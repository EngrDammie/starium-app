import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import QCStringWeightDialog from '../components/QCStringWeightDialog';
import QCBagInspectionDialog from '../components/QCBagInspectionDialog';
import QCCartonInspectionDialog from '../components/QCCartonInspectionDialog';
import { useConfig } from '../context/ConfigContext';
import { useNetwork } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';
import {
  getOrCreateStringWeightShift,
  saveStringWeightCheck, subscribeToMachineStringWeights, subscribeToAllStringWeights,
  getShiftDateInfo
} from '../services/qcStringWeightOperations';
import {
  saveBagInspectionCheck, subscribeToMachineBagInspections
} from '../services/qcBagInspectionOperations';
import {
  saveCartonInspectionCheck, subscribeToMachineCartonInspections
} from '../services/qcCartonInspectionOperations';

export default function QCSachetProductionChecks() {
  const { config, loadingConfig } = useConfig();
  const { isOnline } = useNetwork();
  const { userFullName } = useAuth();

  const [shiftInfo, setShiftInfo] = useState({ shift: '--', date: '--', dateFormatted: '' });
  const [team, setTeam] = useState('');
  const [approvalDocId, setApprovalDocId] = useState(null);

  const [allRecords, setAllRecords] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineRecords, setMachineRecords] = useState([]);
  const [recordsUnsub, setRecordsUnsub] = useState(null);

  const [dialogType, setDialogType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [swTimeLeft, setSwTimeLeft] = useState(null);

  // Bag inspection state
  const [bagRecords, setBagRecords] = useState([]);
  const [bagUnsub, setBagUnsub] = useState(null);
  const [biTimeLeft, setBiTimeLeft] = useState(null);

  // Carton inspection state
  const [ciRecords, setCiRecords] = useState([]);
  const [ciUnsub, setCiUnsub] = useState(null);
  const [ciTimeLeft, setCiTimeLeft] = useState(null);

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  useEffect(() => {
    if (loadingConfig || !config) return;
    const { shift, date } = getShiftDateInfo(config);
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const dayNum = now.getDate();
    const year = now.getFullYear();
    setShiftInfo({ shift, date, dateFormatted: `${dayName}, ${dayNum} ${monthName}, ${year}` });
    setTeam(localStorage.getItem('starium_qc_sachet_team') || config?.packagingTeams?.defaultTeam || 'A');
    initShift();
  }, [config, loadingConfig]);

  const initShift = async () => {
    const docId = await getOrCreateStringWeightShift(config, isOnline);
    setApprovalDocId(docId);
  };

  useEffect(() => {
    if (!approvalDocId) return;
    const unsub = subscribeToAllStringWeights(approvalDocId, (records) => setAllRecords(records));
    return () => unsub();
  }, [approvalDocId]);

  // Subscribe to string weight records for selected machine
  useEffect(() => {
    if (!selectedMachine || !approvalDocId) {
      if (recordsUnsub) recordsUnsub();
      setMachineRecords([]);
      return;
    }
    if (recordsUnsub) recordsUnsub();
    const unsub = subscribeToMachineStringWeights(approvalDocId, selectedMachine.id, (records) => setMachineRecords(records));
    setRecordsUnsub(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [selectedMachine, approvalDocId]);

  // Subscribe to bag inspection records for selected machine
  useEffect(() => {
    if (!selectedMachine || !approvalDocId) {
      if (bagUnsub) bagUnsub();
      setBagRecords([]);
      return;
    }
    if (bagUnsub) bagUnsub();
    const unsub = subscribeToMachineBagInspections(approvalDocId, selectedMachine.id, (records) => setBagRecords(records));
    setBagUnsub(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [selectedMachine, approvalDocId]);

  // Subscribe to carton inspection records for selected machine
  useEffect(() => {
    if (!selectedMachine || !approvalDocId) {
      if (ciUnsub) ciUnsub();
      setCiRecords([]);
      return;
    }
    if (ciUnsub) ciUnsub();
    const unsub = subscribeToMachineCartonInspections(approvalDocId, selectedMachine.id, (records) => setCiRecords(records));
    setCiUnsub(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [selectedMachine, approvalDocId]);

  // String weight cooldown timer
  useEffect(() => {
    if (!machineRecords.length) { setSwTimeLeft(null); return; }
    const latest = machineRecords[machineRecords.length - 1];
    const intervalMs = (config?.qcCheckIntervals?.stringWeight ?? 15) * 60 * 1000;

    const tick = () => {
      const created = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date(latest.localCreatedAt || latest.createdAt);
      setSwTimeLeft(Math.max(0, intervalMs - (Date.now() - created.getTime())));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [machineRecords, config?.qcCheckIntervals?.stringWeight]);

  // Bag inspection cooldown timer
  useEffect(() => {
    if (!bagRecords.length) { setBiTimeLeft(null); return; }
    const latest = bagRecords[bagRecords.length - 1];
    const intervalMs = (config?.qcCheckIntervals?.bagInspection ?? 15) * 60 * 1000;

    const tick = () => {
      const created = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date(latest.localCreatedAt || latest.createdAt);
      setBiTimeLeft(Math.max(0, intervalMs - (Date.now() - created.getTime())));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bagRecords, config?.qcCheckIntervals?.bagInspection]);

  // Carton inspection cooldown timer
  useEffect(() => {
    if (!ciRecords.length) { setCiTimeLeft(null); return; }
    const latest = ciRecords[ciRecords.length - 1];
    const intervalMs = (config?.qcCheckIntervals?.cartonInspection ?? 60) * 60 * 1000;

    const tick = () => {
      const created = latest.createdAt?.toDate ? latest.createdAt.toDate() : new Date(latest.localCreatedAt || latest.createdAt);
      setCiTimeLeft(Math.max(0, intervalMs - (Date.now() - created.getTime())));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [ciRecords, config?.qcCheckIntervals?.cartonInspection]);

  const formatCountdown = (ms) => {
    if (ms === null || ms <= 0) return null;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const swRoundNumber = machineRecords.length > 0
    ? Math.max(...machineRecords.map(r => r.roundNumber)) + 1
    : 1;
  const swPreviousRecord = machineRecords.length > 0 ? machineRecords[machineRecords.length - 1] : null;

  const biRoundNumber = bagRecords.length > 0
    ? Math.max(...bagRecords.map(r => r.roundNumber)) + 1
    : 1;
  const biPreviousRecord = bagRecords.length > 0 ? bagRecords[bagRecords.length - 1] : null;

  const ciRoundNumber = ciRecords.length > 0
    ? Math.max(...ciRecords.map(r => r.roundNumber)) + 1
    : 1;
  const ciPreviousRecord = ciRecords.length > 0 ? ciRecords[ciRecords.length - 1] : null;

  const stringWeightRecord = machineRecords.length > 0 ? machineRecords[machineRecords.length - 1] : null;
  const batchNumber = stringWeightRecord?.batchNumber || '';

  const cartonInspectionLocked = !stringWeightRecord;
  const cartonInspectionReady = !cartonInspectionLocked && (ciTimeLeft === null || ciTimeLeft <= 0);

  const getMachineLatestRound = (machineId) => {
    return allRecords
      .filter(r => r.machineId === machineId)
      .sort((a, b) => (b.roundNumber || 0) - (a.roundNumber || 0))[0] || null;
  };

  const getMachineStatus = (machineId) => {
    const latest = getMachineLatestRound(machineId);
    if (!latest) return 'unchecked';
    if (latest.allInTarget && latest.meetsCriteria === 'Y') return 'checked';
    return 'high-waste';
  };

  const handleMachineClick = (machine) => {
    setSelectedMachine(machine);
    setDialogType(null);
  };

  const handleBackToGrid = () => {
    setSelectedMachine(null);
    setDialogType(null);
  };

  const handleSaveStringWeight = async (data) => {
    setSaving(true);
    try {
      const record = {
        machineId: selectedMachine.id,
        machineDisplayNumber: selectedMachine.displayNumber || selectedMachine.id,
        line: selectedMachine.line,
        gram: selectedMachine.gram,
        fillHeads: selectedMachine.fillHeads ?? 2,
        roundNumber: swRoundNumber,
        shift: shiftInfo.shift,
        date: shiftInfo.date,
        team,
        checkedBy: userFullName,
        approvalDocId,
        weights: data.weights,
        weightStatuses: data.weightStatuses,
        allInTarget: data.allInTarget,
        outOfRangeCount: data.outOfRangeCount,
        meetsCriteria: data.meetsCriteria,
        remarks: data.remarks,
        batchNumber: data.batchNumber
      };
      const result = await saveStringWeightCheck(record, isOnline);
      if (result === 'saved' || result === 'queued') {
        setDialogType(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBagInspection = async (data) => {
    setSaving(true);
    try {
      const record = {
        machineId: selectedMachine.id,
        machineDisplayNumber: selectedMachine.displayNumber || selectedMachine.id,
        line: selectedMachine.line,
        gram: selectedMachine.gram,
        fillHeads: selectedMachine.fillHeads ?? 2,
        roundNumber: biRoundNumber,
        shift: shiftInfo.shift,
        date: shiftInfo.date,
        team,
        checkedBy: userFullName,
        approvalDocId,
        leakage: data.leakage,
        dirtPrintQuality: data.dirtPrintQuality,
        completenessSachets: data.completenessSachets,
        freebiesPresence: data.freebiesPresence,
        perforation: data.perforation,
        perfumeOdour: data.perfumeOdour,
        overallResult: data.overallResult,
        remarks: data.remarks,
        batchNumber: data.batchNumber
      };
      const result = await saveBagInspectionCheck(record, isOnline);
      if (result === 'saved' || result === 'queued') {
        setDialogType(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCartonInspection = async (data) => {
    setSaving(true);
    try {
      const record = {
        machineId: selectedMachine.id,
        machineDisplayNumber: selectedMachine.displayNumber || selectedMachine.id,
        line: selectedMachine.line,
        gram: selectedMachine.gram,
        fillHeads: selectedMachine.fillHeads ?? 2,
        roundNumber: ciRoundNumber,
        shift: shiftInfo.shift,
        date: shiftInfo.date,
        team,
        checkedBy: userFullName,
        approvalDocId,
        detergentDust: data.detergentDust,
        cartonPrintQuality: data.cartonPrintQuality,
        sealQuality: data.sealQuality,
        cartonDamage: data.cartonDamage,
        cartonCodeReadability: data.cartonCodeReadability,
        overallResult: data.overallResult,
        remarks: data.remarks,
        batchNumber: data.batchNumber
      };
      const result = await saveCartonInspectionCheck(record, isOnline);
      if (result === 'saved' || result === 'queued') {
        setDialogType(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Bag Inspection button state
  const bagInspectionLocked = !stringWeightRecord;
  const bagInspectionReady = !bagInspectionLocked && (biTimeLeft === null || biTimeLeft <= 0);

  if (loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading...</div></Layout>;

  if (selectedMachine) {
    return (
      <Layout title="QC Sachet Production Checks" subtitle={selectedMachine ? `Machine M${selectedMachine.displayNumber || selectedMachine.id}` : ''} maxWidth="max-w-4xl">
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
          <button onClick={handleBackToGrid} className="text-primary hover:text-primary-dark text-sm font-bold mb-4">&larr; Back to Machines</button>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Machine M{selectedMachine.displayNumber || selectedMachine.id}
                <span className="text-sm text-gray-400 font-normal ml-2">
                  Line {selectedMachine.line} ({selectedMachine.gram}g · {selectedMachine.fillHeads ?? 2}H)
                </span>
              </h2>
            </div>
            <div className="text-right">
              <div className="text-primary font-bold text-lg">Round {swRoundNumber}</div>
              <div className="text-xs text-gray-500">{machineRecords.length} total round{machineRecords.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {machineRecords.length > 0 && (
            <div className="mb-4 bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden">
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider px-4 pt-3 pb-1">🔬 String Weight Checks — Round History</div>
              <div className="hidden md:flex items-center px-4 py-1 text-[10px] text-gray-500 uppercase tracking-wider font-bold border-t border-[#333]">
                <span className="shrink-0 w-14">Round</span>
                <span className="flex-1 text-center">Weights</span>
                <span className="shrink-0 w-16 text-center">Result</span>
                <span className="shrink-0 w-28 text-center">Staff</span>
                <span className="shrink-0 w-14 text-right">Time</span>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {machineRecords.map((r) => (
                  <div key={r.id || r.roundNumber} className="flex items-center px-4 py-2 text-xs border-t border-[#333] last:border-b-0">
                    <span className="text-primary font-bold shrink-0 w-14">R{r.roundNumber}</span>
                    <div className="flex gap-2 flex-1 justify-center">
                      {(r.weights || []).map((w, i) => (
                        <span key={i} className="text-white font-bold">{w}g</span>
                      ))}
                    </div>
                    <span className={`shrink-0 w-16 text-center ${r.meetsCriteria === 'Y' ? 'text-status-success' : 'text-status-danger'}`}>
                      {r.meetsCriteria === 'Y' ? '✓ Meets' : '✗ No'}
                    </span>
                    <span className="text-gray-300 shrink-0 w-28 text-center">{r.checkedBy || 'Unknown'}</span>
                    <span className="text-gray-500 shrink-0 w-14 text-right">{r.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => swTimeLeft > 0 ? null : setDialogType('stringWeight')}
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${swTimeLeft > 0 ? 'bg-[#1a1a1a] border-2 border-[#444] text-gray-600 cursor-not-allowed' : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-black'}`}>
              {swTimeLeft > 0
                ? `⏳ String Weight Check (${formatCountdown(swTimeLeft)})`
                : '✅ String Weight Check'}
            </button>

            {bagInspectionLocked ? (
              <button disabled
                className="flex-1 py-4 bg-[#1a1a1a] border-2 border-[#444] rounded-xl font-bold text-gray-600 cursor-not-allowed">
                🔒 Bag Inspection <span className="text-[10px] block">requires String Weight R1</span>
              </button>
            ) : (
              <button onClick={() => bagInspectionReady ? setDialogType('bagInspection') : null}
                className={`flex-1 py-4 rounded-xl font-bold transition-all ${!bagInspectionReady ? 'bg-[#1a1a1a] border-2 border-[#444] text-gray-600 cursor-not-allowed' : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-black'}`}>
                {biTimeLeft > 0
                  ? `⏳ Bag Inspection (${formatCountdown(biTimeLeft)})`
                  : '✅ Bag Inspection'}
              </button>
            )}

            {cartonInspectionLocked ? (
              <button disabled
                className="flex-1 py-4 bg-[#1a1a1a] border-2 border-[#444] rounded-xl font-bold text-gray-600 cursor-not-allowed">
                🔒 Carton Inspection <span className="text-[10px] block">requires String Weight R1</span>
              </button>
            ) : (
              <button onClick={() => cartonInspectionReady ? setDialogType('cartonInspection') : null}
                className={`flex-1 py-4 rounded-xl font-bold transition-all ${!cartonInspectionReady ? 'bg-[#1a1a1a] border-2 border-[#444] text-gray-600 cursor-not-allowed' : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-black'}`}>
                {ciTimeLeft > 0
                  ? `⏳ Carton Inspection (${formatCountdown(ciTimeLeft)})`
                  : '✅ Carton Inspection'}
              </button>
            )}
          </div>
        </div>

        {dialogType === 'stringWeight' && (
          <QCStringWeightDialog
            machine={selectedMachine}
            roundNumber={swRoundNumber}
            previousRecord={swPreviousRecord}
            onSave={handleSaveStringWeight}
            onClose={() => setDialogType(null)}
            saving={saving}
          />
        )}

        {dialogType === 'bagInspection' && (
          <QCBagInspectionDialog
            machine={selectedMachine}
            roundNumber={biRoundNumber}
            previousRecord={biPreviousRecord}
            batchNumber={batchNumber}
            stringWeightRecord={stringWeightRecord}
            onSave={handleSaveBagInspection}
            onClose={() => setDialogType(null)}
            saving={saving}
          />
        )}

        {dialogType === 'cartonInspection' && (
          <QCCartonInspectionDialog
            machine={selectedMachine}
            roundNumber={ciRoundNumber}
            previousRecord={ciPreviousRecord}
            batchNumber={batchNumber}
            stringWeightRecord={stringWeightRecord}
            onSave={handleSaveCartonInspection}
            onClose={() => setDialogType(null)}
            saving={saving}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout title="QC Sachet Production Checks" subtitle="Per-machine production quality monitoring" maxWidth="max-w-6xl">
      <div className="bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div><span className="text-gray-400">Date:</span> <span className="text-white font-bold">{shiftInfo.dateFormatted}</span></div>
            <div><span className="text-gray-400">Shift:</span> <span className="text-primary font-bold">{shiftInfo.shift}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Team:</span>
              <select value={team} onChange={e => { setTeam(e.target.value); localStorage.setItem('starium_qc_sachet_team', e.target.value); }}
                className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-1.5 rounded-lg text-sm outline-none focus:border-primary">
                <option value="">Select Team</option>
                {(config?.packagingTeams?.labels || ['A', 'B', 'C']).map(t => (
                  <option key={t} value={t}>Team {t}</option>
                ))}
              </select>
            </div>
            <div><span className="text-gray-400">User:</span> <span className="font-bold text-primary">{userFullName || 'Unknown'}</span></div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-status-success to-[#00C853]"></span><span className="text-gray-400">Checked</span></div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-status-danger to-[#D50000]"></span><span className="text-gray-400">Issues</span></div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-600"></span><span className="text-gray-400">Unchecked</span></div>
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
                  const latest = getMachineLatestRound(m.id);
                  let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer relative flex flex-col items-center gap-1 justify-center min-h-[80px] ";
                  if (status === 'checked') {
                    btnClass += "bg-gradient-to-br from-status-success to-[#00C853] text-black border-2 border-status-success shadow-[0_0_10px_rgba(0,230,118,0.3)] hover:scale-105";
                  } else if (status === 'high-waste') {
                    btnClass += "bg-gradient-to-br from-status-danger to-[#D50000] text-white border-2 border-status-danger shadow-[0_0_10px_rgba(244,67,54,0.4)] hover:scale-105";
                  } else {
                    btnClass += "bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300 border-2 border-gray-600 hover:scale-105 hover:border-gray-500";
                  }
                  return (
                    <button key={m.id} onClick={() => handleMachineClick(m)} className={btnClass}>
                      <span>M{m.displayNumber || m.id}</span>
                      {latest && <span className="text-[10px] leading-tight opacity-80">R{latest.roundNumber}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
