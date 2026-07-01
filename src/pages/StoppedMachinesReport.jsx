import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToActiveStoppedMachines } from '../services/stoppedMachineOperations';

function getMachineStatus(machineId, records) {
  const record = records.find(r => r.machineId === machineId);
  if (!record) return { type: 'normal' };
  const hasUnresolved = record.issues?.some(i => !i.solvedAt);
  const allSolved = record.issues?.length > 0 && record.issues?.every(i => i.solvedAt);
  const isStarted = !!record.startedAt;
  if (isStarted && !hasUnresolved) return { type: 'running', record };
  if (isStarted && hasUnresolved) return { type: 'started-with-issues', record };
  if (!isStarted && allSolved) return { type: 'issues-cleared', record };
  return { type: 'stopped', record };
}

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

function formatFullDateTime(date) {
  if (!date) return 'Unknown';
  return date.toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });
}

export default function StoppedMachinesReport() {
  const { config, loadingConfig } = useConfig();
  const { systemRole, departmentRoles } = useAuth();
  const [records, setRecords] = useState([]);
  const [modalRecord, setModalRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedDateField, setExpandedDateField] = useState(null);

  const canView = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager', 'packaging_manager'].includes(r));

  useEffect(() => {
    if (!canView) return;
    const unsub = subscribeToActiveStoppedMachines((r) => setRecords(r));
    return () => unsub();
  }, [canView]);

  const stoppedCount = records.filter(r => !r.startedAt && r.issues?.some(i => !i.solvedAt)).length;
  const startedWithIssuesCount = records.filter(r => r.startedAt && r.issues?.some(i => !i.solvedAt)).length;
  const issuesClearedCount = records.filter(r => !r.startedAt && r.issues?.length > 0 && r.issues?.every(i => i.solvedAt)).length;

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  const handleMachineClick = (machine) => {
    const status = getMachineStatus(machine.id, records);
    if (status.type !== 'normal') {
      setModalRecord(status.record);
      setIsModalOpen(true);
      setExpandedDateField(null);
    }
  };

  if (!canView) {
    return (
      <Layout title="Stopped Machines Report" subtitle="Real-time stopped status overview" maxWidth="max-w-6xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Stopped Machines Report" subtitle="Real-time overview of machine issues" maxWidth="max-w-6xl">
      <style>{`
        @keyframes cycleStopped {
          0%, 100% { background: #8B0000; border-color: #8B0000; }
          50% { background: #2E7D32; border-color: #66BB6A; }
        }
        .animate-cycle {
          animation: cycleStopped 2s ease-in-out infinite;
        }
      `}</style>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-[fadeIn_0.3s_ease-out]">
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">🛑 Stopped</h3>
          <div className="text-5xl font-black text-status-danger mb-1">{stoppedCount}</div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Machines with issues</div>
        </div>

        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">⚠️ Started with Issues</h3>
          <div className="text-5xl font-black text-status-warning mb-1">{startedWithIssuesCount}</div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Running but unresolved</div>
        </div>

        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">✅ Issues Cleared</h3>
          <div className="text-5xl font-black text-white mb-1">{issuesClearedCount}</div>
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">Ready to start</div>
        </div>
      </div>

      <div className="bg-dark-card p-6 md:p-8 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.5s_ease-out_0.2s_both]">
        <div className="flex items-center gap-6 mb-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: '#00C853' }}></span>
            <span className="text-gray-400">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: '#8B0000' }}></span>
            <span className="text-gray-400">Stopped</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded animate-cycle"></span>
            <span className="text-gray-400">Started w/ issues</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: '#FF6B6B' }}></span>
            <span className="text-gray-400">Issues cleared</span>
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
                  const status = getMachineStatus(m.id, records);

                  let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all relative border-2 ";
                  let style = {};

                  if (status.type === 'normal') {
                    style = { background: 'linear-gradient(to bottom right, #00E676, #00C853)', borderColor: '#00C853', color: 'black' };
                    btnClass += 'cursor-default shadow-[0_0_10px_rgba(0,230,118,0.3)]';
                  } else if (status.type === 'stopped') {
                    style = { background: '#8B0000', borderColor: '#8B0000', color: 'white' };
                    btnClass += 'cursor-pointer hover:scale-105 shadow-[0_0_10px_rgba(139,0,0,0.4)]';
                  } else if (status.type === 'started-with-issues') {
                    btnClass += 'cursor-pointer animate-cycle hover:scale-105 shadow-[0_0_10px_rgba(139,0,0,0.4)]';
                  } else if (status.type === 'issues-cleared') {
                    style = { background: '#FF6B6B', borderColor: '#FF6B6B', color: 'black' };
                    btnClass += 'cursor-pointer hover:scale-105 shadow-[0_0_10px_rgba(255,107,107,0.4)]';
                  } else {
                    style = { background: '#00E676', borderColor: '#00C853', color: 'black' };
                    btnClass += 'cursor-default';
                  }

                  return (
                    <button key={m.id} onClick={() => handleMachineClick(m)} className={btnClass} style={style}>
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
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] rounded-2xl max-w-sm w-[90%] max-h-[85vh] flex flex-col" style={{ borderColor: '#8B0000', borderWidth: 2 }} onClick={e => e.stopPropagation()}>
            <div className="p-8 pb-0">
              <h2 className="text-2xl font-bold mb-5 text-center" style={{ color: '#8B0000' }}>
                🛑 Machine M{modalRecord.machineDisplayNumber || modalRecord.machineId}
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
                  <span className="text-gray-400">Reported By:</span>
                  <span className="text-white font-bold">{modalRecord.stoppedBy}</span>
                </div>
                <div className="flex justify-between border-b border-[#333] pb-2">
                  <span className="text-gray-400">Stopped:</span>
                  <span
                    className="text-white font-bold cursor-pointer select-none"
                    onClick={() => setExpandedDateField(expandedDateField === 'stopped' ? null : 'stopped')}
                    title={expandedDateField !== 'stopped' ? formatFullDateTime(modalRecord.stoppedAt?.toDate ? modalRecord.stoppedAt.toDate() : null) : ''}
                  >
                    {expandedDateField === 'stopped'
                      ? formatFullDateTime(modalRecord.stoppedAt?.toDate ? modalRecord.stoppedAt.toDate() : null)
                      : timeAgo(modalRecord.stoppedAt?.toDate ? modalRecord.stoppedAt.toDate() : null)
                    }
                  </span>
                </div>
                {modalRecord.startedAt && (
                  <div className="flex justify-between border-b border-[#333] pb-2">
                    <span className="text-gray-400">Started:</span>
                    <span
                      className="text-white font-bold cursor-pointer select-none"
                      onClick={() => setExpandedDateField(expandedDateField === 'started' ? null : 'started')}
                      title={expandedDateField !== 'started' ? formatFullDateTime(modalRecord.startedAt?.toDate ? modalRecord.startedAt.toDate() : null) : ''}
                    >
                      {expandedDateField === 'started'
                        ? formatFullDateTime(modalRecord.startedAt?.toDate ? modalRecord.startedAt.toDate() : null)
                        : timeAgo(modalRecord.startedAt?.toDate ? modalRecord.startedAt.toDate() : null)
                      }
                    </span>
                  </div>
                )}
                {modalRecord.startedBy && (
                  <div className="flex justify-between border-b border-[#333] pb-2">
                    <span className="text-gray-400">Started By:</span>
                    <span className="text-white font-bold">{modalRecord.startedBy}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-8">
              <div className="mb-4">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Issues</h3>
                {modalRecord.issues?.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {modalRecord.issues.map((issue, idx) => (
                      <div key={`${issue.id}-${idx}`} className={`flex items-center justify-between p-3 rounded-lg border ${issue.solvedAt ? 'border-status-success/30 bg-status-success/10' : 'border-status-danger/30 bg-status-danger/10'}`}>
                        <span className={`text-sm font-medium ${issue.solvedAt ? 'text-status-success line-through' : 'text-white'}`}>
                          {issue.label}
                        </span>
                        {issue.solvedAt && (
                          <span className="text-xs text-status-success font-bold">✓ Solved</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No issues recorded.</p>
                )}
              </div>
            </div>

            <div className="px-8 pb-8 pt-4">
              <button onClick={() => setIsModalOpen(false)} className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-status-success transition-transform hover:scale-105">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
