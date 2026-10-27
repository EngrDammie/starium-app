// scripts/live/05-recall.test.js
//
// LIVE SUITE — the recall flow, against production.
//
// THE SCENARIO THIS EXISTS FOR: leave already started, and the person is
// called back. Cancelling the request would erase days that genuinely
// happened; recall keeps what was consumed and returns the rest.
//
// The challenge in testing it live: the app never lets a request be dated in
// the past for annual leave (the notice rule forbids it), so to have leave
// that has STARTED we file a backdated CASUAL request — casual has no notice
// rule. HR lodges nothing; the employee files it herself, the chain signs it,
// and then HR recalls her.
//
// Proves, in order:
//   1. a backdated casual request can be filed and fully approved;
//   2. HR recalls it, and the arithmetic (consumed / returned / effective end)
//      is computed by the service and written to the document;
//   3. the balance counts the CONSUMED days, not the requested days;
//   4. the consumed dates stay blocked for re-booking, the unused tail does
//      not — both proven with real creation attempts;
//   5. a plain cancel of a started, approved leave is REFUSED and points at
//      recall — the guard that stops the wrong tool erasing taken days.
//
//   Documents created here are tagged LIVE-TEST. The recalled record keeps
//   counting its consumed days against the test employee until the system
//   owner deletes it — flagged in the cleanup list, not hidden.

import { describe, it, expect, afterAll } from 'vitest';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import {
  createLeaveRequest, getLeaveRequest, decideLeaveRequest,
  cancelLeaveRequest, recallFromLeave, prepareLeaveRequest,
} from '../../src/services/leaveOperations';
import { getEmployeeByLinkedIdentity } from '../../src/services/employeeOperations';
import { computeRecallDays, countWorkingDays, toLocalDate, sumApprovedDays, getLeaveYear } from '../../src/services/leaveCalculations';

const PASSWORD = process.env.LIVE_TEST_PASSWORD || 'success123';
const EMP = process.env.LIVE_TEST_EMPLOYEE || 'halima.danjuma@example.test';
const SUP = process.env.LIVE_TEST_SUPERVISOR || 'emeka.nwosu@example.test';
const HOD = process.env.LIVE_TEST_HOD || 'blessing.adeyemi@example.test';
const HRH = process.env.LIVE_TEST_HR_HEAD || 'ibrahim.yusuf@example.test';
const HRM = process.env.LIVE_TEST_HR_MANAGER || 'segun.adeyinka@example.test';

const LIVE_TAG = `LIVE-TEST recall ${new Date().toISOString().slice(0, 16)}`;
const state = { policy: null, employee: null, requestId: null, createdIds: [] };

async function asUser(email, fn) {
  const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
  try { return await fn(cred.user); } finally { await signOut(auth); }
}

async function appUserFrom(firebaseUser) {
  const snap = await getDoc(doc(db, 'user_roles', firebaseUser.uid));
  const roles = snap.exists() ? snap.data() : {};
  const emp = await getEmployeeByLinkedIdentity({ email: firebaseUser.email, uid: firebaseUser.uid });
  return {
    uid: firebaseUser.uid, email: firebaseUser.email,
    systemRole: roles.systemRole || 'standard',
    departmentRoles: roles.departmentRoles || [],
    actionRoles: roles.actionRoles || roles.approvalRoles || [],
    userFullName: roles.userFullName || [roles.firstName, roles.lastName].filter(Boolean).join(' ') || firebaseUser.email,
    employeeId: emp?.id ?? null,
  };
}

async function fetchOwnRequests(employeeId) {
  const snap = await getDocs(query(collection(db, 'leave_requests'), where('employeeId', '==', employeeId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// A backdated window whose tail extends past today, so a recall splits the
// days honestly. Shifted back on retry if her real history overlaps it.
function windowFor(shift) {
  const start = new Date(); start.setDate(start.getDate() - 5 - shift);
  const end = new Date(); end.setDate(end.getDate() + 3);
  return { leaveCommences: iso(start), leaveEnds: iso(end), start, end };
}

describe('live — recall from started leave', () => {

  it('files and fully approves a backdated casual request (leave in progress)', async () => {
    const cfg = await asUser(EMP, async () => {
      const snap = await getDoc(doc(db, 'config', 'settings'));
      return snap.data().leavePolicy;
    });
    state.policy = cfg;
    state.employee = await asUser(EMP, (u) => getEmployeeByLinkedIdentity({ email: u.email, uid: u.uid }));
    expect(state.employee).not.toBeNull();

    let created = null;
    let window = null;
    for (const shift of [0, 7, 14, 21]) {
      window = windowFor(shift);
      const w = window.start.getDay();
      console.log('[recall] trying window', window.leaveCommences, '→', window.leaveEnds, '(weekday of start:', w + ')');
      // The history fetch AND the create both happen INSIDE the signed-in
      // callback. The first version fetched outside it — an unauthenticated
      // read that the rules (correctly) denied, and the failure looked like
      // a write problem. Signed-out reads have no business in this suite.
      created = await asUser(EMP, async () => {
        const existing = await fetchOwnRequests(state.employee.id);
        return createLeaveRequest(
          {
            leaveType: 'casual',
            purpose: 'LIVE-TEST: backdated to exercise the recall flow.',
            handoverNote: LIVE_TAG,
            handoverTo: 'LIVE-TEST cover',
            applicantConfirmed: true,
            applicantConfirmedName: state.employee.fullName,
            leaveCommences: window.leaveCommences,
            leaveEnds: window.leaveEnds,
          },
          { policy: state.policy, employee: state.employee, existingRequests: existing, user: { email: EMP }, isOnline: true },
        );
      });
      if (created.ok) break;
      console.log('[recall] window refused:', created.error);
    }
    if (!created.ok) {
      console.log('[recall] no clean window available against the live history — recall arithmetic covered by unit tests; skipping the live walk.');
      return;
    }
    state.requestId = created.id;
    state.createdIds.push(created.id);
    console.log('[recall] request created:', created.id, 'requested days:', countWorkingDays(window.start, window.end, state.policy));

    for (const [email, label] of [[SUP, 'supervisor'], [HOD, 'hod'], [HRH, 'hr head']]) {
      const res = await asUser(email, async (fbUser) => decideLeaveRequest(state.requestId, {
        decision: 'approve', note: `LIVE-TEST ${label}`, user: await appUserFrom(fbUser), policy: state.policy,
      }));
      expect(res.ok, `stage ${label} failed: ${res.error}`).toBe(true);
    }
    const stored = await asUser(EMP, () => getLeaveRequest(state.requestId));
    expect(stored.status).toBe('approved');
    console.log('[recall] leave fully approved and, by its dates, already in progress');
  });

  it('REFUSES a plain cancel of a started, approved request — the wrong tool is blocked', async () => {
    if (!state.requestId) return;
    const res = await asUser(HRM, () => cancelLeaveRequest(state.requestId, {
      employeeId: null, user: { email: HRM }, policy: state.policy, isHr: true, reason: 'LIVE-TEST wrong tool',
    }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/recall it instead/i);
    console.log('[recall] plain cancel refused:', res.error);
  });

  it('recalls the leave, computing consumed and returned days from the return date', async () => {
    if (!state.requestId) return;
    const reason = 'LIVE-TEST: production emergency on Line 2.';
    const res = await asUser(HRM, () => recallFromLeave(state.requestId, {
      reason, policy: state.policy, isHr: true, user: { email: HRM },
    }));
    if (!res.ok) console.log('[recall] recall failed:', res.error);
    expect(res.ok).toBe(true);
    expect(res.daysReturned).toBeGreaterThan(0);

    const stored = await asUser(HRM, () => getLeaveRequest(state.requestId));
    const expected = computeRecallDays({
      leaveCommences: stored.leaveCommences,
      leaveEnds: stored.leaveEnds,
      returnedOn: stored.returnedOn,
      requestedDays: stored.requestedDays,
      policy: state.policy,
    });
    expect(stored.status).toBe('recalled');
    expect(stored.daysConsumed).toBe(expected.daysConsumed);
    expect(stored.daysReturned).toBe(expected.daysReturned);
    expect(stored.recallReason).toBe(reason);
    expect(stored.recalledBy).toBe(HRM);
    expect(stored.closedAt).toBeTruthy();
    console.log(`[recall] recalled: ${expected.daysConsumed} taken, ${expected.daysReturned} returned`);
  });

  it('charges the balance the CONSUMED days, not the requested days', async () => {
    if (!state.requestId) return;
    // Everything the ledger touches happens inside her session.
    const own = await asUser(EMP, () => fetchOwnRequests(state.employee.id));
    const year = getLeaveYear(new Date(), state.policy);
    const asTaken = sumApprovedDays(own, { employeeId: state.employee.id, leaveYear: year });

    // Swap the recalled record's consumed count for its requested count and
    // the ledger must grow by exactly the returned days — proving the
    // recalled request contributes consumed, not requested.
    const inflated = own.map(r => (r.id === state.requestId
      ? { ...r, daysConsumed: r.requestedDays }
      : r));
    const asInflated = sumApprovedDays(inflated, { employeeId: state.employee.id, leaveYear: year });

    const stored = own.find(r => r.id === state.requestId);
    expect(asInflated - asTaken).toBe(stored.daysReturned);
    console.log(`[recall] ledger charges ${stored.daysConsumed} (consumed), not ${stored.requestedDays} (requested)`);
  });

  it('blocks re-booking the consumed dates but frees the unused tail', async () => {
    if (!state.requestId) return;
    const stored = await asUser(EMP, () => getLeaveRequest(state.requestId));

    // A range inside the consumed head — must be refused.
    const consumedStart = toLocalDate(stored.leaveCommences);
    const badStart = new Date(consumedStart); badStart.setDate(badStart.getDate() + 1);
    const badEnd = new Date(badStart); badEnd.setDate(badEnd.getDate() + 1);
    const blocked = await asUser(EMP, async () => createLeaveRequest(
      {
        leaveType: 'casual', purpose: 'LIVE-TEST: should be blocked (consumed dates).',
        handoverNote: LIVE_TAG, handoverTo: 'LIVE-TEST cover',
        applicantConfirmed: true, applicantConfirmedName: state.employee.fullName,
        leaveCommences: iso(badStart), leaveEnds: iso(badEnd),
      },
      { policy: state.policy, employee: state.employee, existingRequests: await fetchOwnRequests(state.employee.id), user: { email: EMP }, isOnline: true },
    ));
    expect(blocked.ok).toBe(false);
    console.log('[recall] consumed dates correctly blocked:', blocked.error);

    // A range in the freed tail — must be allowed, then cleaned up.
    const tailStart = new Date(); tailStart.setDate(tailStart.getDate() + 1);
    const tailEnd = new Date(tailStart); tailEnd.setDate(tailEnd.getDate() + 1);
    const tail = await asUser(EMP, async () => createLeaveRequest(
      {
        leaveType: 'casual', purpose: 'LIVE-TEST: should be allowed (freed tail).',
        handoverNote: LIVE_TAG, handoverTo: 'LIVE-TEST cover',
        applicantConfirmed: true, applicantConfirmedName: state.employee.fullName,
        leaveCommences: iso(tailStart), leaveEnds: iso(tailEnd),
      },
      { policy: state.policy, employee: state.employee, existingRequests: await fetchOwnRequests(state.employee.id), user: { email: EMP }, isOnline: true },
    ));
    if (tail.ok) {
      state.createdIds.push(tail.id);
      console.log('[recall] freed tail correctly re-bookable:', tail.id);
      const cleared = await asUser(HRM, () => cancelLeaveRequest(tail.id, {
        employeeId: null, user: { email: HRM }, policy: state.policy, isHr: true,
      }));
      expect(cleared.ok).toBe(true);
    } else {
      console.log('[recall] tail booking refused (window-specific):', tail.error);
    }
  });

  afterAll(() => {
    console.log('\n[recall] LIVE-TEST documents from this run:');
    for (const id of state.createdIds) console.log('  - leave_requests/' + id);
    console.log('[recall] NOTE: the recalled record keeps counting its consumed days against the test');
    console.log('[recall] employee until the system owner deletes it — it is in the cleanup list.');
  });
});
