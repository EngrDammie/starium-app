import { collection, addDoc, query, where, onSnapshot, orderBy, getDoc, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

const BAG_INSPECTION_KEY = 'starium_bag_inspection_queue';

export async function saveBagInspectionCheck(data, isOnline) {
  if (isOnline) {
    try {
      await addDoc(collection(db, 'qc_bag_inspection_checks'), {
        ...data,
        createdAt: serverTimestamp()
      });
      return 'saved';
    } catch (err) {
      console.error('[BagInspection] Offline queueing:', err);
      return queueOffline(data);
    }
  } else {
    return queueOffline(data);
  }
}

function queueOffline(data) {
  const queue = JSON.parse(localStorage.getItem(BAG_INSPECTION_KEY) || '[]');
  queue.push({ ...data, localCreatedAt: new Date().toISOString() });
  localStorage.setItem(BAG_INSPECTION_KEY, JSON.stringify(queue));
  return 'queued';
}

export function subscribeToMachineBagInspections(docId, machineId, callback) {
  const q = query(
    collection(db, 'qc_bag_inspection_checks'),
    where('approvalDocId', '==', docId),
    where('machineId', '==', machineId),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(records);
  }, (err) => {
    console.error('[BagInspection] subscribe error:', err);
    callback([]);
  });
}

export function subscribeToAllBagInspections(docId, callback) {
  const q = query(
    collection(db, 'qc_bag_inspection_checks'),
    where('approvalDocId', '==', docId),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(records);
  }, (err) => {
    console.error('[BagInspection] subscribe all error:', err);
    callback([]);
  });
}

export async function syncBagInspectionQueue() {
  const queue = JSON.parse(localStorage.getItem(BAG_INSPECTION_KEY) || '[]');
  if (queue.length === 0) return;
  const batch = writeBatch(db);
  const ref = collection(db, 'qc_bag_inspection_checks');
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
    localStorage.removeItem(BAG_INSPECTION_KEY);
    return { synced: queue.length };
  } catch (err) {
    console.error('[BagInspection] Sync error:', err);
    throw err;
  }
}

export function computeOverallResult(criteria) {
  const values = Object.values(criteria);
  if (values.includes('U')) return 'fail';
  if (values.includes('M')) return 'conditional';
  return 'pass';
}
