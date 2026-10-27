// src/resolve.js — who receives each event, and dedupe decisions.
//
// Two jobs, both server-side:
//
//   1. RECIPIENTS come from the live database, never from the caller. The
//      caller names an event; the data decides who hears about it.
//   2. DEDUPE is decided here too: the Firestore queue document (whose id is
//      deterministic — `{requestId}_{event}`) is the single authority on
//      whether an email has already gone out. If it says sent, nothing
//      happens, whoever is asking. This is why a retried approval can never
//      double-mail, and why a malicious replay of the same event hits a
//      wall: each (request, event) pair can ever send once.
//
// The worst case for a rogue authenticated user is therefore bounded by the
// data itself: one mail per legitimate (request, event) that has not yet
// been sent, addressed only to people already in the company's records.
// There is no rate limiter because the ceiling is structural, not statistical.

// Which stage is a request sitting at? Mirrors the app's status vocabulary.
export function currentStageId(request, policy) {
  const m = /^pending_(.+)$/.exec(String(request?.status || ''));
  if (!m) return null;
  const stage = (policy?.stages || []).find((s) => s.id === m[1]);
  return stage ? stage.id : null;
}

// The recipients and template inputs for an event, given the documents.
// Returns null when the event makes no sense for this request — which is
// also the answer to a caller asking for, say, "rejected" on an approved one.
export function resolveEvent(event, { request, employee, holders, policy, queueDoc }) {
  if (!request || !request.id) return null;

  // Dedupe: already sent? Then this event has had its email, whoever asks.
  if (queueDoc && queueDoc.status === 'sent') return { skipped: 'already-sent' };

  // The employee's contact address: prefer the request's own frozen contact
  // (it is the address the person gave for exactly this purpose), then the
  // roster record.
  const employeeEmail = request.contactEmail || employee?.email || null;

  const stageId = currentStageId(request, policy);
  const stage = (policy?.stages || []).find((s) => s.id === stageId);
  const firstStage = (policy?.stages || [])[0];

  switch (event) {
    case 'submitted': {
      // The knock on the first approver's door. Only meaningful while the
      // request still sits at the first stage.
      if (stageId !== (firstStage?.id || null)) return null;
      return {
        recipients: (holders || []).map((h) => h.email).filter(Boolean),
        stageLabel: firstStage?.label || null,
      };
    }

    case 'stage_signed': {
      // A stage just signed; the request now sits at the NEXT one. Only
      // meaningful while it is still pending somewhere.
      if (!stageId) return null;
      return {
        recipients: (holders || []).map((h) => h.email).filter(Boolean),
        stageLabel: stage?.label || null,
      };
    }

    case 'approved':
      if (request.status !== 'approved') return null;
      return { recipients: employeeEmail ? [employeeEmail] : [] };

    case 'rejected':
      if (request.status !== 'rejected') return null;
      return {
        recipients: employeeEmail ? [employeeEmail] : [],
        reason: request.rejectedReason || null,
      };

    case 'lodged':
      // HR filed it on the employee's behalf. Receipt only — the approvers
      // are notified by the companion 'submitted' event.
      if (!request.lodgedBy) return null;
      return { recipients: employeeEmail ? [employeeEmail] : [] };

    case 'recalled':
      if (request.status !== 'recalled') return null;
      return {
        recipients: employeeEmail ? [employeeEmail] : [],
        reason: request.recallReason || null,
        actorEmail: request.recalledBy || null,
      };

    case 'cancelled':
      if (request.status !== 'cancelled') return null;
      // The person whose leave it was, and — if a stageId was recorded
      // before the cancellation — whoever was holding it, so nobody reviews
      // a request that has been taken back.
      return {
        recipients: [employeeEmail, ...(holders || []).map((h) => h.email)].filter(Boolean),
        reason: request.cancelledReason || null,
        actorEmail: request.cancelledBy || null,
      };

    default:
      return null;
  }
}

// Which user_roles documents hold a given action role — the input to the
// approver notifications. The Firestore query itself lives in firestore.js;
// this exists separately so it can be tested without a database.
export function emailsOfHolders(roleDocs) {
  return (roleDocs || []).map((d) => d.email).filter(Boolean);
}
