// src/components/BroadcastModal.jsx
import { useState } from 'react';
import { useAlerts } from '../context/AlertContext';
import { MENU_CONFIG } from '../config/navigation';

const routeGroups = MENU_CONFIG.map(cat => ({
  title: cat.title,
  icon: cat.icon,
  routes: cat.children.map(child => ({
    path: child.path,
    label: child.label,
    icon: child.icon
  }))
}));

export default function BroadcastModal({ isOpen, onClose }) {
  const { broadcastAlert } = useAlerts();
  
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastLevel, setBroadcastLevel] = useState('info');
  const [targetPages, setTargetPages] = useState(['all']);

  if (!isOpen) return null;

  const toggleTarget = (page) => {
    if (page === 'all') {
      if (targetPages.includes('all')) {
        setTargetPages([]);
      } else {
        setTargetPages(['all']);
      }
      return;
    }
    let newTargets = targetPages.filter(t => t !== 'all');
    if (newTargets.includes(page)) {
      newTargets = newTargets.filter(t => t !== page);
      if (newTargets.length === 0) newTargets = ['all'];
    } else {
      newTargets.push(page);
    }
    setTargetPages(newTargets);
  };

  const handleBroadcast = () => {
    if (!broadcastMsg.trim()) return;
    broadcastAlert("SYSTEM MESSAGE", broadcastMsg, broadcastLevel, targetPages);
    setBroadcastMsg('');
    setTargetPages(['all']);
    onClose(); 
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[99999] animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-6 rounded-2xl border-2 border-status-warning max-w-lg w-[90%] shadow-[0_0_40px_rgba(255,152,0,0.2)]" onClick={e => e.stopPropagation()}>
        <h2 className="text-status-warning text-2xl font-bold mb-4 text-center tracking-wider">📢 Broadcast Alert</h2>

        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Target Screens</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <label className={`px-3 py-1.5 text-xs font-bold rounded-full cursor-pointer transition-colors ${targetPages.includes('all') ? 'bg-status-warning text-black' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>
              <input type="checkbox" className="hidden" checked={targetPages.includes('all')} onChange={() => toggleTarget('all')} />
              📢 All Screens
            </label>
          </div>
          {!targetPages.includes('all') && (
            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {routeGroups.map(group => (
                <div key={group.title}>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">{group.icon || '📄'} {group.title}</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {group.routes.map(route => (
                      <label
                        key={route.path}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full cursor-pointer transition-colors ${targetPages.includes(route.path) ? 'bg-status-warning text-black' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}
                      >
                        <input type="checkbox" className="hidden" checked={targetPages.includes(route.path)} onChange={() => toggleTarget(route.path)} />
                        {route.icon} {route.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Message</label>
          <textarea 
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="Type your urgent message here..." 
            className="w-full p-3 bg-[#121212] border border-[#444] rounded-lg text-white outline-none focus:border-status-warning min-h-[90px] resize-y"
          />
        </div>

        <div className="mb-6">
          <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Alert Level</label>
          <select 
            value={broadcastLevel}
            onChange={(e) => setBroadcastLevel(e.target.value)}
            className="w-full p-3 bg-[#121212] border border-[#444] rounded-lg text-white outline-none focus:border-status-warning"
          >
            <option value="info">Info (Blue)</option>
            <option value="warning">Warning (Orange)</option>
            <option value="danger">Critical (Red Shaking)</option>
          </select>
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-3 bg-[#444] text-white rounded-lg font-bold hover:bg-[#555] transition-colors">Cancel</button>
          <button onClick={handleBroadcast} className="flex-1 py-3 bg-status-warning text-black rounded-lg font-bold hover:bg-yellow-400 transition-colors uppercase tracking-wider">
            Send Alert
          </button>
        </div>
      </div>
    </div>
  );
}