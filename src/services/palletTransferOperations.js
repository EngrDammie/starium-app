import { db } from '../config/firebase';
import {
  collection, addDoc, doc, getDoc, setDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';

const PALLET_QUEUE_KEY = 'starium_pallet_transfer_queue';

export function getPalletTransferDocId(config) {
  const { shift, date } = getShiftDateInfo(config);
  return `pallet_transfer_${shift}_${date}`;
}

export async function getOrCreatePalletTransferShift(config, isOnline = true) {
  const docId = getPalletTransferDocId(config);
  if (!isOnline) return docId;
  try {
    const docRef = doc(db, 'shift_approvals', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.id;
    await setDoc(docRef, {
      mode: 'pallet_transfer',
      shift: getShiftDateInfo(config).shift,
      date: getShiftDateInfo(config).date,
      status: 'active',
      createdAt: serverTimestamp()
    });
    return docId;
  } catch (error) {
    console.error("Error creating pallet transfer shift:", error);
    return docId;
  }
}

export async function savePalletTransfer(record, config, isOnline) {
  const shiftDocId = getPalletTransferDocId(config);
  const data = {
    gram: record.gram,
    palletSize: record.palletSize,
    palletCount: record.palletCount,
    totalCartons: record.palletCount * record.palletSize,
    team: record.team,
    recordedBy: record.recordedBy,
    recordedByUid: record.recordedByUid,
    shiftApprovalDocId: shiftDocId,
    shift: getShiftDateInfo(config).shift,
    date: getShiftDateInfo(config).date,
  };

  if (isOnline) {
    try {
      await getOrCreatePalletTransferShift(config, true);
      const ref = await addDoc(collection(db, 'pallet_transfers'), {
        ...data,
        createdAt: serverTimestamp(),
        syncedAt: serverTimestamp()
      });
      return { status: 'saved', id: ref.id };
    } catch (error) {
      console.error("Error saving pallet transfer, queuing offline:", error);
    }
  }

  const queue = JSON.parse(localStorage.getItem(PALLET_QUEUE_KEY) || '[]');
  const tempId = 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  queue.push({
    ...data,
    id: tempId,
    createdAt: new Date().toISOString(),
    syncedAt: null,
    _queued: true
  });
  localStorage.setItem(PALLET_QUEUE_KEY, JSON.stringify(queue));
  return { status: 'queued', id: tempId };
}

export function subscribeToShiftPalletTransfers(config, callback) {
  const docId = getPalletTransferDocId(config);
  const q = query(
    collection(db, 'pallet_transfers'),
    where('shiftApprovalDocId', '==', docId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data(), synced: true })));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error("Error in pallet transfers:", error);
    }
    callback([]);
  });
}

export function getQueuedPalletTransfers(config) {
  const docId = getPalletTransferDocId(config);
  const queue = JSON.parse(localStorage.getItem(PALLET_QUEUE_KEY) || '[]');
  return queue
    .filter(r => r.shiftApprovalDocId === docId)
    .map(r => ({ ...r, synced: false }));
}

export async function syncPalletTransferOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(PALLET_QUEUE_KEY) || '[]');
  if (queue.length === 0) return 0;
  const batch = writeBatch(db);
  const synced = [];
  for (const record of queue) {
    try {
      const ref = doc(collection(db, 'pallet_transfers'));
      batch.set(ref, {
        gram: record.gram,
        palletSize: record.palletSize,
        palletCount: record.palletCount,
        totalCartons: record.totalCartons,
        team: record.team,
        recordedBy: record.recordedBy,
        recordedByUid: record.recordedByUid,
        shiftApprovalDocId: record.shiftApprovalDocId,
        shift: record.shift,
        date: record.date,
        createdAt: record._queued ? new Date(record.createdAt) : serverTimestamp(),
        syncedAt: serverTimestamp()
      });
      synced.push(record.id);
    } catch (e) {
      console.error("Error queueing pallet transfer for sync:", e);
    }
  }
  if (synced.length > 0) {
    await batch.commit();
    const remaining = queue.filter(r => !synced.includes(r.id));
    localStorage.setItem(PALLET_QUEUE_KEY, JSON.stringify(remaining));
  }
  return synced.length;
}

export function subscribeToPalletTransfersByDateRange(startDate, endDate, callback) {
  const q = query(
    collection(db, 'pallet_transfers'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data(), synced: true })));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error("Error in pallet transfers date range:", error);
    }
    callback([]);
  });
}
