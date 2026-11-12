// src/services/erpNotifications.js
//
// ERP Notifications — queue-and-send layer for procurement/warehouse/production events.
// Uses the same Cloudflare Email Worker as leave notifications.
// Deterministic queue ID: {entityId}_{event} for idempotent dedupe.

import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// The Worker's live URL — same worker, different endpoint
const WORKER_URL = 'https://starium-leave-mail.dammieoptimus.workers.dev';

const ERP_EVENTS = new Set([
  // Purchase Order events
  'po_submitted',
  'po_approved',
  'po_rejected',
  'po_cancelled',
  // Goods Receipt events
  'grn_posted',
  'grn_shortfall',
  // Credit Note events
  'cn_created',
  'cn_sent',
  'cn_accepted',
  'cn_applied',
  // Stock Transfer events
  'transfer_created',
  'transfer_approved',
  'transfer_rejected',
  'transfer_issued',
  'transfer_received',
  // BOM events
  'bom_submitted',
  'bom_approved',
  'bom_rejected',
  // Production events
  'production_started',
  'production_completed',
  'production_variance',
]);

function queueDocId(entityId, event) {
  if (!ERP_EVENTS.has(event)) throw new Error(`Unknown ERP event: ${event}`);
  return `${entityId}_${event}`;
}

async function getIdToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  return user.getIdToken(true);
}

async function writeQueueDoc(entityId, event, extra = {}) {
  const id = queueDocId(entityId, event);
  const ref = doc(db, 'erp_notifications', id);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().status === 'sent') {
    return id;
  }
  await setDoc(ref, {
    entityId,
    event,
    status: 'queued',
    createdAt: serverTimestamp(),
    ...extra,
  }, { merge: true });
  return id;
}

async function markQueueDoc(id, status, detail = {}) {
  const ref = doc(db, 'erp_notifications', id);
  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
    ...detail,
  });
}

async function callWorker(entityId, event, extra = {}) {
  const token = await getIdToken();
  const res = await fetch(`${WORKER_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ entityId, event, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.detail || `Worker HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Queue an email for an ERP event, then try to send it immediately.
 * Returns { queued: true, sent: boolean, recipients?, error? }.
 * Never throws — callers must not crash on notification failure.
 */
export async function notifyErpEvent(entityId, event, extra = {}) {
  if (!ERP_EVENTS.has(event)) return { queued: false, sent: false, error: 'unknown event' };

  let queueId;
  try {
    queueId = await writeQueueDoc(entityId, event, extra);
  } catch (error) {
    console.warn('[erpNotifications] queue write failed:', error);
    return { queued: false, sent: false, error: String(error.message || error).slice(0, 300) };
  }

  try {
    const result = await callWorker(entityId, event, extra);
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

// Convenience wrappers for each ERP choke point
export const erpNotifications = {
  // Purchase Order
  poSubmitted: (poNumber, extra) => notifyErpEvent(poNumber, 'po_submitted', extra),
  poApproved: (poNumber, extra) => notifyErpEvent(poNumber, 'po_approved', extra),
  poRejected: (poNumber, extra) => notifyErpEvent(poNumber, 'po_rejected', extra),
  poCancelled: (poNumber, extra) => notifyErpEvent(poNumber, 'po_cancelled', extra),

  // Goods Receipt
  grnPosted: (grnNumber, extra) => notifyErpEvent(grnNumber, 'grn_posted', extra),
  grnShortfall: (grnNumber, extra) => notifyErpEvent(grnNumber, 'grn_shortfall', extra),

  // Credit Note
  cnCreated: (cnNumber, extra) => notifyErpEvent(cnNumber, 'cn_created', extra),
  cnSent: (cnNumber, extra) => notifyErpEvent(cnNumber, 'cn_sent', extra),
  cnAccepted: (cnNumber, extra) => notifyErpEvent(cnNumber, 'cn_accepted', extra),
  cnApplied: (cnNumber, extra) => notifyErpEvent(cnNumber, 'cn_applied', extra),

  // Stock Transfer
  transferCreated: (transferNumber, extra) => notifyErpEvent(transferNumber, 'transfer_created', extra),
  transferApproved: (transferNumber, extra) => notifyErpEvent(transferNumber, 'transfer_approved', extra),
  transferRejected: (transferNumber, extra) => notifyErpEvent(transferNumber, 'transfer_rejected', extra),
  transferIssued: (transferNumber, extra) => notifyErpEvent(transferNumber, 'transfer_issued', extra),
  transferReceived: (transferNumber, extra) => notifyErpEvent(transferNumber, 'transfer_received', extra),

  // BOM
  bomSubmitted: (bomId, extra) => notifyErpEvent(bomId, 'bom_submitted', extra),
  bomApproved: (bomId, extra) => notifyErpEvent(bomId, 'bom_approved', extra),
  bomRejected: (bomId, extra) => notifyErpEvent(bomId, 'bom_rejected', extra),

  // Production
  productionStarted: (orderNumber, extra) => notifyErpEvent(orderNumber, 'production_started', extra),
  productionCompleted: (orderNumber, extra) => notifyErpEvent(orderNumber, 'production_completed', extra),
  productionVariance: (orderNumber, extra) => notifyErpEvent(orderNumber, 'production_variance', extra),
};