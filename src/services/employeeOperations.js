// src/services/employeeOperations.js
//
// Data layer for the HR employee master record.
//
// WHY THIS FILE EXISTS (for the next developer):
// The app's `user_roles` collection is a DOOR-KEY list — it stores who can log
// in and what they may do. It has no SAP number, job title, department or
// shift, and it cannot describe someone who never logs in at all (a cleaner
// handing over at end of shift, a driver signing a delivery note).
//
// Leave Management needs all of those fields. So employees live here, in their
// own collection, keyed by a GENERATED employeeId rather than the Firebase
// UID. A login is optional and merely *linked* to the record.
//
// The consequence that matters: a leave request can be filed against an
// employee record with no login at all, and it still belongs to that person,
// draws on their balance and appears in their history.
//
// Data shape: see the blueprint document, section 11.

import { db } from '../config/firebase';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp, orderBy
} from 'firebase/firestore';
// setDoc and deleteDoc are imported above and reused by the login helpers.

const COLLECTION = 'employees';

export const EMPLOYMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

// SAP numbers are typed by humans in a hurry. Without normalisation
// `st-0421`, `ST-0421` and ` ST-0421 ` become three different people.
export function normaliseSapNumber(sap) {
  return String(sap ?? '').trim().toUpperCase();
}

export function normaliseEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

// Derive the display name once so every screen agrees on it.
export function buildFullName(firstName, lastName) {
  const first = String(firstName ?? '').trim();
  const last = String(lastName ?? '').trim();
  if (first && last) return `${first} ${last}`;
  return first || last || '';
}

function toEmployee(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getEmployee(employeeId) {
  if (!employeeId) return null;
  try {
    const docSnap = await getDoc(doc(db, COLLECTION, employeeId));
    return docSnap.exists() ? toEmployee(docSnap) : null;
  } catch (error) {
    console.error('Error getting employee:', error);
    return null;
  }
}

export async function getEmployeeBySapNumber(sap) {
  const normalised = normaliseSapNumber(sap);
  if (!normalised) return null;
  try {
    const q = query(collection(db, COLLECTION), where('sapNumber', '==', normalised));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return toEmployee(snap.docs[0]);
  } catch (error) {
    console.error('Error finding employee by SAP number:', error);
    return null;
  }
}

// Used by AuthContext to link a signed-in user to their HR record.
// Matches either the linked email (normalised) or an already-linked UID,
// because a record may have been created before the person ever logged in.
export async function getEmployeeByLinkedIdentity({ email, uid }) {
  const normalisedEmail = normaliseEmail(email);
  if (!normalisedEmail && !uid) return null;
  try {
    const constraints = [];
    if (uid) constraints.push(where('linkedUserUid', '==', uid));
    else constraints.push(where('linkedUserEmail', '==', normalisedEmail));

    const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
    if (!snap.empty) return toEmployee(snap.docs[0]);

    // Fall back to the employee's own contact email. Someone registered
    // themselves before HR had time to link the record by hand.
    if (normalisedEmail) {
      const byContact = await getDocs(
        query(collection(db, COLLECTION), where('email', '==', normalisedEmail)),
      );
      if (!byContact.empty) return toEmployee(byContact.docs[0]);
    }
    return null;
  } catch (error) {
    console.error('Error finding employee by identity:', error);
    return null;
  }
}

// ─── Live subscriptions ─────────────────────────────────────────────────────

export function subscribeToEmployees(callback) {
  const q = query(collection(db, COLLECTION), orderBy('fullName', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(toEmployee));
  }, (error) => {
    console.error('Error subscribing to employees:', error);
    callback([]);
  });
}

export function subscribeToEmployee(employeeId, callback) {
  if (!employeeId) return () => {};
  return onSnapshot(doc(db, COLLECTION, employeeId), (docSnap) => {
    callback(docSnap.exists() ? toEmployee(docSnap) : null);
  }, (error) => {
    console.error('Error subscribing to employee:', error);
    callback(null);
  });
}

// ─── Writes ─────────────────────────────────────────────────────────────────

// DUPLICATE SAP GUARD.
// A duplicate would split one person's leave history across two records, and
// that kind of bug never announces itself — both records look fine.
export async function isSapNumberTaken(sapNumber, exceptEmployeeId = null) {
  const existing = await getEmployeeBySapNumber(sapNumber);
  return !!existing && existing.id !== exceptEmployeeId;
}

export async function createEmployee(data, createdBy) {
  const firstName = String(data.firstName ?? '').trim().toLowerCase();
  const lastName = String(data.lastName ?? '').trim().toLowerCase();
  const sapNumber = normaliseSapNumber(data.sapNumber);

  if (!firstName) return { ok: false, error: 'First name is required.' };
  if (!lastName) return { ok: false, error: 'Last name is required.' };
  if (!sapNumber) return { ok: false, error: 'SAP number is required.' };
  if (!data.department) return { ok: false, error: 'Department is required.' };

  if (await isSapNumberTaken(sapNumber)) {
    return { ok: false, error: `SAP number ${sapNumber} already belongs to another employee.` };
  }

  try {
    const payload = {
      employeeId: data.employeeId || null, // filled in below from the doc id
      sapNumber,
      firstName,
      lastName,
      fullName: buildFullName(firstName, lastName),
      cadreDesignation: String(data.cadreDesignation ?? '').trim(),
      department: data.department,
      departmentLabel: data.departmentLabel || data.department,
      shift: data.shift || 'DAY',
      phone: String(data.phone ?? '').trim(),
      email: normaliseEmail(data.email),
      address: String(data.address ?? '').trim(),
      dateJoined: data.dateJoined || null,
      employmentStatus: data.employmentStatus || EMPLOYMENT_STATUS.ACTIVE,
      linkedUserUid: data.linkedUserUid || null,
      linkedUserEmail: data.linkedUserEmail ? normaliseEmail(data.linkedUserEmail) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: createdBy || null,
      updatedBy: createdBy || null,
    };

    const created = await addDoc(collection(db, COLLECTION), payload);
    // Mirror the generated doc id into the record so the identifier can be
    // read without a document fetch.
    await setDoc(doc(db, COLLECTION, created.id), { employeeId: created.id }, { merge: true });
    return { ok: true, id: created.id };
  } catch (error) {
    console.error('Error creating employee:', error);
    return { ok: false, error: error.message };
  }
}

export async function updateEmployee(employeeId, patch, updatedBy) {
  if (!employeeId) return { ok: false, error: 'No employee selected.' };

  const clean = { ...patch };

  if (patch.sapNumber !== undefined) {
    const sapNumber = normaliseSapNumber(patch.sapNumber);
    if (!sapNumber) return { ok: false, error: 'SAP number is required.' };
    if (await isSapNumberTaken(sapNumber, employeeId)) {
      return { ok: false, error: `SAP number ${sapNumber} already belongs to another employee.` };
    }
    clean.sapNumber = sapNumber;
  }

  if (patch.firstName !== undefined) clean.firstName = String(patch.firstName).trim().toLowerCase();
  if (patch.lastName !== undefined) clean.lastName = String(patch.lastName).trim().toLowerCase();

  // Keep the derived name consistent with whatever the parts now say.
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    const current = await getEmployee(employeeId);
    clean.fullName = buildFullName(
      clean.firstName ?? current?.firstName,
      clean.lastName ?? current?.lastName,
    );
  }

  if (patch.email !== undefined) clean.email = normaliseEmail(patch.email);
  if (patch.linkedUserEmail !== undefined) {
    clean.linkedUserEmail = patch.linkedUserEmail ? normaliseEmail(patch.linkedUserEmail) : null;
  }
  if (patch.linkedUserUid !== undefined) clean.linkedUserUid = patch.linkedUserUid || null;

  // Never let an edit wipe the person's identity silently.
  clean.updatedAt = serverTimestamp();
  clean.updatedBy = updatedBy || null;

  try {
    await updateDoc(doc(db, COLLECTION, employeeId), clean);
    return { ok: true };
  } catch (error) {
    console.error('Error updating employee:', error);
    return { ok: false, error: error.message };
  }
}

// Prefer deactivating over deleting. Leave history and balances must survive
// someone leaving the company — deleting the record would orphan them.
export async function deactivateEmployee(employeeId, updatedBy) {
  return updateEmployee(employeeId, { employmentStatus: EMPLOYMENT_STATUS.INACTIVE }, updatedBy);
}

export async function reactivateEmployee(employeeId, updatedBy) {
  return updateEmployee(employeeId, { employmentStatus: EMPLOYMENT_STATUS.ACTIVE }, updatedBy);
}

export async function deleteEmployee(employeeId) {
  if (!employeeId) return { ok: false, error: 'No employee selected.' };
  try {
    await deleteDoc(doc(db, COLLECTION, employeeId));
    return { ok: true };
  } catch (error) {
    console.error('Error deleting employee:', error);
    return { ok: false, error: error.message };
  }
}

// ─── Restricted login creation (task 1.5) ─────────────────────────────────
//
// WHY THIS LIVES HERE RATHER THAN IN THE ROSTER COMPONENT:
// Creating an account is a security action with three failure modes worth
// handling in exactly one place — the API call, the role document, and
// cleaning up if the second step fails. Doing it in a component means the next
// screen that needs it will copy-paste a slightly different version.

const AUTH_SIGNUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';

// Firebase REST error codes are developer-facing. Translate them before they
// reach HR, because a raw "WEAK_PASSWORD : Password should be at least 6
// characters" is not something to show a manager.
function friendlyAuthError(message) {
  const m = String(message || '');
  if (m.includes('EMAIL_EXISTS')) return 'That email already has an app login. Use "Remove login" on the existing account, or pick a different address.';
  if (m.includes('WEAK_PASSWORD')) return 'Password must be at least 6 characters.';
  if (m.includes('INVALID_EMAIL')) return 'That email address does not look right.';
  if (m.includes('INVALID_PASSWORD')) return 'That password is not accepted.';
  if (m.includes('OPERATION_NOT_ALLOWED')) return 'Email sign-in is switched off for this app. Contact the administrator.';
  if (m.includes('TOO_MANY_ATTEMPTS')) return 'Too many attempts just now. Wait a minute and try again.';
  return m || 'Could not create the login.';
}

// Creates a Firebase Auth account for an employee.
//
// The account is deliberately MINIMAL: it grants access to My Leave and
// nothing else. A cleaner does not need to see QC records, production data or
// reports, so this account must not be able to reach any of them.
//
// Returns { ok, uid, email, error }.
export async function createLoginForEmployee(employee, { password, departmentRoles = [], actionRoles = [], createdBy }) {
  const email = normaliseEmail(employee?.email);
  if (!email) {
    return { ok: false, error: 'This employee has no email address. Add one on their record first.' };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (employee?.linkedUserUid) {
    return { ok: false, error: 'This employee already has an app login.' };
  }

  let uid;
  try {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const response = await fetch(`${AUTH_SIGNUP_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Could not create the account.');
    uid = data.localId;
    if (!uid) throw new Error('The account was created but no user id was returned.');
  } catch (error) {
    // A network failure here is common on a factory floor. Say so plainly
    // rather than showing an exception.
    if (error?.message === 'Failed to fetch' || error?.code === 20) {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  // Write the role document. departmentRoles defaults to empty: the sidebar
  // requires at least one matching role, so an empty array means no factory
  // module is reachable. restrictedToOwnLeave records the intent — and is set
  // false immediately when real roles are granted at creation, so the flag
  // can never assert "leave-only" for a fully-elevated account.
  const hasRealRoles = (departmentRoles || []).length > 0;
  try {
    await setDoc(doc(db, 'user_roles', uid), {
      firstName: String(employee.firstName || '').toLowerCase(),
      lastName: String(employee.lastName || '').toLowerCase(),
      email,
      systemRole: 'standard',
      departmentRoles: departmentRoles || [],
      actionRoles: actionRoles || [],
      restrictedToOwnLeave: !hasRealRoles,
      createdAt: serverTimestamp(),
      createdBy: createdBy || null,
    });
  } catch (error) {
    // Roll the half-created account back rather than leaving an orphaned
    // Firebase user that nobody can see or manage from the app.
    try { await deleteDoc(doc(db, 'user_roles', uid)); } catch { /* best effort */ }
    console.error('Error writing role document:', error);
    return { ok: false, error: 'The account was created but its permissions could not be saved, so it was removed again. Please try once more.' };
  }

  // Complete the link on the employee record.
  const linked = await linkEmployeeToUser(employee.id, { uid, email });
  if (!linked.ok) {
    return { ok: false, error: 'Login created, but the employee record could not be updated. Remove the login and try again.' };
  }

  return { ok: true, uid, email };
}

// Removes an app login WITHOUT touching the employee record.
//
// The person stays an employee. Only the account goes away. Their leave
// history and balances are untouched, because they never lived on the account.
export async function removeLoginFromEmployee(employee) {
  const uid = employee?.linkedUserUid;
  if (!uid) return { ok: false, error: 'This employee has no app login to remove.' };

  // Unlink FIRST. If the delete then fails, we have an orphaned account the
  // employee no longer points at — untidy but harmless. The reverse order
  // would leave an employee pointing at an account HR believes is gone.
  const unlinked = await unlinkEmployeeFromUser(employee.id);
  if (!unlinked.ok) {
    return { ok: false, error: 'Could not update the employee record, so nothing was changed.' };
  }

  try {
    await deleteDoc(doc(db, 'user_roles', uid));
  } catch (error) {
    // Non-fatal: the employee is already unlinked, so the account has no
    // access to anything and can be cleaned up manually.
    console.warn('Login removed from employee, but its role document could not be deleted:', error);
  }

  return { ok: true };
}

// ─── Login linking ──────────────────────────────────────────────────────────

// Called by AuthContext on sign-in. Completes the link in both directions so
// neither side has to be edited by hand.
export async function linkEmployeeToUser(employeeId, { uid, email }) {
  if (!employeeId || !uid) return { ok: false, error: 'Nothing to link.' };
  try {
    await updateDoc(doc(db, COLLECTION, employeeId), {
      linkedUserUid: uid,
      linkedUserEmail: normaliseEmail(email),
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    console.error('Error linking employee to user:', error);
    return { ok: false, error: error.message };
  }
}

// Unlink a login WITHOUT touching the employee record. The person stays an
// employee; only their account goes away. Their leave history is untouched.
export async function unlinkEmployeeFromUser(employeeId) {
  if (!employeeId) return { ok: false, error: 'Nothing to unlink.' };
  try {
    await updateDoc(doc(db, COLLECTION, employeeId), {
      linkedUserUid: null,
      linkedUserEmail: null,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    console.error('Error unlinking employee from user:', error);
    return { ok: false, error: error.message };
  }
}