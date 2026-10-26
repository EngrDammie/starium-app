// src/services/__tests__/leaveWorkflow.test.js
//
// The sequential approval chain, proven.
//
// The blueprint (section 09) names the one way this can go wrong: "a
// supervisor who is ALSO the HOD. If that person can approve both stages in
// one sitting, the chain is broken." There is a test for exactly that below,
// and it is the most important one in this file.
//
// Like leaveCalculations, this module is Firebase-free, so these tests need
// no mocks. An approval engine that cannot be tested without a database is
// an approval engine nobody can prove correct.

import { describe, it, expect } from 'vitest';
import {
  isTerminal, currentStageIndex, statusAfterStageApproves,
  userCanActAtStage, buildDecisionPatch, awayHolders, userInvolvement,
  UNIVERSAL_DEPUTY_ROLE,
} from '../leaveWorkflow';

// ─── fixtures ──────────────────────────────────────────────────────────────

const POLICY = {
  stages: [
    { id: 'supervisor', label: 'Supervisor', actionRole: 'leave_supervisor', deputyUserUid: null, deputyName: null },
    { id: 'hod', label: 'HOD / Subsidiary', actionRole: 'leave_hod', deputyUserUid: null, deputyName: null },
    { id: 'hr', label: 'Head of HR', actionRole: 'leave_hr_head', deputyUserUid: null, deputyName: null },
  ],
  requireRejectionReason: true,
};

const supervisor = { uid: 'u-sup', email: 'sup@x.test', userFullName: 'Seyi Supervisor', actionRoles: ['leave_supervisor'], systemRole: 'standard' };
const hod = { uid: 'u-hod', email: 'hod@x.test', userFullName: 'Hannah HOD', actionRoles: ['leave_hod'], systemRole: 'standard' };
const hrHead = { uid: 'u-hr', email: 'hr@x.test', userFullName: 'Halima HR', actionRoles: ['leave_hr_head'], systemRole: 'standard' };
const employee = { uid: 'u-emp', email: 'emp@x.test', actionRoles: [], systemRole: 'standard' };
const owner = { uid: 'u-owner', email: 'owner@x.test', systemRole: 'super_admin', actionRoles: [] };

// A fresh request, as createLeaveRequest would have written it.
const freshRequest = (over = {}) => ({
  status: 'pending_supervisor',
  workflow: {
    supervisor: { status: 'pending' },
    hod: { status: 'pending' },
    hr: { status: 'pending' },
  },
  ...over,
});

// ─── where is the request in the chain? ────────────────────────────────────

describe('currentStageIndex', () => {
  it('starts at the first stage', () => {
    expect(currentStageIndex(freshRequest(), POLICY)).toBe(0);
  });

  it('follows the pending_ status, not the workflow block', () => {
    expect(currentStageIndex(freshRequest({ status: 'pending_hod' }), POLICY)).toBe(1);
    expect(currentStageIndex(freshRequest({ status: 'pending_hr' }), POLICY)).toBe(2);
  });

  it('returns -1 for every terminal state', () => {
    for (const status of ['approved', 'rejected', 'cancelled']) {
      expect(currentStageIndex(freshRequest({ status }), POLICY)).toBe(-1);
    }
  });

  it('returns -1 rather than crashing on a malformed status or policy', () => {
    expect(currentStageIndex(freshRequest({ status: 'garbage' }), POLICY)).toBe(-1);
    expect(currentStageIndex(freshRequest(), { stages: [] })).toBe(-1);
    expect(currentStageIndex(null, POLICY)).toBe(-1);
  });
});

describe('statusAfterStageApproves', () => {
  it('moves to the next pending_ status for early stages', () => {
    expect(statusAfterStageApproves(POLICY, 0)).toBe('pending_hod');
    expect(statusAfterStageApproves(POLICY, 1)).toBe('pending_hr');
  });

  it('unlocks the leave only at the final stage', () => {
    // The paper form: "staff should not proceed until they have received
    // formal Approval Coupon from HR Department".
    expect(statusAfterStageApproves(POLICY, 2)).toBe('approved');
  });
});

// ─── who may act ───────────────────────────────────────────────────────────

describe('userCanActAtStage', () => {
  it('lets the stage primary act on the current stage', () => {
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 0, user: supervisor });
    expect(v.can).toBe(true);
    expect(v.actedAsDeputyFor).toBeNull();
  });

  it('REFUSES a supervisor signing their OWN request — no hat makes that right', () => {
    // Found 26 Oct 2026: the chain had no idea whose request it was acting
    // on, so an approver could sign their own leave, and the Head of HR
    // could self-sign the gate that unlocks paid leave.
    const selfSigning = { ...supervisor, employeeId: 'e-sup' };
    const ownRequest = freshRequest({ employeeId: 'e-sup' });
    const v = userCanActAtStage({ request: ownRequest, policy: POLICY, stageIndex: 0, user: selfSigning });
    expect(v.can).toBe(false);
    expect(v.reason).toMatch(/your own leave request/i);
    expect(v.reason).toMatch(/Head of HR/);
  });

  it('REFUSES the Head of HR self-signing the final gate, and names the owner instead', () => {
    const selfHead = { ...hrHead, employeeId: 'e-hr' };
    const ownFinal = freshRequest({ employeeId: 'e-hr', status: 'pending_hr' });
    const v = userCanActAtStage({ request: ownFinal, policy: POLICY, stageIndex: 2, user: selfHead });
    expect(v.can).toBe(false);
    expect(v.reason).toMatch(/system owner/i);
  });

  it('REFUSES the system owner signing their own request too', () => {
    const ownerAsEmployee = { ...owner, employeeId: 'e-owner' };
    const ownRequest = freshRequest({ employeeId: 'e-owner' });
    const v = userCanActAtStage({ request: ownRequest, policy: POLICY, stageIndex: 0, user: ownerAsEmployee });
    expect(v.can).toBe(false);
    expect(v.reason).toMatch(/your own leave request/i);
  });

  it('REFUSES even a NAMED DEPUTY who turns out to be the requester', () => {
    // A deputy configuration naming the requester would otherwise be a
    // self-approval back door. The self-check runs before every grant.
    const policy = {
      ...POLICY,
      stages: [
        { ...POLICY.stages[0], deputyUserUid: 'u-sup', deputyName: 'Themselves (misconfigured)' },
        POLICY.stages[1],
        POLICY.stages[2],
      ],
    };
    const selfDeputy = { ...supervisor, employeeId: 'e-sup' };
    const ownRequest = freshRequest({ employeeId: 'e-sup' });
    const v = userCanActAtStage({ request: ownRequest, policy, stageIndex: 0, user: selfDeputy });
    expect(v.can).toBe(false);
  });

  it('lets the same approver sign SOMEONE ELSE\'S request as normal', () => {
    const supervisorWithRecord = { ...supervisor, employeeId: 'e-sup' };
    const someoneElses = freshRequest({ employeeId: 'e-other' });
    const v = userCanActAtStage({ request: someoneElses, policy: POLICY, stageIndex: 0, user: supervisorWithRecord });
    expect(v.can).toBe(true);
  });

  it('skips the self-check when the actor has no employee record — they cannot own anything', () => {
    const ownRequest = freshRequest({ employeeId: 'e-sup' });
    const v = userCanActAtStage({ request: ownRequest, policy: POLICY, stageIndex: 0, user: supervisor });
    expect(v.can).toBe(true);
  });

  it('refuses the right role at the wrong stage — the chain has not reached them', () => {
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 1, user: hod });
    expect(v.can).toBe(false);
    expect(v.reason).toMatch(/still with Supervisor/i);
  });

  it('refuses the wrong role at the current stage', () => {
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 0, user: hod });
    expect(v.can).toBe(false);
    expect(v.reason).toMatch(/Only the Supervisor/i);
  });

  it('refuses a plain employee outright', () => {
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 0, user: employee });
    expect(v.can).toBe(false);
  });

  it('lets the Head of HR step in EARLY in the chain, recorded as deputy', () => {
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 0, user: hrHead });
    expect(v.can).toBe(true);
    expect(v.actedAsDeputyFor).toMatch(/Head of HR stepping in/);
  });

  it('lets a named deputy act, recorded as deputy', () => {
    const policy = {
      ...POLICY,
      stages: [
        { ...POLICY.stages[0], deputyUserUid: 'u-dep', deputyName: 'Deputy Dan' },
        POLICY.stages[1],
        POLICY.stages[2],
      ],
    };
    const deputy = { uid: 'u-dep', email: 'dan@x.test', actionRoles: [], systemRole: 'standard' };
    const v = userCanActAtStage({ request: freshRequest(), policy, stageIndex: 0, user: deputy });
    expect(v.can).toBe(true);
    expect(v.actedAsDeputyFor).toMatch(/Deputy Dan/);
  });

  it('lets the system owner act at the current stage, recorded as standing in', () => {
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 0, user: owner });
    expect(v.can).toBe(true);
    expect(v.actedAsDeputyFor).toMatch(/Supervisor/);
  });

  it('does NOT let the system owner skip ahead — the chain binds everyone', () => {
    // "Each stage is locked until the one before it is done. Always."
    // The owner stepping in means standing in for whoever holds the CURRENT
    // stage, never jumping the queue. An owner who could skip stages could
    // approve paid leave with a single click, which is exactly the broken
    // chain the blueprint warns about.
    const v = userCanActAtStage({ request: freshRequest(), policy: POLICY, stageIndex: 1, user: owner });
    expect(v.can).toBe(false);
    expect(v.reason).toMatch(/still with Supervisor/);
  });

  it('refuses everyone once the request is decided', () => {
    for (const user of [supervisor, hod, hrHead, owner]) {
      const v = userCanActAtStage({ request: freshRequest({ status: 'approved' }), policy: POLICY, stageIndex: 2, user });
      expect(v.can).toBe(false);
      expect(v.reason).toMatch(/already been decided/);
    }
  });
});

// ─── the decision itself ───────────────────────────────────────────────────

describe('buildDecisionPatch', () => {
  it('advances exactly one stage per approval', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'approve',
      user: supervisor, stageIndex: 0, now: new Date('2026-10-19T09:00:00'),
    });
    expect(r.ok).toBe(true);
    expect(r.patch.status).toBe('pending_hod');
    expect(r.patch.workflow.supervisor.status).toBe('approved');
    expect(r.patch.workflow.supervisor.byName).toBe('Seyi Supervisor');
    expect(r.patch.workflow.supervisor.actedAt).toEqual(new Date('2026-10-19T09:00:00'));
    // Later stages untouched — the HOD has NOT somehow signed.
    expect(r.patch.workflow.hod.status).toBe('pending');
    expect(r.patch.workflow.hr.status).toBe('pending');
    expect(r.patch.fullyApprovedAt).toBeUndefined();
  });

  it('THE CRITICAL TEST: a person holding two roles cannot sign two stages in one decision', () => {
    // The blueprint's named failure mode. This user is BOTH the Supervisor
    // and the HOD. A single decision must fill in exactly one stage —
    // they may legitimately act twice, as two deliberate actions, but the
    // record must never claim both signatures happened in one.
    const both = { ...supervisor, actionRoles: ['leave_supervisor', 'leave_hod'] };
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'approve',
      user: both, stageIndex: 0, now: new Date('2026-10-19T09:00:00'),
    });
    expect(r.ok).toBe(true);
    expect(r.patch.workflow.supervisor.status).toBe('approved');
    expect(r.patch.workflow.hod.status).toBe('pending');
    expect(r.patch.status).toBe('pending_hod');
  });

  it('sets approved only when the final stage signs', () => {
    const r = buildDecisionPatch({
      request: freshRequest({ status: 'pending_hr' }), policy: POLICY, decision: 'approve',
      user: hrHead, stageIndex: 2, now: new Date('2026-10-19T09:00:00'),
    });
    expect(r.patch.status).toBe('approved');
    expect(r.patch.fullyApprovedAt).toBeTruthy();
  });

  it('a rejection ends the chain and records the reason', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'reject',
      note: 'Production line is short-staffed that week.',
      user: supervisor, stageIndex: 0, now: new Date('2026-10-19T09:00:00'),
    });
    expect(r.ok).toBe(true);
    expect(r.patch.status).toBe('rejected');
    expect(r.patch.rejectedReason).toBe('Production line is short-staffed that week.');
    expect(r.patch.rejectedBy).toBe('Seyi Supervisor');
    expect(r.patch.workflow.hod.status).toBe('pending'); // chain stopped, not filled in
  });

  it('refuses a rejection with no reason when the policy demands one', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'reject', note: '   ',
      user: supervisor, stageIndex: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/needs a reason/i);
  });

  it('allows a silent rejection when the policy says reasons are optional', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: { ...POLICY, requireRejectionReason: false },
      decision: 'reject', user: supervisor, stageIndex: 0,
    });
    expect(r.ok).toBe(true);
  });

  it('refuses to act on a stage the chain has not reached, even for the holder', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'approve',
      user: hod, stageIndex: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/still with Supervisor/);
  });

  it('refuses a decision on a terminal request — no double-approve', () => {
    const r = buildDecisionPatch({
      request: freshRequest({ status: 'approved' }), policy: POLICY, decision: 'approve',
      user: hrHead, stageIndex: 2,
    });
    expect(r.ok).toBe(false);
  });

  it('does not let the system owner skip stages either — one decision, one stage', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'approve',
      user: owner, stageIndex: 2,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/still with Supervisor/);
  });

  it('rejects an unknown decision word outright', () => {
    const r = buildDecisionPatch({
      request: freshRequest(), policy: POLICY, decision: 'maybe',
      user: supervisor, stageIndex: 0,
    });
    expect(r.ok).toBe(false);
  });
});

// ─── deputy warnings and involvement ─────────────────────────────────────

describe('awayHolders', () => {
  it('flags holders whose approved leave covers the given day', () => {
    const holders = [{ employeeId: 'e1', fullName: 'Seyi Supervisor' }];
    const requests = [
      { employeeId: 'e1', leaveCommences: new Date('2026-10-15'), leaveEnds: new Date('2026-10-24') },
    ];
    const away = awayHolders({ holders, requests, onDate: new Date('2026-10-19') });
    expect(away).toHaveLength(1);
    expect(away[0].holder.fullName).toBe('Seyi Supervisor');
  });

  it('does not flag someone whose leave has not started or has ended', () => {
    const holders = [{ employeeId: 'e1', fullName: 'Seyi Supervisor' }];
    const requests = [
      { employeeId: 'e1', leaveCommences: new Date('2026-11-01'), leaveEnds: new Date('2026-11-05') },
      { employeeId: 'e1', leaveCommences: new Date('2026-09-01'), leaveEnds: new Date('2026-09-05') },
    ];
    expect(awayHolders({ holders, requests, onDate: new Date('2026-10-19') })).toHaveLength(0);
  });
});

describe('userInvolvement', () => {
  it('counts every approver, deputy-holder and owner as involved', () => {
    for (const user of [supervisor, hod, hrHead, owner]) {
      expect(userInvolvement({ policy: POLICY, user })).toBe(true);
    }
  });

  it('does not count a plain employee', () => {
    expect(userInvolvement({ request: freshRequest(), policy: POLICY, user: employee })).toBe(false);
  });
});

describe('isTerminal', () => {
  it('knows the three frozen states', () => {
    expect(isTerminal({ status: 'approved' })).toBe(true);
    expect(isTerminal({ status: 'rejected' })).toBe(true);
    expect(isTerminal({ status: 'cancelled' })).toBe(true);
    expect(isTerminal({ status: 'pending_hod' })).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });
});
