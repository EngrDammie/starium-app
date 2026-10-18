// src/services/leaveOperations.js
//
// Data layer for leave requests.
//
// ─────────────────────────────────────────────────────────────────────────
// THE SNAPSHOT RULE — the single most important idea in this module.
//
// When a request is created, the entitlement, days-taken, requested-days and
// outstanding figures are COPIED onto the request document and frozen there
// forever.
//
// Why: suppose HR changes an employee's entitlement from 21 to 24 next
// quarter. If the balance were looked up live, a request approved last month
// would silently start displaying different numbers — and the printed form in
// the cabinet would no longer match what the app shows. Approved records must
// be immutable in their arithmetic, or the system loses trust permanently.
//
// The consequence that shapes the rest of the design: balances are DERIVED from
// the request history (see sumApprovedDays in leaveCalculations.js) rather than
// kept in a mutable counter. The history is the ledger, so there is nothing to
// reconcile at year end and nothing that can drift out of step.
//
// Approval writes are NOT implemented here — they belong to task 5.1, and the
// sequential chain is a separate concern from submission.
// ─────────────────────────────────────────────────────────────────────────

import { db } from '../config/firebase';
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs, deleteDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, Timestamp,
} from 'firebase/firestore';

import {
  toLocalDate, toDateKey, countWorkingDays, nextWorkingDay, getLeaveYear,
  calculateBalance, sumApprovedDays, proRateEntitlement, applyCarryOver,
  listNonWorkingDaysInRange, describeOverlaps, validateLeaveRequest, getLeaveType,
} from './leaveCalculations';

import { pushToQueue, readQueue, writeQueue, clearQueue } from './queueStore';

const COLLECTION = 'leave_requests';
export const LEAVE_QUEUE_KEY = 'starium_leave_request_queue';

// Status values mirror the paper form's Section 3 progression.
export const LEAVE_STATUS = {
  PENDING_SUPERVISOR: 'pending_supervisor',
  PENDING_HOD: 'pending_hod',
  PENDING_HR: 'pending_hr',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// A fresh workflow block with every stage pending. Order is significant — see
// the sequential approval note in the file header of leaveCalculations.js.
export function buildWorkflow(policy) {
  const stages = policy?.stages || [];
  const workflow = {};
  for (const stage of stages) {
    workflow[stage.id] = {
      status: 'pending',
      byName: null, byUid: null, byRole: null,
      actedAt: null, note: null, actedAsDeputyFor: null,
    };
  }
  return workflow;
}

// The status a NEW request takes: the first stage in the chain.
export function initialStatus(policy) {
  const stages = policy?.stages || [];
  return stages[0] ? `pending_${stages[0].id}` : LEAVE_STATUS.PENDING_SUPERVISOR;
}

// ─── Balance preparation ───────────────────────────────────────────────────

// Works out everything the request needs to freeze onto itself, WITHOUT
// writing anything. The form calls this on every date change to show live
// figures; createLeaveRequest calls it again at submit time.
export function prepareLeaveRequest(input, { policy, employee, existingRequests = [] }) {
  const leaveType = getLeaveType(input.leaveType, policy);
  const starts = toLocalDate(input.leaveCommences);
  const ends = toLocalDate(input.leaveEnds);

  const requestedDays = (starts && ends)
    ? countWorkingDays(starts, ends, policy)
    : 0;

  const leaveYear = getLeaveYear(starts || new Date(), policy);

  // Entitlement: pro-rated for new joiners when the policy says so.
  const fullEntitlement = leaveType?.balanceTracked
    ? (leaveType.id === 'casual' ? policy.casualEntitlementDays : policy.annualEntitlementDays)
    : 0;

  const entitled = proRateEntitlement(fullEntitlement, employee?.dateJoined, policy, starts || new Date());

  // Carry-over is the capped remainder of the PREVIOUS leave year. Only
  // computed for balance-tracked types; a non-tracked type has no balance to
  // carry.
  const carryOver = leaveType?.balanceTracked
    ? applyCarryOver(entitled, policy)
    : 0;

  const alreadyTaken = leaveType?.balanceTracked
    ? sumApprovedDays(existingRequests, { employeeId: employee?.id, leaveYear })
    : 0;

  const balance = calculateBalance({
    entitlement: entitled, carryOver, alreadyTaken, requestedDays,
  });

  // Resumption date and the non-working days the staff member will not be
  // charged for — these replace the paper form's hand-written "Public Holidays
  // included (give dates)" line.
  const resumptionDate = ends ? nextWorkingDay(ends, policy) : null;
  const excludedDays = (starts && ends) ? listNonWorkingDaysInRange(starts, ends, policy) : [];

  const overlap = (starts && ends)
    ? describeOverlaps({ leaveCommences: starts, leaveEnds: ends }, existingRequests, {
        department: employee?.department, employeeId: employee?.id,
      })
    : { overlaps: [], overlapCount: 0, sameDepartment: [], isConflict: false };

  return {
    leaveType, requestedDays, leaveYear, entitlement: entitled, carryOver,
    alreadyTaken, balance, resumptionDate, excludedDays, overlap,
  };
}

// ─── Writes ────────────────────────────────────────────────────────────────

// Submits a request. Validates FIRST and refuses to write an invalid request —
// a rejected form that still saved is worse than one that refuses.
//
// `submittedBy` differs from `lodgedFor`: when HR lodges on behalf of someone
// with no login, `lodgedFor` is that employee and the document carries a badge
// so no approver is misled into thinking the employee filed it themselves.
export async function createLeaveRequest(input, {
  policy, employee, existingRequests = [], user, isOnline = true,
}) {
  if (!employee?.id) return { ok: false, error: 'No employee record linked to this login.' };

  const prepared = prepareLeaveRequest(input, { policy, employee, existingRequests });

  const errors = validateLeaveRequest(
    { ...input, requestedDays: prepared.requestedDays },
    policy,
    {
      balance: prepared.balance,
      existingRequests,
      employeeId: employee.id,
      department: employee.department,
    },
  );
  if (errors.length) return { ok: false, error: errors.join(' '), errors };

  const starts = toLocalDate(input.leaveCommences);
  const ends = toLocalDate(input.leaveEnds);

  const doc_ = {
    // Who — mirrored from the employee record so a printed form is never blank
    // even if the roster is edited later.
    employeeId: employee.id,
    employeeName: employee.fullName || '',
    sapNumber: employee.sapNumber || '',
    department: employee.department || '',
    departmentLabel: employee.departmentLabel || '',
    cadreDesignation: employee.cadreDesignation || '',
    shift: employee.shift || 'DAY',

    leaveType: prepared.leaveType?.id || input.leaveType,
    leaveTypeLabel: prepared.leaveType?.label || '',
    purpose: String(input.purpose || '').trim(),
    leaveYear: prepared.leaveYear,

    leaveCommences: starts,
    leaveEnds: ends,
    resumptionDate: prepared.resumptionDate,
    excludedNonWorkingDays: prepared.excludedDays,
    contactAddress: String(input.contactAddress || employee.address || '').trim(),
    contactPhone: String(input.contactPhone || employee.phone || '').trim(),
    contactEmail: String(input.contactEmail || employee.email || '').trim(),

    // THE SNAPSHOT. Frozen at creation; never recomputed.
    entitledAtRequest: prepared.entitlement,
    carryOverAtRequest: prepared.carryOver,
    takenBeforeThisRequest: prepared.alreadyTaken,
    requestedDays: prepared.requestedDays,
    outstandingAfter: prepared.balance.outstandingAfter,

    // Section 2 of the paper form.
    handoverNote: String(input.handoverNote || '').trim(),
    handoverTo: String(input.handoverTo || '').trim(),
    applicantConfirmed: !!input.applicantConfirmed,
    applicantConfirmedName: String(input.applicantConfirmedName || '').trim(),

    status: initialStatus(policy),
    workflow: buildWorkflow(policy),

    // "Lodged by HR" badge, so an approver is never misled.
    lodgedForEmployeeId: input.lodgedOnBehalf ? employee.id : null,
    lodgedBy: input.lodgedOnBehalf ? (user?.email || null) : null,

    // Section B of the paper form, completed on resumption.
    requireResumptionConfirmation: policy?.requireResumptionConfirmation !== false,
    resumedOn: null,
    resumptionNote: null,
    closedAt: null,

    requestedAt: serverTimestamp(),
    requestedBy: user?.email || null,
    rejectedReason: null,
    cancelledAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!isOnline) {
    return queueOffline(doc_, employee);
  }

  try {
    const created = await addDoc(collection(db, COLLECTION), doc_);
    return { ok: true, id: created.id, status: doc_.status, offline: false };
  } catch (error) {
    console.error('[leave] submit failed, queueing:', error);
    // A write failure must not lose the request — queue it exactly like a
    // deliberate offline submit, preserving the original submission time.
    return queueOffline(doc_, employee);
  }
}

function queueOffline(payload, employee) {
  try {
    // Preserve the real submission time. Without this the approval timeline
    // would show the moment it reconnected, not the moment it was written.
    const localCreatedAt = new Date().toISOString();
    pushToQueue(LEAVE_QUEUE_KEY, { ...payload, localCreatedAt, employeeName: employee?.fullName });
    return { ok: true, id: null, status: payload.status, offline: true };
  } catch (error) {
    console.error('[leave] could not queue request:', error);
    return { ok: false, error: 'Could not save this request. Check your connection and try again.' };
  }
}

export function getQueuedLeaveRequests() {
  return readQueue(LEAVE_QUEUE_KEY);
}

// Flushes queued requests. Returns { synced, failed } to match the other
// module sync functions, so the offline registry treats it like any other.
export async function syncLeaveRequestOfflineQueue() {
  const queue = getQueuedLeaveRequests();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let failed = 0;
  const remaining = [];

  for (const payload of queue) {
    try {
      // localCreatedAt is lifted out and converted to a real Date so the approval
      // timeline shows when it was WRITTEN, not when it reconnected. The queued
      // copy of the name is dropped: the document already carries the full one.
      const rest = { ...payload };
      const localCreatedAt = rest.localCreatedAt;
      delete rest.localCreatedAt;
      delete rest.employeeName;

      await addDoc(collection(db, COLLECTION), {
        ...rest,
        requestedAt: localCreatedAt ? new Date(localCreatedAt) : serverTimestamp(),
        syncedAt: serverTimestamp(),
        wasOfflineQueued: true,
      });
    } catch (error) {
      failed += 1;
      remaining.push(payload);
      console.error('[leave] sync failed:', error);
    }
  }

  if (failed === 0) clearQueue(LEAVE_QUEUE_KEY);
  else writeQueue(LEAVE_QUEUE_KEY, remaining);

  return { synced: queue.length - failed, failed };
}

// ─── Cancellation and resumption ───────────────────────────────────────────

// The employee may withdraw their own request until it has been signed by the
// final approver. After that the balance is committed and only HR can change it.
export async function cancelLeaveRequest(requestId, { employeeId, user, policy, isAdmin = false }) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return { ok: false, error: 'That request no longer exists.' };
  const data = snap.data();

  if (!isAdmin && data.employeeId !== employeeId) {
    return { ok: false, error: 'You can only cancel your own request.' };
  }
  if (data.status === LEAVE_STATUS.CANCELLED) {
    return { ok: false, error: 'That request is already cancelled.' };
  }

  const finalStage = policy?.stages?.[policy.stages.length - 1]?.id;
  if (data.workflow?.[finalStage]?.status === 'approved' && !isAdmin) {
    return { ok: false, error: 'This leave has already been approved. Ask HR to change it.' };
  }

  try {
    await updateDoc(doc(db, COLLECTION, requestId), {
      status: LEAVE_STATUS.CANCELLED,
      cancelledAt: serverTimestamp(),
      cancelledBy: user?.email || null,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Section B of the paper form: the employee confirms on their return, which
// closes the record. Without this, requests stay open forever and HR has
// nothing to reconcile against.
export async function confirmResumption(requestId, { employeeId, user, note = '' }) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return { ok: false, error: 'That request no longer exists.' };
  const data = snap.data();

  if (data.employeeId !== employeeId) {
    return { ok: false, error: 'You can only confirm your own leave.' };
  }
  if (data.status !== LEAVE_STATUS.APPROVED) {
    return { ok: false, error: 'Only approved leave can be confirmed.' };
  }
  if (data.closedAt) return { ok: false, error: 'That leave is already closed.' };

  try {
    await updateDoc(doc(db, COLLECTION, requestId), {
      resumedOn: serverTimestamp(),
      resumptionNote: String(note || '').trim(),
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || null,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

function toRequest(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    leaveCommences: data.leaveCommences?.toDate ? data.leaveCommences.toDate() : data.leaveCommences,
    leaveEnds: data.leaveEnds?.toDate ? data.leaveEnds.toDate() : data.leaveEnds,
    resumptionDate: data.resumptionDate?.toDate ? data.resumptionDate.toDate() : data.resumptionDate,
  };
}

export async function getLeaveRequest(requestId) {
  if (!requestId) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, requestId));
    return snap.exists() ? toRequest(snap) : null;
  } catch (error) {
    console.error('[leave] could not read request:', error);
    return null;
  }
}

// Everyone's requests, newest first. HR and managers use this; a filtered
// variant exists for the employee's own view.
export function subscribeToLeaveRequests(callback, { employeeId = null, status = null } = {}) {
  const constraints = [];
  if (employeeId) constraints.push(where('employeeId', '==', employeeId));
  if (status) constraints.push(where('status', '==', status));
  constraints.push(orderBy('requestedAt', 'desc'));

  return onSnapshot(query(collection(db, COLLECTION), ...constraints), (snap) => {
    callback(snap.docs.map(toRequest));
  }, (error) => {
    if (error?.code !== 'permission-denied') console.error('[leave] subscribe failed:', error);
    callback([]);
  });
}

export function subscribeToLeaveRequest(requestId, callback) {
  if (!requestId) return () => {};
  return onSnapshot(doc(db, COLLECTION, requestId), (snap) => {
    callback(snap.exists() ? toRequest(snap) : null);
  }, () => callback(null));
}

// Who is away on a given day. Derived from approved requests rather than a
// separate attendance record that could drift out of step with the history.
export function subscribeToAwayOnDate(date, callback) {
  const key = toDateKey(date);
  if (!key) return () => {};
  const day = toLocalDate(key);
  const dayStart = Timestamp.fromDate(new Date(day.getFullYear(), day.getMonth(), day.getDate()));
  const dayEnd = Timestamp.fromDate(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999));

  return onSnapshot(
    query(collection(db, COLLECTION),
      where('status', '==', LEAVE_STATUS.APPROVED),
      where('leaveCommences', '<=', dayEnd),
      where('leaveEnds', '>=', dayStart)),
    (snap) => callback(snap.docs.map(toRequest)),
    (error) => {
      if (error?.code !== 'permission-denied') console.error('[leave] away-today query failed:', error);
      callback([]);
    },
  );
}

// Admin escape hatch: delete a request outright. Prefer cancel, which keeps
// the audit trail.
export async function deleteLeaveRequest(requestId) {
  try {
    await deleteDoc(doc(db, COLLECTION, requestId));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Requests still awaiting each approval stage, for the approver's queue and for
// the "approver is on leave, no deputy set" warning on task 5.4.
export async function fetchRequestsAwaitingStage(stageId) {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('status', '==', `pending_${stageId}`)),
    );
    return snap.docs.map(toRequest);
  } catch (error) {
    console.error('[leave] stage query failed:', error);
    return [];
  }
}