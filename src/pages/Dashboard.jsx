// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToShiftTests } from '../services/qcOperations';
import { subscribeToActiveUsers } from '../services/presenceOperations';
import { subscribeToActiveEmptySilos } from '../services/emptySiloOperations';
import { subscribeToActiveStoppedMachines } from '../services/stoppedMachineOperations';
import { subscribeToShiftCartonRecords } from '../services/cartonOperations';
import { subscribeToShiftLaminateRecords } from '../services/laminateOperations';
import { Link } from 'react-router-dom';
import { subscribeToAllStringWeights, getShiftDateInfo } from '../services/qcStringWeightOperations';
import { subscribeToAllBagInspections } from '../services/qcBagInspectionOperations';
import { subscribeToAllCartonInspections } from '../services/qcCartonInspectionOperations';

export default function Dashboard() {
  const { config, loadingConfig } = useConfig();
  const { currentUser, systemRole, departmentRoles, firstName } = useAuth();
  
  const [level9Count, setLevel9Count] = useState(0);
  const [botCount, setBotCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [emptySilosCount, setEmptySilosCount] = useState(0);
  const [stoppedCount, setStoppedCount] = useState(0);
  const [cartonWaste, setCartonWaste] = useState({ wasted: 0, wastePercent: 0 });
  const [laminateWaste, setLaminateWaste] = useState({ wasteCollected: 0, wastePercent: 0 });
  const [currentShift, setCurrentShift] = useState('--');
  const [swCount, setSwCount] = useState(0);
  const [biCount, setBiCount] = useState(0);
  const [ciCount, setCiCount] = useState(0);

  useEffect(() => {
    if (loadingConfig) return;
    const currentHour = new Date().getHours();
    setCurrentShift((currentHour >= config.dayShiftStart && currentHour < config.nightShiftStart) ? 'DAY' : 'NIGHT');
  }, [config, loadingConfig]);

  useEffect(() => {
    if (loadingConfig) return;

    const unsubLevel9 = subscribeToShiftTests('level9', config, (tests) => {
      setLevel9Count(tests.length);
    });
    
    const unsubBot = subscribeToShiftTests('bot', config, (tests) => {
      setBotCount(tests.length);
    });

    const unsubPresence = subscribeToActiveUsers((users) => {
      setActiveUsersCount(users.length);
    });

    const unsubEmpty = subscribeToActiveEmptySilos((records) => {
      setEmptySilosCount(records.length);
    });

    const unsubStopped = subscribeToActiveStoppedMachines((records) => {
      setStoppedCount(records.filter(r => !r.startedAt).length);
    });

    const unsubCarton = subscribeToShiftCartonRecords(config, (records) => {
      const totalWasted = records.reduce((sum, r) => sum + (r.wasted || 0), 0);
      const totalUsed = records.reduce((sum, r) => sum + (r.used || 0), 0);
      const totalProcessed = totalUsed + totalWasted;
      setCartonWaste({
        wasted: totalWasted,
        wastePercent: totalProcessed > 0 ? Math.round((totalWasted / totalProcessed) * 10000) / 100 : 0
      });
    });

    const unsubLaminate = subscribeToShiftLaminateRecords(config, (records) => {
      const machinesMap = {};
      for (const r of records) {
        if (!machinesMap[r.machineId]) {
          machinesMap[r.machineId] = { totalLaminateUsed: 0, totalWasteCollected: 0 };
        }
        machinesMap[r.machineId].totalLaminateUsed = r.totalLaminateUsed || 0;
        machinesMap[r.machineId].totalWasteCollected += (r.wasteCollected || 0);
      }
      const machineTotals = Object.values(machinesMap);
      const totalWaste = machineTotals.reduce((s, m) => s + m.totalWasteCollected, 0);
      const totalUsed = machineTotals.reduce((s, m) => s + m.totalLaminateUsed, 0);
      setLaminateWaste({
        wasteCollected: totalWaste,
        wastePercent: totalUsed > 0 ? Math.round((totalWaste / totalUsed) * 10000) / 100 : 0
      });
    });

    return () => {
      unsubLevel9();
      unsubBot();
      unsubPresence();
      unsubEmpty();
      unsubStopped();
      unsubCarton();
      unsubLaminate();
    };
  }, [config, loadingConfig]);

  // QC Sachet subscriptions
  useEffect(() => {
    if (loadingConfig) return;
    const { shift, date } = getShiftDateInfo(config);
    const docId = `qc_string_weight_${shift}_${date}`;
    const unsubSW = subscribeToAllStringWeights(docId, (records) => setSwCount(records.length));
    const unsubBI = subscribeToAllBagInspections(docId, (records) => setBiCount(records.length));
    const unsubCI = subscribeToAllCartonInspections(docId, (records) => setCiCount(records.length));
    return () => { unsubSW(); unsubBI(); unsubCI(); };
  }, [config, loadingConfig]);

  const isAdminOrQcManager = systemRole === 'super_admin' || (departmentRoles || []).includes('qc_manager');

  // 🎯 TRUE ENTERPRISE FIX: 100% Dynamic! No hardcoded maps allowed.
  const userCategories = [...new Set(
    departmentRoles.map(roleId => {
      // Find the exact role in the live database configuration
      const roleDef = (config?.departmentRoles || []).find(r => r.id === roleId);
      
      // If found, use the official database Category. 
      // If not, just format the raw ID (e.g. "new_dept" -> "New Dept") so it never crashes.
      return roleDef ? roleDef.category : roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }).filter(Boolean)
  )];

  return (
    <Layout title="Factory Command Center" subtitle={`Live Overview • ${currentShift} Shift`} maxWidth="max-w-7xl">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary p-6 rounded-r-xl mb-8 animate-[fadeIn_0.5s_ease-out]">
        <h2 className="text-2xl font-bold text-white mb-1">
          Welcome back, <span className="text-primary">{firstName || 'Operator'}</span>
        </h2>
        <p className="text-gray-400 text-sm mb-2 font-mono">{currentUser?.email}</p>
        
        <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-primary/20">
          <p className="text-gray-400 text-sm">
            System Role: <span className="uppercase font-bold text-white tracking-wider">{systemRole.replace('_', ' ')}</span>
          </p>
          
          {systemRole === 'super_admin' ? (
             <p className="text-gray-400 text-sm">
              Departments: <span className="font-bold text-white">Full Factory Access</span>
            </p>
          ) : (
            userCategories.length > 0 && (
              <p className="text-gray-400 text-sm">
                Departments: <span className="font-bold text-white">{userCategories.join(', ')}</span>
              </p>
            )
          )}
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
        
        {/* Metric 1: Live Users */}
        {systemRole === 'super_admin' ? (
          <Link to="/active-users" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-[0_0_20px_rgba(0,230,118,0.1)] relative overflow-hidden group hover:border-status-success/50 transition-colors animate-[fadeIn_0.5s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">👥</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse shadow-[0_0_8px_rgba(0,230,118,0.8)]"></span>
              Live Users
            </h3>
            <div className="text-5xl font-black text-white mb-1">{activeUsersCount}</div>
            <div className="text-status-success text-xs font-bold uppercase tracking-wider">Active Now</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-[0_0_20px_rgba(0,230,118,0.1)] relative overflow-hidden group hover:border-status-success/50 transition-colors animate-[fadeIn_0.5s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">👥</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse shadow-[0_0_8px_rgba(0,230,118,0.8)]"></span>
              Live Users
            </h3>
            <div className="text-5xl font-black text-white mb-1">{activeUsersCount}</div>
            <div className="text-status-success text-xs font-bold uppercase tracking-wider">Active Now</div>
          </div>
        )}

        {/* Metric 2: Level 9 Tests */}
        {systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager'].includes(r)) ? (
          <Link to="/level9-exec" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_0.6s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🏭</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🏭 Level 9 Tests</h3>
            <div className="text-5xl font-black text-white mb-1">{level9Count}</div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider">This Shift</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_0.6s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🏭</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🏭 Level 9 Tests</h3>
            <div className="text-5xl font-black text-white mb-1">{level9Count}</div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider">This Shift</div>
          </div>
        )}

        {/* Metric 3: BOT Tests */}
        {systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager'].includes(r)) ? (
          <Link to="/bot-exec" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_0.7s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🤖</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🤖 BOT Tests</h3>
            <div className="text-5xl font-black text-white mb-1">{botCount}</div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider">This Shift</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_0.7s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🤖</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🤖 BOT Tests</h3>
            <div className="text-5xl font-black text-white mb-1">{botCount}</div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider">This Shift</div>
          </div>
        )}

        {/* Metric 4: Empty Silos 🛢️ */}
        {systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r)) ? (
          <Link to="/empty-silos-report" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-status-danger/50 transition-colors animate-[fadeIn_0.8s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🛢️</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-danger animate-pulse shadow-[0_0_8px_rgba(244,67,54,0.8)]"></span>
              🛢️ Empty Silos
            </h3>
            <div className="text-5xl font-black text-white mb-1">{stoppedCount}<span className="text-2xl text-gray-500">/{config?.machines?.length || 0}</span></div>
            <div className="text-status-danger text-xs font-bold uppercase tracking-wider">Needs Fill</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-status-danger/50 transition-colors animate-[fadeIn_0.8s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🛢️</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-danger animate-pulse shadow-[0_0_8px_rgba(244,67,54,0.8)]"></span>
              🛢️ Empty Silos
            </h3>
            <div className="text-5xl font-black text-white mb-1">{emptySilosCount}<span className="text-2xl text-gray-500">/{config?.machines?.length || 0}</span></div>
            <div className="text-status-danger text-xs font-bold uppercase tracking-wider">Needs Fill</div>
          </div>
        )}

        {/* Metric 5: Stopped Machines 🛑 */}
        {systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r)) ? (
          <Link to="/stopped-machines-report" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-status-danger/50 transition-colors animate-[fadeIn_0.9s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🛑</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-danger animate-pulse shadow-[0_0_8px_rgba(244,67,54,0.8)]"></span>
              🛑 Stopped Machines
            </h3>
            <div className="text-5xl font-black text-white mb-1">{stoppedCount}<span className="text-2xl text-gray-500">/{config?.machines?.length || 0}</span></div>
            <div className="text-status-danger text-xs font-bold uppercase tracking-wider">Not Running</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-status-danger/50 transition-colors animate-[fadeIn_0.9s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🛑</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-status-danger animate-pulse shadow-[0_0_8px_rgba(244,67,54,0.8)]"></span>
              🛑 Stopped Machines
            </h3>
            <div className="text-5xl font-black text-white mb-1">{stoppedCount}<span className="text-2xl text-gray-500">/{config?.machines?.length || 0}</span></div>
            <div className="text-status-danger text-xs font-bold uppercase tracking-wider">Not Running</div>
          </div>
        )}


        {/* Metric 6: Carton Waste */}
        {systemRole === 'super_admin' || departmentRoles.some(r => ['prod_manager', 'qc_manager', 'packaging_manager'].includes(r)) ? (
          <Link to="/carton-waste-report" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_1s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">📦</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">📦 Carton Waste</h3>
            <div className="text-5xl font-black text-white mb-1">{cartonWaste.wasted.toLocaleString()}</div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: cartonWaste.wastePercent > (config?.cartonWaste?.targetWastePercent ?? 5) ? '#F44336' : '#00E676' }}>
              Waste {cartonWaste.wastePercent}%
            </div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider mt-1">This Shift</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_1s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">📦</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">📦 Carton Waste</h3>
            <div className="text-5xl font-black text-white mb-1">{cartonWaste.wasted.toLocaleString()}</div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: cartonWaste.wastePercent > (config?.cartonWaste?.targetWastePercent ?? 5) ? '#F44336' : '#00E676' }}>
              Waste {cartonWaste.wastePercent}%
            </div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider mt-1">This Shift</div>
          </div>
        )}

        {/* Metric 7: Laminate Waste */}
        {systemRole === 'super_admin' || departmentRoles.some(r => ['prod_manager', 'qc_manager', 'packaging_manager'].includes(r)) ? (
          <Link to="/laminate-waste-report" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_1s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🗑️</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🗑️ Laminate Waste</h3>
            <div className="text-4xl font-black text-white mb-1">{laminateWaste.wasteCollected.toFixed(2)} kg</div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: laminateWaste.wastePercent > (config?.laminateWaste?.targetWastePercent ?? 5) ? '#F44336' : '#00E676' }}>
              Waste {laminateWaste.wastePercent}%
            </div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider mt-1">This Shift</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_1s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🗑️</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🗑️ Laminate Waste</h3>
            <div className="text-4xl font-black text-white mb-1">{laminateWaste.wasteCollected.toFixed(2)} kg</div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: laminateWaste.wastePercent > (config?.laminateWaste?.targetWastePercent ?? 5) ? '#F44336' : '#00E676' }}>
              Waste {laminateWaste.wastePercent}%
            </div>
            <div className="text-primary text-xs font-bold uppercase tracking-wider mt-1">This Shift</div>
          </div>
        )}

        {/* Metric 8: QC Sachet Checks */}
        {isAdminOrQcManager ? (
          <Link to="/qc-sachet-report" className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_1s_ease-out] block cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">✅</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🔬 QC Sachet Checks</h3>
            <div className="text-5xl font-black text-white mb-1">{swCount + biCount + ciCount}</div>
            <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
              <span>SW: <strong className="text-white">{swCount}</strong></span>
              <span>BI: <strong className="text-white">{biCount}</strong></span>
              <span>CI: <strong className="text-white">{ciCount}</strong></span>
            </div>
            <div className="text-primary text-[10px] font-bold uppercase tracking-wider mt-1">📊 View Reports →</div>
            <div className="text-primary text-[10px] font-bold uppercase tracking-wider">This Shift</div>
          </Link>
        ) : (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_1s_ease-out]">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">✅</div>
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🔬 QC Sachet Checks</h3>
            <div className="text-5xl font-black text-white mb-1">{swCount + biCount + ciCount}</div>
            <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
              <span>SW: <strong className="text-white">{swCount}</strong></span>
              <span>BI: <strong className="text-white">{biCount}</strong></span>
              <span>CI: <strong className="text-white">{ciCount}</strong></span>
            </div>
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mt-1">Total Records This Shift</div>
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-wider">This Shift</div>
          </div>
        )}

      </div>

      {/* Quick Action Links */}
      <h3 className="text-primary font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2 animate-[fadeIn_1s_ease-out]">🚀 Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-[fadeIn_1.1s_ease-out]">
        
        {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager', 'prod_staff', 'prod_manager'].includes(r))) && (
          <>
            <Link to="/powder-density" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">📝</div>
              <div>
                <div className="text-white font-bold text-lg">Powder Density Tests</div>
                <div className="text-gray-400 text-sm">Enter QC data for Level 9 & BOT</div>
              </div>
            </Link>

            {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r))) && (
              <Link to="/qc-sachet-production-checks" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
                <div className="text-3xl group-hover:scale-110 transition-transform">✅</div>
                <div>
                  <div className="text-white font-bold text-lg">QC Sachet Production Checks</div>
                  <div className="text-gray-400 text-sm">String weight, bag & carton inspection</div>
                </div>
              </Link>
            )}

            {(systemRole === 'super_admin' || (departmentRoles || []).includes('qc_manager')) && (
              <Link to="/qc-sachet-report" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
                <div className="text-3xl group-hover:scale-110 transition-transform">📊</div>
                <div>
                  <div className="text-white font-bold text-lg">QC Sachet Report</div>
                  <div className="text-gray-400 text-sm">Printable reports & CSV export</div>
                </div>
              </Link>
            )}

            {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r))) && (
              <Link to="/empty-silos" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
                <div className="text-3xl group-hover:scale-110 transition-transform">🛢️</div>
                <div>
                  <div className="text-white font-bold text-lg">Report Empty Silos</div>
                  <div className="text-gray-400 text-sm">Mark machines as empty</div>
                </div>
              </Link>
            )}

            {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r))) && (
              <Link to="/stop-machine" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
                <div className="text-3xl group-hover:scale-110 transition-transform">🛑</div>
                <div>
                  <div className="text-white font-bold text-lg">Report Stopped Machine</div>
                  <div className="text-gray-400 text-sm">Report & resolve machine issues</div>
                </div>
              </Link>
            )}

            {(systemRole === 'super_admin' || departmentRoles.some(r => ['prod_staff', 'prod_manager', 'qc_manager'].includes(r))) && (
              <Link to="/carton-waste" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
                <div className="text-3xl group-hover:scale-110 transition-transform">📦</div>
                <div>
                  <div className="text-white font-bold text-lg">Carton Waste Tracking</div>
                  <div className="text-gray-400 text-sm">Enter carton waste data per machine</div>
                </div>
              </Link>
            )}

            {(systemRole === 'super_admin' || departmentRoles.some(r => ['prod_staff', 'prod_manager', 'qc_manager'].includes(r))) && (
              <Link to="/laminate-waste" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
                <div className="text-3xl group-hover:scale-110 transition-transform">🗑️</div>
                <div>
                  <div className="text-white font-bold text-lg">Laminate Waste Tracking</div>
                  <div className="text-gray-400 text-sm">Enter laminate waste data per machine</div>
                </div>
              </Link>
            )}
          </>
        )}

        {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager'].includes(r))) && (
          <>
            <Link to="/level9-exec" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">🏭</div>
              <div>
                <div className="text-white font-bold text-lg">Level 9 Dashboard</div>
                <div className="text-gray-400 text-sm">Live views & shift approvals</div>
              </div>
            </Link>

            <Link to="/qc-density-report" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">📊</div>
              <div>
                <div className="text-white font-bold text-lg">QC Density Report</div>
                <div className="text-gray-400 text-sm">Generate & export PDF/CSV</div>
              </div>
            </Link>
          </>
        )}

        {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager', 'packaging_manager'].includes(r))) && (
          <>
            <Link to="/empty-silos-report" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">📋</div>
              <div>
                <div className="text-white font-bold text-lg">Empty Silos Report</div>
                <div className="text-gray-400 text-sm">Real-time empty status overview</div>
              </div>
            </Link>

            <Link to="/stopped-machines-report" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">📊</div>
              <div>
                <div className="text-white font-bold text-lg">Stopped Machines Report</div>
                <div className="text-gray-400 text-sm">Real-time machine issues overview</div>
              </div>
            </Link>

            <Link to="/carton-waste-report" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">📊</div>
              <div>
                <div className="text-white font-bold text-lg">Carton Waste Report</div>
                <div className="text-gray-400 text-sm">Waste analysis & cross-shift comparison</div>
              </div>
            </Link>

            <Link to="/laminate-waste-report" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">🗑️</div>
              <div>
                <div className="text-white font-bold text-lg">Laminate Waste Report</div>
                <div className="text-gray-400 text-sm">Laminate waste analysis & cross-shift comparison</div>
              </div>
            </Link>
          </>
        )}
      </div>

    </Layout>
  );
}