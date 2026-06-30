// src/context/NetworkContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { syncCartonOfflineQueue } from '../services/cartonOperations';
import { syncLaminateOfflineQueue } from '../services/laminateOperations';
import { syncCartonInspectionQueue } from '../services/qcCartonInspectionOperations';

const NetworkContext = createContext();

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [cartonQueueCount, setCartonQueueCount] = useState(0);
  const [laminateQueueCount, setLaminateQueueCount] = useState(0);
  const [cartonInspectionQueueCount, setCartonInspectionQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCartonSyncing, setIsCartonSyncing] = useState(false);
  const [isLaminateSyncing, setIsLaminateSyncing] = useState(false);
  const [isCartonInspectionSyncing, setIsCartonInspectionSyncing] = useState(false);

  // 1. Listen for Wi-Fi changes
  useEffect(() => {
    const checkQueues = () => {
      const q = JSON.parse(localStorage.getItem('starium_offline_queue') || '[]');
      const cq = JSON.parse(localStorage.getItem('starium_carton_offline_queue') || '[]');
      const lq = JSON.parse(localStorage.getItem('starium_laminate_offline_queue') || '[]');
      const ciq = JSON.parse(localStorage.getItem('starium_carton_inspection_queue') || '[]');
      setQueueCount(q.length);
      setCartonQueueCount(cq.length);
      setLaminateQueueCount(lq.length);
      setCartonInspectionQueueCount(ciq.length);
    };

    const handleOnline = () => {
      setIsOnline(true);
      checkQueues();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkQueues();

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

  // 4. Auto-Sync trigger for laminate queue
  useEffect(() => {
    const syncLaminateQueue = async () => {
      setIsLaminateSyncing(true);
      const result = await syncLaminateOfflineQueue();
      if (result?.synced > 0) {
        setLaminateQueueCount(0);
      }
      setIsLaminateSyncing(false);
    };

    if (isOnline && laminateQueueCount > 0 && !isLaminateSyncing) {
      syncLaminateQueue();
    }
  }, [isOnline, laminateQueueCount, isLaminateSyncing]);

  // 5. Auto-Sync trigger for carton inspection queue
  useEffect(() => {
    const syncCiQueue = async () => {
      setIsCartonInspectionSyncing(true);
      const result = await syncCartonInspectionQueue();
      if (result?.synced > 0) {
        setCartonInspectionQueueCount(0);
      }
      setIsCartonInspectionSyncing(false);
    };

    if (isOnline && cartonInspectionQueueCount > 0 && !isCartonInspectionSyncing) {
      syncCiQueue();
    }
  }, [isOnline, cartonInspectionQueueCount, isCartonInspectionSyncing]);

  return (
    <NetworkContext.Provider value={{ isOnline, queueCount, setQueueCount, cartonQueueCount, setCartonQueueCount, laminateQueueCount, setLaminateQueueCount, cartonInspectionQueueCount, setCartonInspectionQueueCount, isSyncing, setIsSyncing, isCartonSyncing, setIsCartonSyncing, isLaminateSyncing, setIsLaminateSyncing, isCartonInspectionSyncing, setIsCartonInspectionSyncing }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);