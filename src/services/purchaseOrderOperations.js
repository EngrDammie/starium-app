// src/services/purchaseOrderOperations.js
//
// Purchase Order operations — CRUD + approval workflow integration.

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, onSnapshot, orderBy, serverTimestamp, getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { initializeApprovalState, processApproval, canUserApprove } from './approvalEngine';

const POS_COLLECTION = collection(db, 'purchase_orders');

// ─── CREATE PO ───────────────────────────────────────────────────────

export async function createPurchaseOrder(poData, requestedByUid, requestedByName) {
  // Generate PO number: PO-YYYY-MM-DD-####
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const existing = await getDocs(query(POS_COLLECTION, where('poNumber', '>=', `PO-${dateStr}-`), orderBy('poNumber')));
  const seq = existing.size + 1;
  const poNumber = `PO-${dateStr}-${String(seq).padStart(4, '0')}`;

  // Initialize approval state
  const approvalState = initializeApprovalState('purchaseOrder', requestedByUid);

  const po = {
    poNumber,
    vendorId: poData.vendorId,
    vendorName: poData.vendorName,
    destinationWarehouseId: poData.destinationWarehouseId,
    lines: poData.lines.map((line, i) => ({
      lineNumber: i + 1,
      itemId: line.itemId,
      itemName: line.itemName,
      itemCode: line.itemCode,
      orderedQty: line.orderedQty,
      unitOfMeasure: line.unitOfMeasure,
      unitPrice: line.unitPrice,
      currency: 'NGN',
      taxRate: line.taxRate || 7.5,
      destinationBinId: line.destinationBinId,
      receivedQty: 0,
      status: 'PENDING'
    })),
    totalAmount: poData.lines.reduce((sum, l) => sum + (l.orderedQty * l.unitPrice), 0),
    approvalState,
    currentApprovalStep: approvalState.currentStep,
    requestedBy: requestedByUid,
    requestedByName,
    requestedAt: serverTimestamp(),
    expectedDeliveryDate: poData.expectedDeliveryDate,
    notes: poData.notes || '',
    status: approvalState.status, // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED | COMPLETED
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = doc(db, 'purchase_orders', poNumber);
  await setDoc(ref, po);
  return poNumber;
}

// ─── UPDATE PO (only if DRAFT) ──────────────────────────────────────

export async function updatePurchaseOrder(poNumber, updates) {
  const ref = doc(db, 'purchase_orders', poNumber);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

// ─── SUBMIT PO FOR APPROVAL ─────────────────────────────────────────

export async function submitPurchaseOrder(poNumber) {
  const ref = doc(db, 'purchase_orders', poNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('PO not found');
  const data = snap.data();

  if (data.status !== 'DRAFT') throw new Error('Only DRAFT POs can be submitted');

  const approvalState = initializeApprovalState('purchaseOrder', data.requestedBy);
  await updateDoc(ref, {
    status: approvalState.status,
    currentApprovalStep: approvalState.currentStep,
    approvalState,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return approvalState;
}

// ─── APPROVE / REJECT A STEP ────────────────────────────────────────

export async function processPoApproval(poNumber, action, actorRole, actorName, actorUid, rejectionReason = '') {
  const ref = doc(db, 'purchase_orders', poNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('PO not found');
  const data = snap.data();

  const result = processApproval(data.approvalState, action, actorRole, actorName, actorUid);
  if (!result.success) throw new Error(result.message);

  const updates = {
    approvalState: {
      ...result.steps ? { ...data.approvalState, steps: result.steps } : data.approvalState,
      ...result
    },
    currentApprovalStep: result.currentStep,
    status: result.newStatus,
    updatedAt: serverTimestamp()
  };

  if (result.approvedAt) updates.approvedAt = result.approvedAt;
  if (result.rejectedAt) updates.rejectedAt = result.rejectedAt;

  await updateDoc(ref, updates);
  return { ...result, poNumber };
}

// ─── CANCEL PO ──────────────────────────────────────────────────────

export async function cancelPurchaseOrder(poNumber, cancelledBy, reason) {
  const ref = doc(db, 'purchase_orders', poNumber);
  await updateDoc(ref, {
    status: 'CANCELLED',
    cancelledBy,
    cancelledAt: serverTimestamp(),
    cancelReason: reason,
    updatedAt: serverTimestamp()
  });
}

// ─── GET / SUBSCRIBE ────────────────────────────────────────────────

export async function getPurchaseOrder(poNumber) {
  const snap = await getDoc(doc(db, 'purchase_orders', poNumber));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToPurchaseOrders(callback, filter = {}) {
  let q = query(POS_COLLECTION, orderBy('createdAt', 'desc'));
  if (filter.status) {
    q = query(POS_COLLECTION, where('status', '==', filter.status), orderBy('createdAt', 'desc'));
  }
  if (filter.vendorId) {
    q = query(POS_COLLECTION, where('vendorId', '==', filter.vendorId), orderBy('createdAt', 'desc'));
  }
  if (filter.requestedBy) {
    q = query(POS_COLLECTION, where('requestedBy', '==', filter.requestedBy), orderBy('createdAt', 'desc'));
  }

  return onSnapshot(q, (snap) => {
    const pos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(pos);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('PO subscription error:', err);
    callback([]);
  });
}

export async function getAllPurchaseOrders() {
  const q = query(POS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingApprovalsForRole(userRole) {
  const q = query(POS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return all.filter(doc => {
    if (!doc.approvalState || !doc.approvalState.approvalEnabled) return false;
    if (doc.approvalState.status !== 'PENDING_APPROVAL') return false;
    const pendingStep = doc.approvalState.steps?.find(s => s.status === 'PENDING');
    return pendingStep ? pendingStep.role === userRole : false;
  });
}

// ─── LINE ITEM RECEIVED QTY UPDATE (called from GRN) ────────────────

export async function updatePoLineReceivedQty(poNumber, poLineNumber, receivedQty) {
  const ref = doc(db, 'purchase_orders', poNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('PO not found');
  const data = snap.data();

  const newLines = data.lines.map(line => {
    if (line.lineNumber === poLineNumber) {
      const newReceived = (line.receivedQty || 0) + receivedQty;
      return {
        ...line,
        receivedQty: newReceived,
        status: newReceived >= line.orderedQty ? 'COMPLETE' : newReceived > 0 ? 'PARTIAL' : 'PENDING'
      };
    }
    return line;
  });

  // Determine overall PO status
  const allComplete = newLines.every(l => l.status === 'COMPLETE');
  const anyReceived = newLines.some(l => l.status !== 'PENDING');
  const poStatus = allComplete ? 'COMPLETED' : anyReceived ? 'PARTIAL' : 'APPROVED';

  await updateDoc(ref, {
    lines: newLines,
    status: poStatus,
    updatedAt: serverTimestamp()
  });
}
