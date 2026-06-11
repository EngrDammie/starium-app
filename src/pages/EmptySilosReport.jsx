import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToActiveEmptySilos, subscribeToShiftEmptySilos } from '../services/emptySiloOperations';

function timeAgo(date) {
  if (!date) return 'Unknown';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remainMins}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

export default function EmptySilosReport() {
  const { config, loadingConfig } = useConfig();
  const { systemRole, departmentRoles } = useAuth();

  const [emptyRecords, setEmptyRecords] = useState([]);
  const [refilledCount, setRefilledCount] = useState(0);
  const [currentShift, setCurrentShift] = useState('--');
  const [modalRecord, setModalRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canView = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager', 'packaging_manager'].includes(r));

  useEffect(() => {
    if (loadingConfig) return;
    const currentHour = new Date().getHours();
    setCurrentShift((currentHour >= config.dayShiftStart && currentHour < config.nightShiftStart) ? 'DAY' : 'NIGHT');
  }, [config, loadingConfig]);

  useEffect(() => {
    if (loadingConfig || !canView) return;
    const unsubActive = subscribeToActiveEmptySilos((records) => {
      setEmptyRecords(records);
    });

    const unsubShift = subscribeToShiftEmptySilos(config, (records) => {
      setRefilledCount(records.filter(r => r.noLongerEmptyAt).length);
    });

    return () => { unsubActive(); unsubShift(); };
  }, [canView, config]);

  const currentlyEmpty = emptyRecords.filter(r => !r.noLongerEmptyAt);
  const totalMachines = config?.machines?.length || 0;
  const emptyCount = currentlyEmpty.length;
  const emptyPercent = totalMachines > 0 ? ((emptyCount / totalMachines) * 100).toFixed(1) : '0.0';

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  const getEmptyRecordForMachine = (machineId) => {
    return currentlyEmpty.find(r => r.machineId === machineId);
  };

  const getFullRecordForMachine = (machineId) => {
    return emptyRecords.find(r => r.machineId === machineId && r.noLongerEmptyAt);
  };

  const handleMachineClick = (machine) => {
    const empty = getEmptyRecordForMachine(machine.id);
    if (empty) {
      setModalRecord(empty);
      setIsModalOpen(true);
    }
  };

  if (!canView) {
    return (
      <Layout title="Empty Silos Report" subtitle="Real-time empty status overview" maxWidth="max-w-6xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
          <p className="text-sm">You do not have permission to view this report.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Empty Silos Report" subtitle={`Real-time overview • ${currentShift} Shift`} maxWidth="max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Empty Machines</h3>
          <div className="text-5xl font-black text-white mb-1">{emptyCount}<span className="text-2xl text-gray-500">/{totalMachines}</span></div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Machines</div>
        </div>

        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Empty Percentage</h3>
          <div className={`text-5xl font-black mb-1 ${parseFloat(emptyPercent) > 20 ? 'text-status-danger' : parseFloat(emptyPercent) > 10 ? 'text-status-warning' : 'text-status-success'}`}>{emptyPercent}%</div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">of all machines</div>
        </div>

        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Refilled This Shift</h3>
          <div className="text-5xl font-black text-white mb-1">{refilledCount}</div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Machines restored</div>
        </div>
      </div>

      <div className="bg-dark-card p-6 md:p-8 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.5s_ease-out_0.2s_both]">
        <div className="flex items-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-status-success"></span>
            <span className="text-gray-400">Filled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-status-danger"></span>
            <span className="text-gray-400">Empty — click for details</span>
          </div>
        </div>

        <div className="flex gap-2 md:gap-3 max-w-4xl mx-auto justify-between mt-4">
          {lines.map(lineObj => {
            const lineMachines = (config.machines || [])
              .filter(m => m.line === lineObj.id)
              .sort((a, b) => (a.displayNumber || a.id) - (b.displayNumber || b.id));

            if (lineMachines.length === 0) return null;

            return (
              <div key={lineObj.id} className="flex flex-col gap-2 md:gap-3 flex-1">
                {lineMachines.map(m => {
                  const isEmpty = !!getEmptyRecordForMachine(m.id);

                  let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all relative ";
                  if (isEmpty) {
                    btnClass += "bg-gradient-to-br from-status-danger to-[#D50000] text-white border-2 border-status-danger shadow-[0_0_10px_rgba(244,67,54,0.4)] cursor-pointer hover:scale-105";
                  } else {
                    btnClass += "bg-gradient-to-br from-status-success to-[#00C853] text-black border-2 border-status-success shadow-[0_0_10px_rgba(0,230,118,0.3)] cursor-default";
                  }

                  return (
                    <button
                      key={m.id}
                      onClick={() => handleMachineClick(m)}
                      className={btnClass}
                    >
                      M{m.displayNumber || m.id}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && modalRecord && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-8 rounded-2xl border-2 border-status-danger shadow-[0_20px_60px_rgba(244,67,54,0.3)] max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
            <h2 className="text-status-danger text-2xl font-bold mb-5 text-center">
              🛢️ Machine M{modalRecord.machineDisplayNumber || modalRecord.machineId}
            </h2>

            <div className="flex flex-col gap-3 text-sm mb-6">
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Line:</span>
                <span className="text-white font-bold">{modalRecord.line}</span>
              </div>
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Gram Setting:</span>
                <span className="text-white font-bold">{modalRecord.gram}g</span>
              </div>
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Marked Empty By:</span>
                <span className="text-status-danger font-bold">{modalRecord.markedEmptyBy}</span>
              </div>
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Empty Duration:</span>
                <span className="text-status-warning font-bold">{timeAgo(modalRecord.markedEmptyAt?.toDate ? modalRecord.markedEmptyAt.toDate() : new Date())}</span>
              </div>
              <div className="flex justify-between border-b border-[#sss] pb-2">
                <span className="text-gray-400">Buggy Number:</span>
                <span className="text-white font-bold">{modalRecord.buggyNumber || 'Not yet refilled'}</span>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-status-success transition-transform hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
