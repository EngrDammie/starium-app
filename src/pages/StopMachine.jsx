import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { subscribeToActiveStoppedMachines, subscribeToMachineIssues, reportStoppedMachine, markIssueSolved, startMachine, addMachineIssue, appendIssuesToMachine } from '../services/stoppedMachineOperations';

const toTitleCase = str => str.replace(/\b\w/g, c => c.toUpperCase());

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

const COLORS = {
  normal: '#00C853',
  stopped: '#8B0000',
  'started-with-issues': null,
  'issues-cleared': '#FF6B6B',
};

export default function StopMachine() {
  const { config, loadingConfig } = useConfig();
  const { systemRole, departmentRoles, userFullName } = useAuth();
  const [stoppedRecords, setStoppedRecords] = useState([]);
  const [machineIssues, setMachineIssues] = useState([]);
  const [modalMachine, setModalMachine] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState([]);
  const [newIssueText, setNewIssueText] = useState('');
  const [sparkle, setSparkle] = useState(false);

  const canReport = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r));

  useEffect(() => {
    if (!canReport) return;
    const unsubRecords = subscribeToActiveStoppedMachines((records) => {
      setStoppedRecords(records);
    });
    const unsubIssues = subscribeToMachineIssues((issues) => {
      setMachineIssues(issues);
    });
    return () => { unsubRecords(); unsubIssues(); };
  }, [canReport]);

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  const handleMachineClick = (machine) => {
    setModalMachine(machine);
    setIsModalOpen(true);
  };

  const machineStatus = modalMachine ? getMachineStatus(modalMachine.id, stoppedRecords) : null;
  const currentRecord = machineStatus?.record;
  const unsolvedLabels = new Set(
    (currentRecord?.issues || [])
      .filter(i => !i.solvedAt)
      .map(i => i.label.toLowerCase())
  );
  const availableIssues = machineIssues.filter(i => !unsolvedLabels.has(i.label.toLowerCase()));

  const handleReportIssues = () => {
    setSelectedIssueIds([]);
    setNewIssueText('');
    setIsReportModalOpen(true);
  };

  const handleSubmitIssues = async () => {
    if (selectedIssueIds.length === 0 && !newIssueText.trim()) return;
    const issues = [];
    for (const id of selectedIssueIds) {
      if (id.startsWith('__new__')) {
        const label = toTitleCase(id.replace('__new__', ''));
        const result = await addMachineIssue(label, userFullName);
        if (result) issues.push({ id: result.id, label: result.label });
      } else {
        const match = machineIssues.find(i => i.id === id);
        if (match) issues.push({ id: match.id, label: match.label });
      }
    }
    if (issues.length === 0) return;
    let result;
    if (currentRecord) {
      result = await appendIssuesToMachine(currentRecord.id, issues, userFullName);
    } else {
      result = await reportStoppedMachine(modalMachine, issues, userFullName);
    }
    if (result === 'saved') {
      setIsReportModalOpen(false);
      setIsModalOpen(false);
    } else {
      alert('Failed to save issues. Please try again.');
    }
  };

  const handleIssueSolved = async (issueId) => {
    if (!currentRecord) return;
    if (!window.confirm('Confirm this issue has been solved?')) return;
    const result = await markIssueSolved(currentRecord.id, issueId, userFullName);
    if (result === 'all-solved') {
      setSparkle(true);
      setTimeout(() => setSparkle(false), 2000);
    }
  };

  const handleStartMachine = async () => {
    if (!currentRecord) return;
    const result = await startMachine(currentRecord.id, userFullName);
    if (result === 'running' || result === 'started-with-issues') {
      setIsModalOpen(false);
    }
  };

  if (!canReport) {
    return (
      <Layout title="Report Stopped Machines" subtitle="Report machine issues" maxWidth="max-w-6xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Report Stopped Machines" subtitle="Click a machine to report or resolve issues" maxWidth="max-w-6xl">
      <style>{`
        @keyframes cycleStopped {
          0%, 100% { background: #8B0000; border-color: #8B0000; }
          50% { background: #2E7D32; border-color: #66BB6A; }
        }
        @keyframes sparkle {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(1.5); }
        }
        .animate-cycle {
          animation: cycleStopped 2s ease-in-out infinite;
        }
        .animate-sparkle {
          animation: sparkle 0.6s ease-out;
        }
      `}</style>

      <div className="bg-dark-card p-6 md:p-8 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center gap-6 mb-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: COLORS.normal }}></span>
            <span className="text-gray-400">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: COLORS.stopped }}></span>
            <span className="text-gray-400">Stopped</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded animate-cycle"></span>
            <span className="text-gray-400">Started with issues</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded" style={{ background: COLORS['issues-cleared'] }}></span>
            <span className="text-gray-400">Issues cleared</span>
          </div>
          <div className="text-gray-500 ml-auto">
            <span className="text-status-danger font-bold">{stoppedRecords.filter(r => !r.startedAt).length}</span>
            <span className="text-gray-600"> stopped</span>
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
                  const status = getMachineStatus(m.id, stoppedRecords);
                  const isActive = status.type !== 'normal';

                  let style = {};
                  let className = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer relative border-2 ";

                  if (status.type === 'normal') {
                    style = { background: 'linear-gradient(to bottom right, #00E676, #00C853)', borderColor: COLORS.normal, color: 'black' };
                    className += 'shadow-[0_0_10px_rgba(0,230,118,0.3)] hover:scale-105';
                  } else if (status.type === 'stopped') {
                    style = { background: '#8B0000', borderColor: COLORS.stopped, color: 'white' };
                    className += 'shadow-[0_0_10px_rgba(139,0,0,0.4)] hover:scale-105';
                  } else if (status.type === 'started-with-issues') {
                    className += 'animate-cycle shadow-[0_0_10px_rgba(139,0,0,0.4)] hover:scale-105';
                  } else if (status.type === 'issues-cleared') {
                    style = { background: COLORS['issues-cleared'], borderColor: COLORS['issues-cleared'], color: 'black' };
                    className += 'shadow-[0_0_10px_rgba(255,107,107,0.4)] hover:scale-105';
                  }

                  return (
                    <button
                      key={m.id}
                      onClick={() => handleMachineClick(m)}
                      className={className}
                      style={style}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]" onClick={() => { setIsModalOpen(false); setSparkle(false); }}>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] rounded-2xl border-2 border-primary shadow-[0_20px_60px_rgba(0,188,212,0.3)] max-w-sm w-[90%] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {sparkle && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-6xl animate-sparkle">✨</div>
              </div>
            )}

            <div className="p-8 pb-0">
              <h2 className="text-primary text-2xl font-bold mb-1 text-center">Machine M{modalMachine.displayNumber || modalMachine.id}</h2>
              {currentRecord && (
                <p className="text-center text-gray-500 text-xs mb-4">
                  Reported by {currentRecord.stoppedBy}
                </p>
              )}

              <div className="flex flex-col gap-3 text-sm mb-6">
                <div className="flex justify-between border-b border-[#333] pb-2">
                  <span className="text-gray-400">Line:</span>
                  <span className="text-white font-bold">{modalMachine.line}</span>
                </div>
                <div className="flex justify-between border-b border-[#333] pb-2">
                  <span className="text-gray-400">Gram Setting:</span>
                  <span className="text-white font-bold">{modalMachine.gram}g</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-8">

            {currentRecord ? (
              <>
                <div className="mb-4">
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Issues</h3>
                  {currentRecord.issues?.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {currentRecord.issues.map((issue, idx) => {
                        const solved = !!issue.solvedAt;
                        return (
                          <div key={`${issue.id}-${idx}`} className={`flex items-center justify-between p-3 rounded-lg border ${solved ? 'border-status-success/30 bg-status-success/10' : 'border-status-danger/30 bg-status-danger/10'}`}>
                            <span className={`text-sm font-medium ${solved ? 'text-status-success line-through' : 'text-white'}`}>
                              {issue.label}
                            </span>
                            {!solved && (
                              <button
                                onClick={() => handleIssueSolved(issue.id)}
                                className="text-xs bg-status-success text-black font-bold px-3 py-1 rounded-md hover:bg-[#00C853] transition-all"
                              >
                                ✓ Solved ❓
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No issues reported.</p>
                  )}
                </div>

              </>
            ) : null}

            </div>

            <div className="px-8 pb-8 pt-4">
              {currentRecord ? (
                <>
                  {!currentRecord.startedAt && (
                    <button
                      onClick={handleStartMachine}
                      className="w-full py-3 mb-3 bg-status-success text-black font-bold rounded-lg hover:bg-[#00C853] transition-transform hover:scale-105"
                    >
                      ▶️ Start Machine
                    </button>
                  )}
                  <button
                    onClick={handleReportIssues}
                    className="w-full py-3 mb-3 bg-status-warning text-black font-bold rounded-lg hover:bg-yellow-400 transition-transform hover:scale-105"
                  >
                    ➕ Report More Issues
                  </button>
                </>
              ) : (
                <button
                  onClick={handleReportIssues}
                  className="w-full py-4 mb-4 bg-status-danger text-white font-bold text-lg rounded-xl hover:bg-[#E53935] transition-transform hover:scale-105"
                >
                  🛑 Report Machine Stopped
                </button>
              )}

              <button onClick={() => { setIsModalOpen(false); setSparkle(false); }} className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-status-success transition-transform hover:scale-105">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-[fadeIn_0.3s_ease]" onClick={() => setIsReportModalOpen(false)}>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] rounded-2xl border-2 border-status-danger shadow-[0_20px_60px_rgba(244,67,54,0.3)] max-w-md w-[90%] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-8 pb-0">
              <h2 className="text-status-danger text-xl font-bold mb-5 text-center">Report Machine Stopped</h2>

              <p className="text-gray-400 text-sm mb-4 text-center">
                Machine M{modalMachine.displayNumber || modalMachine.id} — {modalMachine.gram}g
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-8">
              <div className="mb-4">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Select Issues</h3>
                <div className="flex flex-wrap gap-2 overflow-y-auto custom-scrollbar p-2 border border-[#333] rounded-lg">
                  {availableIssues.length === 0 && selectedIssueIds.length === 0 ? (
                    <p className="text-gray-500 text-sm p-2">No existing issues. Add one below.</p>
                  ) : (
                    <>
                      {availableIssues.map(issue => {
                        const selected = selectedIssueIds.includes(issue.id);
                        return (
                          <button
                            key={issue.id}
                            onClick={() => setSelectedIssueIds(prev => selected ? prev.filter(id => id !== issue.id) : [...prev, issue.id])}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selected ? 'bg-status-danger text-white border-status-danger' : 'bg-[#2d2d2d] text-gray-300 border-[#555] hover:border-primary'}`}
                          >
                            {selected ? '✓ ' : ''}{issue.label}
                          </button>
                        );
                      })}
                      {selectedIssueIds.filter(id => id.startsWith('__new__')).map(id => (
                        <div
                          key={id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-status-danger text-white border border-status-danger"
                        >
                          ✓ {toTitleCase(id.replace('__new__', ''))}
                          <button
                            onClick={() => setSelectedIssueIds(prev => prev.filter(i => i !== id))}
                            className="ml-0.5 text-white/70 hover:text-white text-base leading-none"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Add New Issue</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIssueText}
                    onChange={e => setNewIssueText(e.target.value)}
                    placeholder="e.g. Motor failure"
                    className="flex-1 bg-[#2d2d2d] text-white border border-[#555] rounded-lg px-3 py-2 outline-none focus:border-primary text-sm"
                  />
                  <button
                    onClick={() => {
                      if (newIssueText.trim()) {
                        setSelectedIssueIds(prev => [...prev, `__new__${newIssueText.trim()}`]);
                        setNewIssueText('');
                      }
                    }}
                    disabled={newIssueText.trim() && unsolvedLabels.has(toTitleCase(newIssueText.trim()).toLowerCase())}
                    className="bg-primary text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-primary-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Add
                  </button>
                </div>
                {newIssueText.trim() && unsolvedLabels.has(toTitleCase(newIssueText.trim()).toLowerCase()) ? (
                  <p className="text-status-danger text-xs mt-1">This issue is already on this machine.</p>
                ) : newIssueText.trim() && !selectedIssueIds.includes(`__new__${newIssueText.trim()}`) && (
                  <p className="text-gray-500 text-xs mt-1">Click + Add to include this issue.</p>
                )}
              </div>
            </div>

            <div className="px-8 pb-8 pt-4">
              <button
                onClick={handleSubmitIssues}
                disabled={selectedIssueIds.length === 0 && !newIssueText.trim()}
                className="w-full py-3 mb-3 bg-status-danger text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E53935] transition-transform hover:scale-105"
              >
                🛑 Report & Save
              </button>

              <button
                onClick={() => setIsReportModalOpen(false)}
                className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-status-success transition-transform hover:scale-105"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
