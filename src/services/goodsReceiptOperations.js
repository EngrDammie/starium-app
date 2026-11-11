// src/services/goodsReceiptOperations.js
//
// Goods Receipt Note (GRN) operations + Credit Note auto-drafting.
// 3-Way Match: PO qty vs GRN qty vs Invoice qty.

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, onSnapshot, orderBy, serverTimestamp, getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { updatePoLineReceivedQty } from './purchaseOrderOperations';
import { createStockLedgerEntry, subscribeToStockLedger } from './stockLedgerOperations';

const GRNS_COLLECTION = collection(db, 'goods_receipts');
const CREDIT_NOTES_COLLECTION = collection(db, 'credit_notes');

// ─── CREATE GRN ──────────────────────────────────────────────────────

export async function createGoodsReceipt(grnData, receivedByUid, receivedByName) {
  // Generate GRN number: GRN-YYYY-MM-DD-####
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const existing = await getDocs(query(GRNS_COLLECTION, where('grnNumber', '>=', `GRN-${dateStr}-`), orderBy('grnNumber')));
  const seq = existing.size + 1;
  const grnNumber = `GRN-${dateStr}-${String(seq).padStart(4, '0')}`;

  // Build GRN lines with 3-way match flags
  const grnLines = grnData.lines.map((line, i) => {
    const orderedQty = line.orderedQty || 0;
    const receivedQty = line.receivedQty || 0;
    const isShort = receivedQty < orderedQty;
    const isOver = receivedQty > orderedQty;
    const matchStatus = isShort ? 'SHORT' : isOver ? 'OVER' : 'EXACT';

    return {
      lineNumber: i + 1,
      poLineNumber: line.poLineNumber,
      itemId: line.itemId,
      itemName: line.itemName,
      orderedQty,
      receivedQty,
      unitOfMeasure: line.unitOfMeasure,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
      binId: line.binId,
      condition: line.condition, // GOOD | DAMAGED | SHORT | WRONG_ITEM
      matchStatus,
      notes: line.notes || ''
    };
  });

  // Check if any line is short → credit note needed
  const hasShortfall = grnLines.some(l => l.matchStatus === 'SHORT');
  const shortLines = grnLines.filter(l => l.matchStatus === 'SHORT');

  const grn = {
    grnNumber,
    poId: grnData.poId,
    poNumber: grnData.poNumber,
    vendorId: grnData.vendorId,
    vendorName: grnData.vendorName,
    warehouseId: grnData.warehouseId,
    lines: grnLines,
    status: 'POSTED',
    postedBy: receivedByUid,
    postedByName: receivedByName,
    postedAt: serverTimestamp(),
    invoiceNumber: grnData.invoiceNumber || '',
    invoiceStatus: 'PENDING',
    creditNoteId: null,
    creditNoteCreated: false,
    totalOrdered: grnLines.reduce((sum, l) => sum + l.orderedQty, 0),
    totalReceived: grnLines.reduce((sum, l) => sum + l.receivedQty, 0),
    notes: grnData.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = doc(db, 'goods_receipts', grnNumber);
  await setDoc(ref, grn);

  // ─── STOCK LEDGER: POST GRN (+qty to warehouse/bin) ─────────────

  const ledgerEntries = grnLines.map(line => ({
    itemId: line.itemId,
    lotId: line.lotNumber,
    fromWarehouseId: null,
    toWarehouseId: grnData.warehouseId,
    fromBinId: null,
    toBinId: line.binId,
    movementType: 'GRN',
    qty: line.receivedQty,
    unitOfMeasure: line.unitOfMeasure,
    referenceType: 'GRN',
    referenceId: grnNumber,
    performedBy: receivedByUid,
    performedAt: serverTimestamp(),
    notes: `GRN ${grnNumber} - ${line.condition} (match: ${line.matchStatus})`
  }));

  await createStockLedgerEntry(ledgerEntries, receivedByUid);

  // ─── UPDATE PO LINE RECEIVED QTY ────────────────────────────────

  for (const line of grnLines) {
    await updatePoLineReceivedQty(grnData.poId, line.poLineNumber, line.receivedQty);
  }

  return { grnNumber, hasShortfall, shortLines, grn };
}

// ─── CREDIT NOTE OPERATIONS ─────────────────────────────────────────

export async function createCreditNoteFromGrn(grnNumber, financeOfficerUid, financeOfficerName) {
  const grnRef = doc(db, 'goods_receipts', grnNumber);
  const grnSnap = await getDoc(grnRef);
  if (!grnSnap.exists()) throw new Error('GRN not found');
  const grn = grnSnap.data();

  if (grn.creditNoteCreated) throw new Error('Credit note already exists for this GRN');

  const shortLines = grn.lines.filter(l => l.matchStatus === 'SHORT');
  if (shortLines.length === 0) throw new Error('No shortfall lines to create credit note');

  // Generate CN number: CN-YYYY-MM-DD-####
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const existing = await getDocs(query(CREDIT_NOTES_COLLECTION, where('cnNumber', '>=', `CN-${dateStr}-`), orderBy('cnNumber')));
  const seq = existing.size + 1;
  const cnNumber = `CN-${dateStr}-${String(seq).padStart(4, '0')}`;

  const cnLines = shortLines.map((line, i) => {
    const unitPrice = 850; // TODO: Get from PO line item price
    const taxRate = 7.5;
    const lineTotal = line.shortQty * unitPrice;
    const taxTotal = lineTotal * (taxRate / 100);
    return {
      lineNumber: i + 1,
      itemId: line.itemId,
      itemName: line.itemName,
      shortQty: line.orderedQty - line.receivedQty,
      unitOfMeasure: line.unitOfMeasure,
      unitPrice,
      currency: 'NGN',
      taxRate,
      lineTotal,
      taxTotal,
      total: lineTotal + taxTotal,
      reason: 'SHORT_DELIVERY'
    };
  });

  const subTotal = cnLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const taxTotal = cnLines.reduce((sum, l) => sum + l.taxTotal, 0);
  const grandTotal = subTotal + taxTotal;

  const creditNote = {
    cnNumber,
    grnId: grnNumber,
    grnNumber,
    poId: grn.poId,
    poNumber: grn.poNumber,
    vendorId: grn.vendorId,
    vendorName: grn.vendorName,
    status: 'DRAFT',
    lines: cnLines,
    subTotal,
    taxTotal,
    grandTotal,
    createdBy: financeOfficerUid,
    createdByName: financeOfficerName,
    createdAt: serverTimestamp(),
    sentAt: null,
    sentBy: null,
    acceptedAt: null,
    acceptedBy: null,
    appliedAt: null,
    notes: 'Auto-drafted from GRN shortfall'
  };

  const cnRef = doc(db, 'credit_notes', cnNumber);
  await setDoc(cnRef, creditNote);

  // Link credit note to GRN
  await updateDoc(grnRef, {
    creditNoteId: cnNumber,
    creditNoteCreated: true,
    updatedAt: serverTimestamp()
  });

  return cnNumber;
}

export async function updateCreditNoteStatus(cnNumber, status, actorUid, actorName) {
  const ref = doc(db, 'credit_notes', cnNumber);
  const updates = { status, updatedAt: serverTimestamp() };

  if (status === 'SENT') {
    updates.sentAt = serverTimestamp();
    updates.sentBy = actorUid;
    updates.sentByName = actorName;
  } else if (status === 'ACCEPTED') {
    updates.acceptedAt = serverTimestamp();
    updates.acceptedBy = actorUid;
    updates.acceptedByName = actorName;
  } else if (status === 'APPLIED') {
    updates.appliedAt = serverTimestamp();
    updates.appliedBy = actorUid;
    updates.appliedByName = actorName;
  }

  await updateDoc(ref, updates);
}

export async function getCreditNote(cnNumber) {
  const snap = await getDoc(doc(db, 'credit_notes', cnNumber));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToCreditNotes(callback) {
  const q = query(CREDIT_NOTES_COLLECTION, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const cns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(cns);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('credit notes subscription error:', err);
    callback([]);
  });
}

export async function getAllCreditNotes() {
  const q = query(CREDIT_NOTES_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── GRN SUBSCRIBE / GET ────────────────────────────────────────────

export async function getGoodsReceipt(grnNumber) {
  const snap = await getDoc(doc(db, 'goods_receipts', grnNumber));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToGoodsReceipts(callback, filter = {}) {
  let q = query(GRNS_COLLECTION, orderBy('createdAt', 'desc'));
  if (filter.status) {
    q = query(GRNS_COLLECTION, where('status', '==', filter.status), orderBy('createdAt', 'desc'));
  }
  if (filter.vendorId) {
    q = query(GRNS_COLLECTION, where('vendorId', '==', filter.vendorId), orderBy('createdAt', 'desc'));
  }
  if (filter.warehouseId) {
    q = query(GRNS_COLLECTION, where('warehouseId', '==', filter.warehouseId), orderBy('createdAt', 'desc'));
  }

  return onSnapshot(q, (snap) => {
    const grns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(grns);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('GRN subscription error:', err);
    callback([]);
  });
}

export async function getAllGoodsReceipts() {
  const q = query(GRNS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGrnsForPo(poId) {
  const q = query(GRNS_COLLECTION, where('poId', '==', poId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
