import { db } from '../config/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';

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

export async function reportStoppedMachine(machine, issues, userFullName) {
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

    issues[idx] = { ...issues[idx], solvedAt: serverTimestamp(), solvedBy: userFullName };

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
