// src/services/presenceOperations.js
import { db } from '../config/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';

// 1. The Initial Ping & 3-Minute Heartbeat
export const setOnlineStatus = async (uid, email, path = '/') => {
  if (!uid || uid === 'local-dev-id') return; // Ignore the Ghost Admin
  try {
    await setDoc(doc(db, 'presence', uid), {
      uid,
      email,
      status: 'online',
      lastSeen: serverTimestamp(),
      currentPath: path
    }, { merge: true });
  } catch (error) {
    console.error("Error setting online status:", error);
  }
};

// 2. The Goodbye Signal (Logout or Tab Close)
export const setOfflineStatus = async (uid) => {
  if (!uid || uid === 'local-dev-id') return;
  try {
    await setDoc(doc(db, 'presence', uid), {
      status: 'offline',
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error setting offline status:", error);
  }
};

// 3. The Scanner (For the Command Center Dashboard)
export const subscribeToActiveUsers = (callback) => {
  // We only look for people who claim to be online
  const q = query(collection(db, 'presence'), where('status', '==', 'online'));
  
  return onSnapshot(q, (snapshot) => {
    const now = new Date().getTime();
    const activeUsers = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Safely parse their last heartbeat time
      const lastSeen = data.lastSeen?.toDate ? data.lastSeen.toDate().getTime() : now;
      
      // 🎯 THE SAFETY NET: 5 minutes = 300,000 milliseconds
      // If their last heartbeat was LESS than 5 minutes ago, they are truly online.
      // If a tablet died and couldn't send the Goodbye signal, it fails this test and is ignored!
      if (now - lastSeen < 300000) {
        activeUsers.push(data);
      }
    });

    callback(activeUsers);
  }, (error) => {
    console.error("Error fetching presence:", error);
    callback([]);
  });
};