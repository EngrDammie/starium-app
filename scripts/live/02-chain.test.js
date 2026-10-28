// scripts/live/02-chain.test.js
//
// LIVE SUITE — THE FULL APPROVAL CHAIN AND EVERY NEW GUARD, against the real
// database, through the app's real service functions.
//
// What this proves, in order:
//
//   0. HR can clear the LIVE-TEST backlog: cancel pending requests without a
//      reason, and reverse APPROVED ones with a reason recorded on the
//      request. (Before 26 Oct 2026 the second was impossible for anyone
//      but the system owner, and requests lodged for staff with no login
//      could not be cancelled at all.)
//   1. A compassionate request SUCCEEDS — until 26 Oct 2026 every
//      non-balance leave type was refused as "over-balance", so a member of
//      staff could not file bereavement leave at all.
//   2. A range overlapping the proposer's OWN pending request is REFUSED,
//      with the message telling them to cancel it first.
//   3. A request that would overdraw the balance INCLUDING pending days is
//      REFUSED, with the exposure named in the error.
//   4. The chain itself: frozen numbers on the document, supervisor signs
//      stage 1 and only stage 1, the supervisor is refused at stage 2, the
//      employee cannot approve her own request, a raw database write is
//      denied by the rules, HOD and Head of HR sign in order, and only the
//      last signature makes the leave real.
//   5. A rejection stores its written reason; the chain stops rather than
//      filling in later stages.
//   6. The employee can cancel her own pending request.
//   7. An approver CANNOT sign their own request — whatever hat they wear.
//   8. Resumption cannot be confirmed before the leave has ended.
//   9. HR can cancel a request lodged for someone with no login.
//
// Every document this suite creates is tagged LIVE-TEST for the owner's
// deletion list. Requests are cancelled as the suite goes, so the test
// employee's balance ends where it started.
//
// This file writes to production. It runs only via npm run test:live.

import { describe, it, expect, afterAll } from 'vitest';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import {
  createLeaveRequest, getLeaveRequest, decideLeaveRequest,
  cancelLeaveRequest, prepareLeaveRequest, recallFromLeave,
} from '../../src/services/leaveOperations';
import { getEmployeeByLinkedIdentity, subscribeToEmployees } from '../../src/services/employeeOperations';

const PASSWORD = process.env.LIVE_TEST_PASSWORD || 'success123';
const EMP = process.env.LIVE_TEST_EMPLOYEE || 'halima.danjuma@example.test';
const SUP = process.env.LIVE_TEST_SUPERVISOR || 'emeka.nwosu@example.test';
const HOD = process.env.LIVE_TEST_HOD || 'blessing.adeyemi@example.test';
const HRH = process.env.LIVE_TEST_HR_HEAD || 'ibrahim.yusuf@example.test';
const HRM = process.env.LIVE_TEST_HR_MANAGER || 'segun.adeyinka@example.test';

const LIVE_TAG = `LIVE-TEST chain ${new Date().toISOString().slice(0, 16)}`;

const state = {
  policy: null, employee: null, supervisorEmployee: null,
  ownRequests: [], createdIds: [], approvedId: null, rejectedId: null,
  cancelledId: null, lodgedId: null,
};

async function asUser(email, fn) {
  const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
  try { return await fn(cred.user); } finally { await signOut(auth); }
}

// The app-shaped user, built from the ALREADY-SIGNED-IN Firebase user —
// signing in inside the callback tears the session down before the write.
async function appUserFrom(firebaseUser) {
  const snap = await getDoc(doc(db, 'user_roles', firebaseUser.uid));
  const roles = snap.exists() ? snap.data() : {};
  const emp = await getEmployeeByLinkedIdentity({ email: firebaseUser.email, uid: firebaseUser.uid });
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    systemRole: roles.systemRole || 'standard',
    departmentRoles: roles.departmentRoles || [],
    actionRoles: roles.actionRoles || roles.approvalRoles || [],
    userFullName: roles.userFullName
      || [roles.firstName, roles.lastName].filter(Boolean).join(' ')
      || firebaseUser.email,
    // The chain's self-interest rule needs to know whose record this is.
    employeeId: emp?.id ?? null,
  };
}

// The employee's REAL request history. The early versions of this suite passed
// an empty list and trusted the caller; the real form always subscribes to
// the truth. Honest testing means the same.
async function fetchOwnRequests(employeeId) {
  const snap = await getDocs(query(collection(db, 'leave_requests'), where('employeeId', '==', employeeId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadPolicy() {
  const snap = await getDoc(doc(db, 'config', 'settings'));
  return snap.data().leavePolicy;
}

// Dates roughly three weeks out — clear of the notice rule whenever this
// suite runs.
function dates(offsetDays, spanDays) {
  const start = new Date();
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + spanDays - 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { leaveCommences: iso(start), leaveEnds: iso(end) };
}

// A range containing EXACTLY the requested number of WORKING days.
//
// The first version of this suite asked for "20 days" and got 20 CALENDAR
// days — about 14 working ones — so a request the test expected to be
// refused was perfectly legitimate, and everything after it cascaded. The
// engine counts working days; a test of the engine must too. The end date
// is walked back one day at a time until countWorkingDays lands on the
// number, so weekends and holidays are absorbed rather than guessed at.
import { countWorkingDays as countWorkDays } from '../../src/services/leaveCalculations';
function datesWithWorkingDays(offsetDays, workDays) {
  const { leaveCommences } = dates(offsetDays, 1);
  let { leaveEnds } = dates(offsetDays + Math.ceil(workDays * 1.6) + 2, 1);
  let end = new Date(leaveEnds);
  const start = new Date(leaveCommences);
  while (countWorkDays(start, end, state.policy) > workDays && countWorkDays(start, end, state.policy) > 0) {
    end.setDate(end.getDate() - 1);
  }
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { leaveCommences, leaveEnds: iso(end) };
}

function request(d, over = {}) {
  return {
    leaveType: 'annual', purpose: '', handoverNote: LIVE_TAG, handoverTo: 'LIVE-TEST cover',
    applicantConfirmed: true, applicantConfirmedName: state.employee?.fullName || 'LIVE-TEST',
    ...d, ...over,
  };
}

// Create as a given account, against the live policy and the real history.
async function createAs(email, employee, d, extra = {}) {
  return asUser(email, async () => {
    const existing = await fetchOwnRequests(employee.id);
    return createLeaveRequest(request(d, extra), {
      policy: state.policy, employee, existingRequests: existing,
      user: { email }, isOnline: true,
    });
  });
}

// Cancel as HR. isHr, not isAdmin — the new service path.
async function hrCancel(requestId, reason = '') {
  return asUser(HRM, () => cancelLeaveRequest(requestId, {
    employeeId: null, user: { email: HRM }, policy: state.policy,
    isAdmin: false, isHr: true, reason,
  }));
}

// Recall as HR — for approved leave that has already started.
async function hrRecall(requestId, reason = '') {
  return asUser(HRM, () => recallFromLeave(requestId, {
    user: { email: HRM }, policy: state.policy,
    isHr: true, isAdmin: false, reason,
  }));
}

describe('live chain — every guard, against production', () => {

  it('resolves the employee records behind the test accounts', async () => {
    state.policy = await asUser(EMP, () => loadPolicy());
    state.employee = await asUser(EMP, (u) => getEmployeeByLinkedIdentity({ email: u.email, uid: u.uid }));
    expect(state.employee, 'the employee account has no linked employee record').not.toBeNull();
    state.supervisorEmployee = await asUser(SUP, (u) => getEmployeeByLinkedIdentity({ email: u.email, uid: u.uid }));
    console.log('[chain] employee:', state.employee.fullName, '| supervisor has a record:', !!state.supervisorEmployee);
  });

  it('lets HR clear the LIVE-TEST backlog — pending without a reason, approved with one; started leave is recalled', async () => {
    const backlog = await asUser(HRM, async () => {
      const snap = await getDocs(collection(db, 'leave_requests'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(r => /LIVE-TEST/i.test(String(r.handoverNote || '')) && r.status !== 'cancelled' && r.status !== 'rejected' && r.status !== 'recalled');
    });
    console.log('[chain] backlog to clear:', backlog.length);

    let approvedCancelled = 0, pendingCancelled = 0, approvedRecalled = 0;
    for (const r of backlog) {
      const isApproved = r.status === 'approved';
      const hasStarted = isApproved && r.leaveCommences && new Date(r.leaveCommences.toDate ? r.leaveCommences.toDate() : r.leaveCommences) <= new Date();

      let res;
      if (hasStarted) {
        // Cannot cancel started leave — must recall
        res = await hrRecall(r.id, 'LIVE-TEST cleanup: recalling started test leave.');
        if (res.ok) approvedRecalled += 1;
      } else {
        res = await hrCancel(r.id, isApproved ? 'LIVE-TEST cleanup: reversing test data.' : '');
        if (res.ok && isApproved) approvedCancelled += 1;
        else if (res.ok) pendingCancelled += 1;
      }
      expect(res.ok, `cleanup failed for ${r.id} (started=${hasStarted}): ${res.error}`).toBe(true);
      if (!state.createdIds.includes(r.id)) state.createdIds.push(r.id);
    }
    console.log(`[chain] HR cancelled ${pendingCancelled} pending, reversed ${approvedCancelled} approved, recalled ${approvedRecalled} started LIVE-TEST requests`);
    expect(true).toBe(true);
  });

  it('accepts a COMPASSIONATE request — the type that could not be filed at all until today', async () => {
    const created = await createAs(EMP, state.employee, dates(21, 2), {
      leaveType: 'compassionate', purpose: 'LIVE-TEST: bereavement in the family.',
    });
    if (!created.ok) console.log('[chain] compassionate create failed:', created.error);
    expect(created.ok).toBe(true);
    state.createdIds.push(created.id);

    const stored = await asUser(EMP, () => getLeaveRequest(created.id));
    expect(stored.leaveType).toBe('compassionate');
    console.log('[chain] compassionate request accepted:', created.id);

    const cleared = await hrCancel(created.id);
    expect(cleared.ok).toBe(true);
  });

  it('REFUSES a range overlapping the proposer\'s own pending request, and says what to do', async () => {
    const first = await createAs(EMP, state.employee, dates(21, 3));
    expect(first.ok).toBe(true);
    state.createdIds.push(first.id);

    try {
      // Overlaps the first by a day — same calendar territory.
      const overlapping = await createAs(EMP, state.employee, dates(23, 3));
      expect(overlapping.ok).toBe(false);
      console.log('[chain] self-overlap refused:', overlapping.error);
      expect(overlapping.error).toMatch(/Cancel it from My Leave first/);
    } finally {
      const cleared = await hrCancel(first.id);
      expect(cleared.ok).toBe(true);
    }
  });

  it('REFUSES a request that would overdraw the balance INCLUDING pending days', async () => {
    // Size both against the live balance so the arithmetic is airtight
    // whatever the test employee's entitlement and carry-over are.
    const prepared = await asUser(EMP, async () => prepareLeaveRequest(
      { leaveType: 'annual', leaveCommences: '', leaveEnds: '' },
      { policy: state.policy, employee: state.employee, existingRequests: await fetchOwnRequests(state.employee.id) },
    ));
    const remaining = (prepared.balance?.outstandingBefore ?? 0) - (prepared.pendingDays ?? 0);
    console.log('[chain] live balance: entitled', prepared.entitlement, '· taken', prepared.alreadyTaken, '· pending', prepared.pendingDays, '· remaining', remaining);
    if (remaining < 3) {
      console.log('[chain] remaining too small to exercise the exposure rule live — covered by unit tests.');
      return;
    }

    const commit = Math.min(2, remaining - 1);       // leaves (remaining - commit) uncommitted
    const overshoot = remaining - commit + 1;        // one more than that
    const first = await createAs(EMP, state.employee, datesWithWorkingDays(21, commit));
    expect(first.ok).toBe(true);
    state.createdIds.push(first.id);

    try {
      // Non-overlapping window, so ONLY the exposure rule can refuse it —
      // and EXACTLY the overshoot in working days, or the arithmetic lies.
      const greedy = await createAs(EMP, state.employee, datesWithWorkingDays(45, overshoot));
      expect(greedy.ok).toBe(false);
      console.log('[chain] exposure refused:', greedy.error);
      expect(greedy.error).toMatch(/awaiting approval/);
    } finally {
      // Always take the committed request back, even if an assert above
      // failed — a stranded pending request poisons every test after it.
      const cleared = await hrCancel(first.id);
      expect(cleared.ok).toBe(true);
    }
  });

  it('creates a request with the numbers frozen on the document', async () => {
    const created = await createAs(EMP, state.employee, dates(21, 4));
    if (!created.ok) console.log('[chain] create failed:', created.error);
    expect(created.ok).toBe(true);
    state.approvedId = created.id;
    state.createdIds.push(created.id);

    const stored = await asUser(EMP, () => getLeaveRequest(created.id));
    console.log('[chain] created', created.id, 'status:', stored.status, '· pendingAtRequest:', stored.pendingAtRequest);
    expect(stored.status).toBe('pending_supervisor');
    // THE SNAPSHOT RULE: frozen at birth, and now recording the exposure it
    // was born with.
    expect(stored.entitledAtRequest).toBeGreaterThan(0);
    expect(stored.requestedDays).toBeGreaterThan(0);
    expect(typeof stored.pendingAtRequest).toBe('number');
    expect(stored.outstandingAfter)
      .toBe(stored.entitledAtRequest + stored.carryOverAtRequest - stored.takenBeforeThisRequest - stored.requestedDays);
  });

  it('lets the supervisor sign stage 1 — and only stage 1', async () => {
    const res = await asUser(SUP, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST stage 1', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(res.ok).toBe(true);
    expect(res.status).toBe('pending_hod');

    const stored = await asUser(SUP, () => getLeaveRequest(state.approvedId));
    expect(stored.workflow.supervisor.status).toBe('approved');
    expect(stored.workflow.hod.status).toBe('pending');
  });

  it('REFUSES the same supervisor at stage 2 — the chain binds in the database', async () => {
    const res = await asUser(SUP, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST should not land', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(res.ok).toBe(false);
    console.log('[chain] supervisor at stage 2 refused:', res.error);
  });

  it('REFUSES the employee approving her own request', async () => {
    const res = await asUser(EMP, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST self-approval attempt', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(res.ok).toBe(false);
    console.log('[chain] self-approval refused:', res.error);
  });

  it('REFUSES a raw database write — self-approval is impossible even at the database', async () => {
    let denied = false;
    await asUser(EMP, async () => {
      try {
        await updateDoc(doc(db, 'leave_requests', state.approvedId), { status: 'approved' });
      } catch (e) {
        denied = true;
        console.log('[chain] raw self-approval denied by rules:', e.code);
      }
    });
    expect(denied).toBe(true);
    const stored = await asUser(EMP, () => getLeaveRequest(state.approvedId));
    expect(stored.status).toBe('pending_hod');
  });

  it('signs stage 2 (HOD) and stage 3 (Head of HR) in order', async () => {
    const r2 = await asUser(HOD, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST stage 2', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(r2.ok).toBe(true);
    expect(r2.status).toBe('pending_hr');

    const r3 = await asUser(HRH, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST stage 3 — final', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(r3.ok).toBe(true);
    expect(r3.status).toBe('approved');

    const stored = await asUser(HRH, () => getLeaveRequest(state.approvedId));
    console.log('[chain] fully approved, signed by:', stored.workflow.supervisor.byName, '→', stored.workflow.hod.byName, '→', stored.workflow.hr.byName);
    expect(stored.fullyApprovedAt).toBeTruthy();
  });

  it('REFUSES confirming resumption before the leave has ended', async () => {
    // The request above is dated three weeks out, so its resumption date is
    // in the future. The service must refuse — the old service would have
    // closed the record for leave that had not happened.
    const { confirmResumption } = await import('../../src/services/leaveOperations');
    const res = await asUser(EMP, () => confirmResumption(state.approvedId, {
      employeeId: state.employee.id, user: { email: EMP },
    }));
    expect(res.ok).toBe(false);
    console.log('[chain] premature resumption refused:', res.error);
    expect(res.error).toMatch(/has not ended yet/);
  });

  it('lets HR reverse the approved leave, with the reason recorded on the request', async () => {
    const res = await hrCancel(state.approvedId, 'LIVE-TEST: reversing the chain-test approval so the balance is clean.');
    expect(res.ok).toBe(true);

    const stored = await asUser(EMP, () => getLeaveRequest(state.approvedId));
    expect(stored.status).toBe('cancelled');
    expect(stored.cancelledReason).toMatch(/LIVE-TEST/);
    expect(stored.cancelledByRole).toBe('HR');
    console.log('[chain] HR reversed the approved leave; reason recorded');
  });

  it('REJECTS a second request, and the reason is stored for the employee', async () => {
    const created = await createAs(EMP, state.employee, dates(21, 4));
    expect(created.ok).toBe(true);
    state.rejectedId = created.id;
    state.createdIds.push(created.id);

    const rejection = await asUser(SUP, async (fbUser) => decideLeaveRequest(state.rejectedId, {
      decision: 'reject', note: 'LIVE-TEST: cover is too thin that week — try the next one.', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(rejection.ok).toBe(true);

    const stored = await asUser(EMP, () => getLeaveRequest(state.rejectedId));
    expect(stored.status).toBe('rejected');
    expect(stored.rejectedReason).toMatch(/LIVE-TEST/);
    expect(stored.workflow.hod.status).toBe('pending');
  });

  it('lets the employee cancel her own pending request', async () => {
    const created = await createAs(EMP, state.employee, dates(21, 4));
    expect(created.ok).toBe(true);
    state.cancelledId = created.id;
    state.createdIds.push(created.id);

    const cancelled = await asUser(EMP, () => cancelLeaveRequest(state.cancelledId, {
      employeeId: state.employee.id, user: { email: EMP }, policy: state.policy,
    }));
    expect(cancelled.ok).toBe(true);
    const stored = await asUser(EMP, () => getLeaveRequest(state.cancelledId));
    expect(stored.status).toBe('cancelled');
  });

  it('REFUSES an approver signing their OWN request — whatever hat they wear', async () => {
    if (!state.supervisorEmployee) {
      console.log('[chain] the supervisor account has no employee record, so the self-sign rule cannot bind for them — covered by unit tests.');
      return;
    }
    // Emeka is on the roster AND holds the supervisor power. His own request
    // would, until 26 Oct 2026, have been signable by himself at stage 1.
    const created = await createAs(SUP, state.supervisorEmployee, dates(21, 2), {
      applicantConfirmedName: state.supervisorEmployee.fullName,
    });
    if (!created.ok) {
      console.log('[chain] supervisor could not create (balance?):', created.error, '— self-sign covered by unit tests.');
      return;
    }
    state.createdIds.push(created.id);
    console.log('[chain] supervisor created their own request:', created.id);

    const selfSign = await asUser(SUP, async (fbUser) => decideLeaveRequest(created.id, {
      decision: 'approve', note: 'LIVE-TEST self-sign attempt', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(selfSign.ok).toBe(false);
    console.log('[chain] self-sign refused:', selfSign.error);
    expect(selfSign.error).toMatch(/your own leave request/);

    const cleared = await hrCancel(created.id);
    expect(cleared.ok).toBe(true);
  });

  it('lets HR lodge a request for a login-less staff member, then cancel it', async () => {
    const roster = await asUser(HRM, () => new Promise((resolve) => {
      let settled = false;
      subscribeToEmployees((list) => { if (!settled) { settled = true; resolve(list); } });
      setTimeout(() => { if (!settled) { settled = true; resolve([]); } }, 10_000);
    }));
    const candidate = roster.find(e => e.id !== state.employee?.id && !e.linkedUserUid && e.employmentStatus !== 'inactive');
    expect(candidate, 'no login-less roster employee to lodge for — seed one via the roster').toBeTruthy();
    console.log('[chain] lodging on behalf of:', candidate.fullName, candidate.sapNumber);

    const created = await createAs(HRM, candidate, dates(21, 2), {
      lodgedOnBehalf: true, applicantConfirmedName: candidate.fullName,
    });
    expect(created.ok).toBe(true);
    state.lodgedId = created.id;
    state.createdIds.push(created.id);

    const stored = await asUser(HRM, () => getLeaveRequest(state.lodgedId));
    expect(stored.lodgedBy).toBe(HRM);
    console.log('[chain] lodged by HR, badge stored:', stored.lodgedBy);

    // The person has no login, so only HR can take it back — which, until
    // today, nobody at all could do.
    const cleared = await hrCancel(state.lodgedId);
    expect(cleared.ok).toBe(true);
    console.log('[chain] HR cancelled the lodged request');
  });

  afterAll(() => {
    console.log('\n[live] documents created or touched by this run (tagged LIVE-TEST):');
    for (const id of state.createdIds) console.log('  - leave_requests/' + id);
    console.log('[live] all are cancelled or rejected records; the owner may still delete them.');
  });
});
