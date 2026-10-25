// src/components/leave/leaveStatus.js
//
// THE vocabulary for "what state is this request in?" — one place, so the
// employee's screen and the approver's screen can never disagree about what
// a status is called or what colour it wears.
//
// WHY THIS EXISTS (25 Oct 2026): the Approvals "Decided" tray showed the
// signatures that had been given but never the request's own conclusion — a
// rejected request carried a red SUPERVISOR tag and no visible REJECTED
// badge, and the reason the approver had written was only visible to the
// employee. Both screens now read from here.
//
// The two functions take the policy so the PENDING labels come from the
// configured stages rather than from a hard-coded list. HR may rename
// "HOD / Subsidiary" at any time; a hard-coded label map would keep saying
// HOD while the rest of the app says the new name, and a hard-coded style
// map would silently lose its colour for any id it had not seen before.

// Terminal states. Pending states are derived, because their labels belong
// to the policy, not to this file.
const TERMINAL_LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const PENDING_STYLE = 'bg-status-warning/20 text-status-warning border-status-warning/40';

const TERMINAL_STYLES = {
  approved: 'bg-status-success/20 text-status-success border-status-success/40',
  rejected: 'bg-status-danger/20 text-status-danger border-status-danger/40',
  // Withdrawn is not a failure and not a success. Grey says "no longer
  // active" without implying anybody did anything wrong.
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-600',
};

export const isPending = (status) => String(status || '').startsWith('pending_');

export function leaveStatusLabel(status, policy) {
  if (!status) return '—';

  // "pending_hod" → "Awaiting HOD / Subsidiary", using whatever the stage is
  // actually called in the live policy.
  if (isPending(status)) {
    const stageId = status.slice('pending_'.length);
    const stage = (policy?.stages || []).find(s => s.id === stageId);
    return `Awaiting ${stage?.label || stageId}`;
  }

  return TERMINAL_LABELS[status] || status;
}

export function leaveStatusStyle(status) {
  if (!status) return 'border-[#333] text-gray-500';
  if (isPending(status)) return PENDING_STYLE;
  return TERMINAL_STYLES[status] || 'border-[#333] text-gray-500';
}

// The moment a request stopped being pending — approved, rejected or
// cancelled. Used by the Decided tray to sort newest-decision-first and to
// state when the decision happened. Returns a Date or null.
//
// Firestore Timestamps MUST be unwrapped through toDate() first: these three
// fields are not converted by the request reader, and new Date(timestamp) is
// an Invalid Date — which would silently blank the "Decided" line and make
// the sort fall back to submission order, with nothing visibly broken.
export function decidedAt(request) {
  const raw = request?.fullyApprovedAt || request?.rejectedAt || request?.cancelledAt;
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : (raw instanceof Date ? raw : new Date(raw));
  return isNaN(d) ? null : d;
}

// One sentence for the terminal states, written for the people who signed
// the request. The employee sees the same reason text on their own screen;
// this is the approvers' equivalent, not a second version of the truth.
export function outcomeNote(request) {
  if (!request) return null;
  if (request.status === 'rejected') {
    return request.rejectedReason
      ? { tone: 'danger', title: request.rejectedBy ? `Reason for rejection — ${request.rejectedBy}` : 'Reason for rejection', body: request.rejectedReason }
      : { tone: 'danger', title: 'Rejected', body: 'No reason was recorded.' };
  }
  if (request.status === 'cancelled') {
    return {
      tone: 'muted',
      title: 'Cancelled',
      body: request.cancelledBy
        ? `Withdrawn by ${request.cancelledBy} before final approval. The days returned to the employee's balance.`
        : 'Withdrawn before final approval. The days returned to the employee\'s balance.',
    };
  }
  if (request.status === 'approved') {
    return {
      tone: 'good',
      title: 'Approved — all signatures complete',
      body: 'The leave is unlocked. It appears on the dashboard and can be printed for the file.',
    };
  }
  return null;
}
