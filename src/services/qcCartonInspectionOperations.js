import { collection, addDoc, query, where, onSnapshot, orderBy, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

const CARTON_INSPECTION_KEY = 'starium_carton_inspection_queue';

export async function saveCartonInspectionCheck(data, isOnline) {
  if (isOnline) {
    try {
      await addDoc(collection(db, 'qc_carton_inspection_checks'), {
        ...data,
        createdAt: serverTimestamp()
      });
      return 'saved';
    } catch (err) {
      console.error('[CartonInspection] Offline queueing:', err);
      return queueOffline(data);
    }
  } else {
    return queueOffline(data);
  }
}

function queueOffline(data) {
  const queue = JSON.parse(localStorage.getItem(CARTON_INSPECTION_KEY) || '[]');
  queue.push({ ...data, localCreatedAt: new Date().toISOString() });
  localStorage.setItem(CARTON_INSPECTION_KEY, JSON.stringify(queue));
  return 'queued';
}

export function subscribeToMachineCartonInspections(docId, machineId, callback) {
  const q = query(
    collection(db, 'qc_carton_inspection_checks'),
    where('approvalDocId', '==', docId),
    where('machineId', '==', machineId),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(records);
  }, (err) => {
    console.error('[CartonInspection] subscribe error:', err);
    callback([]);
  });
}

export function subscribeToAllCartonInspections(docId, callback) {
  const q = query(
    collection(db, 'qc_carton_inspection_checks'),
    where('approvalDocId', '==', docId),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(records);
  }, (err) => {
    console.error('[CartonInspection] subscribe all error:', err);
    callback([]);
  });
}

export async function syncCartonInspectionQueue() {
  const queue = JSON.parse(localStorage.getItem(CARTON_INSPECTION_KEY) || '[]');
  if (queue.length === 0) return;
  const batch = writeBatch(db);
  const ref = collection(db, 'qc_carton_inspection_checks');
  for (const record of queue) {
    const newRef = doc(ref);
    batch.set(newRef, {
      ...record,
      localCreatedAt: record.localCreatedAt || new Date().toISOString(),
      syncedAt: serverTimestamp()
    });
  }
  try {
    await batch.commit();
    localStorage.removeItem(CARTON_INSPECTION_KEY);
    return { synced: queue.length };
  } catch (err) {
    console.error('[CartonInspection] Sync error:', err);
    throw err;
  }
}

export function computeCartonOverallResult(criteria) {
  const values = Object.values(criteria);
  if (values.includes('U')) return 'fail';
  return 'pass';
}
