// src/services/qcOperations.js
import { db } from '../config/firebase';
import { collection, addDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';

const QUEUE_KEY = 'starium_offline_queue';

export function getShiftDateInfo(config) {
  const now = new Date();
  const hour = now.getHours();
  let shift, dateObj;
  
  if (hour >= config.dayShiftStart && hour < config.nightShiftStart) {
    shift = 'DAY';
    dateObj = now;
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

// Includes the offline bypass fix
export async function getOrCreateShiftApproval(mode, config, isOnline = true) {
  const { shift, date } = getShiftDateInfo(config);
  const docId = `${mode}_${shift}_${date}`; 

  if (!isOnline) {
    return docId;
  }

  try {
    const docRef = doc(db, 'shift_approvals', docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) return docSnap.id;
    
    await setDoc(docRef, {
      mode, shift, date,
      status: 'pending',
      createdAt: serverTimestamp(),
      approvedBy: [], approvals: {}
    });
    return docId;
  } catch (error) {
    console.error("Error getting/creating shift approval:", error);
    return docId;
  }
}

export async function saveQCTest(testData, isOnline, setQueueCount) {
  if (isOnline) {
    try {
      await addDoc(collection(db, 'qc_tests'), { ...testData, createdAt: serverTimestamp() });
      return 'saved';
    } catch (error) {
      console.error("[Save] Error, queueing for later:", error);
      return queueOffline(testData, setQueueCount);
    }
  } else {
    return queueOffline(testData, setQueueCount);
  }
}

function queueOffline(testData, setQueueCount) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    const localTimestamp = new Date().toISOString();
    const syncId = localTimestamp + '_' + Math.random().toString(36).substr(2, 5);
    
    queue.push({ ...testData, localCreatedAt: localTimestamp, syncId });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    if (setQueueCount) setQueueCount(queue.length);
    
    return 'offline-queued';
  } catch (e) {
    console.error("Failed to queue offline", e);
    return 'error';
  }
}

// Includes the Oldest-to-Newest sorting fix
export function subscribeToShiftTests(mode, config, callback) {
  const { shift, date } = getShiftDateInfo(config);
  const docId = `${mode}_${shift}_${date}`;

  const q = query(collection(db, 'qc_tests'), where('approvalDocId', '==', docId));
  
  return onSnapshot(q, (snapshot) => {
    const tests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    tests.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.localCreatedAt ? new Date(a.localCreatedAt) : new Date(0));
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.localCreatedAt ? new Date(b.localCreatedAt) : new Date(0));
      return dateA - dateB; 
    });
    
    callback(tests);
  }, (error) => {
    console.error("Error subscribing to test count:", error);
    callback([]);
  });
}

// 🎯 RESTORED: The Approval functions for the Executive pages!
export function subscribeToShiftApproval(approvalId, callback) {
  if (!approvalId) return () => {};
  return onSnapshot(doc(db, 'shift_approvals', approvalId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
}

export async function addApprover(approvalId, approverName, approverRole) {
  try {
    const updateData = {};
    updateData[approverRole] = {
      name: approverName,
      role: approverRole,
      timestamp: new Date()
    };
    await updateDoc(doc(db, 'shift_approvals', approvalId), updateData);
    return true;
  } catch (error) {
    console.error('Error adding approver:', error);
    return false;
  }
}