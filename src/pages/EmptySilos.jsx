import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { subscribeToActiveEmptySilos, markMachineEmpty } from '../services/emptySiloOperations';

export default function EmptySilos() {
  const { config, loadingConfig } = useConfig();
  const { systemRole, departmentRoles, userFullName } = useAuth();
  const { broadcastAlert } = useAlerts();

  const [emptyRecords, setEmptyRecords] = useState([]);
  const [currentShift, setCurrentShift] = useState('--');
  const [modalMachine, setModalMachine] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canMark = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r));

  useEffect(() => {
    if (loadingConfig) return;
    const currentHour = new Date().getHours();
    setCurrentShift((currentHour >= config.dayShiftStart && currentHour < config.nightShiftStart) ? 'DAY' : 'NIGHT');
  }, [config, loadingConfig]);

  useEffect(() => {
    if (loadingConfig || !canMark) return;
    const unsub = subscribeToActiveEmptySilos((records) => {
      setEmptyRecords(records);
    });
    return () => unsub();
  }, [canMark]);

  const getEmptyRecordForMachine = (machineId) => {
    return emptyRecords.find(r => r.machineId === machineId && !r.noLongerEmptyAt);
  };

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  const handleMachineClick = (machine) => {
    setModalMachine(machine);
    setIsModalOpen(true);
  };

  const handleMarkEmpty = async () => {
    if (!modalMachine) return;
    const result = await markMachineEmpty(modalMachine, userFullName, config, broadcastAlert);
    if (result === 'saved') {
      setIsModalOpen(false);
      setModalMachine(null);
    }
  };

  if (!canMark) {
    return (
      <Layout title="Report Empty Silos" subtitle="Mark machines as empty" maxWidth="max-w-5xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
          <p className="text-sm">You do not have permission to mark machines as empty.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Report Empty Silos" subtitle={`Click a machine to mark it empty • ${currentShift} Shift`} maxWidth="max-w-6xl">
      <div className="bg-dark-card p-6 md:p-8 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-status-success"></span>
            <span className="text-gray-400">Filled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-status-danger"></span>
            <span className="text-gray-400">Empty</span>
          </div>
          <div className="text-gray-500 ml-auto">
            <span className="text-status-danger font-bold">{emptyRecords.filter(r => !r.noLongerEmptyAt).length}</span>
            <span className="text-gray-600"> / {config?.machines?.length || 0} empty</span>
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
                  const emptyRecord = getEmptyRecordForMachine(m.id);
                  const isEmpty = !!emptyRecord;

                  let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer relative ";
                  if (isEmpty) {
                    btnClass += "bg-gradient-to-br from-status-danger to-[#D50000] text-white border-2 border-status-danger shadow-[0_0_10px_rgba(244,67,54,0.4)] hover:scale-105";
                  } else {
                    btnClass += "bg-gradient-to-br from-status-success to-[#00C853] text-black border-2 border-status-success shadow-[0_0_10px_rgba(0,230,118,0.3)] hover:scale-105";
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

      {isModalOpen && modalMachine && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]" onClick={() => setIsModalOpen(false)}>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-8 rounded-2xl border-2 border-primary shadow-[0_20px_60px_rgba(0,188,212,0.3)] max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-2xl font-bold mb-5 text-center">Machine Details</h2>

            <div className="flex flex-col gap-3 text-sm mb-6">
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Machine ID:</span>
                <span className="text-primary font-bold">M{modalMachine.displayNumber || modalMachine.id}</span>
              </div>
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Line:</span>
                <span className="text-primary font-bold">{modalMachine.line}</span>
              </div>
              <div className="flex justify-between border-b border-[#333] pb-2">
                <span className="text-gray-400">Gram Setting:</span>
                <span className="text-primary font-bold">{modalMachine.gram}g</span>
              </div>
            </div>

            {getEmptyRecordForMachine(modalMachine.id) ? (
              <div className="p-4 bg-status-danger/10 border border-status-danger rounded-xl mb-4 text-center">
                <div className="text-status-danger font-bold text-lg">Already Marked Empty</div>
                <div className="text-gray-400 text-sm mt-1">
                  by {getEmptyRecordForMachine(modalMachine.id).markedEmptyBy}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure Machine M${modalMachine.displayNumber || modalMachine.id} (${modalMachine.gram}g) is empty?`)) {
                    handleMarkEmpty();
                  }
                }}
                className="w-full py-4 mb-4 bg-status-danger text-white font-bold text-lg rounded-xl hover:bg-[#E53935] transition-transform hover:scale-105 shadow-[0_4px_15px_rgba(244,67,54,0.4)]"
              >
                🛢️ Mark as Empty
              </button>
            )}

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
