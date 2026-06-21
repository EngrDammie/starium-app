// src/context/NetworkContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { syncCartonOfflineQueue } from '../services/cartonOperations';

const NetworkContext = createContext();

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [cartonQueueCount, setCartonQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCartonSyncing, setIsCartonSyncing] = useState(false);

  // 1. Listen for Wi-Fi changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check of local memory
    const queue = JSON.parse(localStorage.getItem('starium_offline_queue') || '[]');
    setQueueCount(queue.length);
    const cartonQueue = JSON.parse(localStorage.getItem('starium_carton_offline_queue') || '[]');
    setCartonQueueCount(cartonQueue.length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. The Auto-Sync trigger for QC queue
  useEffect(() => {
    const syncLocalQueue = async () => {
      const queue = JSON.parse(localStorage.getItem('starium_offline_queue') || '[]');
      if (queue.length === 0) return;

      setIsSyncing(true);
      let failedCount = 0;
      const remainingQueue = [];

      for (const testData of queue) {
        try {
          const localTime = testData.localCreatedAt;
          const syncId = testData.syncId;
          
          const docData = {
            ...testData,
            createdAt: localTime ? new Date(localTime) : serverTimestamp(),
            syncedAt: serverTimestamp(),
            wasOfflineQueued: true,
            offlineSyncId: syncId
          };
          delete docData.localCreatedAt;
          delete docData.syncId;

          await addDoc(collection(db, 'qc_tests'), docData);
          console.log('[Sync] Synced:', syncId);
        } catch (e) {
          failedCount++;
          remainingQueue.push(testData);
          console.error('[Sync] Failed to sync item:', e);
        }
      }

      if (failedCount === 0) {
        localStorage.removeItem('starium_offline_queue');
        setQueueCount(0);
      } else {
        localStorage.setItem('starium_offline_queue', JSON.stringify(remainingQueue));
        setQueueCount(remainingQueue.length);
      }
      
      setIsSyncing(false);
    };

    if (isOnline && queueCount > 0 && !isSyncing) {
      syncLocalQueue();
    }
  }, [isOnline, queueCount, isSyncing]);

  // 3. Auto-Sync trigger for carton queue
  useEffect(() => {
    const syncCartonQueue = async () => {
      setIsCartonSyncing(true);
      const result = await syncCartonOfflineQueue();
      if (result?.synced > 0) {
        setCartonQueueCount(0);
      }
      setIsCartonSyncing(false);
    };

    if (isOnline && cartonQueueCount > 0 && !isCartonSyncing) {
      syncCartonQueue();
    }
  }, [isOnline, cartonQueueCount, isCartonSyncing]);

  return (
    <NetworkContext.Provider value={{ isOnline, queueCount, setQueueCount, cartonQueueCount, setCartonQueueCount, isSyncing, setIsSyncing }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);