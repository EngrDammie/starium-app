import { db } from '../config/firebase';
import {
  collection, addDoc, doc, getDoc, getDocs, setDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch
} from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';

const LAMINATE_QUEUE_KEY = 'starium_laminate_offline_queue';

export function getLaminateWasteDocId(config) {
  const { shift, date } = getShiftDateInfo(config);
  return `laminate_waste_${shift}_${date}`;
}

export async function getOrCreateLaminateWasteShift(config, isOnline = true) {
  const docId = getLaminateWasteDocId(config);
  if (!isOnline) return docId;

  try {
    const docRef = doc(db, 'shift_approvals', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) return docSnap.id;

    await setDoc(docRef, {
      mode: 'laminate_waste',
      shift: getShiftDateInfo(config).shift,
      date: getShiftDateInfo(config).date,
      status: 'active',
      createdAt: serverTimestamp()
    });
    return docId;
  } catch (error) {
    console.error("Error creating laminate waste shift:", error);
    return docId;
  }
}

export function computeTotalLaminateUsed(machine, config) {
  const gram = String(machine.gram || '');
  const rollWeight = config?.laminateWaste?.rollWeights?.[gram] ?? 0;
  const rollsPerShift = config?.laminateWaste?.rollsPerShift ?? 3;
  return rollWeight * rollsPerShift;
}

export function getSacWeight(sacType, config) {
  const sacTypes = config?.laminateWaste?.sacTypes || [];
  const found = sacTypes.find(s => s.id === sacType);
  return found ? found.weight : 0;
}

export async function getPreviousLaminateCheck(machineId, shiftApprovalDocId) {
  const q = query(
    collection(db, 'laminate_records'),
    where('machineId', '==', machineId),
    where('shiftApprovalDocId', '==', shiftApprovalDocId),
    orderBy('roundNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export function validateLaminateCheck(record, config) {
  if (!record.sacType) {
    return { valid: false, message: 'Select a sac type.' };
  }
  const sacWeight = getSacWeight(record.sacType, config);
  if (sacWeight <= 0) {
    return { valid: false, message: 'Sac weight must be greater than 0. Check sac type configuration.' };
  }
  if (record.grossWeight < sacWeight) {
    return { valid: false, message: `Gross weight (${record.grossWeight} kg) cannot be less than sac weight (${sacWeight} kg).` };
  }
  if (record.totalLaminateUsed <= 0) {
    return { valid: false, message: 'Total laminate used must be greater than 0. Check roll weight configuration for this machine\'s gram setting.' };
  }
  return { valid: true };
}

export async function saveLaminateCheck(checkData, config, isOnline) {
  const {
    machineId,
    sacType,
    grossWeight,
    team,
    checkedBy,
    remarks = '',
    previousCheck = null,
    totalLaminateUsed
  } = checkData;

  const sacWeight = getSacWeight(sacType, config);
  const wasteCollected = grossWeight - sacWeight;

  const validation = validateLaminateCheck({ sacType, grossWeight, totalLaminateUsed }, config);
  if (!validation.valid) return { status: 'error', message: validation.message };

  const prevRunningWaste = previousCheck?.runningWasteCollected ?? 0;
  const runningWasteCollected = prevRunningWaste + wasteCollected;
  const wastePercent = totalLaminateUsed > 0
    ? (runningWasteCollected / totalLaminateUsed) * 100
    : 0;

  const roundNumber = previousCheck ? previousCheck.roundNumber + 1 : 1;
  const { shift, date } = getShiftDateInfo(config);
  const docId = getLaminateWasteDocId(config);

  const record = {
    machineId,
    machineDisplayNumber: String(checkData.machineDisplayNumber || checkData.machineId || ''),
    machineName: checkData.machineName || '',
    line: checkData.line || '',
    gram: checkData.gram || 0,
    shiftApprovalDocId: docId,
    shift,
    date,
    team: team || '',
    roundNumber,
    sacType,
    sacWeight,
    grossWeight,
    wasteCollected: Math.round(wasteCollected * 1000) / 1000,
    totalLaminateUsed,
    runningWasteCollected: Math.round(runningWasteCollected * 1000) / 1000,
    wastePercent: Math.round(wastePercent * 100) / 100,
    previousRecordId: previousCheck?.id || null,
    checkedBy,
    checkedAt: serverTimestamp(),
    remarks,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (isOnline) {
    try {
      await addDoc(collection(db, 'laminate_records'), record);
      return { status: 'saved' };
    } catch (error) {
      console.error("[Laminate Save] Error, queueing:", error);
      return queueLaminateCheckOffline(record);
    }
  } else {
    return queueLaminateCheckOffline(record);
  }
}

function queueLaminateCheckOffline(record) {
  try {
    const queue = JSON.parse(localStorage.getItem(LAMINATE_QUEUE_KEY) || '[]');
    queue.push({ ...record, localCreatedAt: new Date().toISOString() });
    localStorage.setItem(LAMINATE_QUEUE_KEY, JSON.stringify(queue));
    return { status: 'offline-queued' };
  } catch (e) {
    console.error("Failed to queue laminate check offline", e);
    return { status: 'error' };
  }
}

export async function syncLaminateOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(LAMINATE_QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  const batch = writeBatch(db);
  const collectionRef = collection(db, 'laminate_records');

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
    localStorage.removeItem(LAMINATE_QUEUE_KEY);
    return { synced: queue.length };
  } catch (error) {
    console.error("Failed to sync laminate offline queue:", error);
    return { synced: 0 };
  }
}

export function subscribeToShiftLaminateRecords(config, callback) {
  const docId = getLaminateWasteDocId(config);
  const q = query(
    collection(db, 'laminate_records'),
    where('shiftApprovalDocId', '==', docId),
    orderBy('roundNumber', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to laminate records:", error);
    callback([]);
  });
}

export function subscribeToMachineLaminateHistory(machineId, shiftApprovalDocId, callback) {
  const q = query(
    collection(db, 'laminate_records'),
    where('machineId', '==', machineId),
    where('shiftApprovalDocId', '==', shiftApprovalDocId),
    orderBy('roundNumber', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to machine laminate history:", error);
    callback([]);
  });
}

export async function fetchLaminateRecordsByShift(config, targetShift, targetDate) {
  const docId = `laminate_waste_${targetShift}_${targetDate}`;
  const q = query(
    collection(db, 'laminate_records'),
    where('shiftApprovalDocId', '==', docId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getLaminateWasteSummary(config, targetShift, targetDate) {
  const records = await fetchLaminateRecordsByShift(config, targetShift, targetDate);

  const machinesMap = {};

  for (const record of records) {
    if (!machinesMap[record.machineId]) {
      machinesMap[record.machineId] = {
        machineId: record.machineId,
        machineDisplayNumber: record.machineDisplayNumber,
        line: record.line,
        gram: record.gram,
        checks: [],
        totalLaminateUsed: 0,
        totalWasteCollected: 0
      };
    }

    const m = machinesMap[record.machineId];
    m.checks.push(record);
    m.totalLaminateUsed = record.totalLaminateUsed;
    m.totalWasteCollected += record.wasteCollected;
  }

  return Object.values(machinesMap).map(m => {
    return {
      ...m,
      checks: m.checks.sort((a, b) => a.roundNumber - b.roundNumber),
      wastePercent: m.totalLaminateUsed > 0
        ? Math.round((m.totalWasteCollected / m.totalLaminateUsed) * 10000) / 100
        : 0
    };
  });
}
