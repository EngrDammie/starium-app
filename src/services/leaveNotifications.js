// src/services/leaveNotifications.js
//
// The app-side queue-and-send layer. Every leave event that should
// trigger an email writes ONE document here (deterministic id:
// {requestId}_{event}), then fires a POST to the Worker with the
// caller's own Firebase ID token. The Worker reads back the same
// document (via the caller's token — rules are the gate) and either
// skips it if status === 'sent', or sends the mail and returns
// { ok: true, recipients: [...] } which we record as status: 'sent'.
// Failures are recorded as status: 'failed' with the error text.
//
// The Worker is stateless. The queue IS the audit trail. If the Worker
// never ran again, 'queued' means "not yet delivered" — still true.
//
// The deterministic id makes every (request, event) pair exactly one
// send — no race, no double-send, no schedule. The only way an
// email goes twice is if someone deletes the queue doc, which only
// the owner can do (and only for their own documents, by rule).

import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// The Worker's live URL — keep in sync with wrangler.toml deploy.
const WORKER_URL = 'https://starium-leave-mail.dammieoptimus.workers.dev';

const EVENTS = new Set([
  'submitted',
  'stage_signed',
  'approved',
  'rejected',
  'lodged',
  'cancelled',
  'recalled',
]);

function queueDocId(requestId, event) {
  if (!EVENTS.has(event)) throw new Error(`Unknown leave event: ${event}`);
  return `${requestId}_${event}`;
}

async function getIdToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return user.getIdToken(true); // force refresh so it's fresh for the Worker
}

// Writes the queue document (idempotent: if it exists with 'sent' we still
// write 'queued' — the Worker will short-circuit on read). Returns the doc id.
async function writeQueueDoc(requestId, event, extra = {}) {
  const id = queueDocId(requestId, event);
  const ref = doc(db, 'leave_notifications', id);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().status === 'sent') {
    // Already sent — don't downgrade, just return the id.
    return id;
  }
  await setDoc(ref, {
    requestId,
    event,
    status: 'queued',
    createdAt: serverTimestamp(),
    ...extra,
  }, { merge: true });
  return id;
}

async function markQueueDoc(id, status, detail = {}) {
  const ref = doc(db, 'leave_notifications', id);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
    ...detail,
  });
}

// Calls the Worker. The Worker returns:
//   { ok: true, recipients: [...], rejected?: N, skipped?: 'already-sent' }
// or an error response with { ok: false, error: '...' }.
async function callWorker(requestId, event, stageId) {
  const token = await getIdToken();
  const res = await fetch(`${WORKER_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId, event, stageId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.detail || `Worker HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Queue an email for a leave event, then try to send it immediately.
 * Returns { queued: true, sent: boolean, recipients?, error? }.
 * Never throws — callers must not crash on notification failure.
 */
export async function notifyLeaveEvent(requestId, event, stageId) {
  if (!EVENTS.has(event)) return { queued: false, sent: false, error: 'unknown event' };

  let queueId;
  try {
    queueId = await writeQueueDoc(requestId, event, { stageId: stageId || null });
  } catch (error) {
    // Could not write the queue doc (e.g. permission denied) — log and return,
    // the operation that triggered this notification already succeeded.
    console.warn('[leaveNotifications] queue write failed:', error);
    return { queued: false, sent: false, error: String(error.message || error).slice(0, 300) };
  }

  try {
    const result = await callWorker(requestId, event, stageId);
    if (result.skipped === 'already-sent') {
      await markQueueDoc(queueId, 'sent', { skipped: true, recipients: [] });
      return { queued: true, sent: true, skipped: true, recipients: [] };
    }
    await markQueueDoc(queueId, 'sent', { recipients: result.recipients, rejected: result.rejected || 0 });
    return { queued: true, sent: true, recipients: result.recipients };
  } catch (error) {
    await markQueueDoc(queueId, 'failed', { error: String(error.message || error).slice(0, 300) });
    return { queued: true, sent: false, error: String(error.message || error).slice(0, 300) };
  }
}

// Convenience wrappers for each choke point — the event name is fixed,
// the stageId is optional (used only for 'cancelled' to know which
// stage's holders to notify).
export const leaveNotifications = {
  submitted: (requestId) => notifyLeaveEvent(requestId, 'submitted'),
  stageSigned: (requestId, stageId) => notifyLeaveEvent(requestId, 'stage_signed', stageId),
  approved: (requestId) => notifyLeaveEvent(requestId, 'approved'),
  rejected: (requestId) => notifyLeaveEvent(requestId, 'rejected'),
  lodged: (requestId) => notifyLeaveEvent(requestId, 'lodged'),
  cancelled: (requestId, stageId) => notifyLeaveEvent(requestId, 'cancelled', stageId),
  recalled: (requestId) => notifyLeaveEvent(requestId, 'recalled'),
};