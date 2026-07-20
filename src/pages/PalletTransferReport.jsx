import { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { subscribeToPalletTransfersByDateRange } from '../services/palletTransferOperations';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

function toDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function PalletTransferReport() {
  const { config, loadingConfig } = useConfig();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => toDateStr(new Date()), []);
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateStr(d);
  }, []);

  const fromDateDefault = sevenDaysAgo;
  const toDateDefault = today;

  const [filterFromDate, setFilterFromDate] = useState(fromDateDefault);
  const [filterToDate, setFilterToDate] = useState(toDateDefault);
  const [filterShift, setFilterShift] = useState('all');
  const [filterGram, setFilterGram] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');

  const grams = Object.keys(config?.gramSpecs || {});
  const teamsConfig = config?.packagingTeams?.labels || [];

  useEffect(() => {
    if (loadingConfig) return;
    const unsub = subscribeToPalletTransfersByDateRange(sevenDaysAgo, today, (data) => {
      setRecords(data);
      setLoading(false);
    });
    return () => unsub();
  }, [loadingConfig, sevenDaysAgo, today]);

  const filtered = records.filter(r => {
    if (filterFromDate && r.date < filterFromDate) return false;
    if (filterToDate && r.date > filterToDate) return false;
    if (filterShift !== 'all' && r.shift !== filterShift) return false;
    if (filterGram !== 'all' && r.gram !== filterGram) return false;
    if (filterTeam !== 'all' && r.team !== filterTeam) return false;
    return true;
  });

  const totalPallets = filtered.reduce((s, r) => s + (r.palletCount || 0), 0);
  const totalCartons = filtered.reduce((s, r) => s + (r.totalCartons || 0), 0);
  const totalEntries = filtered.length;
  const uniqueGrams = new Set(filtered.map(r => r.gram)).size;

  const perGram = {};
  for (const r of filtered) {
    if (!perGram[r.gram]) perGram[r.gram] = { pallets: 0, cartons: 0 };
    perGram[r.gram].pallets += r.palletCount || 0;
    perGram[r.gram].cartons += r.totalCartons || 0;
  }

  const sortedGrams = Object.entries(perGram).sort(([a], [b]) => Number(a) - Number(b));

  const barData = {
    labels: sortedGrams.map(([g]) => `${g}g`),
    datasets: [{
      label: 'Cartons',
      data: sortedGrams.map(([, t]) => t.cartons),
      backgroundColor: ['#00BCD4', '#00E676', '#7C4DFF', '#FF9800', '#E91E63', '#FFEB3B'],
      borderColor: ['#0097A7', '#00C853', '#651FFF', '#F57C00', '#C2185B', '#FBC02D'],
      borderWidth: 2,
      borderRadius: 4
    }]
  };

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const g = sortedGrams[context.dataIndex];
            if (!g) return '';
            return `Pallets: ${g[1].pallets}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Total Cartons', color: '#999' },
        grid: { color: '#333' },
        ticks: { color: '#888' }
      },
      y: {
        grid: { color: '#333' },
        ticks: { color: '#888' }
      }
    }
  };

  const doughnutData = {
    labels: sortedGrams.map(([g]) => `${g}g`),
    datasets: [{
      data: sortedGrams.map(([, t]) => t.cartons),
      backgroundColor: ['#00BCD4', '#00E676', '#7C4DFF', '#FF9800', '#E91E63', '#FFEB3B'],
      borderWidth: 2,
      borderColor: '#1a1a1a'
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#ccc', padding: 12 } }
    }
  };

  const weekLabels = [];
  const dayData = [];
  const nightData = [];
  const dayCartonTotals = {};
  const nightCartonTotals = {};

  for (const r of records) {
    const d = r.date;
    if (r.shift === 'DAY') {
      dayCartonTotals[d] = (dayCartonTotals[d] || 0) + (r.totalCartons || 0);
    } else {
      nightCartonTotals[d] = (nightCartonTotals[d] || 0) + (r.totalCartons || 0);
    }
  }

  const allDates = [...new Set([...Object.keys(dayCartonTotals), ...Object.keys(nightCartonTotals)])].sort();
  for (const d of allDates) {
    const dateObj = new Date(d + 'T12:00:00');
    const label = dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    weekLabels.push(label);
    dayData.push(dayCartonTotals[d] || 0);
    nightData.push(nightCartonTotals[d] || 0);
  }

  const weekChartData = {
    labels: weekLabels,
    datasets: [
      {
        label: 'Day Shift',
        data: dayData,
        backgroundColor: 'rgba(255, 193, 7, 0.7)',
        borderColor: '#FFC107',
        borderWidth: 2,
        borderRadius: 3,
        barPercentage: 0.4
      },
      {
        label: 'Night Shift',
        data: nightData,
        backgroundColor: 'rgba(33, 150, 243, 0.7)',
        borderColor: '#2196F3',
        borderWidth: 2,
        borderRadius: 3,
        barPercentage: 0.4
      }
    ]
  };

  const weekChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#ccc' } },
      tooltip: {
        callbacks: {
          afterBody: function(context) {
            const idx = context[0].dataIndex;
            const dayTot = dayData[idx] || 0;
            const nightTot = nightData[idx] || 0;
            const total = dayTot + nightTot;
            const raw = context[0].raw;
            const pct = total > 0 ? ((raw / total) * 100).toFixed(1) : '0.0';
            return `${pct}% of daily total`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: '#333' },
        ticks: { color: '#888' }
      },
      y: {
        title: { display: true, text: 'Cartons Transferred', color: '#999' },
        grid: { color: '#333' },
        ticks: { color: '#888' },
        beginAtZero: true
      }
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Layout title="📦 Pallet Transfer Report" subtitle="Carton transfer analysis from production to warehouse" maxWidth="max-w-7xl">
      {loading ? (
        <div className="text-center text-gray-400 mt-20 animate-pulse text-lg">Loading 7-day data...</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-6 items-end">
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">📅 From</label>
              <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)}
                className="bg-[#1a1a1a] text-white border border-[#444] p-2.5 rounded-lg outline-none focus:border-primary text-sm" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">📅 To</label>
              <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)}
                className="bg-[#1a1a1a] text-white border border-[#444] p-2.5 rounded-lg outline-none focus:border-primary text-sm" />
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">🌗 Shift</label>
              <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-2.5 rounded-lg outline-none focus:border-primary text-sm">
                <option value="all">All Shifts</option>
                <option value="DAY">☀️ Day</option>
                <option value="NIGHT">🌙 Night</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">⚖️ Gram</label>
              <select value={filterGram} onChange={e => setFilterGram(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-2.5 rounded-lg outline-none focus:border-primary text-sm">
                <option value="all">All Grams</option>
                {grams.map(g => <option key={g} value={g}>{g}g</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">👥 Team</label>
              <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-2.5 rounded-lg outline-none focus:border-primary text-sm">
                <option value="all">All Teams</option>
                {teamsConfig.map(t => <option key={t} value={t}>Team {t}</option>)}
              </select>
            </div>
            <div>
              <button onClick={() => { setFilterFromDate(sevenDaysAgo); setFilterToDate(today); setFilterShift('all'); setFilterGram('all'); setFilterTeam('all'); }}
                className="bg-[#333] text-gray-300 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#444] transition-colors border border-[#555]">
                🔄 Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-3">
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">🏗️ Total Pallets</div>
              <div className="text-3xl font-bold text-primary">{totalPallets.toLocaleString()}</div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">📦 Total Cartons</div>
              <div className="text-3xl font-bold text-white">{totalCartons.toLocaleString()}</div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">📋 Total Transfers</div>
              <div className="text-3xl font-bold text-status-success">{totalEntries.toLocaleString()}</div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">🎯 Unique Grams</div>
              <div className="text-3xl font-bold text-status-warning">{uniqueGrams}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-dark-card p-6 rounded-xl border border-[#333]">
              <h3 className="text-primary font-bold mb-4 uppercase tracking-wider text-sm">📊 Cartons per Gram</h3>
              <div className="h-[300px]"><Bar data={barData} options={barOptions} /></div>
            </div>
            <div className="bg-dark-card p-6 rounded-xl border border-[#333]">
              <h3 className="text-primary font-bold mb-4 uppercase tracking-wider text-sm">🥧 Distribution by Gram</h3>
              <div className="h-[300px]"><Doughnut data={doughnutData} options={doughnutOptions} /></div>
            </div>
          </div>

          {sortedGrams.length > 0 && (
            <div className="bg-dark-card p-6 rounded-xl border border-[#333] mb-6">
              <h3 className="text-primary font-bold mb-4 uppercase tracking-wider text-sm">📋 Per-Gram Summary</h3>
              <div className="overflow-x-auto rounded-lg border border-[#333]">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-black/40">
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">⚖️ Gram</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">🏗️ Pallets</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📦 Cartons</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333]">
                    {sortedGrams.map(([g, t]) => (
                      <tr key={g} className="hover:bg-primary/5 transition-colors">
                        <td className="p-4 text-white font-bold">{g}g</td>
                        <td className="p-4 text-gray-300">{t.pallets}</td>
                        <td className="p-4 text-primary font-bold">{t.cartons.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="bg-dark-card p-6 rounded-xl border border-[#333] mb-6 print:break-before-page">
              <h3 className="text-primary font-bold mb-4 uppercase tracking-wider text-sm">📋 Detailed Transfer Log</h3>
              <div className="overflow-x-auto rounded-lg border border-[#333]">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-black/40">
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">⏰ Time</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">🌗 Shift</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📅 Date</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">⚖️ Gram</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📐 Pallet Size</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">🏗️ Pallets</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">📦 Cartons</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">👥 Team</th>
                      <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">👤 Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333]">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                        <td className="p-4 text-gray-300 text-sm">{formatTime(r.createdAt)}</td>
                        <td className="p-4"><span className={`text-xs font-bold px-2 py-0.5 rounded ${r.shift === 'DAY' ? 'bg-[#FFC107]/20 text-[#FFC107]' : 'bg-[#2196F3]/20 text-[#2196F3]'}`}>{r.shift === 'DAY' ? '☀️' : '🌙'} {r.shift}</span></td>
                        <td className="p-4 text-gray-300">{r.date}</td>
                        <td className="p-4 text-white font-bold">{r.gram}g</td>
                        <td className="p-4 text-gray-300">{r.palletSize}</td>
                        <td className="p-4 text-white font-bold">{r.palletCount}</td>
                        <td className="p-4 text-primary font-bold">{r.totalCartons?.toLocaleString()}</td>
                        <td className="p-4 text-gray-300">Team {r.team}</td>
                        <td className="p-4 text-gray-400 text-sm">{r.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {weekLabels.length > 0 && (
            <div className="bg-dark-card p-6 rounded-xl border border-[#333] mb-6">
              <h3 className="text-primary font-bold mb-4 uppercase tracking-wider text-sm">📈 Day vs Night — Cartons Transferred Over Time (7-Day)</h3>
              <div className="h-[300px]"><Bar data={weekChartData} options={weekChartOptions} /></div>
            </div>
          )}

          {filtered.length === 0 && weekLabels.length === 0 && (
            <div className="text-center text-gray-500 py-20 text-lg">No transfers found in this period.</div>
          )}
        </>
      )}
    </Layout>
  );
}
