import { db } from '../config/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';

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

export async function markMachineEmpty(machine, userFullName, config, broadcastAlert) {
  const { shift, date } = getShiftDateInfo(config);
  const docId = getEmptySilosDocId(config);
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

    return 'saved';
  } catch (error) {
    console.error("Error marking machine empty:", error);
    return 'error';
  }
}

export async function markMachineNoLongerEmpty(recordId, buggyNumber, userFullName, config, broadcastAlert, machine) {
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
        `Machine M${machine.displayNumber || machine.id} (Line ${machine.line}, ${machine.gram}g) refilled with Buggy ${buggyNumber} by ${userFullName}.`,
        'info',
        ['/', '/powder-density', '/level9-exec', '/bot-exec']
      );
    }

    return 'updated';
  } catch (error) {
    console.error("Error marking machine no longer empty:", error);
    return 'error';
  }
}
