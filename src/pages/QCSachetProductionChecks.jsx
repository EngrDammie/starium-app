import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import QCSachetMachineGrid from '../components/qcSachet/QCSachetMachineGrid';
import QCSachetMachineDetail from '../components/qcSachet/QCSachetMachineDetail';
import QCSachetApprovalModal from '../components/qcSachet/QCSachetApprovalModal';
import { formatCountdown, formatTime } from '../services/formatUtils';
import { useConfig } from '../context/ConfigContext';
import { useNetwork } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import {
  getOrCreateStringWeightShift,
  saveStringWeightCheck, subscribeToMachineStringWeights, subscribeToAllStringWeights,
  getShiftDateInfo
} from '../services/qcStringWeightOperations';
import {
  saveBagInspectionCheck, subscribeToMachineBagInspections, subscribeToAllBagInspections
} from '../services/qcBagInspectionOperations';
import {
  saveCartonInspectionCheck, subscribeToMachineCartonInspections, subscribeToAllCartonInspections
} from '../services/qcCartonInspectionOperations';
import {
  subscribeToShiftApproval, addApprover
} from '../services/qcOperations';

export default function QCSachetProductionChecks() {
  const { config, loadingConfig } = useConfig();
  const { isOnline } = useNetwork();
  const { userFullName, systemRole, departmentRoles, actionRoles } = useAuth();
  const { broadcastAlert } = useAlerts();
  const navigate = useNavigate();

  const [shiftInfo, setShiftInfo] = useState({ shift: '--', date: '--', dateFormatted: '' });
  const [team, setTeam] = useState('');
  const [approvalDocId, setApprovalDocId] = useState(null);

  const [allRecords, setAllRecords] = useState([]);
  const [queuedSW, setQueuedSW] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineRecords, setMachineRecords] = useState([]);
  const [recordsUnsub, setRecordsUnsub] = useState(null);

  const [dialogType, setDialogType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [swTimeLeft, setSwTimeLeft] = useState(null);

  const [bagRecords, setBagRecords] = useState([]);
  const [queuedBI, setQueuedBI] = useState([]);
  const [bagUnsub, setBagUnsub] = useState(null);
  const [biTimeLeft, setBiTimeLeft] = useState(null);

  const [ciRecords, setCiRecords] = useState([]);
  const [queuedCI, setQueuedCI] = useState([]);
  const [ciUnsub, setCiUnsub] = useState(null);
  const [ciTimeLeft, setCiTimeLeft] = useState(null);

  // Approval state
  const [approvalData, setApprovalData] = useState(null);
  const [allBagRecords, setAllBagRecords] = useState([]);
  const [allCartonRecords, setAllCartonRecords] = useState([]);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

  const isAdminOrQcManager = systemRole === 'super_admin' || (departmentRoles || []).includes('qc_manager');

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

  useEffect(() => {
    if (!approvalDocId) return;
    const unsub = subscribeToAllBagInspections(approvalDocId, (records) => setAllBagRecords(records));
    return () => unsub();
  }, [approvalDocId]);

  useEffect(() => {
    if (!approvalDocId) return;
    const unsub = subscribeToAllCartonInspections(approvalDocId, (records) => setAllCartonRecords(records));
    return () => unsub();
  }, [approvalDocId]);

  useEffect(() => {
    if (!approvalDocId) return;
    const sw = JSON.parse(localStorage.getItem('starium_qc_string_weight_queue') || '[]')
      .filter(q => q.approvalDocId === approvalDocId);
    setQueuedSW(sw);
    const bi = JSON.parse(localStorage.getItem('starium_bag_inspection_queue') || '[]')
      .filter(q => q.approvalDocId === approvalDocId);
    setQueuedBI(bi);
    const ci = JSON.parse(localStorage.getItem('starium_carton_inspection_queue') || '[]')
      .filter(q => q.approvalDocId === approvalDocId);
    setQueuedCI(ci);
  }, [approvalDocId, allRecords, allBagRecords, allCartonRecords]);

  const displaySW = [...allRecords, ...queuedSW.map(r => ({ ...r, synced: false }))];
  const displayBI = [...allBagRecords, ...queuedBI.map(r => ({ ...r, synced: false }))];
  const displayCI = [...allCartonRecords, ...queuedCI.map(r => ({ ...r, synced: false }))];

  useEffect(() => {
    if (!approvalDocId) return;
    const unsub = subscribeToShiftApproval(approvalDocId, (data) => setApprovalData(data));
    return () => unsub();
  }, [approvalDocId]);

  useEffect(() => {
    if (!selectedMachine || !approvalDocId) {
      if (recordsUnsub) recordsUnsub();
      setMachineRecords([]);
      return;
    }
    if (recordsUnsub) recordsUnsub();
    const unsub = subscribeToMachineStringWeights(approvalDocId, selectedMachine.id, (records) => {
      const synced = records.map(r => ({ ...r, synced: true }));
      const queued = JSON.parse(localStorage.getItem('starium_qc_string_weight_queue') || '[]')
        .filter(q => q.machineId === selectedMachine.id && q.approvalDocId === approvalDocId)
        .map(q => ({ ...q, synced: false, id: q.localCreatedAt }));
      const merged = [...synced, ...queued].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
      setMachineRecords(merged);
    });
    setRecordsUnsub(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [selectedMachine, approvalDocId]);

  useEffect(() => {
    if (!selectedMachine || !approvalDocId) {
      if (bagUnsub) bagUnsub();
      setBagRecords([]);
      return;
    }
    if (bagUnsub) bagUnsub();
    const unsub = subscribeToMachineBagInspections(approvalDocId, selectedMachine.id, (records) => {
      const synced = records.map(r => ({ ...r, synced: true }));
      const queued = JSON.parse(localStorage.getItem('starium_bag_inspection_queue') || '[]')
        .filter(q => q.machineId === selectedMachine.id && q.approvalDocId === approvalDocId)
        .map(q => ({ ...q, synced: false, id: q.localCreatedAt }));
      const merged = [...synced, ...queued].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
      setBagRecords(merged);
    });
    setBagUnsub(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [selectedMachine, approvalDocId]);

  useEffect(() => {
    if (!selectedMachine || !approvalDocId) {
      if (ciUnsub) ciUnsub();
      setCiRecords([]);
      return;
    }
    if (ciUnsub) ciUnsub();
    const unsub = subscribeToMachineCartonInspections(approvalDocId, selectedMachine.id, (records) => {
      const synced = records.map(r => ({ ...r, synced: true }));
      const queued = JSON.parse(localStorage.getItem('starium_carton_inspection_queue') || '[]')
        .filter(q => q.machineId === selectedMachine.id && q.approvalDocId === approvalDocId)
        .map(q => ({ ...q, synced: false, id: q.localCreatedAt }));
      const merged = [...synced, ...queued].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
      setCiRecords(merged);
    });
    setCiUnsub(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [selectedMachine, approvalDocId]);

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

  // formatCountdown + formatTime live in src/services/formatUtils.js (shared, tested).

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
    return displaySW
      .filter(r => r.machineId === machineId)
      .sort((a, b) => (b.roundNumber || 0) - (a.roundNumber || 0))[0] || null;
  };

  const getMachineStatus = (machineId) => {
    const latest = getMachineLatestRound(machineId);
    if (!latest) return 'unchecked';
    if (latest.allInTarget && latest.meetsCriteria === 'Y') return 'checked';
    return 'high-waste';
  };

  // Machine stats for approval modal
  const machineStats = (config.machines || []).map(m => {
    const sw = displaySW.filter(r => r.machineId === m.id);
    const bi = displayBI.filter(r => r.machineId === m.id);
    const ci = displayCI.filter(r => r.machineId === m.id);
    return {
      machine: m,
      swRounds: sw.length,
      biRounds: bi.length,
      ciRounds: ci.length,
      latestSW: sw.length > 0 ? sw[sw.length - 1] : null
    };
  });

  // Approvers from approvalData
  const approversList = [];
  if (approvalData) {
    if (approvalData.qc_supervisor) approversList.push(approvalData.qc_supervisor);
    if (approvalData.line_leader) approversList.push(approvalData.line_leader);
  }

  const hasRole = (role) => systemRole === 'super_admin' || (actionRoles || []).includes(role);
  const canApproveQcSupervisor = hasRole('qc_supervisor') && !(approvalData?.qc_supervisor);
  const canApproveLineLeader = hasRole('line_leader') && !(approvalData?.line_leader);

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
        if (result === 'queued') {
          const sw = JSON.parse(localStorage.getItem('starium_qc_string_weight_queue') || '[]')
            .filter(q => q.approvalDocId === approvalDocId);
          setQueuedSW(sw);
          setMachineRecords(prev => {
            const synced = prev.filter(r => r.synced);
            const queued = sw.filter(q => q.machineId === selectedMachine.id)
              .map(q => ({ ...q, synced: false, id: q.localCreatedAt }));
            return [...synced, ...queued].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
          });
        }
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
        if (result === 'queued') {
          const bi = JSON.parse(localStorage.getItem('starium_bag_inspection_queue') || '[]')
            .filter(q => q.approvalDocId === approvalDocId);
          setQueuedBI(bi);
          setBagRecords(prev => {
            const synced = prev.filter(r => r.synced);
            const queued = bi.filter(q => q.machineId === selectedMachine.id)
              .map(q => ({ ...q, synced: false, id: q.localCreatedAt }));
            return [...synced, ...queued].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
          });
        }
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
        if (result === 'queued') {
          const ci = JSON.parse(localStorage.getItem('starium_carton_inspection_queue') || '[]')
            .filter(q => q.approvalDocId === approvalDocId);
          setQueuedCI(ci);
          setCiRecords(prev => {
            const synced = prev.filter(r => r.synced);
            const queued = ci.filter(q => q.machineId === selectedMachine.id)
              .map(q => ({ ...q, synced: false, id: q.localCreatedAt }));
            return [...synced, ...queued].sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const bagInspectionLocked = !stringWeightRecord;
  const bagInspectionReady = !bagInspectionLocked && (biTimeLeft === null || biTimeLeft <= 0);

  const submitApproval = async (approverRole) => {
    setApprovalLoading(true);
    try {
      const roleLabels = { qc_supervisor: 'QC Supervisor', line_leader: 'Line Leader' };
      await addApprover(approvalDocId, userFullName, approverRole);

      broadcastAlert(
        `✅ QC Sachet ${roleLabels[approverRole] || approverRole} Approved`,
        `${userFullName} approved ${shiftInfo.shift} shift QC checks`,
        'info',
        ['/', '/qc-sachet-production-checks']
      );
    } catch (err) {
      console.error('Approval error:', err);
    } finally {
      setApprovalLoading(false);
    }
  };

  // ── Render ──
  if (loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading...</div></Layout>;

  if (selectedMachine) {
    return (
      <QCSachetMachineDetail
        selectedMachine={selectedMachine}
        machineRecords={machineRecords}
        swRoundNumber={swRoundNumber}
        swTimeLeft={swTimeLeft}
        bagInspectionLocked={bagInspectionLocked}
        bagInspectionReady={bagInspectionReady}
        biTimeLeft={biTimeLeft}
        cartonInspectionLocked={cartonInspectionLocked}
        cartonInspectionReady={cartonInspectionReady}
        ciTimeLeft={ciTimeLeft}
        formatCountdown={formatCountdown}
        handleBackToGrid={handleBackToGrid}
        setDialogType={setDialogType}
        dialogType={dialogType}
        swPreviousRecord={swPreviousRecord}
        handleSaveStringWeight={handleSaveStringWeight}
        biPreviousRecord={biPreviousRecord}
        batchNumber={batchNumber}
        stringWeightRecord={stringWeightRecord}
        handleSaveBagInspection={handleSaveBagInspection}
        biRoundNumber={biRoundNumber}
        ciPreviousRecord={ciPreviousRecord}
        handleSaveCartonInspection={handleSaveCartonInspection}
        ciRoundNumber={ciRoundNumber}
        saving={saving}
      />
    );
  }

  return (
    <Layout title="QC Sachet Production Checks" subtitle="Per-machine production quality monitoring" maxWidth="max-w-6xl">
      <div className="bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div><span className="text-gray-400">📅 Date:</span> <span className="text-white font-bold">{shiftInfo.dateFormatted}</span></div>
            <div><span className="text-gray-400">🔄 Shift:</span> <span className="text-primary font-bold">{shiftInfo.shift}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">👥 Team:</span>
              <select value={team} onChange={e => { setTeam(e.target.value); localStorage.setItem('starium_qc_sachet_team', e.target.value); }}
                className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-1.5 rounded-lg text-sm outline-none focus:border-primary">
                <option value="">Select Team</option>
                {(config?.packagingTeams?.labels || ['A', 'B', 'C']).map(t => (
                  <option key={t} value={t}>Team {t}</option>
                ))}
              </select>
            </div>
            <div><span className="text-gray-400">👤 User:</span> <span className="font-bold text-primary">{userFullName || 'Unknown'}</span></div>
          </div>

          {/* Approval badges + action buttons */}
          {isAdminOrQcManager && (
            <div className="flex flex-wrap items-center gap-2">
              {approversList.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#333] px-2.5 py-1 rounded-lg text-xs">
                  <span className="text-status-success">✓</span>
                  <span className="text-gray-300 font-medium">{a.name}</span>
                  <span className="text-gray-500">{a.role === 'qc_supervisor' ? 'QC Sup.' : 'Line Lead'}</span>
                  <span className="text-gray-600">{formatTime(a.timestamp)}</span>
                </div>
              ))}
              <button onClick={() => setIsApproveModalOpen(true)}
                className="bg-primary/20 border border-primary text-primary hover:bg-primary hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                📋 Approve Shift
              </button>
              <button onClick={() => navigate('/qc-sachet-report')}
                className="bg-[#1a1a1a] border border-[#444] text-gray-300 hover:border-gray-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                📊 View Reports
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-status-success to-[#00C853]"></span><span className="text-gray-400">✅ Checked</span></div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gradient-to-br from-status-danger to-[#D50000]"></span><span className="text-gray-400">⚠️ Issues</span></div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-600"></span><span className="text-gray-400">⬜ Unchecked</span></div>
          {(queuedSW.length > 0 || queuedBI.length > 0 || queuedCI.length > 0) && (
            <div className="ml-auto flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-status-warning"></span>
              <span className="text-status-warning text-xs font-bold">⏳ {queuedSW.length + queuedBI.length + queuedCI.length} pending</span>
            </div>
          )}
        </div>

        <QCSachetMachineGrid
          lines={lines}
          config={config}
          queuedSW={queuedSW}
          queuedBI={queuedBI}
          queuedCI={queuedCI}
          getMachineStatus={getMachineStatus}
          getMachineLatestRound={getMachineLatestRound}
          handleMachineClick={handleMachineClick}
        />
      </div>

      {/* Approval Modal */}
      {isApproveModalOpen && (
        <QCSachetApprovalModal
          shiftInfo={shiftInfo}
          machineStats={machineStats}
          approvalData={approvalData}
          formatTime={formatTime}
          canApproveQcSupervisor={canApproveQcSupervisor}
          canApproveLineLeader={canApproveLineLeader}
          submitApproval={submitApproval}
          approvalLoading={approvalLoading}
          onClose={() => setIsApproveModalOpen(false)}
        />
      )}
    </Layout>
  );
}
