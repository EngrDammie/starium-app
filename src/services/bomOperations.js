// src/services/bomOperations.js
//
// BOM / Recipe operations — CRUD + versioning + approval workflow.

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, onSnapshot, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { initializeApprovalState, processApproval } from './approvalEngine';

const BOMS_COLLECTION = collection(db, 'boms');

// ─── CREATE BOM ──────────────────────────────────────────────────────

export async function createBom(bomData, createdByUid, createdByName) {
  // Generate BOM ID: name_version
  const baseId = bomData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const version = bomData.version || 1;
  const bomId = `${baseId}_v${version}`;

  // Calculate batch input/output
  const batchInputKg = bomData.ingredients.reduce((sum, ing) => sum + Number(ing.kgPerBatch || 0), 0);
  const batchOutputKg = batchInputKg * (Number(bomData.yieldPercent || 0) / 100);

  const approvalState = initializeApprovalState('bom', createdByUid);

  const bom = {
    bomId,
    name: bomData.name,
    version,
    status: approvalState.status,
    category: bomData.category || 'DETERGENT_POWDER',
    yieldPercent: Number(bomData.yieldPercent),
    batchInputKg,
    batchOutputKg,
    ingredients: bomData.ingredients.map((ing, i) => ({
      lineNumber: i + 1,
      itemId: ing.itemId,
      itemName: ing.itemName,
      itemCode: ing.itemCode,
      kgPerBatch: Number(ing.kgPerBatch),
      unitOfMeasure: ing.unitOfMeasure || 'kg',
      isCritical: ing.isCritical !== false,
      notes: ing.notes || ''
    })),
    approvalState,
    currentApprovalStep: approvalState.currentStep,
    createdBy: createdByUid,
    createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    approvedAt: null
  };

  const ref = doc(db, 'boms', bomId);
  await setDoc(ref, bom);
  return bomId;
}

export async function updateBom(bomId, updates) {
  await updateDoc(doc(db, 'boms', bomId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function cloneBom(bomId, newVersion, createdByUid, createdByName) {
  const original = await getBom(bomId);
  if (!original) throw new Error('BOM not found');

  const newBomData = {
    name: original.name,
    version: newVersion,
    yieldPercent: original.yieldPercent,
    category: original.category,
    ingredients: original.ingredients.map(ing => ({
      itemId: ing.itemId,
      itemName: ing.itemName,
      itemCode: ing.itemCode,
      kgPerBatch: ing.kgPerBatch,
      unitOfMeasure: ing.unitOfMeasure,
      isCritical: ing.isCritical,
      notes: ing.notes
    }))
  };

  return createBom(newBomData, createdByUid, createdByName);
}

export async function submitBomForApproval(bomId) {
  const ref = doc(db, 'boms', bomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('BOM not found');
  const data = snap.data();

  if (data.status !== 'DRAFT') throw new Error('Only DRAFT BOMs can be submitted');

  const approvalState = initializeApprovalState('bom', data.createdBy);
  await updateDoc(ref, {
    status: approvalState.status,
    currentApprovalStep: approvalState.currentStep,
    approvalState,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return approvalState;
}

export async function processBomApproval(bomId, action, actorRole, actorName, actorUid) {
  const ref = doc(db, 'boms', bomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('BOM not found');
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
  return { ...result, bomId };
}

export async function activateBom(bomId) {
  const ref = doc(db, 'boms', bomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('BOM not found');
  const data = snap.data();

  // Deactivate all other versions of this BOM
  const allBoms = await getAllBoms();
  const sameNameBoms = allBoms.filter(b => b.name === data.name && b.id !== bomId);
  for (const b of sameNameBoms) {
    if (b.status === 'ACTIVE') {
      await updateDoc(doc(db, 'boms', b.id), { status: 'ARCHIVED', updatedAt: serverTimestamp() });
    }
  }

  await updateDoc(ref, {
    status: 'ACTIVE',
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function archiveBom(bomId) {
  const ref = doc(db, 'boms', bomId);
  await updateDoc(ref, { status: 'ARCHIVED', updatedAt: serverTimestamp() });
}

export async function deleteBom(bomId) {
  await deleteDoc(doc(db, 'boms', bomId));
}

export async function getBom(bomId) {
  const snap = await getDoc(doc(db, 'boms', bomId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToBoms(callback, filter = {}) {
  let q = query(BOMS_COLLECTION, orderBy('createdAt', 'desc'));
  if (filter.status) q = query(BOMS_COLLECTION, where('status', '==', filter.status), orderBy('createdAt', 'desc'));
  if (filter.category) q = query(BOMS_COLLECTION, where('category', '==', filter.category), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    const boms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(boms);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('BOM subscription error:', err);
    callback([]);
  });
}

export async function getAllBoms() {
  const q = query(BOMS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveBoms() {
  const q = query(BOMS_COLLECTION, where('status', '==', 'ACTIVE'), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingApprovalsForRole(userRole) {
  const q = query(BOMS_COLLECTION, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return all.filter(bom => {
    if (!bom.approvalState || !bom.approvalState.approvalEnabled) return false;
    if (bom.approvalState.status !== 'PENDING_APPROVAL') return false;
    const step = bom.approvalState.steps?.find(s => s.status === 'PENDING');
    return step ? step.role === userRole : false;
  });
}