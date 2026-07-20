import { db } from '../config/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where, onSnapshot, writeBatch } from 'firebase/firestore';

const STOPPED_MACHINE_QUEUE_KEY = 'starium_stopped_machine_queue';

export function subscribeToMachineIssues(callback) {
  return onSnapshot(collection(db, 'machine_issues'), (snapshot) => {
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    issues.sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));
    callback(issues);
  }, (error) => {
    console.error("Error subscribing to machine issues:", error);
    callback([]);
  });
}

export async function addMachineIssue(label, addedBy) {
  try {
    const docRef = await addDoc(collection(db, 'machine_issues'), {
      label,
      createdBy: addedBy,
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, label };
  } catch (error) {
    console.error("Error adding machine issue:", error);
    return null;
  }
}

export function subscribeToActiveStoppedMachines(callback) {
  const q = query(collection(db, 'stopped_machines'), where('isActive', '==', true));

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to stopped machines:", error);
    callback([]);
  });
}

export async function reportStoppedMachine(machine, issues, userFullName, isOnline = true) {
  if (!isOnline) {
    const queue = JSON.parse(localStorage.getItem(STOPPED_MACHINE_QUEUE_KEY) || '[]');
    queue.push({
      type: 'reportStopped',
      machineId: machine.id,
      machineDisplayNumber: machine.displayNumber || machine.id || '',
      machineName: machine.name || '',
      line: machine.line || '',
      gram: machine.gram || 0,
      stoppedBy: userFullName,
      issues: issues.map(issue => ({
        id: issue.id,
        label: issue.label,
        createdAt: new Date().toISOString(),
        solvedAt: null,
        solvedBy: null,
      })),
      localCreatedAt: new Date().toISOString()
    });
    localStorage.setItem(STOPPED_MACHINE_QUEUE_KEY, JSON.stringify(queue));
    return 'queued';
  }

  try {
    await addDoc(collection(db, 'stopped_machines'), {
      machineId: machine.id,
      machineDisplayNumber: machine.displayNumber || machine.id || '',
      machineName: machine.name || '',
      line: machine.line || '',
      gram: machine.gram || 0,
      stoppedBy: userFullName,
      stoppedAt: serverTimestamp(),
      startedAt: null,
      startedBy: null,
      issues: issues.map(issue => ({
        id: issue.id,
        label: issue.label,
        createdAt: new Date(),
        solvedAt: null,
        solvedBy: null,
      })),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return 'saved';
  } catch (error) {
    console.error("Error reporting stopped machine:", error);
    return 'error';
  }
}

export async function markIssueSolved(machineDocId, issueId, userFullName) {
  try {
    const docRef = doc(db, 'stopped_machines', machineDocId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return 'error';

    const data = snap.data();
    const issues = [...(data.issues || [])];
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx === -1) return 'error';

    issues[idx] = { ...issues[idx], solvedAt: new Date(), solvedBy: userFullName };

    const allSolved = issues.every(i => i.solvedAt);
    const updateData = { issues, updatedAt: serverTimestamp() };

    await updateDoc(docRef, updateData);
    return allSolved ? 'all-solved' : 'solved';
  } catch (error) {
    console.error("Error marking issue solved:", error);
    return 'error';
  }
}

export async function startMachine(machineDocId, userFullName) {
  try {
    const docRef = doc(db, 'stopped_machines', machineDocId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return 'error';

    const data = snap.data();
    const allSolved = (data.issues || []).every(i => i.solvedAt);

    await updateDoc(docRef, {
      startedAt: serverTimestamp(),
      startedBy: userFullName,
      isActive: allSolved ? false : true,
      updatedAt: serverTimestamp(),
    });

    return allSolved ? 'running' : 'started-with-issues';
  } catch (error) {
    console.error("Error starting machine:", error);
    return 'error';
  }
}

export async function appendIssuesToMachine(docId, issues, userFullName) {
  try {
    const docRef = doc(db, 'stopped_machines', docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return 'error';

    const data = snap.data();
    const existingIssues = [...(data.issues || [])];
    const existingIds = new Set(existingIssues.map(i => i.id));
    const newIssues = issues
      .filter(issue => !existingIds.has(issue.id))
      .map(issue => ({
        id: issue.id,
        label: issue.label,
        createdAt: new Date(),
        solvedAt: null,
        solvedBy: null,
      }));

    if (newIssues.length === 0) return 'saved';

    await updateDoc(docRef, {
      issues: [...existingIssues, ...newIssues],
      startedAt: null,
      startedBy: null,
      isActive: true,
      updatedAt: serverTimestamp(),
    });
    return 'saved';
  } catch (error) {
    console.error("Error appending issues:", error);
    return 'error';
  }
}

export function getQueuedStoppedMachines() {
  return JSON.parse(localStorage.getItem(STOPPED_MACHINE_QUEUE_KEY) || '[]');
}

export async function syncStoppedMachineQueue() {
  const queue = JSON.parse(localStorage.getItem(STOPPED_MACHINE_QUEUE_KEY) || '[]');
  if (queue.length === 0) return { synced: 0 };
  const batch = writeBatch(db);
  const ref = collection(db, 'stopped_machines');
  for (const record of queue) {
    if (record.type === 'reportStopped') {
      const newRef = doc(ref);
      batch.set(newRef, {
        machineId: record.machineId,
        machineDisplayNumber: record.machineDisplayNumber,
        machineName: record.machineName,
        line: record.line,
        gram: record.gram,
        stoppedBy: record.stoppedBy,
        stoppedAt: record.localCreatedAt ? new Date(record.localCreatedAt) : serverTimestamp(),
        startedAt: null,
        startedBy: null,
        issues: (record.issues || []).map(i => ({
          ...i,
          createdAt: new Date(i.createdAt),
        })),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
  try {
    await batch.commit();
    localStorage.removeItem(STOPPED_MACHINE_QUEUE_KEY);
    return { synced: queue.length };
  } catch (err) {
    console.error('[StoppedMachine] Sync error:', err);
    throw err;
  }
}
