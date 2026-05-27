// src/components/SyncBadge.jsx
import { useNetwork } from '../context/NetworkContext';

export default function SyncBadge() {
  const { isOnline, queueCount, isSyncing } = useNetwork();

  return (
    // 🎯 FIX: Added print:hidden
    <div className={`print:hidden fixed top-14 md:top-5 left-5 px-4 py-2 rounded-full text-xs font-bold z-40 flex items-center gap-2 transition-colors duration-300 shadow-lg backdrop-blur-sm
      ${isOnline ? 'bg-status-success/10 text-status-success border border-status-success/30' : 'bg-status-danger/10 text-status-danger border border-status-danger/30'}
      ${isSyncing ? 'animate-pulse bg-status-warning/10 text-status-warning border-status-warning/30' : ''}
    `}>
      <span className="text-base">{isOnline ? '🟢' : '📴'}</span>
      <span className="uppercase tracking-wider">{isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'}</span>
      
      {queueCount > 0 && (
        <span className="bg-status-warning text-black px-2 py-0.5 rounded-md ml-2 shadow-[0_0_10px_rgba(255,152,0,0.5)]">
          {queueCount} pending
        </span>
      )}
    </div>
  );
}