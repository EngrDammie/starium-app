// src/services/productionOperations.js
//
// Production Order operations — plan from BOM, track actuals, calculate variance.

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, onSnapshot, orderBy, serverTimestamp, getDocs, writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { initializeApprovalState, processApproval } from './approvalEngine';
import { createStockLedgerEntry } from './stockLedgerOperations';

const PROD_ORDERS_COLLECTION = collection(db, 'production_orders');
const PACKING_ACTUALS_COLLECTION = collection(db, 'packing_actuals');

// ─── CREATE PRODUCTION ORDER ─────────────────────────────────────────

export async function createProductionOrder(orderData, createdByUid, createdByName) {
  // Generate order number: PO-YYYY-MM-DD-####
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const existing = await getDocs(query(PROD_ORDERS_COLLECTION, where('orderNumber', '>=', `PO-${dateStr}-`), orderBy('orderNumber')));
  const seq = existing.size + 1;
  const orderNumber = `PO-${dateStr}-${String(seq).padStart(4, '0')}`;

  // Get BOM for planned consumption
  const bomSnap = await getDoc(doc(db, 'boms', orderData.bomId));
  const bom = bomSnap.exists() ? bomSnap.data() : null;

  let plannedConsumption = [];
  let plannedPowderKg = 0;

  if (bom) {
    plannedConsumption = bom.ingredients.map(ing => ({
      itemId: ing.itemId,
      itemName: ing.itemName,
      plannedQty: ing.kgPerBatch * orderData.plannedBatches,
      unitOfMeasure: ing.unitOfMeasure
    }));
    plannedPowderKg = bom.batchOutputKg * orderData.plannedBatches;
  }

  const approvalState = initializeApprovalState('productionOrder', createdByUid);

  const order = {
    orderNumber,
    bomId: orderData.bomId,
    bomName: bom?.name || 'Unknown BOM',
    bomVersion: bom?.version || 0,
    status: approvalState.status,
    plannedBatches: orderData.plannedBatches,
    plannedStartDate: orderData.plannedStartDate,
    plannedEndDate: orderData.plannedEndDate,
    actualStartDate: null,
    actualEndDate: null,
    plannedConsumption,
    actualConsumption: [],
    plannedPowderKg,
    actualPowderKg: 0,
    powderVariance: 0,
    powderVariancePercent: 0,
    actualYieldPercent: 0,
    inputLots: [],
    outputLotId: null,
    packingPlan: orderData.packingPlan || { '22': 0, '40': 0, '45': 0, '85': 0, '125': 0, '170': 0, '850': 0 },
    plannedSachets: {},
    plannedCartons: {},
    actualSachets: {},
    actualCartons: {},
    approvalState,
    currentApprovalStep: approvalState.currentStep,
    producedBy: createdByUid,
    producedByName,
    recordedBy: null,
    recordedAt: null,
    notes: orderData.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = doc(db, 'production_orders', orderNumber);
  await setDoc(ref, order);
  return orderNumber;
}

export async function submitProductionOrder(orderNumber) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
  const data = snap.data();

  if (data.status !== 'DRAFT' && data.status !== 'PLANNED') throw new Error('Only DRAFT/PLANNED orders can be submitted');

  const approvalState = initializeApprovalState('productionOrder', data.producedBy);
  await updateDoc(ref, {
    status: approvalState.status,
    currentApprovalStep: approvalState.currentStep,
    approvalState,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return approvalState;
}

export async function processProductionOrderApproval(orderNumber, action, actorRole, actorName, actorUid) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
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
  return { ...result, orderNumber };
}

export async function startProductionOrder(orderNumber, startedByUid, startedByName) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
  const data = snap.data();

  if (data.status !== 'APPROVED' && data.status !== 'RELEASED') throw new Error('Order must be APPROVED/RELEASED to start');

  await updateDoc(ref, {
    status: 'IN_PROGRESS',
    actualStartDate: serverTimestamp(),
    startedBy: startedByUid,
    startedByName,
    updatedAt: serverTimestamp()
  });
}

export async function completeProductionOrder(orderNumber, completedByUid, completedByName, actualData) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
  const data = snap.data();

  if (data.status !== 'IN_PROGRESS') throw new Error('Order must be IN_PROGRESS to complete');

  // Calculate variances
  const actualConsumption = actualData.actualConsumption || [];
  const actualPowderKg = actualData.actualPowderKg || 0;
  const outputLotId = actualData.outputLotId || `L-FG-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;

  // Build actual consumption with variance
  const actualConsumptionWithVariance = actualConsumption.map(act => {
    const planned = data.plannedConsumption.find(p => p.itemId === act.itemId) || {};
    const plannedQty = planned.plannedQty || 0;
    const actualQty = Number(act.actualQty) || 0;
    const variance = actualQty - plannedQty;
    const variancePercent = plannedQty > 0 ? (variance / plannedQty * 100) : 0;
    return {
      itemId: act.itemId,
      itemName: act.itemName,
      plannedQty,
      actualQty,
      unitOfMeasure: act.unitOfMeasure || planned.unitOfMeasure || 'kg',
      lotId: act.lotId,
      variance,
      variancePercent: Number(variancePercent.toFixed(2))
    };
  });

  // Powder variance
  const plannedPowder = data.plannedPowderKg;
  const powderVariance = actualPowderKg - plannedPowder;
  const powderVariancePercent = plannedPowder > 0 ? (powderVariance / plannedPowder * 100) : 0;
  const actualYieldPercent = plannedPowder > 0 ? (actualPowderKg / plannedPowder * 100) : 0;

  // Input lots for traceability
  const inputLots = actualConsumption.map(act => ({
    itemId: act.itemId,
    lotId: act.lotId,
    qtyUsed: Number(act.actualQty) || 0
  }));

  // Packing plan calculations
  const { calculateSachetsAndCartons } = await import('./resourcePlanning');
  const gramSpecs = await import('../config/firebase').then(() => import('../context/ConfigContext')).catch(() => ({ gramSpecs: {} }));
  // Note: In real implementation, would fetch from ConfigContext

  // Post stock ledger CONSUMPTION for actuals
  const ledgerEntries = actualConsumptionWithVariance.map(act => ({
    itemId: act.itemId,
    lotId: act.lotId,
    fromWarehouseId: 'PF-L9', // TODO: Get from order
    toWarehouseId: null,
    fromBinId: null,
    toBinId: null,
    movementType: 'CONSUMPTION',
    qty: act.actualQty,
    unitOfMeasure: act.unitOfMeasure,
    referenceType: 'PRODUCTION_ORDER',
    referenceId: orderNumber,
    performedBy: completedByUid,
    performedAt: serverTimestamp(),
    notes: `Production ${orderNumber} - CONSUMED ${act.actualQty} ${act.unitOfMeasure}`
  }));
  await createStockLedgerEntry(ledgerEntries, completedByUid);

  // Post PRODUCTION_OUTPUT
  const outputEntry = {
    itemId: 'FINISHED_POWDER',
    lotId: outputLotId,
    fromWarehouseId: null,
    toWarehouseId: 'FG-WH',
    fromBinId: null,
    toBinId: 'FG-WH-BIN-01',
    movementType: 'PRODUCTION_OUTPUT',
    qty: actualPowderKg,
    unitOfMeasure: 'kg',
    referenceType: 'PRODUCTION_ORDER',
    referenceId: orderNumber,
    performedBy: completedByUid,
    performedAt: serverTimestamp(),
    notes: `Production ${orderNumber} - OUTPUT ${actualPowderKg} kg powder (Lot: ${outputLotId})`
  };
  await createStockLedgerEntry([outputEntry], completedByUid);

  await updateDoc(doc(db, 'production_orders', orderNumber), {
    status: 'COMPLETED',
    actualEndDate: serverTimestamp(),
    actualConsumption: actualConsumptionWithVariance,
    actualPowderKg,
    powderVariance,
    powderVariancePercent,
    actualYieldPercent,
    inputLots,
    outputLotId,
    completedBy: completedByUid,
    completedByName,
    recordedBy: completedByUid,
    recordedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function recordActualConsumption(orderNumber, actualConsumption, recordedByUid, recordedByName) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
  const data = snap.data();

  const actualConsumptionWithVariance = actualConsumption.map(act => {
    const planned = data.plannedConsumption.find(p => p.itemId === act.itemId) || {};
    const plannedQty = planned.plannedQty || 0;
    const actualQty = Number(act.actualQty) || 0;
    const variance = actualQty - plannedQty;
    const variancePercent = plannedQty > 0 ? (variance / plannedQty * 100) : 0;
    return {
      itemId: act.itemId,
      itemName: act.itemName,
      plannedQty,
      actualQty,
      unitOfMeasure: act.unitOfMeasure || planned.unitOfMeasure || 'kg',
      lotId: act.lotId,
      variance,
      variancePercent: Number(variancePercent.toFixed(2))
    };
  });

  await updateDoc(ref, {
    actualConsumption: actualConsumptionWithVariance,
    recordedBy: recordedByUid,
    recordedByName,
    recordedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function recordPowderOutput(orderNumber, actualPowderKg, outputLotId, recordedByUid) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
  const data = snap.data();

  const plannedPowder = data.plannedPowderKg;
  const powderVariance = actualPowderKg - plannedPowder;
  const powderVariancePercent = plannedPowder > 0 ? (powderVariance / plannedPowder * 100) : 0;
  const actualYieldPercent = plannedPowder > 0 ? (actualPowderKg / plannedPowder * 100) : 0;

  await updateDoc(ref, {
    actualPowderKg,
    powderVariance,
    powderVariancePercent,
    actualYieldPercent,
    outputLotId: outputLotId || `L-FG-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`,
    recordedBy: recordedByUid,
    recordedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updatePackingPlan(orderNumber, packingPlan) {
  const ref = doc(db, 'production_orders', orderNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Production order not found');
  const data = snap.data();

  // Calculate planned sachets/cartons from powder kg + packing plan + gram specs
  // This would use the resourcePlanning engine with gram specs
  const plannedSachets = {};
  const plannedCartons = {};

  await updateDoc(ref, {
    packingPlan,
    plannedSachets,
    plannedCartons,
    updatedAt: serverTimestamp()
  });
}

// ─── PACKING ACTUALS ────────────────────────────────────────────────

export async function recordPackingActuals(orderNumber, actuals) {
  // actuals: [{ sku, shift, team, date, plannedSachets, actualSachets, plannedCartons, actualCartons }]
  const batch = writeBatch(db);
  for (const a of actuals) {
    const ref = doc(PACKING_ACTUALS_COLLECTION);
    batch.set(ref, {
      productionOrderId: orderNumber,
      sku: a.sku,
      shift: a.shift,
      team: a.team,
      date: a.date,
      plannedSachets: a.plannedSachets,
      actualSachets: a.actualSachets,
      plannedCartons: a.plannedCartons,
      actualCartons: a.actualCartons,
      varianceSachets: a.actualSachets - a.plannedSachets,
      variancePercent: a.plannedCartons > 0 ? ((a.actualCartons - a.plannedCartons) / a.plannedCartons * 100) : 0,
      recordedBy: a.recordedBy,
      recordedAt: serverTimestamp()
    });
  }
  await batch.commit();
}

export async function getPackingActuals(orderNumber) {
  const q = query(PACKING_ACTUALS_COLLECTION, where('productionOrderId', '==', orderNumber), orderBy('recordedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── GET / SUBSCRIBE ────────────────────────────────────────────────

export async function getProductionOrder(orderNumber) {
  const snap = await getDoc(doc(db, 'production_orders', orderNumber));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToProductionOrders(callback, filter = {}) {
  let q = query(PROD_ORDERS_COLLECTION, orderBy('createdAt', 'desc'));
  if (filter.status) q = query(PROD_ORDERS_COLLECTION, where('status', '==', filter.status), orderBy('createdAt', 'desc'));
  if (filter.bomId) q = query(PROD_ORDERS_COLLECTION, where('bomId', '==', filter.bomId), orderBy('createdAt', 'desc'));
  if (filter.producedBy) q = query(PROD_ORDERS_COLLECTION, where('producedBy', '==', filter.producedBy), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(orders);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('production orders subscription error:', err);
    callback([]);
  });
}

export async function getAllProductionOrders() {
  const q = query(PROD_ORDERS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingApprovalsForRole(userRole) {
  const q = query(PROD_ORDERS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return all.filter(order => {
    if (!order.approvalState || !order.approvalState.approvalEnabled) return false;
    if (order.approvalState.status !== 'PENDING_APPROVAL') return false;
    const step = order.approvalState.steps?.find(s => s.status === 'PENDING');
    return step ? step.role === userRole : false;
  });
}

// ─── VARIANCE CALCULATIONS ──────────────────────────────────────────

export function calculateProductionVariance(productionOrder) {
  const { plannedConsumption, actualConsumption, plannedPowderKg, actualPowderKg } = productionOrder;

  // Raw material variance
  const rawMaterialVariance = actualConsumption.map(act => {
    const planned = plannedConsumption.find(p => p.itemId === act.itemId) || {};
    const plannedQty = planned.plannedQty || 0;
    const actualQty = act.actualQty || 0;
    const variance = actualQty - plannedQty;
    const variancePercent = plannedQty > 0 ? (variance / plannedQty * 100) : 0;
    return {
      itemId: act.itemId,
      itemName: act.itemName,
      plannedQty,
      actualQty,
      unitOfMeasure: act.unitOfMeasure,
      variance,
      variancePercent: Number(variancePercent.toFixed(2)),
      status: Math.abs(variancePercent) > 5 ? 'CRITICAL' : Math.abs(variancePercent) > 2 ? 'WARNING' : 'OK'
    };
  });

  // Powder variance
  const powderVariance = actualPowderKg - plannedPowderKg;
  const powderVariancePercent = plannedPowderKg > 0 ? (powderVariance / plannedPowderKg * 100) : 0;
  const actualYieldPercent = plannedPowderKg > 0 ? (actualPowderKg / plannedPowderKg * 100) : 0;

  // Packing variance
  const packingVariance = {};
  const skus = ['22', '40', '45', '85', '125', '170', '850'];
  for (const sku of skus) {
    const planned = productionOrder.plannedCartons[sku] || 0;
    const actual = productionOrder.actualCartons[sku] || 0;
    const variance = actual - planned;
    const variancePercent = planned > 0 ? (variance / planned * 100) : 0;
    packingVariance[sku] = {
      plannedCartons: planned,
      actualCartons: actual,
      variance,
      variancePercent: Number(variancePercent.toFixed(2)),
      status: Math.abs(variancePercent) > 5 ? 'CRITICAL' : Math.abs(variancePercent) > 2 ? 'WARNING' : 'OK'
    };
  }

  return {
    rawMaterialVariance,
    powder: {
      planned: plannedPowderKg,
      actual: actualPowderKg,
      variance: powderVariance,
      variancePercent: Number(powderVariancePercent.toFixed(2)),
      actualYieldPercent: Number(actualYieldPercent.toFixed(2))
    },
    packing: packingVariance
  };
}