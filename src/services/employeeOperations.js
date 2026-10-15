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