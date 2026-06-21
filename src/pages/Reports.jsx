// src/pages/Reports.jsx
import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function Reports() {
  const { config, loadingConfig } = useConfig();
  
  // 🎯 FIX: Old manual security checks completely stripped out!
  // ProtectedRoute handles all security before this page even loads.

  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('level9');
  const [shift, setShift] = useState('DAY');

  const [reportData, setReportData] = useState(null);

  const generateReport = async () => {
    if (!date) return setError('Please select a date');
    
    setLoading(true);
    setError('');
    setShowFilters(true); 

    try {
      const docId = `${mode}_${shift}_${date}`;
      const approvalSnap = await getDoc(doc(db, 'shift_approvals', docId));
      const approvalData = approvalSnap.exists() ? approvalSnap.data() : null;

      const q = query(collection(db, 'qc_tests'), where('approvalDocId', '==', docId));
      const testSnap = await getDocs(q);
      
      const tests = testSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      tests.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.localCreatedAt ? new Date(a.localCreatedAt) : new Date(0));
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.localCreatedAt ? new Date(b.localCreatedAt) : new Date(0));
        return dateA - dateB; 
      });

      setReportData({ tests, approval: approvalData });

    } catch (err) {
      console.error("Error generating report:", err);
      setError('Error generating report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData?.tests || reportData.tests.length === 0) return;
    
    const headers = mode === 'level9' 
      ? ['Time', 'Weight', 'Density', 'Buggy', 'Machines', 'Appearance', 'Fragrance', 'Remarks', 'QC Name', 'Team']
      : ['Time', 'Weight', 'Density', 'Appearance', 'Flow Property', 'Remarks', 'QC Name', 'Team'];

    const rows = reportData.tests.map(t => {
      const time = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : t.localCreatedAt;
      
      if (mode === 'level9') {
        return [
          time, t.weight, t.density, t.buggyNumber || '', `"${(t.machines || []).join(', ')}"`, 
          t.appearance, t.fragrance, `"${(t.remarks || '').replace(/"/g, '""')}"`, t.qcName, t.team
        ];
      } else {
        return [
          time, t.weight, t.density, t.appearance, t.flowProperty, 
          `"${(t.remarks || '').replace(/"/g, '""')}"`, t.qcName, t.team
        ];
      }
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `starium_report_${mode}_${shift}_${date}.csv`;
    link.click();
  };

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDensityStatus = (densityNum) => {
    const min = mode === 'bot' ? config.botMinDensity : config.level9MinDensity;
    const max = mode === 'bot' ? config.botMaxDensity : config.level9MaxDensity;
    if (densityNum < min) return 'LOW';
    if (densityNum > max) return 'HIGH';
    return 'NORMAL';
  };

  const getStatusBadge = (status) => {
    if (status === 'LOW') return <span className="bg-status-warning/20 text-status-warning px-2 py-1 rounded-full text-xs font-bold print:!bg-transparent print:!text-black">LOW</span>;
    if (status === 'HIGH') return <span className="bg-status-danger/20 text-status-danger px-2 py-1 rounded-full text-xs font-bold print:!bg-transparent print:!text-black">HIGH</span>;
    return <span className="bg-status-success/20 text-status-success px-2 py-1 rounded-full text-xs font-bold print:!bg-transparent print:!text-black">NORMAL</span>;
  };

  let lineChartData = null;
  let lineChartOptions = null;
  let doughnutChartData = null;

  if (reportData?.tests?.length > 0) {
    const minD = mode === 'bot' ? config.botMinDensity : config.level9MinDensity;
    const maxD = mode === 'bot' ? config.botMaxDensity : config.level9MaxDensity;

    lineChartData = {
      labels: reportData.tests.map((_, i) => `T${i + 1}`),
      datasets: [{
        label: 'Density (g/mL)',
        data: reportData.tests.map(t => parseFloat(t.density)),
        borderColor: '#00BCD4',
        backgroundColor: 'rgba(0, 188, 212, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00BCD4',
      }]
    };

    lineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { suggestedMin: Math.max(0, minD - 0.05), suggestedMax: maxD + 0.05, grid: { color: '#333' }, ticks: { color: '#888' } },
        x: { grid: { color: '#333' }, ticks: { color: '#888' } }
      },
      plugins: { legend: { display: false } }
    };

    let normal = 0, low = 0, high = 0;
    reportData.tests.forEach(t => {
      const s = getDensityStatus(parseFloat(t.density));
      if (s === 'NORMAL') normal++;
      else if (s === 'LOW') low++;
      else high++;
    });

    doughnutChartData = {
      labels: ['Normal', 'Low', 'High'],
      datasets: [{
        data: [normal, low, high],
        backgroundColor: ['#00E676', '#FF9800', '#F44336'],
        borderColor: ['#1E1E1E', '#1E1E1E', '#1E1E1E'],
        borderWidth: 2
      }]
    };
  }

  if (loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading Reports...</div></Layout>;

  return (
    <Layout title="📊 QC Density Report" subtitle="Generate and export QC test reports" maxWidth="max-w-7xl">
      
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 10mm; }
            html, body, #root { background-color: white !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      <div className="print:hidden">
        {!showFilters && (
          <button 
            onClick={() => setShowFilters(true)}
            className="w-full bg-gradient-to-br from-dark-card to-[#252525] border-2 border-primary rounded-xl p-6 text-left hover:scale-[1.01] hover:shadow-[0_5px_20px_rgba(0,188,212,0.4)] transition-all mb-6 group"
          >
            <div className="text-xl font-bold text-primary mb-2 group-hover:text-white transition-colors">📋 QC Density Tests Report</div>
            <div className="text-gray-400 text-sm">Query the different shifts (DAY or NIGHT) and modes (Level 9 or BOT) for any specific date.</div>
          </button>
        )}

        {showFilters && (
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-6 animate-[fadeIn_0.3s]">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">📅 Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">🔧 Mode</label>
                <select value={mode} onChange={e => setMode(e.target.value)} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
                  <option value="level9">Level 9 Silo Densities</option>
                  <option value="bot">BOT Densities</option>
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-primary font-bold mb-2">🌙 Shift</label>
                <select value={shift} onChange={e => setShift(e.target.value)} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
                  <option value="DAY">DAY</option>
                  <option value="NIGHT">NIGHT</option>
                </select>
              </div>
              <div className="w-full md:w-auto mt-4 md:mt-0">
                <button onClick={generateReport} disabled={loading} className="w-full bg-primary text-black font-bold py-3 px-8 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {loading ? '⏳ Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>
            {error && <div className="mt-4 text-status-danger text-sm font-bold text-center">{error}</div>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-primary mt-10 animate-pulse font-bold text-xl">Loading report data...</div>
      ) : reportData && (
        <div className="animate-[fadeIn_0.5s_ease-out]">
          
          <div className="flex justify-end gap-3 mb-4 print:hidden">
            <button onClick={() => window.print()} className="bg-[#333] text-white px-4 py-2 rounded font-bold hover:bg-[#444]">🖨️ Print</button>
            <button onClick={exportToCSV} className="bg-[#2196F3] text-white px-4 py-2 rounded font-bold hover:bg-blue-600">📥 Export CSV</button>
          </div>

          <div className="bg-white text-black p-6 rounded-xl border-2 border-[#333] mb-6 print:!border-0 print:!border-transparent print:!shadow-none print:!p-0 print:!m-0 print:!mb-8 print:!bg-white">
            <h2 className="text-2xl font-black text-center mb-6 uppercase tracking-wider">
              {mode === 'level9' ? 'Level 9 Powder Density Tests' : 'BOT Powder Density Tests'}
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
              <div className="border-b border-gray-200 pb-2"><span className="font-bold">Mode:</span> {mode === 'level9' ? 'Level 9 Silos' : 'BOT'}</div>
              <div className="border-b border-gray-200 pb-2"><span className="font-bold">Shift:</span> {shift}</div>
              <div className="border-b border-gray-200 pb-2"><span className="font-bold">Date:</span> {date.split('-').reverse().join('/')}</div>
              <div className="border-b border-gray-200 pb-2"><span className="font-bold">Total Tests:</span> {reportData.tests.length}</div>
              <div className="border-b border-gray-200 pb-2"><span className="font-bold">QC Staff:</span> {[...new Set(reportData.tests.map(t => t.qcName).filter(Boolean))].join(', ') || 'N/A'}</div>
              <div className="border-b border-gray-200 pb-2"><span className="font-bold">Team:</span> {[...new Set(reportData.tests.map(t => t.team).filter(Boolean))].join(', ') || 'N/A'}</div>
            </div>

            <div className="mt-4 pt-4 border-t-2 border-black print:!border-gray-300 print:!border-t">
              <h3 className="font-bold mb-3 uppercase text-sm">Shift Approvers:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {['buggySupervisor', 'plcOperator', 'productionManager', 'qcManager', 'qcSupervisor'].map(role => {
                  const appr = reportData.approval?.[role];
                  if (!appr) return null;
                  const roleName = role.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return <div key={role}>• <span className="font-bold">{roleName}:</span> {appr.name}</div>;
                })}
                {Object.keys(reportData.approval || {}).filter(k => typeof reportData.approval[k] === 'object' && reportData.approval[k].name).length === 0 && (
                  <div className="text-gray-500 italic">No approvals recorded for this shift yet.</div>
                )}
              </div>
            </div>
          </div>

          {reportData.tests.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print:flex print:flex-row print:gap-4 print:break-inside-avoid print:!bg-white">
              <div className="bg-white p-4 rounded-xl border border-gray-300 print:!border-0 print:!border-transparent print:!shadow-none print:!p-0 print:flex-1 print:!bg-white">
                <h3 className="text-center font-bold text-black mb-4 uppercase text-sm tracking-wider">📈 Density Trend</h3>
                <div className="h-[250px]"><Line data={lineChartData} options={lineChartOptions} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-300 print:!border-0 print:!border-transparent print:!shadow-none print:!p-0 print:flex-1 print:!bg-white">
                <h3 className="text-center font-bold text-black mb-4 uppercase text-sm tracking-wider">🥧 High/Low Distribution</h3>
                <div className="h-[250px] flex justify-center"><Doughnut data={doughnutChartData} options={{ maintainAspectRatio: false }} /></div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-300 overflow-x-auto print:!overflow-visible print:!border-0 print:!border-transparent print:!shadow-none print:!bg-transparent">
            {reportData.tests.length === 0 ? (
              <div className="text-center text-gray-500 py-10 font-medium">No tests found for this shift.</div>
            ) : (
              <table className="w-full text-left border-collapse text-sm text-black min-w-[800px] print:min-w-full print:text-xs">
                  <thead>
                    <tr className="bg-gray-800 text-white print:bg-gray-100 print:text-black print:border-b-2 print:border-black">
                      <th className="p-3 border border-gray-400 print:!border-gray-300">Time</th>
                      <th className="p-3 border border-gray-400 print:!border-gray-300">Weight</th>
                      <th className="p-3 border border-gray-400 print:!border-gray-300">Density</th>
                      <th className="p-3 border border-gray-400 print:!border-gray-300">Status</th>
                      {mode === 'level9' && <th className="p-3 border border-gray-400 print:!border-gray-300">Buggy</th>}
                      {mode === 'level9' && <th className="p-3 border border-gray-400 print:!border-gray-300">Machines</th>}
                      <th className="p-3 border border-gray-400 print:!border-gray-300">Appr.</th>
                      <th className="p-3 border border-gray-400 print:!border-gray-300">{mode === 'level9' ? 'Frag.' : 'Flow'}</th>
                      <th className="p-3 border border-gray-400 print:!border-gray-300 w-1/3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const sortedByDensity = [...reportData.tests].sort((a, b) => parseFloat(b.density) - parseFloat(a.density));
                      const top5Ids = new Set(sortedByDensity.slice(0, 5).map(t => t.id));
                      return reportData.tests.map((t, index) => {
                        const isTop5 = top5Ids.has(t.id);
                        return (
                          <tr key={t.id} className={`${isTop5 ? 'bg-amber-50 print:!bg-amber-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="p-3 border border-gray-300 print:!border-gray-300 whitespace-nowrap">{formatTime(t.createdAt || t.localCreatedAt)}</td>
                            <td className="p-3 border border-gray-300 print:!border-gray-300">{t.weight}g</td>
                            <td className={`p-3 border border-gray-300 print:!border-gray-300 font-bold ${isTop5 ? 'text-amber-800' : ''}`}>
                              {isTop5 ? '⭐ ' : ''}{parseFloat(t.density).toFixed(3)}
                            </td>
                            <td className="p-3 border border-gray-300 print:!border-gray-300">{getStatusBadge(getDensityStatus(parseFloat(t.density)))}</td>
                            {mode === 'level9' && <td className="p-3 border border-gray-300 print:!border-gray-300">{t.buggyNumber || '--'}</td>}
                            {mode === 'level9' && <td className="p-3 border border-gray-300 print:!border-gray-300 font-bold">{t.machines ? t.machines.join(', ') : '--'}</td>}
                            <td className="p-3 border border-gray-300 print:!border-gray-300">{t.appearance === 'U' ? 'U' : 'A'}</td>
                            <td className="p-3 border border-gray-300 print:!border-gray-300">{mode === 'level9' ? (t.fragrance === 'U' ? 'U' : 'A') : ((t.flowProperty === 'U' || t.flowProperty === 'NFF') ? 'U' : 'A')}</td>
                            <td className="p-3 border border-gray-300 print:!border-gray-300 text-xs whitespace-pre-wrap break-words">{t.remarks || '--'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
            )}
          </div>

        </div>
      )}
    </Layout>
  );
}