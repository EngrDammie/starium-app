// src/pages/PowderDensity.jsx
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import MachineGrid from '../components/MachineGrid';
import MachineModal from '../components/MachineModal';
import { useConfig } from '../context/ConfigContext';
import { useNetwork } from '../context/NetworkContext';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { getOrCreateShiftApproval, saveQCTest, subscribeToShiftTests } from '../services/qcOperations';
import { subscribeToActiveEmptySilos, markMachineNoLongerEmpty, getEmptySilosDocId } from '../services/emptySiloOperations';

export default function PowderDensity() {
  const { config, loadingConfig } = useConfig();
  const { isOnline, setQueueCount } = useNetwork();
  
  // 🎯 NEW: Pull the user's exact verified full name
  const { systemRole, departmentRoles, userFullName } = useAuth(); 
  const { broadcastAlert } = useAlerts(); 
  
  const [mode, setMode] = useState('level9');
  const [shift, setShift] = useState('DAY');
  const [team, setTeam] = useState(localStorage.getItem('qcTeam') || '');
  const [weight, setWeight] = useState('');
  
  const [buggyNumber, setBuggyNumber] = useState('');
  const [siloMachine, setSiloMachine] = useState('');
  const [appearance, setAppearance] = useState('A');
  const [fragrance, setFragrance] = useState('A');
  const [freeFlowing, setFreeFlowing] = useState('A');
  const [remarksText, setRemarksText] = useState(''); 
  
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [overrideMachines, setOverrideMachines] = useState([]);
  
  const [modalMachine, setModalMachine] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMachineStatus, setModalMachineStatus] = useState({ isMatch: false, isSelected: false });

  const [saveStatus, setSaveStatus] = useState({ state: 'idle', message: '' });
  
  const [shiftTests, setShiftTests] = useState([]);
  const [emptyRecords, setEmptyRecords] = useState([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('qcTeam', team);
  }, [team]);

  useEffect(() => {
    if (loadingConfig) return;
    const currentHour = new Date().getHours();
    setShift((currentHour >= config.dayShiftStart && currentHour < config.nightShiftStart) ? 'DAY' : 'NIGHT');
  }, [config, loadingConfig]);

  useEffect(() => {
    const hasAccess = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager', 'prod_staff', 'prod_manager'].includes(r));
    if (!hasAccess) return;
    if (loadingConfig) return;

    const unsubTests = subscribeToShiftTests(mode, config, (tests) => setShiftTests(tests));

    const unsubEmpty = subscribeToActiveEmptySilos((records) => {
      setEmptyRecords(records);
    });

    return () => { unsubTests(); unsubEmpty(); };
  }, [mode, config, loadingConfig, systemRole, departmentRoles]);

  const resetFormFields = () => {
    setWeight(''); setSelectedMachines([]); setOverrideMachines([]); setSiloMachine('');
    setBuggyNumber(''); setAppearance('A'); setFragrance('A'); setFreeFlowing('A'); 
    setRemarksText(''); 
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    resetFormFields();
  };

  const calculatedDensity = weight && !isNaN(weight) ? (parseFloat(weight) / (mode === 'level9' ? config.level9Divisor : config.botDivisor)).toFixed(3) : null;

  const handleSiloChange = (e) => {
    const val = e.target.value;
    setSiloMachine(val); 
    const parsed = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    setSelectedMachines([...new Set(parsed)]);
  };

  useEffect(() => {
    const currentParsed = siloMachine.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    const currentSet = new Set(currentParsed);
    const newSet = new Set(selectedMachines);
    const setsEqual = currentSet.size === newSet.size && [...currentSet].every(value => newSet.has(value));
    if (!setsEqual) setSiloMachine(selectedMachines.sort((a,b) => a-b).join(','));
  }, [selectedMachines]);

  useEffect(() => {
    setRemarksText(prevText => {
      let auto = [];
      if (calculatedDensity) {
        const d = parseFloat(calculatedDensity);
        if (mode === 'bot') {
          if (d < config.botMinDensity) auto.push(`Density too LOW (${d.toFixed(3)} g/mL)`);
          else if (d > config.botMaxDensity) auto.push(`Density too HIGH (${d.toFixed(3)} g/mL)`);
        } else {
          if (d < config.level9MinDensity) auto.push(`Density too LOW (${d.toFixed(3)} g/mL)`);
          else if (d > config.level9MaxDensity) auto.push(`Density too HIGH (${d.toFixed(3)} g/mL)`);
        }
      }
      if (overrideMachines.length > 0) overrideMachines.forEach(id => auto.push(`Machine ${id} was overridden to receive powder density of ${parseFloat(calculatedDensity).toFixed(3)} g/mL`));
      if (selectedMachines.length > 0) {
        const mList = [...selectedMachines].sort((a,b)=>a-b).join(', ');
        const bNum = buggyNumber.trim() || 'N/A';
        if (selectedMachines.length === 1) auto.push(`Buggy ${bNum} assigned to Machine ${mList}`);
        else auto.push(`Buggy ${bNum} shared across Machines ${mList} for dilution`);
      }
      if (appearance === 'U') auto.push('Appearance: Unacceptable');
      if (mode === 'level9' && fragrance === 'U') auto.push('Fragrance: Unacceptable');
      if (mode === 'bot' && freeFlowing === 'U') auto.push('Flow Property: Not Free Flowing');
      
      const autoRemarksString = auto.join('\n');
      const currentUserContent = (prevText || '').split('\n').filter(line => {
        const l = line.toLowerCase();
        return !l.includes('density too') && !l.includes('was overridden') && !l.includes('assigned to machine') &&
               !l.includes('shared across machines') && !l.includes('appearance:') && !l.includes('fragrance:') && !l.includes('flow property:');
      }).join('\n');
      
      return [autoRemarksString, currentUserContent].filter(Boolean).join('\n');
    });
  }, [calculatedDensity, mode, config, overrideMachines, selectedMachines, buggyNumber, appearance, fragrance, freeFlowing]);

  const handleMachineClick = (machine, isMatch, isSelected) => {
    setModalMachine(machine);
    setModalMachineStatus({ isMatch, isSelected });
    setIsModalOpen(true);
  };

  const handleToggleSelect = () => {
    if (selectedMachines.includes(modalMachine.id)) {
      setSelectedMachines(prev => prev.filter(id => id !== modalMachine.id));
      setOverrideMachines(prev => prev.filter(id => id !== modalMachine.id));
    } else setSelectedMachines(prev => [...prev, modalMachine.id]);
    setIsModalOpen(false);
  };

  const handleOverride = () => {
    if (!overrideMachines.includes(modalMachine.id)) setOverrideMachines(prev => [...prev, modalMachine.id]);
    if (!selectedMachines.includes(modalMachine.id)) setSelectedMachines(prev => [...prev, modalMachine.id]);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!team) return setSaveStatus({ state: 'error', message: '⚠️ Select your team' });
    if (!weight || isNaN(weight) || parseFloat(weight) <= 0) return setSaveStatus({ state: 'error', message: '⚠️ Enter valid weight' });
    if (!calculatedDensity) return setSaveStatus({ state: 'error', message: '⚠️ Calculate density first' });

    setSaveStatus({ state: 'saving', message: '⏳ Saving...' });

    try {
      const approvalDocId = await getOrCreateShiftApproval(mode, config, isOnline);
      const testData = { 
        mode, approvalDocId, weight: parseFloat(weight), density: calculatedDensity, 
        shift, team, appearance, remarks: remarksText,
        qcName: userFullName // 🎯 Guaranteed authentic!
      };
      
      if (mode === 'level9') { testData.buggyNumber = buggyNumber.trim(); testData.fragrance = fragrance; testData.machines = selectedMachines.sort((a,b) => a-b); } 
      else { testData.flowProperty = freeFlowing; }

      const result = await saveQCTest(testData, isOnline, setQueueCount);

      if (result === 'saved' || result === 'offline-queued') {
        const d = parseFloat(calculatedDensity);
        const isLevel9Bad = mode === 'level9' && (d < config.level9MinDensity || d > config.level9MaxDensity);
        const isBotBad = mode === 'bot' && (d < config.botMinDensity || d > config.botMaxDensity);
        
        if (isLevel9Bad || isBotBad) {
          const status = (mode === 'level9' ? d > config.level9MaxDensity : d > config.botMaxDensity) ? 'HIGH' : 'LOW';
          const modeLabel = mode === 'level9' ? 'LEVEL 9' : 'BOT';
          const targetPages = mode === 'level9' ? ['/', '/powder-density', '/level9-exec'] : ['/', '/powder-density', '/bot-exec'];
          
          broadcastAlert(`⚠️ ${modeLabel} DENSITY TOO ${status}!`, `Density recorded at ${d.toFixed(3)} g/mL by ${userFullName} (Team ${team}).`, 'danger', targetPages);
        }

        if (mode === 'level9' && selectedMachines.length > 0) {
          const buggy = buggyNumber.trim();
          for (const machineId of selectedMachines) {
            const emptyRecord = emptyRecords.find(r => r.machineId === machineId && !r.noLongerEmptyAt);
            if (emptyRecord && buggy) {
              const machine = config.machines?.find(m => m.id === machineId);
              markMachineNoLongerEmpty(emptyRecord.id, buggy, userFullName, config, broadcastAlert, machine);
            }
          }
        }
      }

      if (result === 'offline-queued') setSaveStatus({ state: 'saved', message: '📱 Saved Offline!' });
      else if (result === 'saved') setSaveStatus({ state: 'saved', message: '✅ Saved!' });

      setTimeout(() => { resetFormFields(); setSaveStatus({ state: 'idle', message: '' }); }, 2000);
    } catch (error) {
      console.error("Error saving:", error);
      setSaveStatus({ state: 'error', message: '❌ Error saving' });
      setTimeout(() => setSaveStatus({ state: 'idle', message: '' }), 3000);
    }
  };

  let l9DensityColorClass = "text-white text-shadow-[0_0_20px_rgba(255,255,255,0.5)]";
  let hasMatchingMachines = true;
  if (calculatedDensity && mode === 'level9') {
    const d = parseFloat(calculatedDensity);
    if (d < config.level9MinDensity || d > config.level9MaxDensity) l9DensityColorClass = "text-status-danger text-shadow-[0_0_30px_rgba(244,67,54,0.8)]";
    const matches = (config.machines || []).filter(m => {
      const spec = config.gramSpecs?.[String(m.gram)];
      const min = spec ? spec.min : m.min;
      const max = spec ? spec.max : m.max;
      return d >= min && d <= max && d >= config.level9MinDensity && d <= config.level9MaxDensity;
    });
    hasMatchingMachines = matches.length > 0;
  }

  let botStatusClass = ''; let botStatusText = '';
  if (mode === 'bot' && calculatedDensity) {
    const num = parseFloat(calculatedDensity);
    if (num < config.botMinDensity) { botStatusClass = 'bg-gradient-to-br from-status-danger to-[#D50000] shadow-[0_0_30px_rgba(244,67,54,0.5)]'; botStatusText = 'TOO LOW'; }
    else if (num > config.botMaxDensity) { botStatusClass = 'bg-gradient-to-br from-status-danger to-[#D50000] shadow-[0_0_30px_rgba(244,67,54,0.5)]'; botStatusText = 'TOO HIGH'; }
    else { botStatusClass = 'bg-gradient-to-br from-status-success to-[#00C853] shadow-[0_0_30px_rgba(0,230,118,0.5)]'; botStatusText = 'NORMAL'; }
  }

  const formatTime = (ts) => {
    if (!ts) return '--';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getModalDensityBadge = (densityNum) => {
    const min = mode === 'bot' ? config.botMinDensity : config.level9MinDensity;
    const max = mode === 'bot' ? config.botMaxDensity : config.level9MaxDensity;
    if (densityNum < min) return <span className="bg-status-warning/20 text-status-warning px-2 py-1 rounded-full text-xs font-bold">LOW</span>;
    if (densityNum > max) return <span className="bg-status-danger/20 text-status-danger px-2 py-1 rounded-full text-xs font-bold">HIGH</span>;
    return <span className="bg-status-success/20 text-status-success px-2 py-1 rounded-full text-xs font-bold">NORMAL</span>;
  };

  const showTestCounter = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_staff', 'qc_manager'].includes(r));

  return (
    <Layout title="Starium Rafa Quality Control" subtitle="Powder Density Data Entry">
      <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } } .animate-shake { animation: shake 0.4s ease-in-out; }`}</style>
      
      <div className="flex flex-wrap justify-center gap-4 mb-6 animate-[fadeIn_0.5s_ease-out]">
        <div className="flex items-center gap-2">
          <label className="text-primary font-bold">Mode:</label>
          <select value={mode} onChange={(e) => handleModeChange(e.target.value)} className="bg-dark-card text-white border-[3px] border-primary rounded-lg px-3 py-2 font-bold outline-none cursor-pointer focus:shadow-[0_0_15px_rgba(0,188,212,0.5)]">
            <option value="level9">Level 9 Silo Densities</option>
            <option value="bot">BOT Densities</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-primary font-bold">Shift:</label>
          <select disabled value={shift} className="bg-[#1a1a1a] text-gray-500 border-2 border-[#555] rounded-lg px-3 py-2 cursor-not-allowed"><option>{shift}</option></select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-primary font-bold">Team:</label>
          <select value={team} onChange={(e) => setTeam(e.target.value)} className="bg-dark-card text-white border-2 border-primary rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-status-success">
            <option value="" disabled>Select Team</option><option value="A">Team A</option><option value="B">Team B</option><option value="C">Team C</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-primary font-bold flex gap-1">Name: <span className="text-[10px] text-status-success uppercase mt-1 tracking-widest">(Locked)</span></label>
          {/* 🎯 FIX: Input is disabled, grayed out, and safely auto-fills userFullName */}
          <input 
            type="text" 
            value={userFullName} 
            readOnly 
            title="Name is securely locked to your account"
            className="bg-[#1a1a1a] text-gray-400 border border-[#444] rounded-lg px-3 py-2 w-48 outline-none cursor-not-allowed"
          />
        </div>
      </div>

      <div className="bg-dark-card p-6 md:p-8 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.6s_ease-out_0.2s_both]">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-primary font-bold">Powder Weight (g)</label>
            <input type="number" value={weight} onFocus={resetFormFields} onChange={(e) => setWeight(e.target.value)} placeholder="Enter powder weight" className="bg-[#2d2d2d] text-white border-2 border-primary rounded-lg p-3 outline-none focus:border-status-success focus:shadow-[0_0_15px_rgba(0,188,212,0.5)] transition-all"/>
          </div>
        </div>

        {calculatedDensity && mode === 'level9' && (
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] rounded-xl py-8 text-center mb-6 shadow-inner animate-[fadeIn_0.3s]">
            <div className="bg-white/25 inline-block px-4 py-1 rounded text-xs font-black tracking-[3px] uppercase mb-4 text-white">Buggy Powder Density</div>
            <div className={`text-7xl md:text-8xl font-black animate-[pulse_2s_ease-in-out_infinite] transition-colors duration-300 ${l9DensityColorClass}`}>{calculatedDensity}</div>
            <div className="text-gray-500 mt-2 font-bold tracking-widest uppercase">g/mL</div>
            <MachineGrid density={calculatedDensity} selectedMachines={selectedMachines} overrideMachines={overrideMachines} onMachineClick={handleMachineClick} />
            {!hasMatchingMachines && <div className="bg-gradient-to-br from-status-danger to-[#D50000] text-white p-4 rounded-xl text-center font-bold text-lg mt-8 max-w-lg mx-auto shadow-[0_8px_25px_rgba(244,67,54,0.4)] animate-shake border border-red-400">⚠️ No matching machines found for this density!</div>}
          </div>
        )}

        {calculatedDensity && mode === 'bot' && (
          <div className={`rounded-xl py-8 text-center mb-6 text-black border-2 transition-all animate-[fadeIn_0.3s] ${botStatusClass}`}>
            <div className="bg-white/25 inline-block px-4 py-1 rounded text-xs font-black tracking-[3px] uppercase mb-2">Base Powder Density</div>
            <div className="text-5xl font-bold">{calculatedDensity} <span className="text-2xl">g/mL</span></div>
            <div className="text-2xl font-bold mt-4">{botStatusText}</div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {mode === 'bot' && (
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex flex-col gap-2 flex-1"><label className="text-primary font-bold">Appearance</label><select value={appearance} onChange={(e) => setAppearance(e.target.value)} className={`bg-[#2d2d2d] text-white border-2 rounded-lg p-3 outline-none ${appearance === 'U' ? 'border-status-danger' : 'border-status-success'}`}><option value="A">Acceptable</option><option value="U">Unacceptable</option></select></div>
              <div className="flex flex-col gap-2 flex-1"><label className="text-primary font-bold">Free Flowing</label><select value={freeFlowing} onChange={(e) => setFreeFlowing(e.target.value)} className={`bg-[#2d2d2d] text-white border-2 rounded-lg p-3 outline-none ${freeFlowing === 'U' ? 'border-status-danger' : 'border-status-success'}`}><option value="A">Acceptable</option><option value="U">Unacceptable</option></select></div>
            </div>
          )}

          {mode === 'level9' && (
            <>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex flex-col gap-2 flex-1"><label className="text-primary font-bold">Buggy Number</label><input type="text" value={buggyNumber} onChange={(e) => setBuggyNumber(e.target.value)} placeholder="e.g., B001" className="bg-[#2d2d2d] text-white border-2 border-primary rounded-lg p-3 outline-none focus:border-status-success"/></div>
                <div className="flex flex-col gap-2 flex-1"><label className="text-primary font-bold">Silo/Machine Numbers</label><input type="text" value={siloMachine} onChange={handleSiloChange} placeholder="e.g., 1,2,3 or click grid" className="bg-[#2d2d2d] text-white border-2 border-primary rounded-lg p-3 outline-none focus:border-status-success"/></div>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex flex-col gap-2 flex-1"><label className="text-primary font-bold">Appearance</label><select value={appearance} onChange={(e) => setAppearance(e.target.value)} className={`bg-[#2d2d2d] text-white border-2 rounded-lg p-3 outline-none ${appearance === 'U' ? 'border-status-danger' : 'border-status-success'}`}><option value="A">Acceptable</option><option value="U">Unacceptable</option></select></div>
                <div className="flex flex-col gap-2 flex-1"><label className="text-primary font-bold">Fragrance</label><select value={fragrance} onChange={(e) => setFragrance(e.target.value)} className={`bg-[#2d2d2d] text-white border-2 rounded-lg p-3 outline-none ${fragrance === 'U' ? 'border-status-danger' : 'border-status-success'}`}><option value="A">Acceptable</option><option value="U">Unacceptable</option></select></div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-primary font-bold">Remarks</label>
            <textarea value={remarksText} onChange={(e) => setRemarksText(e.target.value)} placeholder="Enter additional remarks..." className="bg-[#2d2d2d] text-white border-2 border-primary rounded-lg p-3 outline-none focus:border-status-success min-h-[100px] resize-y"></textarea>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center mt-6 gap-3 mb-16">
        <button onClick={handleSave} disabled={saveStatus.state === 'saving' || saveStatus.state === 'saved'} className="bg-gradient-to-br from-primary to-primary-dark text-black px-10 py-4 rounded-xl font-bold text-lg hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(0,188,212,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">💾 Save Test</button>
        {saveStatus.message && <div className={`font-bold text-lg ${saveStatus.state === 'saved' ? 'text-status-success' : saveStatus.state === 'error' ? 'text-status-danger' : 'text-status-warning'}`}>{saveStatus.message}</div>}
      </div>

      <MachineModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} machine={modalMachine} isMatch={modalMachineStatus.isMatch} isSelected={modalMachineStatus.isSelected} onToggleSelect={handleToggleSelect} onOverride={handleOverride} />

      {showTestCounter && (
        <button onClick={() => setIsHistoryModalOpen(true)} className="fixed bottom-5 right-5 bg-[#1a1a1a] px-6 py-3 rounded-full flex items-center gap-3 z-40 shadow-[0_0_20px_rgba(0,188,212,0.4)] border-2 border-primary hover:scale-105 hover:bg-primary/20 transition-all cursor-pointer animate-[fadeIn_0.5s_ease-out]">
          <span className="text-gray-400 text-sm font-medium">Tests this shift:</span>
          <span className="text-primary text-2xl font-black">{shiftTests.length}</span>
          <span className="bg-status-success/20 text-status-success px-2 py-1 rounded-md text-xs uppercase tracking-wider font-bold ml-1">{mode === 'level9' ? 'LEVEL 9' : 'BOT'}</span>
        </button>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsHistoryModalOpen(false)}>
          <div className="bg-dark-card border-2 border-primary rounded-2xl w-[95%] max-w-5xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,188,212,0.3)] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#333] flex justify-between items-center bg-gradient-to-r from-[#1E1E1E] to-[#2d2d2d]"><h2 className="text-2xl font-black text-primary tracking-widest uppercase">{mode === 'level9' ? '🏭 Level 9 Tests this Shift' : '🤖 BOT Tests this Shift'}</h2><button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-500 hover:text-white text-4xl leading-none transition-colors">&times;</button></div>
            <div className="p-6 overflow-auto custom-scrollbar">
              {shiftTests.length === 0 ? <div className="text-center text-gray-500 py-12 text-lg">No tests recorded yet for this shift.</div> : (
                <div className="overflow-x-auto rounded-lg border border-[#333]">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-black/40">
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Time</th><th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Weight</th><th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Density</th><th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Status</th>
                        {mode === 'level9' && <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Buggy</th>}
                        {mode === 'level9' && <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Machine</th>}
                        <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Appr.</th>
                        {mode === 'level9' ? <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Frag.</th> : <th className="p-4 border-b-2 border-primary text-primary text-xs uppercase tracking-wider font-bold">Flow</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#333]">
                      {shiftTests.map((test) => (
                        <tr key={test.id} className="hover:bg-primary/5 transition-colors">
                          <td className="p-4 text-gray-300 font-medium">{formatTime(test.createdAt || test.localCreatedAt)}</td>
                          <td className="p-4 text-white font-bold">{test.weight}g</td>
                          <td className="p-4 text-white font-bold">{parseFloat(test.density).toFixed(3)}</td>
                          <td className="p-4">{getModalDensityBadge(parseFloat(test.density))}</td>
                          {mode === 'level9' && <td className="p-4 text-gray-300">{test.buggyNumber || '--'}</td>}
                          {mode === 'level9' && <td className="p-4 text-primary font-bold">{test.machines ? test.machines.join(', ') : '--'}</td>}
                          <td className="p-4 text-white font-bold">{test.appearance === 'U' ? 'U' : 'A'}</td>
                          {mode === 'level9' ? <td className="p-4 text-white font-bold">{test.fragrance === 'U' ? 'U' : 'A'}</td> : <td className="p-4 text-white font-bold">{(test.flowProperty === 'U' || test.flowProperty === 'NFF') ? 'U' : 'A'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}