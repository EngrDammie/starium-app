// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToShiftTests } from '../services/qcOperations';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { config, loadingConfig } = useConfig();
  const { currentUser, systemRole, departmentRoles, firstName } = useAuth();
  
  const [level9Count, setLevel9Count] = useState(0);
  const [botCount, setBotCount] = useState(0);
  const [currentShift, setCurrentShift] = useState('--');

  useEffect(() => {
    if (loadingConfig) return;
    const currentHour = new Date().getHours();
    setCurrentShift((currentHour >= config.dayShiftStart && currentHour < config.nightShiftStart) ? 'DAY' : 'NIGHT');
  }, [config, loadingConfig]);

  useEffect(() => {
    if (loadingConfig) return;
    const unsubLevel9 = subscribeToShiftTests('level9', config, (tests) => setLevel9Count(tests.length));
    const unsubBot = subscribeToShiftTests('bot', config, (tests) => setBotCount(tests.length));
    return () => { unsubLevel9(); unsubBot(); };
  }, [config, loadingConfig]);

  // 🎯 TRUE ENTERPRISE FIX: Dynamically match the user's role IDs to the Categories in the database!
  const userCategories = [...new Set(
    departmentRoles.map(roleId => {
      // Find the role definition in the database config
      const roleDef = (config?.departmentRoles || []).find(r => r.id === roleId);
      // Return its category (e.g., "Quality Control" or "Human Resources")
      return roleDef ? roleDef.category : null;
    }).filter(Boolean) // Remove any nulls
  )];

  return (
    <Layout title="Factory Command Center" subtitle={`Live Overview • ${currentShift} Shift`} maxWidth="max-w-7xl">
      
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_0.6s_ease-out]">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🏭</div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Level 9 Tests</h3>
          <div className="text-5xl font-black text-white mb-1">{level9Count}</div>
          <div className="text-status-success text-xs font-bold uppercase">This Shift</div>
        </div>

        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:border-primary/50 transition-colors animate-[fadeIn_0.7s_ease-out]">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl">🤖</div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">BOT Tests</h3>
          <div className="text-5xl font-black text-white mb-1">{botCount}</div>
          <div className="text-status-success text-xs font-bold uppercase">This Shift</div>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#121212] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden opacity-60 animate-[fadeIn_0.8s_ease-out]">
          <div className="absolute inset-0 flex items-center justify-center z-10"><span className="bg-black/80 text-primary border border-primary px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase rotate-[-15deg] backdrop-blur-sm">Coming Soon</span></div>
          <div className="absolute top-0 right-0 p-4 opacity-5 text-5xl">🛢️</div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Empty Silos</h3>
          <div className="text-5xl font-black text-gray-600 mb-1">--<span className="text-2xl text-gray-700">/{config?.machines?.length || 30}</span></div>
          <div className="text-gray-600 text-xs font-bold uppercase">Total Machines</div>
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#121212] border border-[#333] p-6 rounded-2xl shadow-lg relative overflow-hidden opacity-60 animate-[fadeIn_0.9s_ease-out]">
          <div className="absolute inset-0 flex items-center justify-center z-10"><span className="bg-black/80 text-primary border border-primary px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase rotate-[-15deg] backdrop-blur-sm">Coming Soon</span></div>
          <div className="absolute top-0 right-0 p-4 opacity-5 text-5xl">🛑</div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Stopped Issues</h3>
          <div className="text-5xl font-black text-gray-600 mb-1">--<span className="text-2xl text-gray-700">/{config?.machines?.length || 30}</span></div>
          <div className="text-gray-600 text-xs font-bold uppercase">Total Machines</div>
        </div>
      </div>

      <h3 className="text-primary font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2 animate-[fadeIn_1s_ease-out]">🚀 Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-[fadeIn_1.1s_ease-out]">
        {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager', 'prod_staff', 'prod_manager'].includes(r))) && (
          <Link to="/powder-density" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
            <div className="text-3xl group-hover:scale-110 transition-transform">📝</div>
            <div><div className="text-white font-bold text-lg">Powder Density Tests</div><div className="text-gray-400 text-sm">Enter QC data for Level 9 & BOT</div></div>
          </Link>
        )}

        {(systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager'].includes(r))) && (
          <>
            <Link to="/level9-exec" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">🏭</div>
              <div><div className="text-white font-bold text-lg">Level 9 Dashboard</div><div className="text-gray-400 text-sm">Live views & shift approvals</div></div>
            </Link>

            <Link to="/reports" className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl flex items-center gap-4 hover:border-primary hover:bg-[#222] transition-all group">
              <div className="text-3xl group-hover:scale-110 transition-transform">📊</div>
              <div><div className="text-white font-bold text-lg">QC Reports</div><div className="text-gray-400 text-sm">Generate & export PDF/CSV</div></div>
            </Link>
          </>
        )}
      </div>

    </Layout>
  );
}