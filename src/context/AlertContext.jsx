// src/context/AlertContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [sessionStartTime] = useState(() => new Date().toISOString());

  useEffect(() => {
    // Listen to the 'alerts' collection for brand new alerts only
    const q = query(collection(db, 'alerts'), where('localTimestamp', '>=', sessionStartTime));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newAlert = { id: change.doc.id, ...change.doc.data() };
          
          setAlerts(prev => [...prev, newAlert]);
          
          // Auto-remove after 15 seconds
          setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
          }, 15000);
        }
      });
    });

    return () => unsubscribe();
  }, [sessionStartTime]);

  // 🎯 FIX: Added 'targetPages' array. Defaults to ['all']
  const broadcastAlert = async (title, message, level = 'info', targetPages = ['all']) => {
    try {
      await addDoc(collection(db, 'alerts'), {
        title,
        message,
        level, 
        targetPages, // Which pages should show this alert!
        localTimestamp: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to broadcast alert", error);
    }
  };

  return (
    <AlertContext.Provider value={{ alerts, broadcastAlert, setAlerts }}>
      {children}
    </AlertContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertContext);