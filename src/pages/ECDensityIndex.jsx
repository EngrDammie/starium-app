// src/pages/ECDensityIndex.jsx
//
// EC Density Data Index — super_admin only
//
// Shows all dates with Level 9 / BOT density data, with counts and quick links
// to jump straight to the pre-filled QC Density Report.
//
// WHY THIS EXISTS: the super_admin (you) needs a quick way to see which dates
// have data before walking into a demo. Clicking a date/mode/shift combo
// deep-links into the QC Density Report with the query pre-filled and
// auto-generated.

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function formatDateKey(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

export default function ECDensityIndex() {
  const { systemRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Guard: super_admin only
  if (systemRole !== 'super_admin') {
    return (
      <Layout title="No Access" subtitle="Super Admin Only" maxWidth="max-w-3xl">
        <div className="bg-dark-card border border-[#333] rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-white mb-2">Super Admin Only</h2>
          <p className="text-gray-400 text-sm">This index is for the system owner only.</p>
        </div>
      </Layout>
    );
  }

  useEffect(() => {
    let alive = true;
    
    async function loadStats() {
      setLoading(true);
      setError(null);
      
      try {
        const snapshot = await getDocs(collection(db, 'qc_tests'));
        
        const statsMap = {};
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const approvalDocId = data.approvalDocId || '';
          const match = approvalDocId.match(/^(level9|bot)_(DAY|NIGHT)_(\d{4}-\d{2}-\d{2})$/);
          if (!match) return;
          
          const [, mode, shift, date] = match;
          const key = `${date}|${mode}|${shift}`;
          
          if (!statsMap[key]) {
            statsMap[key] = { date, mode, shift, count: 0, teams: new Set(), qcNames: new Set() };
          }
          statsMap[key].count++;
          if (data.team) statsMap[key].teams.add(data.team);
          if (data.qcName) statsMap[key].qcNames.add(data.qcName);
        });
        
        const sorted = Object.values(statsMap)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (alive) setStats(sorted);
      } catch (err) {
        console.error('Error loading EC density index:', err);
        if (alive) setError('Failed to load data. Please try again.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    
    loadStats();
    
    return () => { alive = false; };
  }, []);

  // Handle deep-link from query params (e.g., ?date=2026-10-15&mode=level9&shift=DAY)
  const deepLinkDate = searchParams.get('date');
  const deepLinkMode = searchParams.get('mode');
  const deepLinkShift = searchParams.get('shift');
  
  const highlightKey = deepLinkDate && deepLinkMode && deepLinkShift 
    ? `${deepLinkDate}|${deepLinkMode}|${deepLinkShift}` 
    : null;

  if (loading) {
    return (
      <Layout title="Loading..." subtitle="Scanning EC Density data" maxWidth="max-w-5xl">
        <div className="text-center text-white mt-10">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Scanning EC Density data...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Error" subtitle="Failed to load" maxWidth="max-w-3xl">
        <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-white mb-2">Failed to Load</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} 
            className="bg-primary text-black font-bold px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors">
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  // Group by date for summary cards
  const byDate = {};
  stats.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = { count: 0, level9: 0, bot: 0, shifts: new Set() };
    byDate[s.date].count += s.count;
    if (s.mode === 'level9') byDate[s.date].level9 += s.count;
    else byDate[s.date].bot += s.count;
    byDate[s.date].shifts.add(s.shift);
  });

  const dateCards = Object.entries(byDate)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([date, data]) => ({
      date,
      day: getDayName(date),
      formatted: formatDateKey(date),
      total: data.count,
      level9: data.level9,
      bot: data.bot,
      shifts: [...data.shifts].join(', ')
    }));

  return (
    <Layout title="📊 EC Density Data Index" subtitle="Super Admin — All dates with Level 9 & BOT data" maxWidth="max-w-6xl">
      <div className="flex flex-col gap-6 pb-16">
        
        {/* Header with summary */}
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">EC Density Data Index</h2>
              <p className="text-gray-400 text-sm mt-1">All dates with Level 9 & BOT density test data — click any row to open the pre-filled QC Density Report</p>
            </div>
            <div className="flex gap-4">
              <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl min-w-[140px] text-center">
                <div className="text-3xl font-black text-primary">{stats.reduce((a,b) => a + b.count, 0)}</div>
                <div className="text-gray-500 text-xs uppercase tracking-wider">Total Tests</div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl min-w-[140px] text-center">
                <div className="text-3xl font-black text-cyan-400">{Object.keys(
                  stats.reduce((acc, s) => { acc.add(s.date); return acc; }, new Set())
                ).length}</div>
                <div className="text-gray-500 text-xs uppercase tracking-wider">Dates with Data</div>
              </div>
              <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl min-w-[140px] text-center">
                <div className="text-3xl font-black text-amber-400">{new Set(stats.map(s => s.mode)).size}</div>
                <div className="text-gray-500 text-xs uppercase tracking-wider">Modes Active</div>
              </div>
            </div>
          </div>

          {/* Date cards — quick overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {dateCards.map(d => (
              <Link key={d.date} to={`/qc-density-report?date=${d.date}&mode=level9&shift=DAY`} 
                className="bg-dark-card border border-[#333] p-4 rounded-xl hover:border-primary hover:shadow-[0_0_15px_rgba(0,188,212,0.2)] transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-bold text-lg group-hover:text-primary transition-colors">{d.formatted}</span>
                  <span className="text-gray-500 text-xs">{d.day}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-primary/20 text-primary rounded-full font-bold">{d.total} tests</span>
                  {d.level9 > 0 && <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-full">L9: {d.level9}</span>}
                  {d.bot > 0 && <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full">BOT: {d.bot}</span>}
                </div>
                <div className="mt-2 text-gray-500 text-xs">Shifts: {d.shifts}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Detailed table */}
        <div className="bg-dark-card border border-[#333] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#333]">
            <h3 className="text-lg font-bold text-white mb-1">All Date / Mode / Shift Combinations</h3>
            <p className="text-gray-400 text-sm">Each row links directly to the QC Density Report with the query pre-filled and auto-generated.</p>
          </div>
          
          {stats.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-5xl mb-4">📭</div>
              <p className="font-bold text-white mb-1">No EC Density data found</p>
              <p className="text-sm">Run some Level 9 or BOT tests to populate this index.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Day</th>
                    <th className="p-4">Mode</th>
                    <th className="p-4">Shift</th>
                    <th className="p-4">Tests</th>
                    <th className="p-4">Teams</th>
                    <th className="p-4">QC Staff</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                  {stats.map((s, idx) => {
                    const isHighlighted = highlightKey === `${s.date}|${s.mode}|${s.shift}`;
                    const link = `/qc-density-report?date=${s.date}&mode=${s.mode}&shift=${s.shift}`;
                    return (
                      <tr key={`${s.date}|${s.mode}|${s.shift}`} 
                          className={`${isHighlighted ? 'bg-primary/10 ring-2 ring-primary/50' : idx % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10 transition-colors`}>
                        <td className="p-4 mono text-white font-bold">{formatDateKey(s.date)}</td>
                        <td className="p-4 text-gray-400">{getDayName(s.date)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.mode === 'level9' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {s.mode.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-700 text-gray-300">{s.shift}</span>
                        </td>
                        <td className="p-4 mono text-white font-bold text-lg">{s.count}</td>
                        <td className="p-4 text-gray-400 text-sm max-w-[200px] truncate">
                          {Array.from(s.teams).join(', ') || '—'}
                        </td>
                        <td className="p-4 text-gray-400 text-sm max-w-[200px] truncate">
                          {Array.from(s.qcNames).join(', ') || '—'}
                        </td>
                        <td className="p-4">
                          <Link to={link} 
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary-dark transition-colors group"
                          >
                            <span>Open Report</span>
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </Link>
                        </td>
                      </tr>
                    )}
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}