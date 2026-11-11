// src/services/stockTransferOperations.js
//
// Stock Transfer operations — move stock from any warehouse to any warehouse.
// Two-step: Source ISSUES → Destination RECEIVES.
// Configurable approval chain (default OFF).

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, onSnapshot, orderBy, serverTimestamp, getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { initializeApprovalState, processApproval } from './approvalEngine';
import { createStockLedgerEntry } from './stockLedgerOperations';

const TRANSFERS_COLLECTION = collection(db, 'stock_transfers');

// ─── CREATE STOCK TRANSFER ───────────────────────────────────────────

export async function createStockTransfer(transferData, requestedByUid, requestedByName) {
  // Generate number: ST-YYYY-MM-DD-####
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const existing = await getDocs(query(TRANSFERS_COLLECTION, where('transferNumber', '>=', `ST-${dateStr}-`), orderBy('transferNumber')));
  const seq = existing.size + 1;
  const transferNumber = `ST-${dateStr}-${String(seq).padStart(4, '0')}`;

  // Initialize approval state
  const approvalState = initializeApprovalState('stockTransfer', requestedByUid);

  const transfer = {
    transferNumber,
    fromWarehouseId: transferData.fromWarehouseId,
    fromWarehouseName: transferData.fromWarehouseName,
    toWarehouseId: transferData.toWarehouseId,
    toWarehouseName: transferData.toWarehouseName,
    status: approvalState.status, // DRAFT | PENDING_APPROVAL | APPROVED | IN_TRANSIT | COMPLETED | CANCELLED | REJECTED
    approvalState,
    currentApprovalStep: approvalState.currentStep,
    requestedBy: requestedByUid,
    requestedByName,
    requestedAt: serverTimestamp(),
    issuedBy: null,
    issuedAt: null,
    receivedBy: null,
    receivedAt: null,
    lines: transferData.lines.map((line, i) => ({
      lineNumber: i + 1,
      itemId: line.itemId,
      itemName: line.itemName,
      lotId: line.lotId,
      requestedQty: line.requestedQty,
      issuedQty: 0,
      receivedQty: 0,
      unitOfMeasure: line.unitOfMeasure,
      fromBinId: line.fromBinId,
      toBinId: line.toBinId,
      notes: line.notes || ''
    })),
    notes: transferData.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = doc(db, 'stock_transfers', transferNumber);
  await setDoc(ref, transfer);
  return transferNumber;
}

// ─── SUBMIT FOR APPROVAL ─────────────────────────────────────────────

export async function submitStockTransfer(transferNumber) {
  const ref = doc(db, 'stock_transfers', transferNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found');
  const data = snap.data();

  if (data.status !== 'DRAFT') throw new Error('Only DRAFT transfers can be submitted');

  const approvalState = initializeApprovalState('stockTransfer', data.requestedBy);
  await updateDoc(ref, {
    status: approvalState.status,
    currentApprovalStep: approvalState.currentStep,
    approvalState,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return approvalState;
}

// ─── PROCESS APPROVAL STEP ───────────────────────────────────────────

export async function processTransferApproval(transferNumber, action, actorRole, actorName, actorUid) {
  const ref = doc(db, 'stock_transfers', transferNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found');
  const data = snap.data();

  const result = processApproval(data.approvalState, action, actorRole, actorName, actorUid);
  if (!result.success) throw new Error(result.message);

  const updates = {
    approvalState: { ...data.approvalState, steps: result.steps, ...result },
    currentApprovalStep: result.currentStep,
    status: result.newStatus,
    updatedAt: serverTimestamp()
  };

  if (result.approvedAt) updates.approvedAt = result.approvedAt;
  if (result.rejectedAt) updates.rejectedAt = result.rejectedAt;

  await updateDoc(ref, updates);
  return { ...result, transferNumber };
}

// ─── ISSUE (Warehouse Clerk) ─────────────────────────────────────────

export async function issueStockTransfer(transferNumber, issuedByUid, issuedByName) {
  const ref = doc(db, 'stock_transfers', transferNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found');
  const data = snap.data();

  if (data.status !== 'APPROVED' && data.status !== 'PENDING_APPROVAL') {
    // If approval not required, APPROVED status means ready to issue
    if (data.status !== 'APPROVED') throw new Error('Transfer must be APPROVED before issuing');
  }

  // Check stock availability for each line
  for (const line of data.lines) {
    const currentStock = await getCurrentStockForBin(line.fromBinId, line.itemId, line.lotId);
    if (currentStock < line.requestedQty) {
      throw new Error(`Insufficient stock in ${line.fromBinId} for ${line.itemName}. Available: ${currentStock} ${line.unitOfMeasure}, requested: ${line.requestedQty}`);
    }
  }

  // Post TRANSFER_OUT ledger entries
  const ledgerEntries = data.lines.map(line => ({
    itemId: line.itemId,
    lotId: line.lotId,
    fromWarehouseId: data.fromWarehouseId,
    toWarehouseId: null, // in transit
    fromBinId: line.fromBinId,
    toBinId: null,
    movementType: 'TRANSFER_OUT',
    qty: line.requestedQty,
    unitOfMeasure: line.unitOfMeasure,
    referenceType: 'TRANSFER_ORDER',
    referenceId: transferNumber,
    performedBy: issuedByUid,
    performedAt: serverTimestamp(),
    notes: `Transfer ${transferNumber} - ISSUED from ${line.fromBinId}`
  }));

  await createStockLedgerEntry(ledgerEntries, issuedByUid);

  // Update transfer lines issuedQty
  const newLines = data.lines.map(line => ({
    ...line,
    issuedQty: line.requestedQty
  }));

  await updateDoc(ref, {
    status: 'IN_TRANSIT',
    issuedBy: issuedByUid,
    issuedByName: issuedByName,
    issuedAt: serverTimestamp(),
    lines: newLines,
    updatedAt: serverTimestamp()
  });
}

// ─── RECEIVE (Production Operator / Destination) ─────────────────────

export async function receiveStockTransfer(transferNumber, receivedByUid, receivedByName, receivedQtyOverrides = {}) {
  const ref = doc(db, 'stock_transfers', transferNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found');
  const data = snap.data();

  if (data.status !== 'IN_TRANSIT') throw new Error('Transfer must be IN_TRANSIT to receive');

  // Post TRANSFER_IN ledger entries
  const ledgerEntries = data.lines.map(line => {
    const receivedQty = receivedQtyOverrides[line.lineNumber] || line.issuedQty;
    return {
      itemId: line.itemId,
      lotId: line.lotId,
      fromWarehouseId: null,
      toWarehouseId: data.toWarehouseId,
      fromBinId: line.fromBinId,
      toBinId: line.toBinId,
      movementType: 'TRANSFER_IN',
      qty: receivedQty,
      unitOfMeasure: line.unitOfMeasure,
      referenceType: 'TRANSFER_ORDER',
      referenceId: transferNumber,
      performedBy: receivedByUid,
      performedAt: serverTimestamp(),
      notes: `Transfer ${transferNumber} - RECEIVED at ${line.toBinId}`
    };
  });

  await createStockLedgerEntry(ledgerEntries, receivedByUid);

  // Update transfer lines receivedQty
  const newLines = data.lines.map(line => ({
    ...line,
    receivedQty: receivedQtyOverrides[line.lineNumber] || line.issuedQty
  }));

  const allReceived = newLines.every(l => l.receivedQty >= l.issuedQty);

  await updateDoc(ref, {
    status: allReceived ? 'COMPLETED' : 'PARTIAL',
    receivedBy: receivedByUid,
    receivedByName: receivedByName,
    receivedAt: serverTimestamp(),
    lines: newLines,
    updatedAt: serverTimestamp()
  });
}

// ─── CANCEL ──────────────────────────────────────────────────────────

export async function cancelStockTransfer(transferNumber, cancelledBy, reason) {
  const ref = doc(db, 'stock_transfers', transferNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Transfer not found');
  const data = snap.data();

  if (data.status === 'COMPLETED') throw new Error('Cannot cancel COMPLETED transfer');

  await updateDoc(ref, {
    status: 'CANCELLED',
    cancelledBy,
    cancelledAt: serverTimestamp(),
    cancelReason: reason,
    updatedAt: serverTimestamp()
  });
}

// ─── GET / SUBSCRIBE ────────────────────────────────────────────────

export async function getStockTransfer(transferNumber) {
  const snap = await getDoc(doc(db, 'stock_transfers', transferNumber));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToStockTransfers(callback, filter = {}) {
  let q = query(TRANSFERS_COLLECTION, orderBy('createdAt', 'desc'));
  if (filter.status) q = query(TRANSFERS_COLLECTION, where('status', '==', filter.status), orderBy('createdAt', 'desc'));
  if (filter.fromWarehouseId) q = query(TRANSFERS_COLLECTION, where('fromWarehouseId', '==', filter.fromWarehouseId), orderBy('createdAt', 'desc'));
  if (filter.toWarehouseId) q = query(TRANSFERS_COLLECTION, where('toWarehouseId', '==', filter.toWarehouseId), orderBy('createdAt', 'desc'));
  if (filter.requestedBy) q = query(TRANSFERS_COLLECTION, where('requestedBy', '==', filter.requestedBy), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    const transfers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(transfers);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('stock transfer subscription error:', err);
    callback([]);
  });
}

export async function getAllStockTransfers() {
  const q = query(TRANSFERS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingApprovalsForRole(userRole) {
  const q = query(TRANSFERS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return all.filter(doc => {
    if (!doc.approvalState || !doc.approvalState.approvalEnabled) return false;
    if (doc.approvalState.status !== 'PENDING_APPROVAL') return false;
    const pendingStep = doc.approvalState.steps?.find(s => s.status === 'PENDING');
    return pendingStep ? pendingStep.role === userRole : false;
  });
}

// Helper: get current stock for a bin+item+lot
async function getCurrentStockForBin(binId, itemId, lotId = null) {
  const { getCurrentStock } = await import('./stockLedgerOperations');
  // We need to sum all ledger entries for this bin/item/lot
  // TRANSFER_IN adds, TRANSFER_OUT subtracts, ISSUE subtracts, etc.
  let q;
  if (lotId) {
    q = query(
      collection(db, 'stock_ledger'),
      where('itemId', '==', itemId),
      where('lotId', '==', lotId),
      where('toBinId', '==', binId),
      orderBy('performedAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'stock_ledger'),
      where('itemId', '==', itemId),
      where('toBinId', '==', binId),
      orderBy('performedAt', 'desc')
    );
  }

  const snap = await getDocs(q);
  let stock = 0;
  snap.docs.forEach(d => {
    const e = d.data();
    const isOut = ['TRANSFER_OUT', 'ISSUE', 'CONSUMPTION'].includes(e.movementType);
    stock += isOut ? -e.qty : e.qty;
  });
  return Math.max(0, stock);
}
