// src/components/BroadcastModal.jsx
import { useState } from 'react';
import { useAlerts } from '../context/AlertContext';

export default function BroadcastModal({ isOpen, onClose }) {
  const { broadcastAlert } = useAlerts();
  
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastLevel, setBroadcastLevel] = useState('info');
  const [targetPages, setTargetPages] = useState(['all']);

  if (!isOpen) return null;

  const toggleTarget = (page) => {
    if (page === 'all') {
      setTargetPages(['all']);
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
      <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-8 rounded-2xl border-2 border-status-warning max-w-lg w-[90%] shadow-[0_0_40px_rgba(255,152,0,0.2)]" onClick={e => e.stopPropagation()}>
        <h2 className="text-status-warning text-2xl font-bold mb-6 text-center tracking-wider">📢 Broadcast Alert</h2>

        <div className="mb-6">
          <label className="text-xs text-gray-400 uppercase font-bold block mb-3">Target Screens</label>
          <div className="flex flex-wrap gap-2">
            <label className={`px-3 py-1.5 text-xs font-bold rounded-full cursor-pointer transition-colors ${targetPages.includes('all') ? 'bg-status-warning text-black' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>
              <input type="checkbox" className="hidden" checked={targetPages.includes('all')} onChange={() => toggleTarget('all')} />
              All Screens
            </label>
            <label className={`px-3 py-1.5 text-xs font-bold rounded-full cursor-pointer transition-colors ${targetPages.includes('/') ? 'bg-status-warning text-black' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>
              <input type="checkbox" className="hidden" checked={targetPages.includes('/')} onChange={() => toggleTarget('/')} />
              Data Entry
            </label>
            <label className={`px-3 py-1.5 text-xs font-bold rounded-full cursor-pointer transition-colors ${targetPages.includes('/level9-exec') ? 'bg-status-warning text-black' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>
              <input type="checkbox" className="hidden" checked={targetPages.includes('/level9-exec')} onChange={() => toggleTarget('/level9-exec')} />
              L9 Exec
            </label>
            <label className={`px-3 py-1.5 text-xs font-bold rounded-full cursor-pointer transition-colors ${targetPages.includes('/bot-exec') ? 'bg-status-warning text-black' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>
              <input type="checkbox" className="hidden" checked={targetPages.includes('/bot-exec')} onChange={() => toggleTarget('/bot-exec')} />
              BOT Exec
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Message</label>
          <textarea 
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="Type your urgent message here..." 
            className="w-full p-3 bg-[#121212] border border-[#444] rounded-lg text-white outline-none focus:border-status-warning min-h-[100px] resize-y"
          />
        </div>

        <div className="mb-8">
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