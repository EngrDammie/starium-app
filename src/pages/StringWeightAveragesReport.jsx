// src/pages/StringWeightAveragesReport.jsx
//
// String Weight Averages Report — per gram/SKU running averages by shift.
// Accessible to QC Managers and Super Admins only.
// Shows per-gram averages, min/max, target range, variance, and status.

import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToAllStringWeights, getShiftDateInfo } from '../services/qcStringWeightOperations';
import { calculateStringWeightAverages } from '../services/stringWeightAverages';
import { pluralize } from '../services/formatUtils';

export default function StringWeightAveragesReport() {
  const { config, loadingConfig } = useConfig();
  const { systemRole, departmentRoles } = useAuth();
  
  const [shift, setShift] = useState('DAY');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [teamFilter, setTeamFilter] = useState('all');
  const [gramFilter, setGramFilter] = useState('all');
  const [records, setRecords] = useState([]);
  const [averages, setAverages] = useState({ perGram: {}, gramOrder: [] });
  const [loading, setLoading] = useState(true);

  const isAdminOrQcManager = systemRole === 'super_admin' || (departmentRoles || []).includes('qc_manager');

  // Access control
  if (!isAdminOrQcManager) {
    return (
      <Layout title="String Weight Averages Report">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
          <p className="text-sm">This report is available to QC Managers and Super Admins only.</p>
        </div>
      </Layout>
    );
  }

  // Build docId from filters
  const docId = `qc_string_weight_${shift}_${date}`;

  // Subscribe to records
  useEffect(() => {
    if (loadingConfig) return;
    setLoading(true);
    
    const unsub = subscribeToAllStringWeights(docId, (recs) => {
      setRecords(recs);
      const avgs = calculateStringWeightAverages(recs, config);
      setAverages(avgs);
      setLoading(false);
    });
    return unsub;
  }, [docId, config, loadingConfig]);

  // Include queued records for real-time feel
  useEffect(() => {
    const updateFromQueue = () => {
      const queue = JSON.parse(localStorage.getItem('starium_qc_string_weight_queue') || '[]')
        .filter(q => q.approvalDocId === docId);
      if (queue.length) {
        const allRecs = [...records, ...queue];
        const avgs = calculateStringWeightAverages(allRecs, config);
        setAverages(avgs);
      }
    };
    const interval = setInterval(updateFromQueue, 3000);
    return () => clearInterval(interval);
  }, [docId, records, config]);

  // Derived filter options
  const teams = useMemo(() => [...new Set(records.map(r => r.team).filter(Boolean))].sort(), [records]);
  const grams = useMemo(() => [...new Set(records.map(r => r.gram).filter(Boolean))].sort((a,b) => Number(a)-Number(b)), [records]);

  // Filtered averages
  const filteredAverages = useMemo(() => {
    const filtered = { ...averages.perGram };
    if (gramFilter !== 'all') {
      Object.keys(filtered).forEach(g => { if (g !== gramFilter) delete filtered[g]; });
    }
    return filtered;
  }, [averages.perGram, gramFilter]);

  if (loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading…</div></Layout>;

  return (
    <Layout title="⚖️ String Weight Averages Report" subtitle={`${shift} Shift • ${date}`} maxWidth="max-w-7xl">
      
      {/* Filters */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Shift</label>
            <select value={shift} onChange={e => setShift(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
              <option value="DAY">Day Shift</option>
              <option value="NIGHT">Night Shift</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Team</label>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t} value={t}>Team {t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Gram/SKU</label>
            <select value={gramFilter} onChange={e => setGramFilter(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
              <option value="all">All Grams</option>
              {grams.map(g => <option key={g} value={g}>{g}g</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Total Checks</h3>
          <div className="text-4xl font-black text-white">{averages.totalChecks}</div>
        </div>
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Overall Avg Weight</h3>
          <div className="text-4xl font-black text-white">{averages.overallAvg ?? '--'}g</div>
        </div>
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Grams Checked</h3>
          <div className="text-4xl font-black text-white">{averages.gramOrder.length}</div>
        </div>
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Weight Readings</h3>
          <div className="text-4xl font-black text-white">{averages.totalWeightReadings ?? 0}</div>
        </div>
      </div>

      {/* Per-Gram Table */}
      <div className="bg-dark-card border border-[#333] rounded-xl overflow-x-auto">
        {Object.keys(filteredAverages).length === 0 ? (
          <div className="p-12 text-center text-gray-500">No string weight checks for the selected filters.</div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#333]">
                <th className="p-3">Gram/SKU</th>
                <th className="p-3">Checks</th>
                <th className="p-3 text-right">Avg Weight (g)</th>
                <th className="p-3 text-right">Min</th>
                <th className="p-3 text-right">Max</th>
                <th className="p-3 text-right">Target Range</th>
                <th className="p-3 text-right">Variance</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {averages.gramOrder
                .filter(g => gramFilter === 'all' || g === gramFilter)
                .map(g => {
                  const data = filteredAverages[g];
                  if (!data) return null;
                  const variance = data.target !== null ? Math.abs(data.avg - data.target) : 0;
                  const isOnTarget = data.target !== null && variance <= 0.02;
                  const variancePct = data.target !== null ? ((data.avg - data.target) / data.target * 100).toFixed(1) : 'N/A';
                  
                  return (
                    <tr key={g} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 text-white font-bold">{g}g</td>
                      <td className="p-3 text-gray-300">{data.count}</td>
                      <td className="p-3 text-right text-white font-mono">{data.avg.toFixed(3)}</td>
                      <td className="p-3 text-right text-gray-400">{data.min.toFixed(3)}</td>
                      <td className="p-3 text-right text-gray-400">{data.max.toFixed(3)}</td>
                      <td className="p-3 text-right text-gray-300">{data.targetRange}</td>
                      <td className="p-3 text-right">
                        <span className={variance <= 0.02 ? 'text-green-400' : 'text-amber-400'} font-mono>
                          {variancePct !== 'N/A' ? (variancePct > 0 ? '+' : '') + variancePct + '%' : 'N/A'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isOnTarget ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/40">✓ On Target</span>
                        ) : data.target !== null ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">⚠ Off Target</span>
                        ) : (
                          <span className="text-gray-500 text-xs">No Target</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3 mt-6">
        <button className="bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition-colors">
          📄 Export PDF
        </button>
        <button className="bg-[#333] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#444] transition-colors">
          📊 Export Excel
        </button>
      </div>

    </Layout>
  );
}