// src/services/leaveWorkflow.js
//
// The sequential approval chain, as PURE functions.
//
// ──────────────────────────────────────────────────────────────────────────
// WHY THIS FILE HAS NO FIREBASE IMPORTS
//
// The paper form's Section 3 is a CHAIN OF AUTHORITY, not a group signature.
// The Head of HR's signature MEANS the supervisor signed first and the HOD
// confirmed the handover. If one person could sign two stages with a single
// click, the record would claim authority that was never exercised.
//
// That is exactly the kind of rule that gets broken by an innocent-looking
// refactor three months later. So the chain lives here as pure functions with
// tests alongside, and the only file that can move a request through the
// chain is leaveOperations.decideLeaveRequest, which calls this module and
// refuses to write anything it did not sanction.
//
// THE RULES THIS MODULE ENFORCES, IN ORDER:
//   1. A request moves through stages in policy.stages order. Always.
//   2. Only the CURRENT stage can be acted on. No skipping, no going back.
//   3. One decision advances exactly ONE stage. Never two, never zero.
//   4. A rejection ends the chain. The later stages are never filled in.
//   5. A cancelled request is frozen. Nobody acts on it.
//   6. Who may act at a stage: its primary role, its named deputy, or the
//      Head of HR acting as universal deputy. The system owner may act
//      anywhere, always recorded as standing in.
//   7. Every action records who, as-what-role, when, and any note.
// ──────────────────────────────────────────────────────────────────────────

// The roles that can act at a stage, in the order they should be offered.
// The Head of HR is the universal deputy: the single most common way a leave
// system deadlocks is an approver being on leave with nobody able to step in
// (assumption A18). HR is the final authority on the paper form already, so
// HR stepping in earlier is consistent with how the factory actually works.
export const UNIVERSAL_DEPUTY_ROLE = 'leave_hr_head';

export function isTerminal(request) {
  return ['approved', 'rejected', 'cancelled'].includes(request?.status);
}

// Which policy stage is the request currently waiting on?
// -1 means "not waiting on anything" — either terminal, or the workflow
// block predates the current policy shape (defensive, never crash).
export function currentStageIndex(request, policy) {
  if (!request || !policy?.stages?.length) return -1;
  const status = request.status || '';
  if (status === 'approved' || status === 'rejected' || status === 'cancelled') return -1;
  const match = /^pending_(.+)$/.exec(status);
  if (!match) return -1;
  const idx = policy.stages.findIndex(s => s.id === match[1]);
  return idx;
}

// The status a request takes once stage N has approved.
// The LAST stage's approval IS the unlock — the paper form says nobody
// proceeds until the Head of HR has signed.
export function statusAfterStageApproves(policy, stageIndex) {
  const stages = policy?.stages || [];
  const stage = stages[stageIndex];
  if (!stage) return null;
  if (stageIndex >= stages.length - 1) return 'approved';
  return `pending_${stages[stageIndex + 1].id}`;
}

// ─── Who may act ────────────────────────────────────────────────────────────

// Can this user act on this stage RIGHT NOW?
//
// `user` is the AuthContext shape: { uid, systemRole, actionRoles, employee }.
// Returns a verdict object rather than a bare boolean, because "no" is useless
// without the reason — the approvals screen shows it, and the write layer
// refuses with it, so the UI and the database can never disagree about
// whether an action was allowed.
export function userCanActAtStage({ request, policy, stageIndex, user }) {
  const stages = policy?.stages || [];
  const stage = stages[stageIndex];

  if (!stage) return { can: false, reason: 'That approval stage does not exist.' };
  if (isTerminal(request)) {
    return { can: false, reason: 'This request has already been decided.' };
  }
  if (!user) return { can: false, reason: 'Not signed in.' };

  const at = currentStageIndex(request, policy);
  if (at !== stageIndex) {
    return {
      can: false,
      reason: at === -1
        ? 'This request is not waiting on any stage.'
        : `The chain has not reached ${stage.label} yet — it is still with ${stages[at].label}.`,
    };
  }

  const actionRoles = user.actionRoles || [];

  // ── No signing your own leave, whatever hat you wear ──────────────────────
  // Added 26 Oct 2026: the chain had no idea whose request it was acting on.
  // A supervisor could sign stage 1 of their OWN leave, and the Head of HR
  // could self-sign the final gate — the approval that unlocks paid leave.
  // The check runs BEFORE every grant, so it binds the primary role, a named
  // deputy, and the system owner alike; a deputy configuration that names
  // the requester cannot become a self-approval back door either.
  //
  // `user.employeeId` is the ACTOR's own employee record, resolved by the
  // caller. An approver with no employee record cannot be the owner of any
  // request, so the check is skipped for them.
  if (user.employeeId && request.employeeId && user.employeeId === request.employeeId) {
    const last = stageIndex >= stages.length - 1;
    return {
      can: false,
      reason: last
        ? 'This is your own leave request — the system owner or this stage\'s named deputy must sign it, not you.'
        : 'This is your own leave request — the Head of HR or this stage\'s named deputy must sign it, not you.',
    };
  }

  // The system owner can always step in. Recorded as acting for the stage's
  // primary so the audit trail never claims a role the person does not hold.
  if (user.systemRole === 'super_admin') {
    return { can: true, actingAsRole: stage.actionRole, actedAsDeputyFor: stage.label };
  }

  // The stage's primary approver.
  if (actionRoles.includes(stage.actionRole)) {
    return { can: true, actingAsRole: stage.actionRole, actedAsDeputyFor: null };
  }

  // The named deputy for the stage (A18). Configured per stage in the policy.
  if (stage.deputyUserUid && user.uid === stage.deputyUserUid) {
    return {
      can: true,
      actingAsRole: stage.actionRole,
      actedAsDeputyFor: `${stage.label} (deputy for ${stage.deputyName || 'the approver'})`,
    };
  }

  // The Head of HR, stepping in earlier in the chain than usual.
  if (stageIndex < stages.length - 1 && actionRoles.includes(UNIVERSAL_DEPUTY_ROLE)) {
    return {
      can: true,
      actingAsRole: stage.actionRole,
      actedAsDeputyFor: `${stage.label} (Head of HR stepping in)`,
    };
  }

  return { can: false, reason: `Only the ${stage.label}, or a deputy, can act at this stage.` };
}

// ─── The decision ──────────────────────────────────────────────────────────

// Builds the exact patch a decision writes, or refuses.
//
// Approvals happen ONLINE ONLY in this app — a deliberate exception to the
// offline-first rule (blueprint section 10): an approval authorises paid
// leave, so the official record of who approved it must not sit in one
// browser's localStorage. The caller enforces the connection; this function
// enforces the chain. Neither is sufficient alone.
//
// `now` is passed in (not new Date()) so tests are deterministic and the
// caller can supply a server-shaped value.
export function buildDecisionPatch({
  request, policy, decision, note, user, stageIndex, now = new Date(),
}) {
  if (decision !== 'approve' && decision !== 'reject') {
    return { ok: false, error: 'A decision must be either approve or reject.' };
  }

  const verdict = userCanActAtStage({ request, policy, stageIndex, user });
  if (!verdict.can) return { ok: false, error: verdict.reason };

  if (decision === 'reject' && policy?.requireRejectionReason !== false) {
    const trimmed = String(note || '').trim();
    if (!trimmed) {
      return { ok: false, error: 'A rejection needs a reason — the employee deserves to know why.' };
    }
  }

  const stages = policy?.stages || [];
  const stage = stages[stageIndex];
  const workflow = { ...(request.workflow || {}) };
  const entry = { ...(workflow[stage.id] || {}) };

  entry.status = decision === 'approve' ? 'approved' : 'rejected';
  entry.byName = user.userFullName || user.email || null;
  entry.byUid = user.uid || null;
  entry.byRole = verdict.actingAsRole;
  entry.actedAsDeputyFor = verdict.actedAsDeputyFor;
  entry.note = String(note || '').trim() || null;
  entry.actedAt = now;
  workflow[stage.id] = entry;

  const patch = { workflow };

  if (decision === 'reject') {
    patch.status = 'rejected';
    patch.rejectedReason = String(note || '').trim();
    patch.rejectedBy = entry.byName;
    patch.rejectedAt = now;
  } else {
    // Exactly one stage forward. The final stage's approval sets 'approved'.
    patch.status = statusAfterStageApproves(policy, stageIndex);
    if (patch.status === 'approved') {
      patch.fullyApprovedAt = now;
    }
  }

  patch.decidedAt = now;
  patch.updatedAt = now;

  return { ok: true, patch, stage, actedAsDeputyFor: verdict.actedAsDeputyFor };
}

// ─── Deputy warnings ───────────────────────────────────────────────────────

// Which holders of a stage's action role are themselves on approved leave,
// so the approvals screen can warn that the queue may be about to deadlock.
//
// `holders` is [{ uid, fullName }] — the people who hold the stage's role,
// resolved by the caller from user_roles + employees. `requests` is the
// approved requests for those people. Pure date work; no database.
export function awayHolders({ holders, requests, onDate = new Date() }) {
  const out = [];
  for (const holder of holders || []) {
    const away = (requests || []).find(r => {
      if (r.employeeId !== holder.employeeId) return false;
      const start = r.leaveCommences instanceof Date ? r.leaveCommences : new Date(r.leaveCommences);
      const end = r.leaveEnds instanceof Date ? r.leaveEnds : new Date(r.leaveEnds);
      return !isNaN(start) && !isNaN(end) && onDate >= start && onDate <= end;
    });
    if (away) out.push({ holder, until: away.leaveEnds });
  }
  return out;
}

// Which stages of a request a given user could EVER act on — used to sort the
// approvals screen into "yours to act on now", "yours later in the chain",
// and "nothing to do with you", so an approver's queue never shows a wall of
// other people's requests they cannot move.
//
// Takes no request on purpose: involvement is a property of the CHAIN and
// the person, not of any single request. The same answer applies to every
// request under the same policy.
export function userInvolvement({ policy, user }) {
  const stages = policy?.stages || [];
  const actionRoles = user?.actionRoles || [];
  const involved = stages.some(s => actionRoles.includes(s.actionRole))
    || stages.some(s => s.deputyUserUid && s.deputyUserUid === user?.uid)
    || actionRoles.includes(UNIVERSAL_DEPUTY_ROLE)
    || user?.systemRole === 'super_admin';
  return involved;
}
