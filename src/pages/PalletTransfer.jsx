import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  getPalletTransferDocId,
  savePalletTransfer,
  subscribeToShiftPalletTransfers,
  getQueuedPalletTransfers
} from '../services/palletTransferOperations';
import PalletCalculatorModal from '../components/PalletCalculatorModal';

export default function PalletTransfer() {
  const { config, loadingConfig } = useConfig();
  const { currentUser, userFullName } = useAuth();
  const { isOnline, setPalletQueueCount } = useNetwork();

  const [shiftInfo, setShiftInfo] = useState({ shift: '--', date: '--' });
  const [team, setTeam] = useState(() => {
    return localStorage.getItem('starium_pallet_team') || config?.packagingTeams?.defaultTeam || '';
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [gram, setGram] = useState('');
  const [palletSize, setPalletSize] = useState('');
  const [palletCount, setPalletCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const lastPalletSizes = useRef({});

  const grams = Object.keys(config?.gramSpecs || {});
  const gramLabels = grams.map(g => `${g}g`);

  const palletSizesConfig = config?.palletTransfer?.palletSizes || {};
  const teamsConfig = config?.packagingTeams || { labels: ['A', 'B', 'C'], defaultTeam: 'A' };

  useEffect(() => {
    if (loadingConfig) return;
    const hour = new Date().getHours();
    const isDay = hour >= config.dayShiftStart && hour < config.nightShiftStart;
    const now = new Date();
    setShiftInfo({
      shift: isDay ? 'DAY' : 'NIGHT',
      date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    });
  }, [config, loadingConfig]);

  useEffect(() => {
    if (loadingConfig) return;
    const unsub = subscribeToShiftPalletTransfers(config, (synced) => {
      const queued = getQueuedPalletTransfers(config);
      const merged = [...synced, ...queued].sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime();
        const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime();
        return ta - tb;
      });
      setRecords(merged);
      setLoading(false);
    });
    return () => unsub();
  }, [config, loadingConfig]);

  useEffect(() => {
    const q = JSON.parse(localStorage.getItem('starium_pallet_transfer_queue') || '[]');
    setPalletQueueCount(q.length);
  }, [records, setPalletQueueCount]);

  useEffect(() => {
    if (team) localStorage.setItem('starium_pallet_team', team);
  }, [team]);

  const handleGramChange = (e) => {
    const g = e.target.value;
    setGram(g);
    if (g) {
      const remembered = lastPalletSizes.current[g];
      setPalletSize(remembered !== undefined ? remembered : (palletSizesConfig[g] || ''));
    } else {
      setPalletSize('');
    }
    setPalletCount(1);
    setError('');
  };

  const handlePalletSizeBlur = () => {
    if (gram && palletSize) {
      lastPalletSizes.current[gram] = Number(palletSize);
    }
  };

  const adjustCount = (delta) => {
    setPalletCount(prev => Math.max(1, prev + delta));
  };

  const totalCartons = Number(palletSize || 0) * palletCount;

  const perGramTotals = {};
  for (const r of records) {
    if (!perGramTotals[r.gram]) perGramTotals[r.gram] = { pallets: 0, cartons: 0 };
    perGramTotals[r.gram].pallets += r.palletCount || 0;
    perGramTotals[r.gram].cartons += r.totalCartons || 0;
  }

  const handleSubmit = async () => {
    if (!gram) { setError('Select a gram/SKU'); return; }
    if (!palletSize || Number(palletSize) <= 0) { setError('Enter a valid pallet size'); return; }
    if (!team) { setError('Select a team'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await savePalletTransfer({
        gram,
        palletSize: Number(palletSize),
        palletCount,
        team,
        recordedBy: userFullName || currentUser?.email?.split('@')[0] || 'Staff',
        recordedByUid: currentUser?.uid || 'unknown'
      }, config, isOnline);
      if (result.status === 'queued') {
        const queuedList = getQueuedPalletTransfers(config);
        setRecords(prev => {
          const syncedOnly = prev.filter(r => r.synced);
          return [...syncedOnly, ...queuedList].sort((a, b) => {
            const ta = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt).getTime();
            const tb = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt).getTime();
            return ta - tb;
          });
        });
      }
      setPalletCount(1);
    } catch (err) {
      setError('Failed to save. Try again.');
    }
    setSaving(false);
  };

  const totalPallets = records.reduce((s, r) => s + (r.palletCount || 0), 0);
  const totalCartonsAll = records.reduce((s, r) => s + (r.totalCartons || 0), 0);
  const totalEntries = records.length;
  const pendingCount = records.filter(r => !r.synced).length;

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const canRecord = gram && palletSize && Number(palletSize) > 0 && team && !saving;

  return (
    <Layout title="📦 Pallet Transfer" subtitle={`Production Floor → Warehouse · ${shiftInfo.shift} · ${shiftInfo.date}`} maxWidth="max-w-4xl">
      {loading ? (
        <div className="text-center text-gray-400 mt-20 animate-pulse text-lg">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">🏗️ Total Pallets</div>
              <div className="text-3xl font-bold text-primary">{totalPallets}</div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">📦 Total Cartons</div>
              <div className="text-3xl font-bold text-white">{totalCartonsAll.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-8 rounded-2xl border-2 border-primary shadow-[0_0_30px_rgba(255,107,0,0.15)] mb-6">
            <h3 className="text-primary text-lg font-bold mb-6 text-center uppercase tracking-wider">Record New Transfer</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-primary font-bold mb-2 text-sm">⚖️ Gram / SKU</label>
                <select value={gram} onChange={handleGramChange} className="w-full p-3 bg-[#121212] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary transition-all">
                  <option value="">— Select Gram —</option>
                  {grams.map(g => (
                    <option key={g} value={g}>{g}g</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-primary font-bold mb-2 text-sm">📐 Cartons per Pallet</label>
                <input type="number" min="1" value={palletSize} onChange={e => setPalletSize(e.target.value)} onBlur={handlePalletSizeBlur}
                  className="w-full p-3 bg-[#121212] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary transition-all" placeholder="e.g. 100" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-primary font-bold mb-3 text-sm text-center">🔢 Number of Pallets</label>
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => adjustCount(-1)} disabled={palletCount <= 1} className="w-16 h-16 bg-[#1a1a1a] border-2 border-primary rounded-2xl text-primary text-3xl font-bold hover:bg-primary hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-[0_0_15px_rgba(255,107,0,0.2)]">−</button>
                <div className="text-6xl font-black text-white tabular-nums w-24 text-center">{palletCount}</div>
                <button onClick={() => adjustCount(1)} className="w-16 h-16 bg-[#1a1a1a] border-2 border-primary rounded-2xl text-primary text-3xl font-bold hover:bg-primary hover:text-black transition-all flex items-center justify-center shadow-[0_0_15px_rgba(255,107,0,0.2)]">+</button>
              </div>
            </div>

            {palletSize && (
              <div className="bg-primary/10 border-2 border-primary/30 rounded-2xl p-6 mb-6 text-center">
                <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Cartons This Transfer</div>
                <div className="text-5xl font-black text-white">{totalCartons.toLocaleString()}</div>
                <div className="text-sm text-gray-500 mt-1">{palletCount} pallet{palletCount !== 1 ? 's' : ''} × {palletSize} cartons</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-primary font-bold mb-2 text-sm">👥 Team</label>
                <select value={team} onChange={e => setTeam(e.target.value)} className="w-full p-3 bg-[#121212] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary transition-all">
                  <option value="">— Select Team —</option>
                  {teamsConfig.labels.map(t => (
                    <option key={t} value={t}>Team {t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-primary font-bold mb-2 text-sm">👤 Recorded By</label>
                <input type="text" value={userFullName || currentUser?.email?.split('@')[0] || ''} readOnly
                  className="w-full p-3 bg-[#121212] text-gray-400 border-2 border-gray-800 rounded-lg outline-none cursor-not-allowed" />
              </div>
            </div>

            {error && <div className="text-status-danger bg-status-danger/10 border border-status-danger p-3 rounded-lg mb-5 text-center text-sm font-medium">{error}</div>}

            <button onClick={handleSubmit} disabled={!canRecord} className="w-full p-5 bg-gradient-to-br from-primary to-[#e55a00] text-white rounded-xl font-bold uppercase tracking-wide text-lg hover:from-[#ff7a1a] hover:to-primary hover:shadow-[0_0_30px_rgba(255,107,0,0.5)] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? '⏳ Saving...' : isOnline ? '📦 Record Transfer' : '📦 Save Offline'}
            </button>
          </div>

          {Object.keys(perGramTotals).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {Object.entries(perGramTotals).sort(([a], [b]) => Number(a) - Number(b)).map(([g, t]) => (
                <div key={g} className="bg-dark-card p-4 rounded-xl border border-[#333] text-center">
                  <div className="text-primary font-black text-lg mb-1">{g}g</div>
                  <div className="flex justify-center gap-3 text-xs">
                    <span className="text-gray-300">🏗️ {t.pallets}</span>
                    <span className="text-white font-bold">📦 {t.cartons.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setIsCalculatorOpen(true)}
            className="fixed bottom-5 left-5 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] px-5 py-3 rounded-full flex items-center gap-2 z-40 shadow-[0_0_20px_rgba(255,107,0,0.4)] border-2 border-primary hover:scale-105 hover:bg-primary/20 transition-all cursor-pointer animate-[fadeIn_0.5s_ease-out]"
            title="Quick pallet & carton qty calculator for loading / waybill"
          >
            <span className="text-2xl">🧮</span>
            <span className="text-primary text-sm font-bold uppercase tracking-wider">Calc</span>
          </button>

          {totalEntries > 0 && (
            <button onClick={() => setIsHistoryOpen(true)} className="fixed bottom-5 right-5 bg-[#1a1a1a] px-6 py-3 rounded-full flex items-center gap-3 z-40 shadow-[0_0_20px_rgba(0,188,212,0.4)] border-2 border-primary hover:scale-105 hover:bg-primary/20 transition-all cursor-pointer animate-[fadeIn_0.5s_ease-out]">
              <span className="text-gray-400 text-sm font-medium">📋 Transfers this shift:</span>
              <span className="text-primary text-2xl font-black">{totalEntries}</span>
              {pendingCount > 0 && (
                <span className="bg-status-warning/20 text-status-warning px-2 py-1 rounded-md text-xs uppercase tracking-wider font-bold ml-1">⏳ {pendingCount}</span>
              )}
            </button>
          )}
        </>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsHistoryOpen(false)}>
          <div className="bg-dark-card border-2 border-primary rounded-2xl w-[95%] max-w-5xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,188,212,0.3)] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#333] flex justify-between items-center bg-gradient-to-r from-[#1E1E1E] to-[#2d2d2d]">
              <h2 className="text-2xl font-black text-primary tracking-widest uppercase">📦 Pallet Transfers this Shift</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="text-gray-500 hover:text-white text-4xl leading-none transition-colors">&times;</button>
            </div>
            <div className="p-6 overflow-auto custom-scrollbar">
              {records.length === 0 ? (
                <div className="text-center text-gray-500 py-12 text-lg">No transfers recorded yet.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#333]">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-black/40">
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">⏰ Time</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">⚖️ Gram</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📐 Pallet Size</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">🏗️ Pallets</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📦 Cartons</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">👥 Team</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">👤 By</th>
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📡</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                      {records.map((r) => (
                        <tr key={r.id} className={`hover:bg-primary/5 transition-colors ${!r.synced ? 'opacity-50' : ''}`}>
                          <td className="p-4 text-gray-300 font-medium">{formatTime(r.createdAt)}</td>
                          <td className="p-4 text-white font-bold">{r.gram}g</td>
                          <td className="p-4 text-gray-300">{r.palletSize}</td>
                          <td className="p-4 text-white font-bold">{r.palletCount}</td>
                          <td className="p-4 text-primary font-bold">{r.totalCartons?.toLocaleString()}</td>
                          <td className="p-4 text-gray-300">Team {r.team}</td>
                          <td className="p-4 text-gray-400 text-sm">{r.recordedBy}</td>
                          <td className="p-4">{!r.synced ? <span title="Pending sync" className="text-status-warning">⏳</span> : <span title="Synced" className="text-status-success">✅</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <PalletCalculatorModal
        open={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        grams={grams}
        palletSizesConfig={palletSizesConfig}
      />
    </Layout>
  );
}
