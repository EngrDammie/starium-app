import { useState, useEffect, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { fetchLaminateRecordsByShift, getLaminateWasteSummary } from '../services/laminateOperations';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

export default function LaminateWasteReport() {
  const { config, loadingConfig } = useConfig();

  const [showFilters, setShowFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('DAY');
  const [teamFilter, setTeamFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState([]);
  const [crossShiftData, setCrossShiftData] = useState([]);

  const generateReport = useCallback(async () => {
    if (!date) return setError('Please select a date');

    setLoading(true);
    setError('');

    try {
      const allRecords = await fetchLaminateRecordsByShift(config, shift, date);
      const machineSummary = await getLaminateWasteSummary(config, shift, date);

      let filteredRecords = allRecords;
      let filteredSummary = machineSummary;

      if (teamFilter !== 'all') {
        filteredRecords = allRecords.filter(r => r.team === teamFilter);
        filteredSummary = machineSummary.map(m => {
          const teamRecords = m.checks.filter(c => c.team === teamFilter);
          const totalWasteCollected = teamRecords.reduce((s, c) => s + (c.wasteCollected || 0), 0);
          return {
            ...m,
            checks: teamRecords,
            totalWasteCollected,
            wastePercent: m.totalLaminateUsed > 0 ? Math.round((totalWasteCollected / m.totalLaminateUsed) * 10000) / 100 : 0
          };
        }).filter(m => m.checks.length > 0);
      }

      if (machineFilter !== 'all') {
        const machineId = parseInt(machineFilter);
        filteredRecords = filteredRecords.filter(r => r.machineId === machineId);
        filteredSummary = filteredSummary.filter(m => m.machineId === machineId);
      }

      setRecords(filteredRecords);
      setSummary(filteredSummary);

      const crossShifts = await buildCrossShiftData(config, shift, date, teamFilter);
      setCrossShiftData(crossShifts);
    } catch (err) {
      console.error("Error generating report:", err);
      setError('Error generating report.');
    } finally {
      setLoading(false);
    }
  }, [date, shift, teamFilter, machineFilter, config]);

  useEffect(() => {
    if (!loadingConfig) {
      generateReport();
    }
  }, [loadingConfig, generateReport]);

  const totalLaminateUsed = summary.reduce((s, m) => s + (m.totalLaminateUsed || 0), 0);
  const totalWasteCollected = records.reduce((s, r) => s + (r.wasteCollected || 0), 0);
  const wastePercent = totalLaminateUsed > 0 ? (totalWasteCollected / totalLaminateUsed) * 100 : 0;
  const machinesWithData = summary.length;

  const targetWastePercent = config?.laminateWaste?.targetWastePercent ?? 5;

  const getWasteColor = (wp) => {
    if (wp <= targetWastePercent) return { bg: 'rgba(0, 230, 118, 0.7)', border: '#00E676' };
    if (wp <= targetWastePercent * 1.5) return { bg: 'rgba(255, 152, 0, 0.7)', border: '#FF9800' };
    return { bg: 'rgba(244, 67, 54, 0.7)', border: '#F44336' };
  };

  const sortedByWaste = [...summary].sort((a, b) => b.wastePercent - a.wastePercent);
  const top5Machines = sortedByWaste.slice(0, 5);

  const machineLabel = (m) => `M${(m.machineDisplayNumber && m.machineDisplayNumber !== 'undefined' ? m.machineDisplayNumber : m.machineId)}`;
  const barChartLabels = sortedByWaste.map(m => machineLabel(m));
  const barChartData = {
    labels: barChartLabels,
    datasets: [{
      label: 'Waste %',
      data: sortedByWaste.map(m => m.wastePercent),
      backgroundColor: sortedByWaste.map(m => getWasteColor(m.wastePercent).bg),
      borderColor: sortedByWaste.map(m => getWasteColor(m.wastePercent).border),
      borderWidth: 2,
      borderRadius: 4
    }]
  };

  const barChartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: function(context) {
            const idx = context.dataIndex;
            const m = sortedByWaste[idx];
            if (!m) return '';
            return `Laminate Used: ${m.totalLaminateUsed.toFixed(2)} kg\nWaste Collected: ${m.totalWasteCollected.toFixed(3)} kg`;
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Waste %', color: '#999' },
        max: Math.max(...sortedByWaste.map(m => m.wastePercent), targetWastePercent * 2),
        grid: { color: '#333' },
        ticks: { color: '#888' }
      },
      y: {
        grid: { color: '#333' },
        ticks: { color: '#888' }
      }
    }
  };

  const trendLabels = top5Machines.length > 0
    ? top5Machines[0].checks.map(c => `R${c.roundNumber}`)
    : [];

  const trendColors = ['#00BCD4', '#F44336', '#FF9800', '#4CAF50', '#9C27B0'];

  const trendDatasets = top5Machines.map((m, i) => ({
    label: machineLabel(m),
    data: trendLabels.map((_, ri) => {
      const check = m.checks[ri];
      return check ? check.wastePercent : null;
    }),
    borderColor: trendColors[i % trendColors.length],
    backgroundColor: trendColors[i % trendColors.length] + '33',
    fill: false,
    tension: 0.3,
    pointRadius: 4,
    spanGaps: true
  }));

  const trendChartData = {
    labels: trendLabels,
    datasets: trendDatasets
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#ccc' } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { grid: { color: '#333' }, ticks: { color: '#888' } },
      y: {
        title: { display: true, text: 'Waste %', color: '#999' },
        grid: { color: '#333' },
        ticks: { color: '#888' }
      }
    }
  };

  const crossShiftLabels = crossShiftData.map(d => `${d.shift} ${d.shortDate}`);
  const crossShiftWastePcts = crossShiftData.map(d => d.wastePercent);

  const crossShiftChartData = {
    labels: crossShiftLabels,
    datasets: [{
      label: 'Waste %',
      data: crossShiftWastePcts,
      backgroundColor: crossShiftData.map((d, i) => {
        if (d.isCurrent) return 'rgba(255, 215, 0, 0.7)';
        const color = getWasteColor(d.wastePercent);
        return color.bg;
      }),
      borderColor: crossShiftData.map((d, i) => {
        if (d.isCurrent) return '#FFD700';
        return getWasteColor(d.wastePercent).border;
      }),
      borderWidth: crossShiftData.map(d => d.isCurrent ? 3 : 1),
      borderRadius: 4
    }]
  };

  const crossShiftChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { grid: { color: '#333' }, ticks: { color: '#888', maxRotation: 45 } },
      y: {
        title: { display: true, text: 'Waste %', color: '#999' },
        grid: { color: '#333' },
        ticks: { color: '#888' }
      }
    }
  };

  const trendArrow = calculateTrend(crossShiftData.map(d => d.wastePercent));

  const exportToCSV = () => {
    if (records.length === 0) return;

    const headers = ['Date', 'Shift', 'Team', 'Machine', 'Line', 'Round', 'Sac Type', 'Sac Wt (kg)', 'Gross Wt (kg)', 'Waste Collected (kg)', 'Laminate Used (kg)', 'Waste %', 'CheckedBy', 'CheckedAt'];
    const rows = records.map(r => {
      const checkedAt = r.checkedAt?.toDate ? r.checkedAt.toDate().toLocaleString() : (r.localCreatedAt || '');
      return [
        r.date, r.shift, r.team,
        machineLabel(r),
        r.line || '', r.roundNumber,
        r.sacType === 'small' ? 'Small' : 'Large',
        r.sacWeight?.toFixed(3),
        r.grossWeight?.toFixed(3),
        r.wasteCollected?.toFixed(3),
        r.totalLaminateUsed?.toFixed(2),
        r.wastePercent?.toFixed(2),
        r.checkedBy || '',
        checkedAt
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laminate_waste_${shift}_${date}.csv`;
    link.click();
  };

  if (loadingConfig) {
    return <Layout title="Laminate Waste Report" subtitle="Loading..."><div className="text-center text-white mt-10 animate-pulse">Loading...</div></Layout>;
  }

  return (
    <Layout title="Laminate Waste Report" subtitle="Analyze laminate waste across shifts" maxWidth="max-w-7xl">
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          html, body, #root { background-color: white !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          .bg-dark-card, .bg-\\[\\#1a1a1a\\], .bg-\\[\\#121212\\], .bg-gradient-to-br {
            background-color: white !important;
            border-color: #ccc !important;
          }
          .text-white, .text-gray-300, .text-gray-400, .text-gray-500, .text-gray-600 {
            color: black !important;
          }
          .text-primary {
            color: #00838f !important;
          }
          .text-status-danger {
            color: #d32f2f !important;
          }
          .text-status-success {
            color: #2e7d32 !important;
          }
          .text-status-warning {
            color: #f57c00 !important;
          }
          .border-\\[\\#333\\], .border-gray-600, .border-gray-700 {
            border-color: #ccc !important;
          }
          .divide-\\[\\#333\\] > * {
            border-color: #ddd !important;
          }
          .border-b-\\[\\#333\\] {
            border-bottom-color: #ddd !important;
          }
          .bg-primary\\/10 {
            background-color: #e3f2fd !important;
          }
          canvas {
            background: white !important;
          }
        }
      `}</style>

      <div className="print:hidden">
        {!showFilters && (
          <button
            onClick={() => setShowFilters(true)}
            className="w-full bg-gradient-to-br from-dark-card to-[#252525] border-2 border-primary rounded-xl p-6 text-left hover:scale-[1.01] hover:shadow-[0_5px_20px_rgba(0,188,212,0.4)] transition-all mb-6 group"
          >
            <div className="text-xl font-bold text-primary mb-2 group-hover:text-white transition-colors">🗑️ Laminate Waste Report</div>
            <div className="text-gray-400 text-sm">View laminate waste analysis for any shift. Filter by team, machine, and compare across shifts.</div>
          </button>
        )}

        {showFilters && (
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-6 animate-[fadeIn_0.3s]">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">Shift</label>
                <select value={shift} onChange={e => setShift(e.target.value)}
                  className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
                  <option value="DAY">DAY</option>
                  <option value="NIGHT">NIGHT</option>
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">Team</label>
                <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
                  className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
                  <option value="all">All Teams</option>
                  {(config?.laminateWaste?.teams || ['A', 'B', 'C']).map(t => (
                    <option key={t} value={t}>Team {t}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">Machine</label>
                <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)}
                  className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
                  <option value="all">All Machines</option>
                  {(config.machines || []).map(m => (
                    <option key={m.id} value={m.id}>M{m.displayNumber || m.id}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-auto">
                <button onClick={generateReport} disabled={loading}
                  className="w-full bg-primary text-black font-bold py-3 px-8 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>
            {error && <div className="mt-4 text-status-danger text-sm font-bold text-center">{error}</div>}
          </div>
        )}
      </div>

      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-black uppercase tracking-wider text-black">Laminate Waste Report</h1>
        <p className="text-sm text-gray-700 mt-1">{shift} · {date} · {teamFilter === 'all' ? 'All Teams' : `Team ${teamFilter}`} · {machineFilter === 'all' ? 'All Machines' : `M${machineFilter}`}</p>
      </div>

      {loading ? (
        <div className="text-center text-primary mt-10 animate-pulse font-bold text-xl">Loading report data...</div>
      ) : records.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <div className="text-5xl mb-4">🗑️</div>
          <p className="text-lg font-bold">No records found</p>
          <p className="text-sm text-gray-600">No laminate waste records for {shift} {date}.</p>
        </div>
      ) : (
        <div className="animate-[fadeIn_0.5s_ease-out]">
          <div className="flex justify-end gap-3 mb-4 print:hidden">
            <button onClick={() => window.print()} className="bg-[#333] text-white px-4 py-2 rounded font-bold hover:bg-[#444]">Print</button>
            <button onClick={exportToCSV} className="bg-[#2196F3] text-white px-4 py-2 rounded font-bold hover:bg-blue-600">Export CSV</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-3">
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Laminate Used</div>
              <div className="text-3xl font-bold text-primary">{totalLaminateUsed.toFixed(2)} kg</div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Waste Collected</div>
              <div className="text-3xl font-bold text-status-warning">{totalWasteCollected.toFixed(3)} kg</div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Waste %</div>
              <div className={`text-3xl font-bold ${wastePercent <= targetWastePercent ? 'text-status-success' : wastePercent <= targetWastePercent * 1.5 ? 'text-status-warning' : 'text-status-danger'}`}>
                {wastePercent.toFixed(2)}%
              </div>
            </div>
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] text-center">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Machines with Data</div>
              <div className="text-3xl font-bold text-white">{machinesWithData}</div>
            </div>
          </div>

          {summary.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 print:flex print:flex-row print:gap-4 print:break-inside-avoid">
              <div className="bg-dark-card p-5 rounded-xl border border-[#333]">
                <h3 className="text-center font-bold text-primary mb-4 uppercase text-sm tracking-wider">Waste % by Machine</h3>
                <div className="h-[300px]"><Bar data={barChartData} options={barChartOptions} /></div>
              </div>

              {top5Machines.length > 0 && (
                <div className="bg-dark-card p-5 rounded-xl border border-[#333]">
                  <h3 className="text-center font-bold text-primary mb-4 uppercase text-sm tracking-wider">Waste Trend Over Rounds (Top 5)</h3>
                  <div className="h-[300px]"><Line data={trendChartData} options={trendChartOptions} /></div>
                </div>
              )}
            </div>
          )}

          {crossShiftData.length > 0 && (
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] mb-6 print:break-inside-avoid">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-primary uppercase text-sm tracking-wider">Cross-Shift Comparison</h3>
                <span className={`text-sm font-bold ${trendArrow === 'improving' ? 'text-status-success' : trendArrow === 'worsening' ? 'text-status-danger' : 'text-gray-400'}`}>
                  {trendArrow === 'improving' ? '↓ Improving' : trendArrow === 'worsening' ? '↑ Worsening' : '→ Stable'}
                </span>
              </div>
              <div className="h-[250px]"><Bar data={crossShiftChartData} options={crossShiftChartOptions} /></div>
            </div>
          )}

          {crossShiftData.length > 0 && (
            <div className="bg-dark-card p-5 rounded-xl border border-[#333] mb-6 overflow-x-auto print:break-inside-avoid">
              <h3 className="font-bold text-primary uppercase text-sm tracking-wider mb-4">Shift Comparison</h3>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                    <th className="p-3">Shift</th>
                    <th className="p-3">Laminate Used</th>
                    <th className="p-3">Waste Collected</th>
                    <th className="p-3">Waste %</th>
                    <th className="p-3">vs Prev</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                  {crossShiftData.map((d, i) => (
                    <tr key={i} className={`hover:bg-white/5 ${d.isCurrent ? 'bg-primary/10' : ''}`}>
                      <td className={`p-3 font-bold ${d.isCurrent ? 'text-primary' : 'text-white'}`}>
                        {d.shift} {d.shortDate} {d.isCurrent && '<'}
                      </td>
                      <td className="p-3 text-gray-300">{d.totalLaminateUsed?.toFixed(2) || '-'} kg</td>
                      <td className="p-3 text-gray-300">{d.totalWasteCollected?.toFixed(3) || '-'} kg</td>
                      <td className={`p-3 font-bold ${d.wastePercent <= targetWastePercent ? 'text-status-success' : 'text-status-danger'}`}>
                        {d.wastePercent.toFixed(2)}%
                      </td>
                      <td className="p-3">
                        {i < crossShiftData.length - 1 ? (
                          (() => {
                            const diff = d.wastePercent - crossShiftData[i + 1].wastePercent;
                            const isImprovement = diff < 0;
                            return (
                              <span className={isImprovement ? 'text-status-success' : 'text-status-danger'}>
                                {diff >= 0 ? '+' : ''}{diff.toFixed(2)}% {isImprovement ? '↓' : '↑'}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-dark-card p-5 rounded-xl border border-[#333] mb-6 overflow-x-auto print:break-inside-avoid">
            <h3 className="font-bold text-primary uppercase text-sm tracking-wider mb-4">Per-Machine Breakdown</h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                  <th className="p-3">Machine</th>
                  <th className="p-3">Line</th>
                  <th className="p-3">Checks</th>
                  <th className="p-3">Laminate Used (kg)</th>
                  <th className="p-3">Waste Collected (kg)</th>
                  <th className="p-3">Waste %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {summary.map(m => (
                  <tr key={m.machineId} className="hover:bg-white/5">
                    <td className="p-3 text-primary font-bold">{machineLabel(m)}</td>
                    <td className="p-3 text-gray-300">{m.line}</td>
                    <td className="p-3 text-white">{m.checks.length}</td>
                    <td className="p-3 text-gray-300">{m.totalLaminateUsed.toFixed(2)}</td>
                    <td className="p-3 text-gray-300">{m.totalWasteCollected.toFixed(3)}</td>
                    <td className={`p-3 font-bold ${m.wastePercent <= targetWastePercent ? 'text-status-success' : m.wastePercent <= targetWastePercent * 1.5 ? 'text-status-warning' : 'text-status-danger'}`}>
                      {m.wastePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary font-bold">
                  <td className="p-3 text-primary">Total</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-white">{records.length}</td>
                  <td className="p-3 text-white">{totalLaminateUsed.toFixed(2)}</td>
                  <td className="p-3 text-white">{totalWasteCollected.toFixed(3)}</td>
                  <td className={`p-3 ${wastePercent <= targetWastePercent ? 'text-status-success' : wastePercent <= targetWastePercent * 1.5 ? 'text-status-warning' : 'text-status-danger'}`}>
                    {wastePercent.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-dark-card p-5 rounded-xl border border-[#333] mb-6 overflow-x-auto print:break-inside-avoid">
            <h3 className="font-bold text-primary uppercase text-sm tracking-wider mb-4">Round-by-Round Details</h3>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                  <th className="p-3">Date/Shift</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Machine</th>
                  <th className="p-3">Round</th>
                  <th className="p-3">Sac Type</th>
                  <th className="p-3">Sac Wt (kg)</th>
                  <th className="p-3">Gross Wt (kg)</th>
                  <th className="p-3">Waste (kg)</th>
                  <th className="p-3">Laminate Used (kg)</th>
                  <th className="p-3">Waste %</th>
                  <th className="p-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {records.sort((a, b) => {
                  const mIdA = a.machineId || 0;
                  const mIdB = b.machineId || 0;
                  if (mIdA !== mIdB) return mIdA - mIdB;
                  return (a.roundNumber || 0) - (b.roundNumber || 0);
                }).map(r => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="p-3 text-gray-300">{r.date} {r.shift}</td>
                    <td className="p-3 text-gray-300">{r.team}</td>
                    <td className="p-3 text-primary font-bold">{machineLabel(r)}</td>
                    <td className="p-3 text-white">{r.roundNumber}</td>
                    <td className="p-3 text-gray-300">{r.sacType === 'small' ? 'Small' : 'Large'}</td>
                    <td className="p-3 text-gray-300">{r.sacWeight?.toFixed(3)}</td>
                    <td className="p-3 text-gray-300">{r.grossWeight?.toFixed(3)}</td>
                    <td className="p-3 text-gray-300">{r.wasteCollected?.toFixed(3)}</td>
                    <td className="p-3 text-gray-300">{r.totalLaminateUsed?.toFixed(2)}</td>
                    <td className={`p-3 font-bold ${r.wastePercent <= targetWastePercent ? 'text-status-success' : 'text-status-danger'}`}>
                      {r.wastePercent?.toFixed(2)}%
                    </td>
                    <td className="p-3 text-gray-400">{r.checkedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}

function buildShiftIdentifiers(targetShift, targetDateStr, count) {
  const targetDate = new Date(targetDateStr);
  const results = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const shortDate = `${month}/${day}`;

    results.push({
      shift: targetShift,
      date: dateStr,
      shortDate,
      isCurrent: i === 0
    });
  }

  return results;
}

async function buildCrossShiftData(config, targetShift, targetDateStr, teamFilter) {
  const shifts = buildShiftIdentifiers(targetShift, targetDateStr, 14);
  const data = [];

  for (const s of shifts) {
    try {
      const records = await fetchLaminateRecordsByShift(config, s.shift, s.date);

      let filtered = records;
      if (teamFilter !== 'all') {
        filtered = records.filter(r => r.team === teamFilter);
      }

      if (filtered.length === 0) {
        data.push({ ...s, totalLaminateUsed: 0, totalWasteCollected: 0, wastePercent: 0, hasData: false });
        continue;
      }

      const machinesMap = {};
      for (const r of filtered) {
        if (!machinesMap[r.machineId]) {
          machinesMap[r.machineId] = { totalLaminateUsed: 0, totalWasteCollected: 0 };
        }
        machinesMap[r.machineId].totalLaminateUsed = r.totalLaminateUsed || 0;
        machinesMap[r.machineId].totalWasteCollected += (r.wasteCollected || 0);
      }

      const machineTotals = Object.values(machinesMap);
      const ta = machineTotals.reduce((sum, m) => sum + m.totalLaminateUsed, 0);
      const tw = machineTotals.reduce((sum, m) => sum + m.totalWasteCollected, 0);
      const wp = ta > 0 ? (tw / ta) * 100 : 0;

      data.push({ ...s, totalLaminateUsed: Math.round(ta * 100) / 100, totalWasteCollected: Math.round(tw * 1000) / 1000, wastePercent: Math.round(wp * 100) / 100, hasData: true });
    } catch (e) {
      console.error(`Error fetching shift ${s.shift} ${s.date}:`, e);
      data.push({ ...s, totalLaminateUsed: 0, totalWasteCollected: 0, wastePercent: 0, hasData: false });
    }
  }

  return data;
}

function calculateTrend(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length < 2) return 'stable';

  const n = validValues.length;
  const indices = validValues.map((_, i) => i);
  const sumX = indices.reduce((s, x) => s + x, 0);
  const sumY = validValues.reduce((s, y) => s + y, 0);
  const sumXY = indices.reduce((s, x, i) => s + x * validValues[i], 0);
  const sumXX = indices.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  if (Math.abs(slope) < 0.05) return 'stable';
  return slope < 0 ? 'improving' : 'worsening';
}
