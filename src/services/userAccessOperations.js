// src/services/userAccessOperations.js
//
// Joins the two lists that were previously disconnected.
//
// THE PROBLEM THIS SOLVES (task 1.6):
// `user_roles` is a list of ACCOUNTS (an email plus some permissions).
// `employees` is a list of PEOPLE (a name, a SAP number, a department).
// They are related only by `linkedUserUid` on the employee record, and nothing
// in the app read that link in the access-management direction. So HR saw a
// list of email addresses and had to work out who each one belonged to.
//
// This module reads both, subscribes to both, and returns a joined view so
// access can be granted BY PERSON rather than by guessing from an address.
//
// NOTE ON PRIVILEGE: elevation must never be able to mint a god-mode account.
// `mayGrantSuperAdmin` lives in UserManagement.jsx because it is a UI concern;
// every write here refuses to set systemRole at all. Callers grant department
// and approval roles; super_admin is the founder's decision alone.

import { db } from '../config/firebase';
import {
  collection, doc, setDoc, updateDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { subscribeToEmployees } from './employeeOperations';

const ROLES_COLLECTION = 'user_roles';

// ─── Reads ──────────────────────────────────────────────────────────────────

function toRow(docSnap) {
  return { id: docSnap.id, ...docSnap.data() };
}

// Live view of every role document, for joining against the employee list.
export function subscribeToUserRoles(callback) {
  return onSnapshot(collection(db, ROLES_COLLECTION), (snapshot) => {
    callback(snapshot.docs.map(toRow));
  }, (error) => {
    // permission-denied is expected when auth is mid-resolve; stay quiet so
    // the console is not littered on every render.
    if (error?.code !== 'permission-denied') console.error('Error reading user roles:', error);
    callback([]);
  });
}

// Joins employees with their access, plus a list of accounts that belong to no
// employee (created via the Add User form, or HR itself).
//
// Returns { people, unlinked, employees, roles, ready }.
export function subscribeToAccessView(callback) {
  let employees = [];
  let roles = [];
  let ready = false;
  let lastEmployees = null;

  const emit = () => {
    if (lastEmployees === null) return; // employees not loaded yet
    const rolesByUid = new Map(roles.map(r => [r.id, r]));

    const people = employees.map((emp) => {
      const role = emp.linkedUserUid ? rolesByUid.get(emp.linkedUserUid) : null;
      return {
        ...emp,
        role: role || null,
        hasLogin: !!emp.linkedUserUid && !!role,
        // A login whose role document has vanished (deleted out of band) must
        // still read as broken, not as "no login".
        loginBroken: !!emp.linkedUserUid && !role,
        accessSummary: summariseAccess(role),
      };
    });

    // Accounts with no employee record: they can use the factory but have no
    // HR record, so no leave. Surfaced rather than hidden.
    const linkedUids = new Set(employees.map(e => e.linkedUserUid).filter(Boolean));
    const unlinked = roles.filter(r => !linkedUids.has(r.id));

    callback({ people, unlinked, employees, roles, ready });
  };

  const unsubEmployees = subscribeToEmployees((list) => {
    lastEmployees = list;
    employees = list;
    ready = true;
    emit();
  });
  const unsubRoles = subscribeToUserRoles((list) => {
    roles = list;
    emit();
  });

  return () => { unsubEmployees(); unsubRoles(); };
}

function summariseAccess(role) {
  if (!role) return null;
  const depts = role.departmentRoles || [];
  const actions = role.actionRoles || [];
  const isSuper = role.systemRole === 'super_admin' || role.role === 'admin';
  return {
    isSuper,
    isLeaveOnly: !!role.restrictedToOwnLeave && depts.length === 0,
    deptCount: depts.length,
    actionCount: actions.length,
    // "None" is the honest label for an account that can do nothing yet.
    label: isSuper
      ? 'Super Admin'
      : depts.length === 0 && actions.length === 0
        ? 'No access yet'
        : [depts.length ? `${depts.length} dept` : null, actions.length ? `${actions.length} approval` : null]
            .filter(Boolean).join(' · '),
  };
}

// ─── Writes ────────────────────────────────────────────────────────────────

// Grants or changes an EXISTING login's department and approval roles.
//
// Deliberately never touches systemRole — see the privilege note at the top of
// this file.
export async function updateUserAccess(uid, { departmentRoles = [], actionRoles = [] }, updatedBy) {
  if (!uid) return { ok: false, error: 'No account selected.' };
  const hasRealRoles = departmentRoles.length > 0;
  try {
    await updateDoc(doc(db, ROLES_COLLECTION, uid), {
      departmentRoles,
      actionRoles,
      // Clear the leave-only flag the moment real access is granted. Without
      // this a promoted user keeps a flag asserting they are still restricted.
      restrictedToOwnLeave: !hasRealRoles,
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    });
    return { ok: true };
  } catch (error) {
    console.error('Error updating user access:', error);
    return { ok: false, error: error.message };
  }
}

// Keeps the employee's own record in step when an account's email changes.
//
// Without this the roster shows a stale address forever, because nothing else
// writes email back onto the employee record.
export async function syncEmailToEmployee(employeeId, email, updatedBy) {
  if (!employeeId || !email) return { ok: false, error: 'Nothing to sync.' };
  try {
    await updateDoc(doc(db, 'employees', employeeId), {
      email: String(email).trim().toLowerCase(),
      linkedUserEmail: String(email).trim().toLowerCase(),
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    });
    return { ok: true };
  } catch (error) {
    console.error('Error syncing email to employee:', error);
    return { ok: false, error: error.message };
  }
}

// Keeps the employee's name in step when an account's name is corrected.
export async function syncNameToEmployee(employeeId, { firstName, lastName }, updatedBy) {
  if (!employeeId) return { ok: false, error: 'Nothing to sync.' };
  const first = String(firstName || '').trim().toLowerCase();
  const last = String(lastName || '').trim().toLowerCase();
  try {
    await updateDoc(doc(db, 'employees', employeeId), {
      firstName: first,
      lastName: last,
      fullName: first && last ? `${first} ${last}` : (first || last || ''),
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || null,
    });
    return { ok: true };
  } catch (error) {
    console.error('Error syncing name to employee:', error);
    return { ok: false, error: error.message };
  }
}

// Attaches an already-created account to an employee record.
//
// Used by the Add User form so there is only ONE way in: an account with no
// employee link can still be created for a non-employee (an IT contractor, or
// the founder), but it is then visible in the "No employee record" list rather
// than being invisible.
export async function linkAccountToEmployee(employeeId, { uid, email }) {
  if (!employeeId || !uid) return { ok: false, error: 'Nothing to link.' };
  try {
    await setDoc(doc(db, 'employees', employeeId), {
      linkedUserUid: uid,
      linkedUserEmail: String(email || '').trim().toLowerCase(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (error) {
    console.error('Error linking account to employee:', error);
    return { ok: false, error: error.message };
  }
}