// src/services/stockLedgerOperations.js
//
// Stock Ledger — IMMUTABLE record of every stock movement.
// Current Stock = Sum of all ledger entries for (item, lot, warehouse, bin).
// Never delete or update ledger entries — only append.

import {
  doc, setDoc, collection, query, where, onSnapshot,
  orderBy, serverTimestamp, getDocs, writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

const LEDGER_COLLECTION = collection(db, 'stock_ledger');

// ─── CREATE LEDGER ENTRY (single or batch) ───────────────────────────

export async function createStockLedgerEntry(entries, performedByUid) {
  const batch = writeBatch(db);
  for (const entry of entries) {
    const id = `${entry.referenceType}-${entry.referenceId}-${entry.itemId}-${entry.lotId || 'nolot'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ref = doc(db, 'stock_ledger', id);
    batch.set(ref, {
      id,
      ...entry,
      performedBy: performedByUid,
      performedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  }
  await batch.commit();
  return entries.length;
}

// ─── GET CURRENT STOCK FOR AN ITEM AT A LOCATION ─────────────────────

// Sum all ledger entries for (itemId, lotId, warehouseId, binId)
// Positive for IN movements (GRN, TRANSFER_IN, PRODUCTION_OUTPUT, RETURN)
// Negative for OUT movements (TRANSFER_OUT, ISSUE, CONSUMPTION)
export async function getCurrentStock(itemId, warehouseId, binId = null, lotId = null) {
  let q = query(
    LEDGER_COLLECTION,
    where('itemId', '==', itemId),
    where('toWarehouseId', '==', warehouseId),
    orderBy('performedAt', 'desc')
  );
  if (binId) q = query(LEDGER_COLLECTION, where('itemId', '==', itemId), where('toWarehouseId', '==', warehouseId), where('toBinId', '==', binId), orderBy('performedAt', 'desc'));
  if (lotId) q = query(LEDGER_COLLECTION, where('itemId', '==', itemId), where('lotId', '==', lotId), orderBy('performedAt', 'desc'));

  const snap = await getDocs(q);
  let stock = 0;
  snap.docs.forEach(d => {
    const e = d.data();
    // IN movements add, OUT movements subtract
    const isOut = ['TRANSFER_OUT', 'ISSUE', 'CONSUMPTION'].includes(e.movementType);
    stock += isOut ? -e.qty : e.qty;
  });
  return Math.max(0, stock);
}

// ─── GET STOCK BY ITEM ACROSS ALL LOCATIONS ──────────────────────────

export async function getStockByItem(itemId) {
  const q = query(LEDGER_COLLECTION, where('itemId', '==', itemId), orderBy('performedAt', 'desc'));
  const snap = await getDocs(q);

  // Group by warehouse+bin+lot
  const stockByLocation = new Map();
  snap.docs.forEach(d => {
    const e = d.data();
    const key = `${e.toWarehouseId}|${e.toBinId || 'nobin'}|${e.lotId || 'nolot'}`;
    if (!stockByLocation.has(key)) {
      stockByLocation.set(key, {
        itemId: e.itemId,
        warehouseId: e.toWarehouseId,
        binId: e.toBinId || null,
        lotId: e.lotId || null,
        qty: 0,
        unitOfMeasure: e.unitOfMeasure
      });
    }
    const loc = stockByLocation.get(key);
    const isOut = ['TRANSFER_OUT', 'ISSUE', 'CONSUMPTION'].includes(e.movementType);
    loc.qty += isOut ? -e.qty : e.qty;
  });

  return Array.from(stockByLocation.values()).filter(l => l.qty > 0);
}

// ─── GET STOCK FOR A BIN ─────────────────────────────────────────────

export async function getStockForBin(binId) {
  const q = query(LEDGER_COLLECTION, where('toBinId', '==', binId), orderBy('performedAt', 'desc'));
  const snap = await getDocs(q);

  const stockByItem = new Map();
  snap.docs.forEach(d => {
    const e = d.data();
    const key = e.itemId + '|' + (e.lotId || 'nolot');
    if (!stockByItem.has(key)) {
      stockByItem.set(key, {
        itemId: e.itemId,
        lotId: e.lotId || null,
        qty: 0,
        unitOfMeasure: e.unitOfMeasure
      });
    }
    const loc = stockByItem.get(key);
    const isOut = ['TRANSFER_OUT', 'ISSUE', 'CONSUMPTION'].includes(e.movementType);
    loc.qty += isOut ? -e.qty : e.qty;
  });

  return Array.from(stockByItem.values()).filter(l => l.qty > 0);
}

// ─── SUBSCRIBE TO LEDGER ─────────────────────────────────────────────

export function subscribeToStockLedger(callback, filter = {}) {
  let q = query(LEDGER_COLLECTION, orderBy('performedAt', 'desc'));
  if (filter.itemId) q = query(LEDGER_COLLECTION, where('itemId', '==', filter.itemId), orderBy('performedAt', 'desc'));
  if (filter.warehouseId) q = query(LEDGER_COLLECTION, where('toWarehouseId', '==', filter.warehouseId), orderBy('performedAt', 'desc'));
  if (filter.movementType) q = query(LEDGER_COLLECTION, where('movementType', '==', filter.movementType), orderBy('performedAt', 'desc'));

  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(entries);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('stock ledger subscription error:', err);
    callback([]);
  });
}

export async function getAllStockLedger() {
  const q = query(LEDGER_COLLECTION, orderBy('performedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLedgerForItem(itemId) {
  const q = query(LEDGER_COLLECTION, where('itemId', '==', itemId), orderBy('performedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLedgerForReference(referenceType, referenceId) {
  const q = query(
    LEDGER_COLLECTION,
    where('referenceType', '==', referenceType),
    where('referenceId', '==', referenceId),
    orderBy('performedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
