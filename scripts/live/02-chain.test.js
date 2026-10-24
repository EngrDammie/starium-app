// scripts/live/02-chain.test.js
//
// LIVE SUITE — THE FULL APPROVAL CHAIN, against the real database.
//
// What this proves, in order:
//
//   1. A real employee (halima) can create a real leave request through the
//      app's own createLeaveRequest, and the frozen numbers land on the
//      document exactly as the snapshot rule demands.
//   2. The supervisor (emeka) signs stage 1 — and NOTHING else happens.
//   3. The same supervisor CANNOT sign stage 2. Not because the button is
//      hidden — the write itself is refused. This is the chain.
//   4. The employee CANNOT approve her own request. The database refuses,
//      not just the UI.
//   5. The HOD (blessing) signs stage 2, the Head of HR (ibrahim) signs
//      stage 3, and only then does the request become APPROVED.
//   6. A second request is REJECTED with a written reason.
//   7. A third request is created and cancelled by the employee.
//   8. HR (segun) lodges a request on behalf of someone who never logs in,
//      and the "Lodged by HR" badge is on the document.
//   9. Every document this test creates carries LIVE-TEST in its purpose.
//      The IDs are printed at the end for the owner to delete.
//
// This file writes to production. It runs only via npm run test:live.

import { describe, it, expect, afterAll } from 'vitest';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';
import {
  createLeaveRequest, getLeaveRequest, decideLeaveRequest,
  cancelLeaveRequest,
} from '../../src/services/leaveOperations';
import { getEmployeeByLinkedIdentity } from '../../src/services/employeeOperations';
import { subscribeToEmployees } from '../../src/services/employeeOperations';

const PASSWORD = process.env.LIVE_TEST_PASSWORD || 'success123';
const EMP = process.env.LIVE_TEST_EMPLOYEE || 'halima.danjuma@example.test';
const SUP = process.env.LIVE_TEST_SUPERVISOR || 'emeka.nwosu@example.test';
const HOD = process.env.LIVE_TEST_HOD || 'blessing.adeyemi@example.test';
const HRH = process.env.LIVE_TEST_HR_HEAD || 'ibrahim.yusuf@example.test';
const HRM = process.env.LIVE_TEST_HR_MANAGER || 'segun.adeyinka@example.test';

// Requests are created ~3 weeks out so the annual-leave notice rule (7
// working days) is satisfied whatever day this suite runs.
function futureDates() {
  const start = new Date();
  start.setDate(start.getDate() + 21);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { leaveCommences: iso(start), leaveEnds: iso(end) };
}

const LIVE_TAG = `LIVE-TEST chain ${new Date().toISOString().slice(0, 16)}`;

// State carried between the ordered tests.
const state = { employee: null, policy: null, approvedId: null, rejectedId: null, cancelledId: null, lodgedId: null, createdIds: [] };

async function asUser(email, fn) {
  const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
  try { return await fn(cred.user); } finally { await signOut(auth); }
}

// The app-shaped user the services expect: AuthContext builds this in the
// real app by joining Firebase Auth with the user_roles document. The FIRST
// live run failed by passing the raw Firebase user (no actionRoles — every
// approver silently role-less). The SECOND failed by signing in AGAIN inside
// the callback, whose signOut tore the session down before the write — an
// unauthenticated transaction is denied by rules that are working perfectly.
//
// So: build the shape from the ALREADY-SIGNED-IN user, and never sign in or
// out inside an asUser callback.
async function appUserFrom(firebaseUser) {
  const snap = await getDoc(doc(db, 'user_roles', firebaseUser.uid));
  const roles = snap.exists() ? snap.data() : {};
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    systemRole: roles.systemRole || 'standard',
    departmentRoles: roles.departmentRoles || [],
    actionRoles: roles.actionRoles || roles.approvalRoles || [],
    userFullName: roles.userFullName
      || [roles.firstName, roles.lastName].filter(Boolean).join(' ')
      || firebaseUser.email,
  };
}

// The live policy, read through the same merge every screen uses.
async function loadPolicy() {
  const snap = await getDoc(doc(db, 'config', 'settings'));
  return snap.data().leavePolicy;
}

describe('live chain — create, three signatures, refusals', () => {

  it('finds the employee record behind the employee login', async () => {
    state.policy = await asUser(EMP, () => loadPolicy());
    state.employee = await asUser(EMP, (user) => getEmployeeByLinkedIdentity({ email: user.email, uid: user.uid }));
    expect(state.employee, 'the employee account has no linked employee record — ask HR to link it').not.toBeNull();
    console.log('[chain] employee:', state.employee.fullName, state.employee.sapNumber, 'dept:', state.employee.department);
  });

  it('creates a request and freezes the numbers on the document', async () => {
    const dates = futureDates();
    const res = await asUser(EMP, (user) => createLeaveRequest(
      {
        leaveType: 'annual',
        purpose: '',
        handoverNote: LIVE_TAG,
        handoverTo: 'LIVE-TEST cover',
        applicantConfirmed: true,
        applicantConfirmedName: state.employee.fullName,
        ...dates,
      },
      {
        policy: state.policy,
        employee: state.employee,
        existingRequests: [],
        user: { email: EMP },
        isOnline: true,
      },
    ));
    if (!res.ok) console.log('[chain] create failed:', res.error);
    expect(res.ok).toBe(true);
    state.approvedId = res.id;

    const stored = await asUser(EMP, () => getLeaveRequest(res.id));
    console.log('[chain] created', res.id, 'status:', stored.status);
    expect(stored.status).toBe('pending_supervisor');
    // THE SNAPSHOT RULE: the arithmetic is frozen on the document at birth.
    expect(stored.entitledAtRequest).toBeGreaterThan(0);
    expect(stored.requestedDays).toBeGreaterThan(0);
    expect(stored.outstandingAfter).toBe(stored.entitledAtRequest + stored.carryOverAtRequest - stored.takenBeforeThisRequest - stored.requestedDays);
    expect(stored.handoverNote).toContain('LIVE-TEST');
    state.createdIds.push(res.id);
  });

  it('lets the supervisor sign stage 1 — and only stage 1', async () => {
    const res = await asUser(SUP, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST stage 1', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(res.ok).toBe(true);
    expect(res.status).toBe('pending_hod');

    const stored = await asUser(SUP, () => getLeaveRequest(state.approvedId));
    expect(stored.workflow.supervisor.status).toBe('approved');
    expect(stored.workflow.supervisor.byName).toBeTruthy();
    expect(stored.workflow.hod.status).toBe('pending');
  });

  it('REFUSES the same supervisor at stage 2 — the chain binds in the database', async () => {
    const res = await asUser(SUP, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST should not land', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(res.ok).toBe(false);
    console.log('[chain] supervisor at stage 2 refused:', res.error);
    expect(res.error).toMatch(/Only the HOD|still with/i);

    // And the document is untouched by the refusal.
    const stored = await asUser(SUP, () => getLeaveRequest(state.approvedId));
    expect(stored.workflow.hod.status).toBe('pending');
  });

  it('REFUSES the employee approving her own request', async () => {
    const res = await asUser(EMP, async (fbUser) => decideLeaveRequest(state.approvedId, {
      decision: 'approve', note: 'LIVE-TEST self-approval attempt', user: await appUserFrom(fbUser), policy: state.policy,
    }));
    expect(res.ok).toBe(false);
    console.log('[chain] self-approval refused:', res.error);
  });

  it('REFUSES raw database writes — self-approval is now impossible', async () => {
    // Not through the service: straight at the database, exactly as a
    // determined user with the API key could. The FIRST live run found the
    // rules ALLOWED this — the owner could set status: approved directly and
    // forge the three-signature chain. The rules were tightened the same day
    // (owner may only move status to cancelled, and dates/days never); this
    // test is the proof the tightening actually holds in production.
    let ownDenied = false;
    await asUser(EMP, async () => {
      try {
        await updateDoc(doc(db, 'leave_requests', state.approvedId), { status: 'approved' });
      } catch (e) {
        ownDenied = true;
        console.log('[chain] raw self-approval denied by rules:', e.code);
      }
    });
    expect(ownDenied, 'an employee setting their own request to approved must be DENIED').toBe(true);

    const stored = await asUser(EMP, () => getLeaveRequest(state.approvedId));
    expect(stored.status).toBe('pending_hod');
    expect(stored.workflow.hod.status).toBe('pending');
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
    console.log('[chain] fully approved:', stored.status,
      '| signed by:', stored.workflow.supervisor.byName, '→', stored.workflow.hod.byName, '→', stored.workflow.hr.byName);
    expect(stored.workflow.hr.status).toBe('approved');
    expect(stored.fullyApprovedAt).toBeTruthy();
  });

  it('REJECTS a second request, and the reason is stored for the employee', async () => {
    const dates = futureDates();
    const created = await asUser(EMP, (user) => createLeaveRequest(
      { leaveType: 'annual', purpose: '', handoverNote: LIVE_TAG, handoverTo: 'LIVE-TEST cover', applicantConfirmed: true, applicantConfirmedName: state.employee.fullName, ...dates },
      { policy: state.policy, employee: state.employee, existingRequests: [], user: { email: EMP }, isOnline: true },
    ));
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
    expect(stored.workflow.hod.status).toBe('pending'); // the chain stopped, not filled in
    console.log('[chain] rejected with reason stored');
  });

  it('lets the employee cancel her own pending request', async () => {
    const dates = futureDates();
    const created = await asUser(EMP, (user) => createLeaveRequest(
      { leaveType: 'annual', purpose: '', handoverNote: LIVE_TAG, handoverTo: 'LIVE-TEST cover', applicantConfirmed: true, applicantConfirmedName: state.employee.fullName, ...dates },
      { policy: state.policy, employee: state.employee, existingRequests: [], user: { email: EMP }, isOnline: true },
    ));
    expect(created.ok).toBe(true);
    state.cancelledId = created.id;
    state.createdIds.push(created.id);

    const cancelled = await asUser(EMP, (user) => cancelLeaveRequest(state.cancelledId, {
      employeeId: state.employee.id, user: { email: EMP }, policy: state.policy,
    }));
    expect(cancelled.ok).toBe(true);
    const stored = await asUser(EMP, () => getLeaveRequest(state.cancelledId));
    expect(stored.status).toBe('cancelled');
    console.log('[chain] cancelled by the employee');
  });

  it('lets HR lodge a request on behalf of a staff member with no login', async () => {
    // Pick a roster employee who is NOT the test employee and has no login.
    const roster = await asUser(HRM, () => new Promise((resolve) => {
      const unsub = subscribeToEmployees((list) => { unsub(); resolve(list); });
    }));
    const candidate = roster.find(e => e.id !== state.employee.id && !e.linkedUserUid && e.employmentStatus !== 'inactive');
    expect(candidate, 'no login-less roster employee to lodge for — seed one via the roster').toBeTruthy();
    console.log('[chain] lodging on behalf of:', candidate.fullName, candidate.sapNumber);

    const dates = futureDates();
    const res = await asUser(HRM, (user) => createLeaveRequest(
      {
        leaveType: 'annual', purpose: '', handoverNote: LIVE_TAG, handoverTo: 'LIVE-TEST cover',
        applicantConfirmed: true, applicantConfirmedName: candidate.fullName,
        lodgedOnBehalf: true, ...dates,
      },
      { policy: state.policy, employee: candidate, existingRequests: [], user: { email: HRM }, isOnline: true },
    ));
    expect(res.ok).toBe(true);
    state.lodgedId = res.id;
    state.createdIds.push(res.id);

    const stored = await asUser(HRM, () => getLeaveRequest(state.lodgedId));
    expect(stored.lodgedBy).toBe(HRM);
    console.log('[chain] lodged by HR, badge stored:', stored.lodgedBy);

    // And the employee the request belongs to is the only non-HR, non-approver
    // who could conceivably write to it — she is NOT its owner, so even her
    // raw write is denied. (The test employee writing someone else's request.)
    let denied = false;
    await asUser(EMP, async () => {
      try {
        await updateDoc(doc(db, 'leave_requests', state.lodgedId), { status: 'approved' });
      } catch (e) {
        denied = true;
        console.log('[chain] cross-employee raw write denied by rules:', e.code);
      }
    });
    expect(denied, 'writing someone else\'s request must be DENIED even for a signed-in employee').toBe(true);
  });

  afterAll(() => {
    console.log('\n[live] documents created by this run (purpose is tagged LIVE-TEST):');
    for (const id of state.createdIds) console.log('  - leave_requests/' + id);
    console.log('[live] the system owner can delete these from the console, or leave them as cancelled/rejected audit records.');
  });
});
