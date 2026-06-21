// src/services/cartonOperations.js
import { db } from '../config/firebase';
import {
  collection, addDoc, doc, getDoc, getDocs, setDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch
} from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';

const CARTON_QUEUE_KEY = 'starium_carton_offline_queue';

export function getCartonWasteDocId(config) {
  const { shift, date } = getShiftDateInfo(config);
  return `carton_waste_${shift}_${date}`;
}

export async function getOrCreateCartonWasteShift(config, isOnline = true) {
  const docId = getCartonWasteDocId(config);
  if (!isOnline) return docId;

  try {
    const docRef = doc(db, 'shift_approvals', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) return docSnap.id;

    await setDoc(docRef, {
      mode: 'carton_waste',
      shift: getShiftDateInfo(config).shift,
      date: getShiftDateInfo(config).date,
      status: 'active',
      createdAt: serverTimestamp()
    });
    return docId;
  } catch (error) {
    console.error("Error creating carton waste shift:", error);
    return docId;
  }
}

export async function getPreviousCheck(machineId, shiftApprovalDocId) {
  const q = query(
    collection(db, 'carton_records'),
    where('machineId', '==', machineId),
    where('shiftApprovalDocId', '==', shiftApprovalDocId),
    orderBy('roundNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export function validateCheck(record, previousCheck) {
  const previousRemaining = previousCheck?.remaining ?? 0;
  const maxAvailable = previousRemaining + record.allocated;

  if (record.remaining > maxAvailable) {
    return { valid: false, message: `Remaining (${record.remaining}) exceeds available cartons (${maxAvailable}). Check your counts.` };
  }

  const used = maxAvailable - record.remaining;
  if (used < 0) {
    return { valid: false, message: `Calculated used is negative (${used}). Remaining seems too high.` };
  }

  if (record.wasted > maxAvailable) {
    return { valid: false, message: `Wasted (${record.wasted}) exceeds available cartons (${maxAvailable}).` };
  }

  if (record.wasted + used > maxAvailable) {
    return { valid: false, message: `Used + Wasted (${used + record.wasted}) exceeds available (${maxAvailable}). Double-check your counts.` };
  }

  return { valid: true };
}

export async function saveCartonCheck(checkData, config, isOnline) {
  const {
    machineId,
    allocated,
    remaining,
    wasted,
    team,
    checkedBy,
    remarks = '',
    previousCheck = null
  } = checkData;

  const previousRemaining = previousCheck?.remaining ?? 0;
  const used = previousRemaining + allocated - remaining;

  const validation = validateCheck({ allocated, remaining, wasted }, previousCheck);
  if (!validation.valid) return { status: 'error', message: validation.message };

  const totalProcessed = used + wasted;
  const wastePercent = totalProcessed > 0 ? (wasted / totalProcessed) * 100 : 0;

  const prevRunningAllocated = previousCheck?.runningAllocated ?? 0;
  const prevRunningUsed = previousCheck?.runningUsed ?? 0;
  const prevRunningWasted = previousCheck?.runningWasted ?? 0;

  const runningAllocated = prevRunningAllocated + allocated;
  const runningUsed = prevRunningUsed + used;
  const runningWasted = prevRunningWasted + wasted;
  const runningTotalProcessed = runningUsed + runningWasted;
  const runningWastePercent = runningTotalProcessed > 0
    ? (runningWasted / runningTotalProcessed) * 100
    : 0;

  const roundNumber = previousCheck ? previousCheck.roundNumber + 1 : 1;
  const { shift, date } = getShiftDateInfo(config);
  const docId = getCartonWasteDocId(config);

  const record = {
    machineId: checkData.machineId,
    machineDisplayNumber: String(checkData.machineDisplayNumber || checkData.machineId || ''),
    machineName: checkData.machineName || '',
    line: checkData.line || '',
    gram: checkData.gram || 0,
    shiftApprovalDocId: docId,
    shift,
    date,
    team: team || '',
    roundNumber,
    allocated,
    remaining,
    wasted,
    used,
    wastePercent: Math.round(wastePercent * 100) / 100,
    runningAllocated,
    runningUsed,
    runningWasted,
    runningWastePercent: Math.round(runningWastePercent * 100) / 100,
    previousCheckId: previousCheck?.id || null,
    previousRemaining,
    checkedBy,
    checkedAt: serverTimestamp(),
    remarks,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (isOnline) {
    try {
      await addDoc(collection(db, 'carton_records'), record);
      return { status: 'saved' };
    } catch (error) {
      console.error("[Carton Save] Error, queueing:", error);
      return queueCartonCheckOffline(record);
    }
  } else {
    return queueCartonCheckOffline(record);
  }
}

function queueCartonCheckOffline(record) {
  try {
    const queue = JSON.parse(localStorage.getItem(CARTON_QUEUE_KEY) || '[]');
    queue.push({ ...record, localCreatedAt: new Date().toISOString() });
    localStorage.setItem(CARTON_QUEUE_KEY, JSON.stringify(queue));
    return { status: 'offline-queued' };
  } catch (e) {
    console.error("Failed to queue carton check offline", e);
    return { status: 'error' };
  }
}

export async function syncCartonOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(CARTON_QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  const batch = writeBatch(db);
  const collectionRef = collection(db, 'carton_records');

  for (const record of queue) {
    const newDocRef = doc(collectionRef);
    batch.set(newDocRef, {
      ...record,
      localCreatedAt: record.localCreatedAt || new Date().toISOString(),
      syncedAt: serverTimestamp()
    });
  }

  try {
    await batch.commit();
    localStorage.removeItem(CARTON_QUEUE_KEY);
    return { synced: queue.length };
  } catch (error) {
    console.error("Failed to sync carton offline queue:", error);
    return { synced: 0 };
  }
}

export function subscribeToShiftCartonRecords(config, callback) {
  const docId = getCartonWasteDocId(config);
  const q = query(
    collection(db, 'carton_records'),
    where('shiftApprovalDocId', '==', docId),
    orderBy('roundNumber', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to carton records:", error);
    callback([]);
  });
}

export function subscribeToMachineCartonHistory(machineId, shiftApprovalDocId, callback) {
  const q = query(
    collection(db, 'carton_records'),
    where('machineId', '==', machineId),
    where('shiftApprovalDocId', '==', shiftApprovalDocId),
    orderBy('roundNumber', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to machine carton history:", error);
    callback([]);
  });
}

export async function fetchCartonRecordsByShift(config, targetShift, targetDate) {
  const docId = `carton_waste_${targetShift}_${targetDate}`;
  const q = query(
    collection(db, 'carton_records'),
    where('shiftApprovalDocId', '==', docId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCartonWasteSummary(config, targetShift, targetDate) {
  const records = await fetchCartonRecordsByShift(config, targetShift, targetDate);

  const machinesMap = {};

  for (const record of records) {
    if (!machinesMap[record.machineId]) {
      machinesMap[record.machineId] = {
        machineId: record.machineId,
        machineDisplayNumber: record.machineDisplayNumber,
        line: record.line,
        gram: record.gram,
        checks: [],
        totalAllocated: 0,
        totalUsed: 0,
        totalWasted: 0
      };
    }

    const m = machinesMap[record.machineId];
    m.checks.push(record);
    m.totalAllocated += record.allocated;
    m.totalUsed += record.used;
    m.totalWasted += record.wasted;
  }

  return Object.values(machinesMap).map(m => {
    const totalProcessed = m.totalUsed + m.totalWasted;
    return {
      ...m,
      checks: m.checks.sort((a, b) => a.roundNumber - b.roundNumber),
      wastePercent: totalProcessed > 0
        ? Math.round((m.totalWasted / totalProcessed) * 10000) / 100
        : 0
    };
  });
}
