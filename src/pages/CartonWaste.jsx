import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { useNetwork } from '../context/NetworkContext';
import {
  getOrCreateCartonWasteShift,
  getPreviousCheck,
  saveCartonCheck,
  subscribeToShiftCartonRecords,
  getCartonWasteDocId
} from '../services/cartonOperations';

export default function CartonWaste() {
  const { config, loadingConfig } = useConfig();
  const { currentUser, userFullName } = useAuth();
  const { broadcastAlert } = useAlerts();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(() => {
    return localStorage.getItem('starium_carton_team') || config?.cartonWaste?.defaultTeam || '';
  });
  const [shiftInfo, setShiftInfo] = useState({ shift: '--', date: '--' });

  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previousCheck, setPreviousCheck] = useState(null);
  const [loadingPrev, setLoadingPrev] = useState(false);

  const [allocated, setAllocated] = useState('');
  const [remaining, setRemaining] = useState('');
  const [wasted, setWasted] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingConfig) return;
    const currentHour = new Date().getHours();
    const isDay = currentHour >= config.dayShiftStart && currentHour < config.nightShiftStart;
    const now = new Date();
    setShiftInfo({
      shift: isDay ? 'DAY' : 'NIGHT',
      date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
    });
  }, [config, loadingConfig]);

  useEffect(() => {
    if (loadingConfig) return;
    const unsub = subscribeToShiftCartonRecords(config, (data) => {
      setRecords(data);
      setLoading(false);
    });
    return () => unsub();
  }, [config, loadingConfig]);

  const getMachineLatestCheck = useCallback((machineId) => {
    const machineRecords = records.filter(r => r.machineId === machineId);
    if (machineRecords.length === 0) return null;
    return machineRecords.reduce((latest, r) =>
      r.roundNumber > latest.roundNumber ? r : latest
    );
  }, [records]);

  const getMachineStatus = useCallback((machineId) => {
    const latest = getMachineLatestCheck(machineId);
    if (!latest) return 'unchecked';
    const threshold = config?.cartonWaste?.targetWastePercent ?? 5;
    if (latest.runningWastePercent > threshold) return 'high-waste';
    return 'checked';
  }, [getMachineLatestCheck, config]);

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  const handleMachineClick = async (machine) => {
    setSelectedMachine(machine);
    setAllocated('');
    setRemaining('');
    setWasted('');
    setRemarks('');
    setError('');
    setIsModalOpen(true);
    setLoadingPrev(true);
    setPreviousCheck(null);

    try {
      const docId = getCartonWasteDocId(config);
      const prev = await getPreviousCheck(machine.id, docId);
      setPreviousCheck(prev);
    } catch (e) {
      console.error("Error fetching previous check:", e);
    }
    setLoadingPrev(false);
  };

  const handleSave = async (nextMachine = false) => {
    if (!team) {
      setError('Select your team');
      return;
    }

    const allocNum = Number(allocated);
    const remainNum = Number(remaining);
    const wasteNum = Number(wasted);

    if (isNaN(allocNum) || allocNum < 0) {
      setError('Enter valid allocated cartons');
      return;
    }
    if (isNaN(remainNum) || remainNum < 0) {
      setError('Enter valid remaining cartons');
      return;
    }
    if (isNaN(wasteNum) || wasteNum < 0) {
      setError('Enter valid wasted cartons');
      return;
    }

    setSaving(true);
    setError('');

    const result = await saveCartonCheck({
      machineId: selectedMachine.id,
      machineDisplayNumber: selectedMachine.displayNumber || selectedMachine.id,
      machineName: selectedMachine.name || '',
      line: selectedMachine.line || '',
      gram: selectedMachine.gram || 0,
      allocated: allocNum,
      remaining: remainNum,
      wasted: wasteNum,
      team,
      checkedBy: userFullName || currentUser?.email || 'Unknown',
      remarks,
      previousCheck
    }, config, isOnline);

    if (result.status === 'error') {
      setError(result.message);
      setSaving(false);
      return;
    }

    setSaving(false);

    if (result.status === 'offline-queued') {
      broadcastAlert(`Carton check saved offline for M${selectedMachine.displayNumber || selectedMachine.id}`, 'info', undefined, ['/', '/carton-waste', '/carton-waste-report']);
    }

    const wastePct = result.status === 'saved' || result.status === 'offline-queued'
      ? (() => {
          const prevRemain = previousCheck?.remaining ?? 0;
          const u = prevRemain + allocNum - remainNum;
          const tp = u + wasteNum;
          return tp > 0 ? (wasteNum / tp) * 100 : 0;
        })()
      : 0;

    if (wastePct > (config?.cartonWaste?.wasteAlertThreshold ?? 10)) {
      broadcastAlert(
        `⚠️ High carton waste on M${selectedMachine.displayNumber || selectedMachine.id}: ${Math.round(wastePct * 100) / 100}% (by ${userFullName || currentUser?.email})`,
        'warning',
        undefined,
        ['/', '/carton-waste', '/carton-waste-report']
      );
    }

    if (nextMachine) {
      const sorted = [...(config.machines || [])].sort((a, b) => (a.displayNumber || a.id) - (b.displayNumber || b.id));
      const currentIdx = sorted.findIndex(m => m.id === selectedMachine.id);
      const next = sorted[currentIdx + 1];
      if (next) {
        setIsModalOpen(false);
        setTimeout(() => handleMachineClick(next), 500);
        return;
      }
    }

    setIsModalOpen(false);
    setSelectedMachine(null);
  };

  const uncheckedCount = (config.machines || []).filter(m => getMachineStatus(m.id) === 'unchecked').length;

  if (loadingConfig || loading) {
    return (
      <Layout title="Carton Waste Tracking" subtitle="Loading..." maxWidth="max-w-6xl">
        <div className="text-center text-white mt-10 animate-pulse">Loading Carton Waste Tracking...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Carton Waste Tracking" subtitle={`${shiftInfo.shift} · ${shiftInfo.date}`} maxWidth="max-w-6xl">
      <div className="bg-dark-card p-6 md:p-8 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.5s_ease-out]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Shift:</span>
              <span className={`font-bold ${shiftInfo.shift === 'DAY' ? 'text-status-warning' : 'text-primary'}`}>{shiftInfo.shift}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Date:</span>
              <span className="font-bold text-white">{shiftInfo.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">User:</span>
              <span className="font-bold text-primary">{userFullName || currentUser?.email || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Team:</span>
              <select
                value={team}
                onChange={e => { setTeam(e.target.value); localStorage.setItem('starium_carton_team', e.target.value); }}
                className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-1.5 rounded-lg text-sm outline-none focus:border-primary"
              >
                <option value="">Select Team</option>
                {(config?.cartonWaste?.teams || ['A', 'B', 'C']).map(t => (
                  <option key={t} value={t}>Team {t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {uncheckedCount > 0 && (
              <span className="bg-gray-600/30 text-gray-400 px-3 py-1 rounded-full text-xs font-bold">
                {uncheckedCount} unchecked
              </span>
            )}
            <button
              onClick={() => navigate('/carton-waste-report')}
              className="bg-primary text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary-dark transition-colors"
            >
              View Report →
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-status-success"></span>
            <span className="text-gray-400">Checked</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-status-danger"></span>
            <span className="text-gray-400">High Waste</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-gray-600"></span>
            <span className="text-gray-400">Unchecked</span>
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
                  const status = getMachineStatus(m.id);
                  const latest = getMachineLatestCheck(m.id);

                  let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer relative flex flex-col items-center gap-1 ";
                  if (status === 'checked') {
                    btnClass += "bg-gradient-to-br from-status-success to-[#00C853] text-black border-2 border-status-success shadow-[0_0_10px_rgba(0,230,118,0.3)] hover:scale-105";
                  } else if (status === 'high-waste') {
                    btnClass += "bg-gradient-to-br from-status-danger to-[#D50000] text-white border-2 border-status-danger shadow-[0_0_10px_rgba(244,67,54,0.4)] hover:scale-105";
                  } else {
                    btnClass += "bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300 border-2 border-gray-600 hover:scale-105 hover:border-gray-500";
                  }

                  return (
                    <button
                      key={m.id}
                      onClick={() => handleMachineClick(m)}
                      className={btnClass}
                    >
                      <span>M{m.displayNumber || m.id}</span>
                      {latest && (
                        <span className="text-[10px] leading-tight opacity-80">
                          Alloc:{latest.runningAllocated}
                        </span>
                      )}
                      {latest && (
                        <span className="text-[10px] leading-tight opacity-80">
                          Waste:{latest.runningWastePercent.toFixed(1)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && selectedMachine && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-6 rounded-2xl border-2 border-primary shadow-[0_20px_60px_rgba(0,188,212,0.3)] max-w-lg w-[95%] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-primary text-xl font-bold">
                Machine M{selectedMachine.displayNumber || selectedMachine.id}
                <span className="text-sm text-gray-400 font-normal ml-2">
                  Line {selectedMachine.line} ({selectedMachine.gram}g)
                </span>
              </h2>
              <button onClick={() => !saving && setIsModalOpen(false)} className="text-gray-500 hover:text-white text-2xl">&times;</button>
            </div>

            {loadingPrev ? (
              <div className="text-center text-gray-400 py-8 animate-pulse">Loading previous check...</div>
            ) : (
              <>
                {previousCheck && (
                  <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl mb-4">
                    <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">
                      Previous Check (<span className="text-primary font-bold">Round {previousCheck.roundNumber}</span>)
                      {previousCheck.checkedBy && <> by {previousCheck.checkedBy}</>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">Allocated:</span> <span className="text-white font-bold">{previousCheck.allocated}</span></div>
                      <div><span className="text-gray-500">Remaining:</span> <span className="text-white font-bold">{previousCheck.remaining}</span></div>
                      <div><span className="text-gray-500">Wasted:</span> <span className="text-white font-bold">{previousCheck.wasted}</span></div>
                    </div>
                    <div className="text-sm mt-1">
                      <span className="text-gray-500">Used: {previousCheck.used} &middot; Waste: {previousCheck.wastePercent}%</span>
                    </div>
                  </div>
                )}

                {!previousCheck && (
                  <div className="bg-status-warning/10 border border-status-warning/30 p-4 rounded-xl mb-4">
                    <div className="text-xs text-status-warning uppercase font-bold tracking-wider mb-1">First check of the shift</div>
                    <div className="text-sm text-gray-400">
                      Are there cartons carried over from the previous shift? Enter them as Allocated.
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">
                  New Check — <span className="text-status-warning font-bold">Round {previousCheck ? previousCheck.roundNumber + 1 : 1}</span>
                </div>

                {error && (
                  <div className="bg-status-danger/10 border border-status-danger/30 p-3 rounded-lg mb-4 text-status-danger text-sm font-bold">{error}</div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Cartons Allocated (new since last check)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={allocated}
                      onChange={e => { setAllocated(e.target.value); setError(''); }}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Cartons Remaining (current physical count)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={remaining}
                      onChange={e => { setRemaining(e.target.value); setError(''); }}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Cartons Wasted (new since last check)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={wasted}
                      onChange={e => { setWasted(e.target.value); setError(''); }}
                      onFocus={e => e.target.select()}
                      placeholder="0"
                      className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {(allocated !== '' || remaining !== '' || wasted !== '') && (
                  <div className="mt-4 bg-[#1a1a1a] border border-[#333] p-4 rounded-xl">
                    <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Auto-Calculated</div>
                    {(() => {
                      const prevRemain = previousCheck?.remaining ?? 0;
                      const allocNum = Number(allocated) || 0;
                      const remainNum = Number(remaining) || 0;
                      const wasteNum = Number(wasted) || 0;
                      const used = prevRemain + allocNum - remainNum;
                      const totalProcessed = used + wasteNum;
                      const wastePct = totalProcessed > 0 ? (wasteNum / totalProcessed) * 100 : 0;

                      const prevRunAlloc = previousCheck?.runningAllocated ?? 0;
                      const prevRunUsed = previousCheck?.runningUsed ?? 0;
                      const prevRunWasted = previousCheck?.runningWasted ?? 0;
                      const runAlloc = prevRunAlloc + allocNum;
                      const runUsed = prevRunUsed + used;
                      const runWasted = prevRunWasted + wasteNum;
                      const runTotal = runUsed + runWasted;
                      const runWastePct = runTotal > 0 ? (runWasted / runTotal) * 100 : 0;

                      return (
                        <>
                          <div className="text-sm text-white">
                            Cartons Used: {prevRemain} + {allocNum} - {remainNum} = <span className="text-primary font-bold">{used}</span>
                          </div>
                          <div className="text-sm text-white">
                            Waste % (this check): {wasteNum} / ({used} + {wasteNum}) = <span className={`font-bold ${wastePct > (config?.cartonWaste?.targetWastePercent ?? 5) ? 'text-status-danger' : 'text-status-success'}`}>{wastePct.toFixed(2)}%</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-[#333]">
                            <div className="text-xs text-gray-400 uppercase font-bold mb-1">Running Totals (this shift, this machine)</div>
                            <div className="text-sm text-white">
                              Allocated: {runAlloc} | Used: {runUsed} | Wasted: {runWasted} | Waste %: <span className={`font-bold ${runWastePct > (config?.cartonWaste?.targetWastePercent ?? 5) ? 'text-status-danger' : 'text-status-success'}`}>{runWastePct.toFixed(2)}%</span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-sm text-gray-300 mb-1">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                    className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => !saving && setIsModalOpen(false)}
                    disabled={saving}
                    className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex-[2] py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save & Next Machine'}
                  </button>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex-1 py-3 bg-status-success/20 text-status-success border border-status-success rounded-lg font-bold hover:bg-status-success hover:text-black transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save & Close'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
