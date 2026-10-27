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
// Approval writes live in decideLeaveRequest below (task 5.1). The chain
// itself is decided by leaveWorkflow.js — pure, tested, Firebase-free — and
// this module is the ONLY place allowed to apply what it sanctions.
// ─────────────────────────────────────────────────────────────────────────

import { db } from '../config/firebase';
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs, deleteDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, Timestamp, runTransaction,
} from 'firebase/firestore';

import {
  toLocalDate, toDateKey, countWorkingDays, nextWorkingDay, getLeaveYear,
  calculateBalance, sumApprovedDays, proRateEntitlement, applyCarryOver,
  listNonWorkingDaysInRange, describeOverlaps, validateLeaveRequest, getLeaveType,
  spansLeaveYear as spansLeaveYearFlag,
} from './leaveCalculations';

import { pushToQueue, readQueue, writeQueue, clearQueue } from './queueStore';
import {
  currentStageIndex, buildDecisionPatch,
} from './leaveWorkflow';
import { computeRecallDays } from './leaveCalculations';

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
  RECALLED: 'recalled',
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
//
// TWO LISTS, two different questions (fixed 26 Oct 2026):
//   existingRequests  — the proposer's OWN requests, any status. They drive
//                      the taken-days count, the pending-days exposure and
//                      the self-overlap refusal.
//   departmentRequests — OTHER people's approved requests. They drive the
//                      colleague-coverage warning.
// The old signature had one list doing both jobs, which is why the coverage
// warning never fired: the form fed it the proposer's own requests, and the
// overlap scan then excluded exactly those.
export function prepareLeaveRequest(input, { policy, employee, existingRequests = [], departmentRequests = [] }) {
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
    ? describeOverlaps({ leaveCommences: starts, leaveEnds: ends }, departmentRequests, {
        department: employee?.department, employeeId: employee?.id, policy,
      })
    : { overlaps: [], overlapCount: 0, sameDepartment: [], isConflict: false, threshold: 0 };

  // Days already awaiting approval. They commit the balance as surely as
  // approved days do, and the form shows them so the person understands
  // why a seemingly-available request is refused.
  const pendingDays = (existingRequests || [])
    .filter(r => String(r?.status || '').startsWith('pending_'))
    .reduce((sum, r) => sum + (Number(r?.requestedDays) || 0), 0);

  return {
    leaveType, requestedDays, leaveYear, entitlement: entitled, carryOver,
    alreadyTaken, pendingDays, balance, resumptionDate, excludedDays, overlap,
    spansLeaveYear: (starts && ends) ? spansLeaveYearFlag(starts, ends, policy) : false,
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
  policy, employee, existingRequests = [], departmentRequests = [], user, isOnline = true,
}) {
  if (!employee?.id) return { ok: false, error: 'No employee record linked to this login.' };

  const prepared = prepareLeaveRequest(input, { policy, employee, existingRequests, departmentRequests });

  const errors = validateLeaveRequest(
    { ...input, requestedDays: prepared.requestedDays },
    policy,
    {
      balance: prepared.balance,
      existingRequests,
      departmentRequests,
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
    // Days already awaiting approval when this was submitted — the exposure
    // the old snapshot could not see, which is how two healthy-looking
    // requests could jointly overdraw the balance.
    pendingAtRequest: prepared.pendingDays,
    requestedDays: prepared.requestedDays,
    outstandingAfter: prepared.balance.outstandingAfter,
    spansLeaveYear: prepared.spansLeaveYear,

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
export async function syncLeaveRequestQueue() {
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

// Cancelling, and who may.
//
//   The employee   — their OWN request, any time before final approval. No
//                    reason needed; plans change.
//   HR (isHr)      — any pending request (including ones lodged for staff
//                    with no login — until 26 Oct 2026 those were
//                    un-cancellable by anyone but the system owner, because
//                    the only person allowed to cancel could not log in),
//                    and APPROVED requests too, as the authority that can
//                    reverse committed leave — with a required written
//                    reason, because reversing signed-off paid leave is a
//                    decision that must be explainable later.
//   The owner      — everything (isAdmin), as before.
//
// The employee's message for approved leave ("Ask HR to change it") is only
// honest because HR genuinely can.
export async function cancelLeaveRequest(requestId, {
  employeeId, user, policy, isAdmin = false, isHr = false, reason = '',
}) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return { ok: false, error: 'That request no longer exists.' };
  const data = snap.data();

  const isOwner = employeeId && data.employeeId === employeeId;
  if (!isAdmin && !isHr && !isOwner) {
    return { ok: false, error: 'You can only cancel your own request. HR may cancel on request.' };
  }
  if (data.status === LEAVE_STATUS.CANCELLED) {
    return { ok: false, error: 'That request is already cancelled.' };
  }

  const finalStage = policy?.stages?.[policy.stages.length - 1]?.id;
  const finalApproved = data.status === LEAVE_STATUS.APPROVED
    || data.workflow?.[finalStage]?.status === 'approved';

  if (finalApproved && !isAdmin && !isHr) {
    return { ok: false, error: 'This leave has already been approved. Ask HR to change it.' };
  }

  // Once leave has STARTED, cancelling the whole request would erase days
  // that genuinely happened — the ledger would under-count leave actually
  // taken. Recall is the honest tool for calling someone back, and this
  // refusal says so in plain words. Applies to HR and the owner alike:
  // nobody gets to quietly un-take days that were taken.
  if (finalApproved) {
    const start = toLocalDate(data.leaveCommences);
    if (start && new Date() >= start) {
      return {
        ok: false,
        error: 'This leave has already started — recall it instead (Leave Approvals, on the request), so the days already taken stay on the record.',
      };
    }
  }
  if (finalApproved && isHr && !isAdmin && !String(reason || '').trim()) {
    return { ok: false, error: 'Reversing approved leave needs a written reason — it will be recorded on the request.' };
  }

  const byLabel = isHr && !isOwner ? 'HR' : (isAdmin && !isOwner ? 'System owner' : null);
  try {
    const patch = {
      status: LEAVE_STATUS.CANCELLED,
      cancelledAt: serverTimestamp(),
      cancelledBy: user?.email || null,
      updatedAt: serverTimestamp(),
    };
    if (byLabel) patch.cancelledByRole = byLabel;
    if (String(reason || '').trim()) patch.cancelledReason = String(reason).trim();
    await updateDoc(doc(db, COLLECTION, requestId), patch);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Section B of the paper form: the employee confirms on their return, which
// closes the record. Without this, requests stay open forever and HR has
// nothing to reconcile against.
//
// The resumption DATE is enforced in the service, not just hidden in the UI
// (found 26 Oct 2026): the My Leave screen only shows the button when the
// return date has arrived, but the service itself would happily close a
// record for leave that has not happened. HR (isHr) may still close early —
// a genuine early return is an HR decision, recorded with who made it.
export async function confirmResumption(requestId, { employeeId, user, note = '', isHr = false }) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return { ok: false, error: 'That request no longer exists.' };
  const data = snap.data();

  if (!isHr && data.employeeId !== employeeId) {
    return { ok: false, error: 'You can only confirm your own leave. HR may close a record early.' };
  }
  if (data.status !== LEAVE_STATUS.APPROVED) {
    return { ok: false, error: 'Only approved leave can be confirmed.' };
  }
  if (data.closedAt) return { ok: false, error: 'That leave is already closed.' };

  if (!isHr) {
    const back = data.resumptionDate?.toDate ? data.resumptionDate.toDate() : toLocalDate(data.resumptionDate);
    if (back && new Date() < back) {
      return {
        ok: false,
        error: 'This leave has not ended yet — confirm your return on or after the resumption date. If you returned early, ask HR to close the record.',
      };
    }
  }

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

// ─── Recall from leave (27 Oct 2026) ────────────────────────────────────────
//
// The honest tool for "come back to work": leave that already started is cut
// short, and only the days actually taken stay counted.
//
//   Cancelling an in-progress request would have erased them — the company
//   would under-count leave that genuinely happened, and at year end the
//   numbers would quietly lie. Recall closes the record at the point of
//   return instead:
//
//     daysConsumed = working days from the start through the day before the
//                    return (holidays inside the stretch uncharged, as booked)
//     daysReturned = the rest, back in the balance immediately — there is no
//                    counter to unwind, balances are derived from this history
//
// The service computes the arithmetic; HR records two things and two only —
// the return date and a written reason. The request keeps its status as a
// RECALLED record: the leave happened, then stopped, and must never be
// mistaken for "never approved".
export async function recallFromLeave(requestId, {
  returnedOn, reason, user, policy, isHr = false, isAdmin = false,
}) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return { ok: false, error: 'That request no longer exists.' };
  const data = snap.data();

  if (!isHr && !isAdmin) {
    return { ok: false, error: 'Only HR or the system owner may recall someone from leave.' };
  }
  if (data.status !== LEAVE_STATUS.APPROVED) {
    return { ok: false, error: 'Only approved leave in progress can be recalled. For a request that has not started, cancel it instead.' };
  }
  if (!String(reason || '').trim()) {
    return { ok: false, error: 'A recall needs a written reason — it is recorded on the request.' };
  }

  const start = toLocalDate(data.leaveCommences);
  const today = new Date();
  if (!start || today < start) {
    return { ok: false, error: 'This leave has not started yet — cancel it instead, and the full balance returns.' };
  }

  const computed = computeRecallDays({
    leaveCommences: data.leaveCommences,
    leaveEnds: data.leaveEnds,
    returnedOn: returnedOn || today,
    requestedDays: data.requestedDays,
    policy,
  });
  if (!computed) return { ok: false, error: 'The request has no dates to recall from.' };

  // The return date must fall inside the leave's own calendar, and cannot be
  // in the future — nobody records a recall for a return that has not
  // happened. The first day of leave is the earliest possible return.
  const back = toLocalDate(returnedOn || today);
  if (back < start) {
    return { ok: false, error: 'The return date cannot be before the leave started.' };
  }
  if (back > today) {
    return { ok: false, error: 'The return date cannot be in the future.' };
  }

  try {
    await updateDoc(doc(db, COLLECTION, requestId), {
      status: LEAVE_STATUS.RECALLED,
      daysConsumed: computed.daysConsumed,
      daysReturned: computed.daysReturned,
      effectiveEnd: computed.effectiveEnd,
      returnedOn: back,
      recalledAt: serverTimestamp(),
      recalledBy: user?.email || null,
      recallReason: String(reason).trim(),
      // The record closes at recall: the return has happened, so the
      // employee must not be asked to confirm it again later.
      resumedOn: back,
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: user?.email || null,
    });
    return { ok: true, daysConsumed: computed.daysConsumed, daysReturned: computed.daysReturned };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// ─── Decisions (task 5.1) ───────────────────────────────────────────────────

// Applies an approve/reject decision to the CURRENT stage of a request.
//
// WHY THIS IS A TRANSACTION AND NOT read-then-write:
// two approvers — say the supervisor and the Head of HR stepping in early —
// can both see "awaiting supervisor" and both press Approve within the same
// second. A plain updateDoc would apply both patches; the second would
// silently overwrite the first's audit record and the chain would show the
// wrong person as having signed. runTransaction re-reads the request inside
// the transaction and refuses to apply a patch built against stale state,
// so the loser gets a clear "already decided" instead of corrupting the
// record of who authorised paid leave.
//
// WHY THERE IS NO OFFLINE PATH:
// an approval authorises someone's PAID LEAVE. If it sat in localStorage
// until Wi-Fi returned, then for a while the official record of who approved
// paid leave would not exist. That is the one deliberate exception to this
// app's offline-first rule (blueprint section 10) — the UI disables the
// buttons when offline, and this function double-checks, so nobody can
// "fix" the gap from a console.
export async function decideLeaveRequest(requestId, { decision, note = '', user, policy, isOnline = true }) {
  if (!requestId) return { ok: false, error: 'No request selected.' };
  if (!isOnline) {
    return { ok: false, offline: true, error: 'Approval needs a connection. Nothing has been saved — reconnect and try again.' };
  }

  const ref = doc(db, COLLECTION, requestId);

  try {
    const actedAsDeputyFor = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('That request no longer exists.');

      const request = toRequest(snap);
      const stageIndex = currentStageIndex(request, policy);

      // Refuse rather than recompute: a patch built for a different stage is
      // a patch built against a request that has already moved on.
      const built = buildDecisionPatch({ request, policy, decision, note, user, stageIndex });
      if (!built.ok) throw new DecisionError(built.error);

      // Firestore's transaction requires every write to be a serverTimestamp,
      // not the caller-supplied Date the pure engine produced.
      const workflow = {};
      for (const [stageId, entry] of Object.entries(built.patch.workflow)) {
        workflow[stageId] = {
          ...entry,
          actedAt: entry.actedAt ? serverTimestamp() : null,
        };
      }

      tx.update(ref, {
        workflow,
        status: built.patch.status,
        rejectedReason: built.patch.rejectedReason ?? null,
        rejectedBy: built.patch.rejectedBy ?? null,
        rejectedAt: built.patch.rejectedAt ? serverTimestamp() : null,
        fullyApprovedAt: built.patch.fullyApprovedAt ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || null,
      });

      return { stage: built.stage.label, actedAsDeputyFor: built.actedAsDeputyFor, status: built.patch.status };
    });

    return { ok: true, ...actedAsDeputyFor };
  } catch (error) {
    if (error instanceof DecisionError) return { ok: false, error: error.message };
    console.error('[leave] decision failed:', error);
    return { ok: false, error: error.message || 'Could not save that decision.' };
  }
}

// Distinguishes "the chain refused this" (a message worth showing verbatim)
// from a transport failure (worth logging). Both travel as exceptions inside
// the transaction; only the refusal should reach the user word-for-word.
class DecisionError extends Error {
  constructor(message) { super(message); this.name = 'DecisionError'; }
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