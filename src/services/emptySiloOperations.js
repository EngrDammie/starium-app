import { db } from '../config/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';
import { addMachineIssue, reportStoppedMachine, markIssueSolved } from './stoppedMachineOperations';

const EMPTY_SILO_QUEUE_KEY = 'starium_empty_silo_queue';

export function getEmptySilosDocId(config) {
  const { shift, date } = getShiftDateInfo(config);
  return `empty_silos_${shift}_${date}`;
}

export function subscribeToActiveEmptySilos(callback) {
  const q = query(collection(db, 'empty_silos'), where('noLongerEmptyAt', '==', null));

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to active empty silos:", error);
    callback([]);
  });
}

export function subscribeToShiftEmptySilos(config, callback) {
  const docId = getEmptySilosDocId(config);
  const q = query(collection(db, 'empty_silos'), where('shiftApprovalDocId', '==', docId));

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to empty silos:", error);
    callback([]);
  });
}

export async function markMachineEmpty(machine, userFullName, config, broadcastAlert, isOnline = true) {
  const { shift, date } = getShiftDateInfo(config);
  const docId = getEmptySilosDocId(config);

  if (!isOnline) {
    const queue = JSON.parse(localStorage.getItem(EMPTY_SILO_QUEUE_KEY) || '[]');
    const existing = queue.find(r => r.machineId === machine.id && !r.noLongerEmptyAt);
    if (existing) return 'already-queued';
    queue.push({
      shiftApprovalDocId: docId,
      machineId: machine.id,
      machineDisplayNumber: machine.displayNumber || machine.id || '',
      machineName: machine.name || '',
      line: machine.line || '',
      gram: machine.gram || 0,
      markedEmptyBy: userFullName,
      markedEmptyAt: new Date().toISOString(),
      shift,
      date,
      buggyNumber: null,
      noLongerEmptyAt: null,
      noLongerEmptyBy: null,
      localCreatedAt: new Date().toISOString()
    });
    localStorage.setItem(EMPTY_SILO_QUEUE_KEY, JSON.stringify(queue));
    await autoStopMachineForEmpty(machine, userFullName, false);
    return 'queued';
  }

  try {
    await addDoc(collection(db, 'empty_silos'), {
      shiftApprovalDocId: docId,
      machineId: machine.id,
      machineDisplayNumber: machine.displayNumber || machine.id || '',
      machineName: machine.name || '',
      line: machine.line || '',
      gram: machine.gram || 0,
      markedEmptyBy: userFullName,
      markedEmptyAt: serverTimestamp(),
      shift,
      date,
      buggyNumber: null,
      noLongerEmptyAt: null,
      noLongerEmptyBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    broadcastAlert(
      `🛢️ Machine M${machine.displayNumber || machine.id} EMPTY`,
      `Machine M${machine.displayNumber || machine.id} (Line ${machine.line}, ${machine.gram}g) marked empty by ${userFullName}.`,
      'warning',
      ['/', '/powder-density', '/level9-exec', '/bot-exec']
    );

    await autoStopMachineForEmpty(machine, userFullName, true);
    return 'saved';
  } catch (error) {
    console.error("Error marking machine empty:", error);
    const queue = JSON.parse(localStorage.getItem(EMPTY_SILO_QUEUE_KEY) || '[]');
    const existing = queue.find(r => r.machineId === machine.id && !r.noLongerEmptyAt);
    if (existing) return 'already-queued';
    queue.push({
      shiftApprovalDocId: docId,
      machineId: machine.id,
      machineDisplayNumber: machine.displayNumber || machine.id || '',
      machineName: machine.name || '',
      line: machine.line || '',
      gram: machine.gram || 0,
      markedEmptyBy: userFullName,
      markedEmptyAt: new Date().toISOString(),
      shift,
      date,
      buggyNumber: null,
      noLongerEmptyAt: null,
      noLongerEmptyBy: null,
      localCreatedAt: new Date().toISOString()
    });
    localStorage.setItem(EMPTY_SILO_QUEUE_KEY, JSON.stringify(queue));
    await autoStopMachineForEmpty(machine, userFullName, false);
    return 'queued';
  }
}

export function getQueuedEmptySilos() {
  return JSON.parse(localStorage.getItem(EMPTY_SILO_QUEUE_KEY) || '[]');
}

async function getOrCreateNoPowderIssue(userFullName) {
  try {
    const q = query(collection(db, 'machine_issues'), where('label', '==', 'No Powder'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, label: doc.data().label };
    }
    const result = await addMachineIssue('No Powder', userFullName);
    if (result) return result;
  } catch (e) {
    console.warn('[EmptySilo] Could not get/create No Powder issue:', e);
  }
  return { id: '__no_powder__', label: 'No Powder' };
}

async function autoStopMachineForEmpty(machine, userFullName, isOnline) {
  try {
    const issue = await getOrCreateNoPowderIssue(userFullName);
    await reportStoppedMachine(machine, [issue], userFullName, isOnline);
  } catch (e) {
    console.error('[EmptySilo] Auto-stop failed:', e);
  }
}

async function resolveNoPowderIssueForMachine(machine, userFullName) {
  if (!machine?.id) return;
  try {
    const q = query(
      collection(db, 'stopped_machines'),
      where('machineId', '==', machine.id),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    const stoppedDoc = snapshot.docs[0];
    const noPowderIssue = stoppedDoc.data().issues?.find(i => i.label === 'No Powder' && !i.solvedAt);
    if (!noPowderIssue) return;
    await markIssueSolved(stoppedDoc.id, noPowderIssue.id, userFullName);
  } catch (e) {
    console.warn('[EmptySilo] Could not resolve No Powder issue:', e);
  }
}

export async function syncEmptySiloQueue() {
  const queue = JSON.parse(localStorage.getItem(EMPTY_SILO_QUEUE_KEY) || '[]');
  if (queue.length === 0) return { synced: 0 };
  const batch = writeBatch(db);
  const ref = collection(db, 'empty_silos');
  const refills = [];
  for (const record of queue) {
    if (record.type === 'refill') {
      refills.push(record);
    } else {
      const newRef = doc(ref);
      batch.set(newRef, {
        ...record,
        markedEmptyAt: record.markedEmptyAt ? new Date(record.markedEmptyAt) : serverTimestamp(),
        noLongerEmptyAt: record.noLongerEmptyAt ? new Date(record.noLongerEmptyAt) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
  try {
    await batch.commit();
    for (const refill of refills) {
      if (!refill.recordId) continue;
      try {
        await updateDoc(doc(db, 'empty_silos', refill.recordId), {
          buggyNumber: refill.buggyNumber,
          noLongerEmptyAt: refill.noLongerEmptyAt ? new Date(refill.noLongerEmptyAt) : serverTimestamp(),
          noLongerEmptyBy: refill.noLongerEmptyBy,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('[EmptySilo] Refill sync error:', e);
      }
    }
    localStorage.removeItem(EMPTY_SILO_QUEUE_KEY);
    return { synced: queue.length };
  } catch (err) {
    console.error('[EmptySilo] Sync error:', err);
    throw err;
  }
}

export async function markMachineNoLongerEmpty(recordId, buggyNumber, userFullName, config, broadcastAlert, machine, isOnline = true, setQueueCount) {
  if (!isOnline || !recordId) {
    const queue = JSON.parse(localStorage.getItem(EMPTY_SILO_QUEUE_KEY) || '[]');
    const idx = queue.findIndex(r => r.machineId === machine?.id && !r.noLongerEmptyAt);
    if (idx !== -1) {
      queue[idx].buggyNumber = buggyNumber;
      queue[idx].noLongerEmptyAt = new Date().toISOString();
      queue[idx].noLongerEmptyBy = userFullName;
    } else {
      queue.push({
        type: 'refill',
        recordId,
        machineId: machine?.id,
        buggyNumber,
        noLongerEmptyAt: new Date().toISOString(),
        noLongerEmptyBy: userFullName,
        localCreatedAt: new Date().toISOString()
      });
    }
    localStorage.setItem(EMPTY_SILO_QUEUE_KEY, JSON.stringify(queue));
    if (setQueueCount) setQueueCount(queue.length);
    return 'queued';
  }

  try {
    await updateDoc(doc(db, 'empty_silos', recordId), {
      buggyNumber,
      noLongerEmptyAt: serverTimestamp(),
      noLongerEmptyBy: userFullName,
      updatedAt: serverTimestamp(),
    });

    if (broadcastAlert && machine) {
      broadcastAlert(
        `✅ Machine M${machine.displayNumber || machine.id} REFILLED`,
        `Machine M${machine.displayNumber || machine.id} (Line ${machine.line}, ${machine.gram}g) refilled with Buggy ${buggyNumber} by ${userFullName}. ⚠️ Remember to START the machine!`,
        'info',
        ['/', '/powder-density', '/level9-exec', '/bot-exec']
      );
    }

    await resolveNoPowderIssueForMachine(machine, userFullName);
    return 'updated';
  } catch (error) {
    console.error("Error marking machine no longer empty:", error);
    const queue = JSON.parse(localStorage.getItem(EMPTY_SILO_QUEUE_KEY) || '[]');
    const idx = queue.findIndex(r => r.machineId === machine?.id && !r.noLongerEmptyAt);
    if (idx !== -1) {
      queue[idx].buggyNumber = buggyNumber;
      queue[idx].noLongerEmptyAt = new Date().toISOString();
      queue[idx].noLongerEmptyBy = userFullName;
    } else {
      queue.push({
        type: 'refill',
        recordId,
        machineId: machine?.id,
        buggyNumber,
        noLongerEmptyAt: new Date().toISOString(),
        noLongerEmptyBy: userFullName,
        localCreatedAt: new Date().toISOString()
      });
    }
    localStorage.setItem(EMPTY_SILO_QUEUE_KEY, JSON.stringify(queue));
    if (setQueueCount) setQueueCount(queue.length);
    return 'queued';
  }
}
