// src/pages/LeaveApprovals.jsx
//
// The approver's queue (task 5.2).
//
// WHAT THIS PAGE IS NOT: it is not a list of every leave request in the
// company. An approver who has to scroll past forty requests they cannot act
// on will stop reading, and the one that matters will be missed. The page
// sorts the world into exactly three buckets:
//
//   1. WAITING FOR YOU — the request is at your stage of the chain, now.
//   2. WAITING ON OTHERS — you can see it, but the chain has not reached you.
//   3. DECIDED — already signed off or rejected, for reference.
//
// Only bucket 1 has buttons, and the buttons do one stage at a time. That is
// the whole design: the interface makes skipping the chain impossible, not
// merely discouraged.
//
// OFFLINE — THE ONE DELIBERATE EXCEPTION (blueprint section 10):
// submissions queue on the device like every factory module; approvals do
// NOT. An approval authorises paid leave, so it goes straight to the
// database or not at all. When you are offline the buttons are disabled and
// the page says so in plain words, so nobody wonders whether their signature
// was saved somewhere in limbo.

import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useNetwork } from '../context/NetworkContext';
import {
  subscribeToLeaveRequests, decideLeaveRequest, cancelLeaveRequest, recallFromLeave,
} from '../services/leaveOperations';
import { spansLeaveYear, toLocalDate } from '../services/leaveCalculations';
import {
  currentStageIndex, userCanActAtStage, awayHolders, userInvolvement,
} from '../services/leaveWorkflow';
import { leaveStatusLabel, leaveStatusStyle, decidedAt, outcomeNote } from '../components/leave/leaveStatus';
import { useEmployeeRecord } from '../hooks/useEmployeeRecord';
import { subscribeToAccessView } from '../services/userAccessOperations';

const fmt = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// The default date for the recall dialog: today, in the input's own format.
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Stepper({ request, policy, highlight }) {
  const stages = policy?.stages || [];
  const at = currentStageIndex(request, policy);
  return (
    <div className="flex items-center gap-1 flex-wrap mt-3">
      {stages.map((stage, i) => {
        const entry = request.workflow?.[stage.id];
        const done = entry?.status === 'approved';
        const rejected = entry?.status === 'rejected';
        const isNow = i === at;
        return (
          <div key={stage.id} className="flex items-center gap-1">
            <span
              className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
                done ? 'bg-status-success/20 text-status-success border-status-success/40'
                  : rejected ? 'bg-status-danger/20 text-status-danger border-status-danger/40'
                  : isNow ? `border-primary text-primary ${highlight ? 'animate-pulse' : ''}`
                  : 'border-[#333] text-gray-500'}`}
              title={entry?.byName ? `Signed by ${entry.byName}${entry.actedAsDeputyFor ? ` (for ${entry.actedAsDeputyFor})` : ''}` : undefined}
            >
              {done ? '✓ ' : rejected ? '✕ ' : isNow ? '● ' : ''}{stage.label}
            </span>
            {i < stages.length - 1 && <span className="text-gray-700 text-xs">→</span>}
          </div>
        );
      })}
    </div>
  );
}

// The outcome block for a decided request: the reason a rejection was given,
// the note that a cancellation released the days, or the confirmation that
// all three signatures landed. Same reason text the employee reads on their
// own screen — the approvers are not given a different version of events.
const OUTCOME_TONES = {
  danger: 'bg-status-danger/10 border-status-danger/40 text-status-danger',
  muted: 'bg-[#1a1a1a] border-[#333] text-gray-400',
  good: 'bg-status-success/10 border-status-success/40 text-status-success',
  warn: 'bg-status-warning/10 border-status-warning/40 text-status-warning',
};

function OutcomeBlock({ request }) {
  const note = outcomeNote(request);
  if (!note) return null;
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 ${OUTCOME_TONES[note.tone] || OUTCOME_TONES.muted}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-1">{note.title}</div>
      <p className={`text-sm ${note.tone === 'muted' ? 'text-gray-300' : 'text-gray-200'}`}>{note.body}</p>
    </div>
  );
}

function RequestCard({ request, policy, user, isOnline, onDecide, onCancel, onRecall, canManage, ownerStatus, awayWarning }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const [returnDate, setReturnDate] = useState('');

  const at = currentStageIndex(request, policy);
  const stage = policy?.stages?.[at];
  const verdict = userCanActAtStage({ request, policy, stageIndex: at, user });
  const canAct = verdict.can && isOnline;

  // The request's own conclusion, in the same words and colours the employee
  // sees on My Leave. The stepper below shows WHO signed; this shows WHAT
  // became of the request — the two answers the Decided tray needs.
  const statusLabel = leaveStatusLabel(request.status, policy);
  const statusStyle = leaveStatusStyle(request.status);
  const decided = decidedAt(request);

  const act = async (decision) => {
    if (busy) return;
    if (decision === 'reject' && policy?.requireRejectionReason !== false && !note.trim()) {
      setShowReject(true);
      return;
    }
    setBusy(true);
    const res = await onDecide(request, decision, note);
    setBusy(false);
    if (res.ok) { setNote(''); setShowReject(false); }
  };

  // HR / the owner cancelling. Reversing APPROVED leave requires a written
  // reason (the service enforces it); cancelling a pending one does not.
  const doCancel = async () => {
    if (busy) return;
    const approved = request.status === 'approved';
    if (approved && !note.trim()) { setShowCancel(true); return; }
    setBusy(true);
    const res = await onCancel(request, note);
    setBusy(false);
    if (res.ok) { setNote(''); setShowCancel(false); }
  };

  // HR / the owner RECALLING someone from started leave — the only honest
  // way to cut leave short, because the days already taken stay counted.
  const doRecall = async () => {
    if (busy) return;
    if (!note.trim()) return; // reason required; the dialog enforces it visibly
    setBusy(true);
    const res = await onRecall(request, { returnedOn: returnDate || null, reason: note });
    setBusy(false);
    if (res.ok) { setNote(''); setShowRecall(false); setReturnDate(''); }
  };

  // Has this leave actually started? The calendar decides which tool the
  // card offers — cancel before the start, recall after it.
  const starts = toLocalDate(request.leaveCommences);
  const started = !!starts && new Date() >= starts;

  return (
    <div className="bg-dark-card border border-[#333] rounded-xl p-5">
      {/* The request's state, stated before anything else. In the Decided
          tray this is the headline: REJECTED, APPROVED or CANCELLED — with
          when it was decided beside it. */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusStyle}`}>
          {statusLabel}
        </span>
        {decided && (
          <span className="text-[10px] uppercase tracking-wider text-gray-500">
            Decided {fmt(decided)}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold">{request.employeeName}</span>
            <span className="mono text-gray-500 text-xs">{request.sapNumber}</span>
            <span className="text-gray-500 text-xs">{request.departmentLabel || request.department}</span>
            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-primary/50 text-primary">
              {request.leaveTypeLabel || request.leaveType}
            </span>
            {request.requestedDays >= (policy?.handoverNoteRequiredDays || 999) && (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-[#444] text-gray-400">
                handover: {request.handoverTo || 'not named'}
              </span>
            )}
            {request.lodgedBy && (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-status-warning/50 text-status-warning">
                🧑‍💼 lodged by HR
              </span>
            )}
            {ownerStatus === 'inactive' && (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-status-danger/50 text-status-danger"
                title="This person has left the company — confirm with HR before signing anything for them.">
                🚫 left the company
              </span>
            )}
            {spansLeaveYear(request.leaveCommences, request.leaveEnds, policy) && (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-[#444] text-gray-400"
                title={`Charged wholly to leave year ${request.leaveYear}, by the convention for ranges crossing the boundary.`}>
                spans two leave years
              </span>
            )}
          </div>
          <div className="text-gray-400 text-sm mt-1">
            {fmt(request.leaveCommences)} → {fmt(request.leaveEnds)} · <strong className="text-white">{request.requestedDays}</strong> working days · resumes {fmt(request.resumptionDate)}
          </div>
          {request.purpose && <div className="text-gray-500 text-xs mt-1">Reason given: {request.purpose}</div>}
          {request.handoverNote && (
            <div className="text-gray-500 text-xs mt-1">Handover note: {request.handoverNote}</div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Snapshot</div>
          <div className="text-xs text-gray-400 mono">
            entitled {request.entitledAtRequest} · taken {request.takenBeforeThisRequest} · after <strong className={request.outstandingAfter < 0 ? 'text-status-danger' : 'text-status-success'}>{request.outstandingAfter}</strong>
          </div>
        </div>
      </div>

      {/* CANCEL — HR and the system owner, on pending AND approved cards.
          RENDERED ON canManage ALONE, deliberately outside the signing block
          above. The first version of this button lived inside `canAct`, which
          only renders when the viewer can sign the CURRENT stage — and an
          approved request has no current stage, so the people this button
          was built for never saw it at all. Found live by the founder,
          27 Oct 2026; the browser suite now walks the whole chain and
          reverses an approval through this exact button. */}
      {canManage && request.status !== 'cancelled' && request.status !== 'rejected' && (
        <div className="mt-4 pt-4 border-t border-[#333]">
          {!showCancel && !showRecall ? (
            <div className="flex items-center gap-2 flex-wrap">
              {request.status === 'approved' && started ? (
                <button onClick={() => setShowRecall(true)} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#333] text-gray-300 hover:bg-status-warning hover:text-white transition-colors disabled:opacity-50"
                  title="Cut this leave short at the point of return — the days already taken stay counted, the rest return to the balance.">
                  ↩ Recall from leave
                </button>
              ) : (
                <button onClick={() => {
                  if (request.status === 'approved') { setShowCancel(true); }
                  else { setShowCancel(true); } // pending: still show confirm dialog, but reason optional
                }} disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#333] text-gray-300 hover:bg-status-danger hover:text-white transition-colors disabled:opacity-50"
                  title={request.status === 'approved'
                    ? 'Reverse this approved leave — a written reason is recorded on the request.'
                    : 'Cancel this pending request; the days return to the employee.'}>
                  ✕ {request.status === 'approved' ? 'Cancel this approved leave' : 'Cancel this request'}
                </button>
              )}
              <span className="text-gray-500 text-xs">
                {request.status === 'approved' && started
                  ? 'Cutting leave short keeps the days already taken on the record; the unused days return.'
                  : request.status === 'approved'
                    ? 'Reversing approved leave requires a written reason; it is recorded on the request.'
                    : 'The days return to the employee' + '’' + 's balance.'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={request.status === 'approved'
                  ? 'Reason for cancelling approved leave — recorded on the request (required)'
                  : 'Reason for cancelling (optional) — recorded on the request'}
                className="w-full bg-[#1a1a1a] text-white border border-status-warning/50 p-3 rounded-lg outline-none focus:border-status-warning text-sm"
              />
              <div className="flex gap-2">
                <button onClick={doCancel} disabled={busy || (request.status === 'approved' && !note.trim())}
                  className="bg-status-danger text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#E53935] transition-colors disabled:opacity-50">
                  {busy ? 'Cancelling…' : 'Confirm — cancel this leave'}
                </button>
                <button onClick={() => { setShowCancel(false); setNote(''); }}
                  className="bg-[#333] text-gray-300 font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#444] transition-colors">
                  Back
                </button>
              </div>
              {request.status === 'approved' && (
                <span className="text-gray-500 text-xs">Approved leave requires a written reason.</span>
              )}
            </div>
          )}

          {showRecall && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Returned to work on</label>
                  <input type="date"
                    value={returnDate || todayKey()}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-[#1a1a1a] text-white border border-status-warning/50 p-3 rounded-lg outline-none focus:border-status-warning text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Reason (required)</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Production emergency on Line 2"
                    className="w-full bg-[#1a1a1a] text-white border border-status-warning/50 p-3 rounded-lg outline-none focus:border-status-warning text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={doRecall} disabled={busy || !note.trim()}
                  className="bg-status-warning text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#e68900] transition-colors disabled:opacity-50">
                  {busy ? 'Recalling…' : 'Confirm — cut this leave short'}
                </button>
                <button onClick={() => { setShowRecall(false); setNote(''); setReturnDate(''); }}
                  className="bg-[#333] text-gray-300 font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#444] transition-colors">
                  Back
                </button>
              </div>
              <span className="text-gray-500 text-xs">
                The app works out the days already taken; the unused days return to the balance at once.
              </span>
            </div>
          )}
        </div>
      )}

      {/* What became of the request. In the Decided tray this is the answer
          the approver is looking for: REJECTED with the reason the employee
          reads, or the note that the days were released on cancellation. */}
      <OutcomeBlock request={request} />

      {awayWarning && (
        <div className="mt-3 bg-status-warning/10 border border-status-warning/40 rounded-lg px-3 py-2 text-xs text-status-warning">
          ⚠️ {awayWarning}
        </div>
      )}

      {canAct && (
        <div className="mt-4 pt-4 border-t border-[#333]">
          {showReject ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for rejection — the employee will see this"
                className="w-full bg-[#1a1a1a] text-white border border-status-danger/50 p-3 rounded-lg outline-none focus:border-status-danger text-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => act('reject')} disabled={busy}
                  className="bg-status-danger text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#E53935] transition-colors disabled:opacity-50">
                  {busy ? 'Saving…' : 'Confirm rejection'}
                </button>
                <button onClick={() => { setShowReject(false); setNote(''); }}
                  className="bg-[#333] text-gray-300 font-bold px-4 py-2 rounded-lg text-sm hover:bg-[#444] transition-colors">
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => act('approve')} disabled={busy}
                className="bg-status-success text-black font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-[#00C853] transition-colors disabled:opacity-50">
                {busy ? 'Signing…' : `✓ Sign as ${stage?.label || 'approver'}`}
              </button>
              <button onClick={() => { if (policy?.requireRejectionReason !== false) setShowReject(true); else act('reject'); }} disabled={busy}
                className="bg-[#333] text-gray-300 font-bold px-4 py-2.5 rounded-lg text-sm hover:bg-status-danger hover:text-white transition-colors disabled:opacity-50">
                ✕ Reject
              </button>
              <span className="text-gray-500 text-xs">
                {verdict.actedAsDeputyFor
                  ? `You are standing in: ${verdict.actedAsDeputyFor}. This is recorded on the request.`
                  : 'Your signature moves this to the next stage — one stage at a time.'}
              </span>
            </div>
          )}

        </div>
      )}

      {!verdict.can && at !== -1 && (
        <div className="mt-3 text-xs text-gray-500">{verdict.reason}</div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mt-1">
        <Stepper request={request} policy={policy} highlight={canAct} />
        <Link to={`/print/leave/${request.id}`} title="Print this form"
          className="no-underline px-3 py-1.5 rounded-lg text-xs font-bold bg-[#333] text-gray-300 hover:bg-primary hover:text-black transition-colors">
          🖨️ Print
        </Link>
      </div>
    </div>
  );
}

export default function LeaveApprovals() {
  const { currentUser, systemRole, actionRoles, departmentRoles, uid, userFullName } = useAuth();
  const { config, loadingConfig } = useConfig();
  const { isOnline } = useNetwork();
  const policy = config?.leavePolicy;

  const [requests, setRequests] = useState([]);
  const [access, setAccess] = useState({ people: [], ready: false });
  // The approver's own record — for the "you cannot sign your own leave"
  // rule and for cancelling as the owner of a request.
  const employee = useEmployeeRecord();
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState('mine');

  // The actor's own employee record id, resolved from the joined access
  // view. The chain needs it for one rule above all others: nobody signs
  // their own leave, whatever hat they wear. While the access view loads
  // the id is null and the self-check is skipped — an approver with no
  // employee record cannot own a request in the first place.
  const actorEmployeeId = useMemo(
    () => (access.people || []).find(p => p.linkedUserUid === uid)?.id ?? null,
    [access.people, uid],
  );

  const user = useMemo(
    () => ({ uid, email: currentUser?.email, userFullName, systemRole, actionRoles, employeeId: actorEmployeeId }),
    [uid, currentUser?.email, userFullName, systemRole, actionRoles, actorEmployeeId],
  );

  // Who may cancel: HR (department), the Head of HR, or the system owner.
  const canManage = useMemo(
    () => systemRole === 'super_admin'
      || (actionRoles || []).includes('leave_hr_head')
      || (departmentRoles || []).some(r => ['hr_staff', 'hr_manager'].includes(r)),
    [systemRole, actionRoles, departmentRoles],
  );

  useEffect(() => subscribeToLeaveRequests(setRequests), []);
  useEffect(() => subscribeToAccessView(setAccess), []);

  const buckets = useMemo(() => {
    if (!policy) return { mine: [], others: [], decided: [] };
    const mine = [], others = [], decided = [];
    for (const r of requests) {
      const at = currentStageIndex(r, policy);
      if (at === -1) { decided.push(r); continue; }
      const verdict = userCanActAtStage({ request: r, policy, stageIndex: at, user });
      if (verdict.can) mine.push(r);
      else if (userInvolvement({ policy, user })) others.push(r);
    }
    // Newest decision first. The requests arrive ordered by submission date,
    // which is the right order while they are live — but in the Decided tray
    // the useful question is "what happened most recently?", and a request
    // lodged months ago and rejected this morning belongs at the top.
    decided.sort((a, b) => (decidedAt(b)?.getTime() || 0) - (decidedAt(a)?.getTime() || 0));
    return { mine, others, decided };
  }, [requests, policy, user]);

  // Which approvers are THEMSELVES on approved leave right now, per stage —
  // so the queue can warn before it deadlocks, which is the single most
  // common way a leave system seizes up (blueprint A18).
  //
  // Resolution: subscribeToAccessView joins employees to their role
  // documents, so a "holder" is any person whose login carries the stage's
  // action role, plus the stage's named deputy. The employees collection
  // alone cannot answer this — action roles live on user_roles.
  // employmentStatus by employee id, for the "left the company" badge.
  const statusById = useMemo(() => {
    const m = new Map();
    for (const person of access.people || []) m.set(person.id, person.employmentStatus);
    return m;
  }, [access.people]);

  const awayByRole = useMemo(() => {
    if (!policy) return {};
    const approved = requests.filter(r => r.status === 'approved');
    const byRole = {};
    for (const stage of policy.stages || []) {
      const holders = (access.people || [])
        .filter(p => {
          const roles = p.role?.actionRoles || p.role?.approvalRoles || [];
          return roles.includes(stage.actionRole)
            || (stage.deputyUserUid && p.linkedUserUid === stage.deputyUserUid);
        })
        .map(p => ({ employeeId: p.id, fullName: p.fullName }));
      byRole[stage.id] = awayHolders({ holders, requests: approved, onDate: new Date() });
    }
    return byRole;
  }, [policy, requests, access]);

  const handleCancel = async (request, reason) => {
    const res = await cancelLeaveRequest(request.id, {
      employeeId: employee?.id ?? null,
      user: { email: currentUser?.email },
      policy,
      isAdmin: systemRole === 'super_admin',
      isHr: canManage && systemRole !== 'super_admin',
      reason,
    });
    setNotice(res.ok
      ? { ok: true, text: 'Leave cancelled. The days returned to the employee’s balance.' }
      : { ok: false, text: res.error });
    return res;
  };

  const handleRecall = async (request, { returnedOn, reason }) => {
    const res = await recallFromLeave(request.id, {
      returnedOn, reason,
      user: { email: currentUser?.email },
      policy,
      isAdmin: systemRole === 'super_admin',
      isHr: canManage && systemRole !== 'super_admin',
    });
    setNotice(res.ok
      ? { ok: true, text: `Recalled from leave — ${res.daysConsumed} day(s) taken, ${res.daysReturned} returned to the balance.` }
      : { ok: false, text: res.error });
    return res;
  };

  const handleDecide = async (request, decision, note) => {
    const res = await decideLeaveRequest(request.id, {
      decision, note, user, policy, isOnline,
    });
    setNotice(res.ok
      ? { ok: true, text: decision === 'approve'
          ? `Signed. ${res.status === 'approved' ? 'The leave is now fully approved.' : 'Moved to the next stage.'}`
          : 'Request rejected — the employee will see the reason.' }
      : { ok: false, text: res.error });
    return res;
  };

  if (loadingConfig) {
    return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading…</div></Layout>;
  }

  // Involvement is a property of the person and the chain, not of any single
  // request (userInvolvement takes no request on purpose), so this is "is
  // there anything here AND are you part of the leave machinery at all".
  const involved = requests.length > 0 && userInvolvement({ policy, user });

  // An approver who is nothing to do with leave at all should not see a wall
  // of other people's requests — but HR department users reach this page via
  // the menu, so they get the oversight view rather than a locked screen.
  const isOversight = (systemRole === 'super_admin')
    || (actionRoles || []).includes('leave_hr_head');

  if (!involved && requests.length > 0 && !isOversight && buckets.mine.length === 0 && buckets.others.length === 0) {
    return (
      <Layout title="Leave Approvals" subtitle="Nothing waiting for you" maxWidth="max-w-3xl">
        <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-lg font-bold text-white mb-2">No leave requests need your signature</h2>
          <p className="text-gray-400 text-sm">
            You are not one of the approvers in the leave chain. Employees' requests appear here
            the moment a stage reaches you.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="✅ Leave Approvals" subtitle="Sign at your stage of the chain — one stage at a time" maxWidth="max-w-5xl">
      <div className="flex flex-col gap-6 pb-16">

        {notice && (
          <div className={`rounded-xl px-5 py-3 text-sm ${notice.ok ? 'bg-status-success/10 border border-status-success/50 text-status-success' : 'bg-status-danger/10 border border-status-danger/50 text-status-danger'}`}>
            {notice.text}
          </div>
        )}

        {!isOnline && (
          <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-5 py-4">
            <div className="text-status-warning font-bold text-sm mb-1">⏳ Approval needs a connection.</div>
            <p className="text-status-warning/80 text-xs">
              Nothing has been saved — reconnect and try again. Submissions work offline; approvals
              do not, because an approval authorises paid leave and must exist in the database the
              moment it is made.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {[
            { id: 'mine', label: `Waiting for you (${buckets.mine.length})` },
            { id: 'others', label: `Waiting on others (${buckets.others.length})` },
            { id: 'decided', label: `Decided (${buckets.decided.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider border transition-colors ${tab === t.id ? 'bg-primary text-black border-primary' : 'border-[#444] text-gray-400 hover:border-[#666]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'mine' && (
          buckets.mine.length === 0
            ? <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center text-gray-500 text-sm">Nothing is waiting on your signature. 🎉</div>
            : <div className="flex flex-col gap-4">
                {buckets.mine.map(r => (
                  <RequestCard key={r.id} request={r} policy={policy} user={user}
                    isOnline={isOnline} onDecide={handleDecide} onCancel={handleCancel} onRecall={handleRecall}
                    canManage={canManage} ownerStatus={statusById.get(r.employeeId)}
                    awayWarning={awayWarningFor(r, policy, awayByRole)} />
                ))}
              </div>
        )}

        {tab === 'others' && (
          buckets.others.length === 0
            ? <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center text-gray-500 text-sm">Nothing in the pipeline ahead of you.</div>
            : <div className="flex flex-col gap-4">
                {buckets.others.map(r => (
                  <RequestCard key={r.id} request={r} policy={policy} user={user}
                    isOnline={isOnline} onDecide={handleDecide} onCancel={handleCancel} onRecall={handleRecall}
                    canManage={canManage} ownerStatus={statusById.get(r.employeeId)} />
                ))}
              </div>
        )}

        {tab === 'decided' && (
          buckets.decided.length === 0
            ? <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center text-gray-500 text-sm">No requests have been decided yet.</div>
            : <div className="flex flex-col gap-4">
                {buckets.decided.map(r => (
                  <RequestCard key={r.id} request={r} policy={policy} user={user}
                    isOnline={isOnline} onDecide={handleDecide} onCancel={handleCancel} onRecall={handleRecall}
                    canManage={canManage} ownerStatus={statusById.get(r.employeeId)} />
                ))}
              </div>
        )}
      </div>
    </Layout>
  );
}

// Build the human warning for a card: is an approver for the CURRENT stage
// away right now? Resolved from the stage's named deputy when one is set,
// because that is the one person we KNOW is meant to cover.
function awayWarningFor(request, policy, awayByRole) {
  const at = currentStageIndex(request, policy);
  const stage = policy?.stages?.[at];
  if (!stage) return null;
  const away = awayByRole?.[stage.id] || [];
  if (!away.length) return null;
  const names = away.map(a => a.holder.fullName).join(', ');
  return `${stage.label} approver away: ${names} (back ${fmt(away[0].until)}). ${stage.deputyName ? `${stage.deputyName} is the named deputy and may sign.` : 'The Head of HR may step in.'}`;
}
