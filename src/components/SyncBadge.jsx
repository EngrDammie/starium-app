// src/components/SyncBadge.jsx
import { useNetwork } from '../context/NetworkContext';

export default function SyncBadge() {
  const { isOnline, queueCount, cartonQueueCount, laminateQueueCount, isSyncing, isCartonSyncing, isLaminateSyncing } = useNetwork();
  const syncing = isSyncing || isCartonSyncing || isLaminateSyncing;
  const totalPending = queueCount + cartonQueueCount + laminateQueueCount;

  return (
    // 🎯 FIX: Changed left-5 to left-[80px] to make room for the Hamburger Menu!
    <div className={`print:hidden fixed top-14 md:top-5 left-[80px] px-4 py-2 rounded-full text-xs font-bold z-40 flex items-center gap-2 transition-colors duration-300 shadow-lg backdrop-blur-sm
      ${isOnline ? 'bg-status-success/10 text-status-success border border-status-success/30' : 'bg-status-danger/10 text-status-danger border border-status-danger/30'}
      ${syncing ? 'animate-pulse bg-status-warning/10 text-status-warning border-status-warning/30' : ''}
    `}>
      <span className="text-base">{syncing ? '🔄' : isOnline ? '🟢' : '📴'}</span>
      <span className="uppercase tracking-wider">{syncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}</span>
      
      {totalPending > 0 && (
        <span className="bg-status-warning text-black px-2 py-0.5 rounded-md ml-2 shadow-[0_0_10px_rgba(255,152,0,0.5)]">
          {totalPending} pending
        </span>
      )}
    </div>
  );
}