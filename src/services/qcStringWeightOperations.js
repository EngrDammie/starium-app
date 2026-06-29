import { collection, addDoc, query, where, onSnapshot, orderBy, getDoc, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

const STRING_WEIGHT_KEY = 'starium_qc_string_weight_queue';

export function getStringWeightShiftDocId(config) {
  const { shift, date } = getShiftDateInfo(config);
  return `qc_string_weight_${shift}_${date}`;
}

export function getShiftDateInfo(config) {
  const now = new Date();
  const hour = now.getHours();
  let shift, dateObj;
  if (hour >= config.dayShiftStart && hour < config.nightShiftStart) {
    shift = 'DAY'; dateObj = now;
  } else {
    shift = 'NIGHT';
    if (hour >= config.nightShiftStart) {
      dateObj = now;
    } else {
      dateObj = new Date(now);
      dateObj.setDate(dateObj.getDate() - 1);
    }
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return { shift, date: `${year}-${month}-${day}` };
}

export async function getOrCreateStringWeightShift(config, isOnline = true) {
  const docId = getStringWeightShiftDocId(config);
  if (!isOnline) return docId;
  try {
    const docRef = doc(db, 'shift_approvals', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return docId;
    await setDoc(docRef, {
      mode: 'qc_string_weight',
      shift: getShiftDateInfo(config).shift,
      date: getShiftDateInfo(config).date,
      status: 'active',
      createdAt: serverTimestamp()
    });
    return docId;
  } catch (err) {
    console.error(err);
    return docId;
  }
}

export async function saveStringWeightCheck(data, isOnline, setQueueCount) {
  if (isOnline) {
    try {
      await addDoc(collection(db, 'qc_string_weight_checks'), {
        ...data,
        createdAt: serverTimestamp()
      });
      return 'saved';
    } catch (err) {
      console.error('[StringWeight] Offline queueing:', err);
      return queueOffline(data, setQueueCount);
    }
  } else {
    return queueOffline(data, setQueueCount);
  }
}

function queueOffline(data, setQueueCount) {
  const queue = JSON.parse(localStorage.getItem(STRING_WEIGHT_KEY) || '[]');
  queue.push({ ...data, localCreatedAt: new Date().toISOString() });
  localStorage.setItem(STRING_WEIGHT_KEY, JSON.stringify(queue));
  if (setQueueCount) setQueueCount(queue.length);
  return 'queued';
}

export function subscribeToMachineStringWeights(docId, machineId, callback) {
  const q = query(
    collection(db, 'qc_string_weight_checks'),
    where('approvalDocId', '==', docId),
    where('machineId', '==', machineId),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(records);
  }, (err) => {
    console.error('[StringWeight] subscribe error:', err);
    callback([]);
  });
}

export function subscribeToAllStringWeights(docId, callback) {
  const q = query(
    collection(db, 'qc_string_weight_checks'),
    where('approvalDocId', '==', docId),
    orderBy('roundNumber', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(records);
  }, (err) => {
    console.error('[StringWeight] subscribe all error:', err);
    callback([]);
  });
}

export function subscribeToShiftApproval(approvalId, callback) {
  if (!approvalId) return () => {};
  return onSnapshot(doc(db, 'shift_approvals', approvalId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

export async function syncStringWeightQueue() {
  const queue = JSON.parse(localStorage.getItem(STRING_WEIGHT_KEY) || '[]');
  if (queue.length === 0) return;
  const batch = writeBatch(db);
  const ref = collection(db, 'qc_string_weight_checks');
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
    localStorage.removeItem(STRING_WEIGHT_KEY);
    return { synced: queue.length };
  } catch (err) {
    console.error('[StringWeight] Sync error:', err);
    throw err;
  }
}

export function getStringWeightStatus(gramSetting, weight, config) {
  const ranges = config?.fillHeadWeightRanges?.[String(gramSetting)];
  if (!ranges || isNaN(weight) || weight === '' || weight === null) return null;

  const w = Number(weight);
  if (w <= ranges.tooLow.max)  return { level: 'tooLow',  label: 'Too Low!',  border: 'border-[#FF1744]', text: 'text-[#FF1744]', bg: 'bg-[#FF1744]/10' };
  if (w <= ranges.low.max)     return { level: 'low',     label: 'Low',       border: 'border-[#B71C1C]', text: 'text-[#B71C1C]', bg: 'bg-[#B71C1C]/10' };
  if (w <= ranges.target.max)  return { level: 'target',  label: 'Target',    border: 'border-[#00E676]', text: 'text-[#00E676]', bg: 'bg-[#00E676]/10' };
  if (w <= ranges.high.max)    return { level: 'high',    label: 'High',      border: 'border-[#B71C1C]', text: 'text-[#B71C1C]', bg: 'bg-[#B71C1C]/10' };
  if (w >= ranges.tooHigh.min) return { level: 'tooHigh', label: 'Too High!', border: 'border-[#FF1744]', text: 'text-[#FF1744]', bg: 'bg-[#FF1744]/10' };
  return null;
}
