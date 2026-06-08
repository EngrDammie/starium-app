// src/pages/Level9Exec.jsx
import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import MachineGrid from '../components/MachineGrid';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { getOrCreateShiftApproval, subscribeToShiftTests, subscribeToShiftApproval, addApprover, getShiftDateInfo } from '../services/qcOperations';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Level9Exec() {
  const { config, loadingConfig } = useConfig();
  
  // 🎯 FIX: Fetch userFullName to permanently stamp it on the approval!
  const { systemRole, actionRoles, userFullName } = useAuth();
  const { broadcastAlert } = useAlerts(); 
  const navigate = useNavigate();

  const [shiftInfo, setShiftInfo] = useState({ shift: '--', date: '--' });
  const [shiftTests, setShiftTests] = useState([]);
  const [approvalData, setApprovalData] = useState(null);
  const [approvalId, setApprovalId] = useState(null);

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [currentApproverType, setCurrentApproverType] = useState(null);
  const [detailsMachine, setDetailsMachine] = useState(null);

  useEffect(() => {
    if (loadingConfig) return;

    const info = getShiftDateInfo(config);
    setShiftInfo({ shift: info.shift, date: info.date.split('-').reverse().join('-') });

    let testsUnsubscribe = () => {};
    let approvalUnsubscribe = () => {};

    const initializeData = async () => {
      const docId = await getOrCreateShiftApproval('level9', config);
      setApprovalId(docId);
      testsUnsubscribe = subscribeToShiftTests('level9', config, (tests) => setShiftTests(tests));
      approvalUnsubscribe = subscribeToShiftApproval(docId, (data) => setApprovalData(data));
    };

    initializeData();

    return () => {
      testsUnsubscribe();
      approvalUnsubscribe();
    };
  }, [config, loadingConfig]);

  const latestTest = shiftTests.length > 0 ? shiftTests[shiftTests.length - 1] : null;
  const recent10Tests = [...shiftTests].reverse().slice(0, 10); 

  const formatTime = (ts) => {
    if (!ts) return '--';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getDensityStatus = (density) => {
    const d = parseFloat(density);
    if (d < config.level9MinDensity) return 'low';
    if (d > config.level9MaxDensity) return 'high';
    return 'normal';
  };

  const getStatusColor = (density) => {
    if (!density) return "text-white";
    const status = getDensityStatus(density);
    if (status === 'low' || status === 'high') return "text-status-danger text-shadow-[0_0_20px_rgba(244,67,54,0.8)]";
    return "text-status-success text-shadow-[0_0_20px_rgba(0,230,118,0.5)]";
  };

  const getMachineStatus = (machine) => {
    if (!latestTest?.density) return { text: 'Unknown', color: '#888' };
    const d = parseFloat(latestTest.density);
    if (d < config.level9MinDensity) return { text: '⚠️ Density Too Low', color: '#FF1744' };
    if (d > config.level9MaxDensity) return { text: '❌ Density Too High', color: '#FF1744' };
    
    const spec = config.gramSpecs?.[String(machine.gram)];
    const min = spec ? spec.min : machine.min;
    const max = spec ? spec.max : machine.max;
    
    if (d >= min && d <= max) return { text: '✅ Matches', color: '#00E676' };
    return { text: '⚠️ Out of Range', color: '#FF1744' };
  };

  const getTableDensityBadge = (densityNum) => {
    if (densityNum < config.level9MinDensity) return <span className="bg-status-warning/20 text-status-warning px-2 py-1 rounded-full text-xs font-bold">LOW</span>;
    if (densityNum > config.level9MaxDensity) return <span className="bg-status-danger/20 text-status-danger px-2 py-1 rounded-full text-xs font-bold">HIGH</span>;
    return <span className="bg-status-success/20 text-status-success px-2 py-1 rounded-full text-xs font-bold">NORMAL</span>;
  };

  const chartData = {
    labels: recent10Tests.slice().reverse().map((_, i) => `T${i + 1}`),
    datasets: [{
      label: 'Density (g/mL)',
      data: recent10Tests.slice().reverse().map(t => parseFloat(t.density)),
      borderColor: '#00BCD4',
      backgroundColor: 'rgba(0, 188, 212, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#00BCD4',
      pointRadius: 4,
    }]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      y: { suggestedMin: Math.max(0, config.level9MinDensity - 0.05), suggestedMax: config.level9MaxDensity + 0.05, grid: { color: '#333' }, ticks: { color: '#888' } },
      x: { grid: { color: '#333' }, ticks: { color: '#888' } }
    },
    plugins: { legend: { display: false } }
  };

  const approvalButtons = [
    { type: 'buggySupervisor', label: '🔧 Buggy Supervisor' },
    { type: 'plcOperator', label: '⚡ PLC Operator' },
    { type: 'productionManager', label: '🏭 Production Manager' },
    { type: 'qcManager', label: '✅ QC Manager' },
    { type: 'qcSupervisor', label: '🔍 QC Supervisor' },
  ];

  const handleOpenApproval = (roleType) => {
    const requiredRole = roleType.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (systemRole !== 'super_admin' && !actionRoles.includes(requiredRole)) {
      alert("⛔ Access Denied! You do not have the specific keycard required to click this approval button.");
      return;
    }
    setCurrentApproverType(roleType);
    setIsApproveModalOpen(true);
  };

  const submitApproval = async () => {
    // 🎯 FIX: Automatically submits userFullName! No typing required.
    const success = await addApprover(approvalId, userFullName, currentApproverType);
    
    if (success) {
      const btnInfo = approvalButtons.find(b => b.type === currentApproverType);
      const roleName = btnInfo ? btnInfo.label.split(' ').slice(1).join(' ') : 'Supervisor';
      
      broadcastAlert(
        `✅ SHIFT APPROVED!`,
        `${userFullName} (${roleName}) has approved the ${shiftInfo.shift} shift for Level 9.`,
        'info',
        ['/','/powder-density', '/level9-exec']
      );
    }

    setIsApproveModalOpen(false);
  };

  return (
    <Layout title="🏭 Level 9 Executive View" subtitle="Real-time Density Monitoring & Approval" maxWidth="max-w-7xl">
      <style>{`@keyframes alertBlink { 0%, 100% { opacity: 1; } 25%, 75% { opacity: 0.4; } 50% { opacity: 0; } } .animate-alert-blink { animation: alertBlink 1.5s linear infinite; }`}</style>

      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">Mode</div><div className="text-primary font-bold text-lg">Level 9</div></div>
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">Shift</div><div className="text-primary font-bold text-lg">{shiftInfo.shift}</div></div>
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">Date</div><div className="text-primary font-bold text-lg">{shiftInfo.date}</div></div>
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">Tests</div><div className="text-primary font-bold text-lg">{shiftTests.length}</div></div>
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">QC Staff</div><div className="text-primary font-bold text-lg">{latestTest?.qcName || '--'}</div></div>
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">Team</div><div className="text-primary font-bold text-lg">{latestTest?.team || '--'}</div></div>
        <div className="bg-dark-card border border-[#333] px-5 py-2 rounded-lg text-center"><div className="text-[10px] text-gray-400 uppercase">Last Test</div><div className="text-primary font-bold text-lg">{latestTest ? formatTime(latestTest.createdAt) : '--'}</div></div>
      </div>

      <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border-2 border-primary rounded-xl p-8 text-center mb-6 shadow-[0_0_30px_rgba(0,188,212,0.15)]">
        <div className="text-gray-400 uppercase tracking-widest text-sm mb-2 font-bold">Current Density</div>
        <div className={`text-7xl md:text-8xl font-black mb-2 transition-colors ${getStatusColor(latestTest?.density)}`}>
          {latestTest?.density || '--'}
        </div>
        {latestTest?.density && (() => {
          const status = getDensityStatus(latestTest.density);
          const statusClass = status === 'normal' ? 'bg-status-success/20 text-status-success border border-status-success' : 'bg-status-danger text-white border-2 border-red-400 animate-alert-blink shadow-[0_0_15px_rgba(244,67,54,0.6)]';
          const statusText = status === 'normal' ? '✓ Normal' : status === 'low' ? '⚠️ Too Low' : '⚠️ Too High';
          return <div className={`mt-4 inline-block px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest ${statusClass}`}>{statusText}</div>;
        })()}
      </div>

      <div className="bg-dark-card rounded-xl p-6 mb-6 border border-[#333]">
        <h3 className="text-primary font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🏭 Machine Status</h3>
        <MachineGrid density={latestTest?.density} selectedMachines={latestTest?.machines || []} overrideMachines={[]} onMachineClick={(machine) => setDetailsMachine(machine)} />
        <div className="bg-[#1a1a1a] border-l-4 border-primary rounded-lg p-4 mt-6">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-bold">📝 Remarks</div>
          <div className={`text-sm whitespace-pre-wrap ${!latestTest?.remarks ? 'text-gray-500 italic' : 'text-white'}`}>{latestTest?.remarks || 'No remarks'}</div>
        </div>
      </div>

      <div className="bg-dark-card rounded-xl p-6 mb-6 border border-[#333]">
        <h3 className="text-primary font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">👔 Shift Approvals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {approvalButtons.map(btn => {
            const isApproved = approvalData?.[btn.type];
            const labelText = btn.label.split(' ').slice(1).join(' '); 
            return (
              <button
                key={btn.type}
                onClick={() => handleOpenApproval(btn.type)}
                disabled={isApproved}
                className={`p-4 rounded-lg border-2 text-sm font-bold transition-all ${
                  isApproved ? 'bg-status-success/10 border-status-success text-status-success cursor-not-allowed' : 'bg-[#1a1a1a] border-[#444] text-white hover:border-[#FFD700] hover:shadow-[0_0_15px_rgba(255,215,0,0.3)]'
                }`}
              >
                {isApproved ? `✓ ${labelText} ${isApproved.name} has approved this shift` : btn.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-dark-card rounded-xl p-6 mb-6 border border-[#333]">
        <h3 className="text-primary font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">📈 Density Trend (Last 10)</h3>
        <div className="h-[250px] w-full"><Line data={chartData} options={chartOptions} /></div>
      </div>

      <div className="bg-dark-card rounded-xl p-6 mb-16 border border-[#333] overflow-x-auto">
        <h3 className="text-primary font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">📋 RECENT TESTS (LAST 10)</h3>
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Time</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Weight</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Density</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Status</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Buggy</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Silo/Machine</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Appr.</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Frag.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {recent10Tests.map((t) => (
              <tr key={t.id} className="hover:bg-primary/5">
                <td className="p-3 text-gray-300 text-sm">{formatTime(t.createdAt || t.localCreatedAt)}</td>
                <td className="p-3 text-white text-sm">{t.weight}g</td>
                <td className="p-3 text-white text-sm font-bold">{parseFloat(t.density).toFixed(3)}</td>
                <td className="p-3">{getTableDensityBadge(parseFloat(t.density))}</td>
                <td className="p-3 text-gray-300 text-sm">{t.buggyNumber || '--'}</td>
                <td className="p-3 text-primary text-sm font-bold">{t.machines ? t.machines.join(', ') : '--'}</td>
                <td className="p-3 text-white font-bold">{t.appearance === 'U' ? 'U' : 'A'}</td>
                <td className="p-3 text-white font-bold">{t.fragrance === 'U' ? 'U' : 'A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isApproveModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsApproveModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-4 text-center uppercase tracking-wider">Confirm Approval</h2>
            
            {/* 🎯 FIX: Name is now securely locked to the user's authentic account! */}
            <p className="text-center text-gray-400 mb-2">You are approving this shift as:</p>
            <div className="w-full p-4 bg-[#1a1a1a] text-primary border-2 border-primary rounded-lg mb-6 text-center font-bold text-xl uppercase tracking-widest shadow-[0_0_15px_rgba(0,188,212,0.2)]">
              {userFullName}
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setIsApproveModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
              <button onClick={submitApproval} className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.4)]">CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {detailsMachine && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setDetailsMachine(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-2xl font-bold mb-5 text-center">🏭 Machine Details</h2>
            <div className="flex flex-col gap-3 text-sm mb-6">
              <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400">Machine ID:</span><span className="text-primary font-bold">M{detailsMachine.displayNumber || detailsMachine.id}</span></div>
              <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400">Line:</span><span className="text-primary font-bold">{detailsMachine.line}</span></div>
              <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400">Gram Setting:</span><span className="text-primary font-bold">{detailsMachine.gram}g</span></div>
              <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400">Density Range:</span><span className="text-primary font-bold">{(config.gramSpecs?.[String(detailsMachine.gram)]?.min || detailsMachine.min).toFixed(3)} - {(config.gramSpecs?.[String(detailsMachine.gram)]?.max || detailsMachine.max).toFixed(3)}</span></div>
              <div className="flex justify-between border-b border-[#333] pb-2"><span className="text-gray-400">Status:</span><span className="font-bold" style={{ color: getMachineStatus(detailsMachine).color }}>{getMachineStatus(detailsMachine).text}</span></div>
            </div>
            <button onClick={() => setDetailsMachine(null)} className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary-dark transition-colors">Close</button>
          </div>
        </div>
      )}
      
      <button onClick={() => navigate('/bot-exec')} className="fixed bottom-5 right-5 bg-status-warning text-black px-6 py-3 rounded-lg font-bold shadow-lg hover:scale-105 transition-all z-40">
        🔄 Switch to BOT Mode
      </button>

    </Layout>
  );
}