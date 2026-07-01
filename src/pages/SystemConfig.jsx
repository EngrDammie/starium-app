// src/pages/SystemConfig.jsx
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';

export default function SystemConfig() {
  const { config, loadingConfig } = useConfig();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('machines');
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  // Modals State
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [isGramModalOpen, setIsGramModalOpen] = useState(false);

  // Form States
  const [machineForm, setMachineForm] = useState({ id: '', displayNumber: '', name: '', line: '', gram: 125, min: '', max: '', fillHeads: 2, isEdit: false });
  const [lineForm, setLineForm] = useState({ id: '', name: '', order: '', isEdit: false });
  const [gramForm, setGramForm] = useState({ oldGram: '', gram: '', min: '', max: '', pieces: '', breakdown: '', bags: '', freebies: '', isEdit: false });
  
  // Role Definition States
  const [newDeptRole, setNewDeptRole] = useState({ id: '', label: '', category: '' });
  const [newActionRole, setNewActionRole] = useState({ id: '', label: '' });

  // Global Settings State
  const [globalSettings, setGlobalSettings] = useState({
    level9MinDensity: 0.200, level9MaxDensity: 0.310, level9Divisor: 1580,
    botMinDensity: 0.200, botMaxDensity: 0.240, botDivisor: 1680,
    dayShiftStart: 7, nightShiftStart: 19, machineGridColumns: 6
  });
  const [authEnabled, setAuthEnabled] = useState(true);

  // Packaging Teams State
  const [packagingTeamsSettings, setPackagingTeamsSettings] = useState({
    labels: 'A, B, C',
    defaultTeam: 'A'
  });

  // Carton Waste Settings State
  const [cartonWasteSettings, setCartonWasteSettings] = useState({
    targetWastePercent: 5,
    wasteAlertThreshold: 10
  });

  // QC Settings State
  const [qcSettings, setQcSettings] = useState({
    weightRanges: {
      "22":  { tooLow: { max: 128 }, low: { min: 129, max: 136 }, target: { min: 137, max: 141 }, high: { min: 142, max: 149 }, tooHigh: { min: 150 } },
      "45":  { tooLow: { max: 259 }, low: { min: 260, max: 272 }, target: { min: 273, max: 282 }, high: { min: 283, max: 290 }, tooHigh: { min: 291 } },
      "85":  { tooLow: { max: 487 }, low: { min: 488, max: 516 }, target: { min: 517, max: 536 }, high: { min: 537, max: 564 }, tooHigh: { min: 565 } },
      "125": { tooLow: { max: 487 }, low: { min: 488, max: 506 }, target: { min: 507, max: 517 }, high: { min: 518, max: 538 }, tooHigh: { min: 539 } },
      "850": { tooLow: { max: 861 }, low: { min: 862, max: 870 }, target: { min: 871, max: 900 }, high: { min: 901, max: 980 }, tooHigh: { min: 981 } }
    },
    checkIntervals: {
      stringWeight: 15,
      bagInspection: 15,
      cartonInspection: 60
    }
  });

  // Laminate Waste Settings State
  const [laminateWasteSettings, setLaminateWasteSettings] = useState({
    targetWastePercent: 5,
    wasteAlertThreshold: 10,
    rollsPerShift: 3,
    smallSacWeight: 80,
    largeSacWeight: 160,
    rollWeight22: 51.32,
    rollWeight45: 54.40,
    rollWeight85: 51.60,
    rollWeight125: 53.70,
    rollWeight850: 49.90
  });

  // Filters
  const [machineSearch, setMachineSearch] = useState('');
  const [machineLineFilter, setMachineLineFilter] = useState('');

  useEffect(() => {
    const fetchAuthSettings = async () => {
      const authDoc = await getDoc(doc(db, 'config', 'auth_settings'));
      if (authDoc.exists()) setAuthEnabled(authDoc.data().authEnabled !== false);
    };
    fetchAuthSettings();
  }, []);

  useEffect(() => {
    if (config) {
      setGlobalSettings({
        level9MinDensity: config.level9MinDensity ?? 0.200,
        level9MaxDensity: config.level9MaxDensity ?? 0.310,
        level9Divisor: config.level9Divisor ?? 1580,
        botMinDensity: config.botMinDensity ?? 0.200,
        botMaxDensity: config.botMaxDensity ?? 0.240,
        botDivisor: config.botDivisor ?? 1680,
        dayShiftStart: config.dayShiftStart ?? 7,
        nightShiftStart: config.nightShiftStart ?? 19,
        machineGridColumns: config.machineGridColumns ?? 6
      });
    }
    if (config?.packagingTeams) {
      setPackagingTeamsSettings({
        labels: (config.packagingTeams.labels || ['A', 'B', 'C']).join(', '),
        defaultTeam: config.packagingTeams.defaultTeam ?? 'A'
      });
    }
    if (config?.fillHeadWeightRanges || config?.qcCheckIntervals) {
      setQcSettings(prev => ({
        weightRanges: config.fillHeadWeightRanges || prev.weightRanges,
        checkIntervals: config.qcCheckIntervals || prev.checkIntervals
      }));
    }
    if (config?.cartonWaste) {
      setCartonWasteSettings({
        targetWastePercent: config.cartonWaste.targetWastePercent ?? 5,
        wasteAlertThreshold: config.cartonWaste.wasteAlertThreshold ?? 10
      });
    }
    if (config?.laminateWaste) {
      const lw = config.laminateWaste;
      setLaminateWasteSettings({
        targetWastePercent: lw.targetWastePercent ?? 5,
        wasteAlertThreshold: lw.wasteAlertThreshold ?? 10,
        rollsPerShift: lw.rollsPerShift ?? 3,
        smallSacWeight: (lw.sacTypes?.find(s => s.id === 'small')?.weight || 0.080) * 1000,
        largeSacWeight: (lw.sacTypes?.find(s => s.id === 'large')?.weight || 0.160) * 1000,
        rollWeight22: lw.rollWeights?.['22'] ?? 51.32,
        rollWeight45: lw.rollWeights?.['45'] ?? 54.40,
        rollWeight85: lw.rollWeights?.['85'] ?? 51.60,
        rollWeight125: lw.rollWeights?.['125'] ?? 53.70,
        rollWeight850: lw.rollWeights?.['850'] ?? 49.90
      });
    }
  }, [config]);

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const updateDatabase = async (updates, successMsg) => {
    try {
      await setDoc(doc(db, 'config', 'settings'), { ...updates, updatedAt: serverTimestamp() }, { merge: true });
      showToast(successMsg);
      return true;
    } catch (error) {
      console.error(error);
      showToast('Error updating database', true);
      return false;
    }
  };

  // --- MACHINE LOGIC ---
  const handleOpenMachineModal = (machine = null) => {
    if (machine) {
      const spec = config.gramSpecs?.[String(machine.gram)];
      setMachineForm({ ...machine, min: spec ? spec.min : machine.min, max: spec ? spec.max : machine.max, isEdit: true });
    } else {
      const maxId = config.machines?.length > 0 ? Math.max(...config.machines.map(m => m.id)) : 0;
      const firstLine = config.productionLines?.[0]?.id || '';
      let nextDisplay = 1;
      if (firstLine) {
        const lineM = config.machines?.filter(m => m.line === firstLine) || [];
        nextDisplay = lineM.length > 0 ? Math.max(...lineM.map(m => m.displayNumber || m.id)) + 1 : 1;
      }
      setMachineForm({ id: maxId + 1, displayNumber: nextDisplay, name: '', line: firstLine, gram: 125, min: '', max: '', fillHeads: 2, isEdit: false });
    }
    setIsMachineModalOpen(true);
  };

  const handleMachineGramChange = (newGram) => {
    const spec = config.gramSpecs?.[String(newGram)];
    setMachineForm(prev => ({ ...prev, gram: newGram, min: spec ? spec.min : prev.min, max: spec ? spec.max : prev.max }));
  };

  const saveMachine = async (e) => {
    e.preventDefault();
    let newMachines = [...(config.machines || [])];
    let { id, displayNumber, name, line, gram, min, max, fillHeads, isEdit } = machineForm;
    id = parseInt(id); displayNumber = parseInt(displayNumber); gram = parseInt(gram);
    min = parseFloat(min); max = parseFloat(max);

    if (isNaN(min) || isNaN(max)) {
      const spec = config.gramSpecs?.[String(gram)];
      if (spec) { min = spec.min; max = spec.max; }
    }

    const machineData = { id, displayNumber, name, line, gram, min, max, fillHeads };

    if (isEdit) {
      newMachines = newMachines.map(m => m.id === id ? machineData : m);
    } else {
      if (newMachines.find(m => m.id === id)) return showToast(`ID ${id} already exists!`, true);
      newMachines.push(machineData);
    }

    if (await updateDatabase({ machines: newMachines }, 'Machine saved successfully!')) setIsMachineModalOpen(false);
  };

  const deleteMachine = async (id) => {
    if (!window.confirm(`Delete machine M${id}?`)) return;
    const newMachines = (config.machines || []).filter(m => m.id !== id);
    await updateDatabase({ machines: newMachines }, 'Machine deleted');
  };

  // --- LINE LOGIC ---
  const saveLine = async (e) => {
    e.preventDefault();
    let newLines = [...(config.productionLines || [])];
    const { id, name, order, isEdit } = lineForm;
    const lineData = { id, name, order: parseInt(order) };

    if (isEdit) {
      newLines = newLines.map(l => l.id === id ? lineData : l);
    } else {
      if (newLines.find(l => l.id === id)) return showToast('Line ID exists!', true);
      newLines.push(lineData);
    }
    if (await updateDatabase({ productionLines: newLines }, 'Line saved!')) setIsLineModalOpen(false);
  };

  const deleteLine = async (id) => {
    if (!window.confirm(`Delete line ${id}?`)) return;
    const newLines = (config.productionLines || []).filter(l => l.id !== id);
    await updateDatabase({ productionLines: newLines }, 'Line deleted');
  };

  // --- GRAM SPEC LOGIC ---
  const saveGramSpec = async (e) => {
    e.preventDefault();
    const newSpecs = { ...config.gramSpecs };
    const { oldGram, gram, min, max, pieces, breakdown, bags, freebies } = gramForm;
    const bagCount = parseInt(bags) || 0;
    const freebieCount = parseInt(freebies) || 0;

    if (oldGram && oldGram !== gram) delete newSpecs[oldGram];
    newSpecs[gram] = {
      min: parseFloat(min), max: parseFloat(max),
      piecesPerCarton: parseInt(pieces) || (bagCount + freebieCount),
      piecesBreakdown: breakdown || `${bagCount} pcs + ${freebieCount} freebies`,
      bagCount, freebieCount
    };

    if (await updateDatabase({ gramSpecs: newSpecs }, 'Gram spec saved!')) setIsGramModalOpen(false);
  };

  const deleteGramSpec = async (gram) => {
    if (!window.confirm(`Delete spec for ${gram}g?`)) return;
    const newSpecs = { ...config.gramSpecs };
    delete newSpecs[gram];
    await updateDatabase({ gramSpecs: newSpecs }, 'Gram spec deleted');
  };

  // --- ROLE DEFINITIONS LOGIC ---
  const saveDeptRole = async (e) => {
    e.preventDefault();
    if (!newDeptRole.id || !newDeptRole.label || !newDeptRole.category) return showToast('Fill all fields', true);
    const newRoles = [...(config.departmentRoles || []), newDeptRole];
    if (await updateDatabase({ departmentRoles: newRoles }, 'Department Role Added!')) {
      setNewDeptRole({ id: '', label: '', category: '' });
    }
  };

  const deleteDeptRole = async (id) => {
    if (!window.confirm(`Delete department role ${id}?`)) return;
    const newRoles = (config.departmentRoles || []).filter(r => r.id !== id);
    await updateDatabase({ departmentRoles: newRoles }, 'Role deleted');
  };

  const saveActionRole = async (e) => {
    e.preventDefault();
    if (!newActionRole.id || !newActionRole.label) return showToast('Fill all fields', true);
    const newRoles = [...(config.actionRoles || []), newActionRole];
    if (await updateDatabase({ actionRoles: newRoles }, 'Action Role Added!')) {
      setNewActionRole({ id: '', label: '' });
    }
  };

  const deleteActionRole = async (id) => {
    if (!window.confirm(`Delete action role ${id}?`)) return;
    const newRoles = (config.actionRoles || []).filter(r => r.id !== id);
    await updateDatabase({ actionRoles: newRoles }, 'Role deleted');
  };

  // --- GLOBAL SETTINGS LOGIC ---
  const handleGlobalSettingsChange = (e) => {
    const { name, value } = e.target;
    setGlobalSettings(prev => ({ ...prev, [name]: Number(value) }));
  };

  const saveGlobalSettings = async () => {
    if (globalSettings.level9MinDensity >= globalSettings.level9MaxDensity) return showToast('L9 Min must be < Max', true);
    if (globalSettings.botMinDensity >= globalSettings.botMaxDensity) return showToast('BOT Min must be < Max', true);
    const teamsArray = packagingTeamsSettings.labels.split(',').map(t => t.trim()).filter(Boolean);
    await updateDatabase({
      ...globalSettings,
      packagingTeams: { labels: teamsArray, defaultTeam: packagingTeamsSettings.defaultTeam }
    }, 'Global Settings Saved!');
  };

  const toggleGlobalAuth = async () => {
    const newState = !authEnabled;
    try {
      await setDoc(doc(db, 'config', 'auth_settings'), { authEnabled: newState, updatedAt: serverTimestamp() }, { merge: true });
      setAuthEnabled(newState);
      showToast(`Authentication ${newState ? 'Enabled' : 'Disabled'}!`);
    } catch (error) {
      showToast('Error updating auth settings', true);
    }
  };

  // --- IMPORT / EXPORT LOGIC ---
  const exportConfig = () => {
    const data = {
      machines: config.machines, productionLines: config.productionLines, gramSpecs: config.gramSpecs,
      machineGridColumns: config.machineGridColumns, dayShiftStart: config.dayShiftStart, nightShiftStart: config.nightShiftStart,
      departmentRoles: config.departmentRoles, actionRoles: config.actionRoles,
      packagingTeams: config.packagingTeams,
      fillHeadWeightRanges: config.fillHeadWeightRanges,
      qcCheckIntervals: config.qcCheckIntervals,
      cartonWaste: config.cartonWaste,
      laminateWaste: config.laminateWaste,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `starium-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Configuration exported!');
  };

  const importConfig = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!window.confirm('This will overwrite your current configuration. Continue?')) { e.target.value = ''; return; }
      
      const updates = {};
      if (data.machines) updates.machines = data.machines;
      if (data.productionLines) updates.productionLines = data.productionLines;
      if (data.gramSpecs) updates.gramSpecs = data.gramSpecs;
      if (data.machineGridColumns) updates.machineGridColumns = data.machineGridColumns;
      if (data.departmentRoles) updates.departmentRoles = data.departmentRoles;
      if (data.actionRoles) updates.actionRoles = data.actionRoles;
      if (data.dayShiftStart) updates.dayShiftStart = data.dayShiftStart;
      if (data.nightShiftStart) updates.nightShiftStart = data.nightShiftStart;
      if (data.packagingTeams) updates.packagingTeams = data.packagingTeams;
      if (data.fillHeadWeightRanges) updates.fillHeadWeightRanges = data.fillHeadWeightRanges;
      if (data.qcCheckIntervals) updates.qcCheckIntervals = data.qcCheckIntervals;
      if (data.cartonWaste) updates.cartonWaste = data.cartonWaste;
      if (data.laminateWaste) updates.laminateWaste = data.laminateWaste;

      await updateDatabase(updates, 'Configuration imported successfully!');
    } catch (error) {
      showToast('Error importing configuration (Invalid JSON)', true);
    }
    e.target.value = '';
  };

  const resetToDefaults = async () => {
    if (!window.confirm('⚠️ This will reset ALL configuration to defaults. This cannot be undone! Are you sure?')) return;
    if (!window.confirm('Really reset? All custom machines, lines, and settings will be lost.')) return;

    // Standard 30 machine factory default
    const DEFAULT_FACTORY_CONFIG = {
      machineGridColumns: 6,
      packagingTeams: {
        labels: ['A', 'B', 'C'],
        defaultTeam: 'A'
      },
      productionLines: [
        { id: "1A", name: "Line 1A", order: 1 }, { id: "1B", name: "Line 1B", order: 2 },
        { id: "2A", name: "Line 2A", order: 3 }, { id: "2B", name: "Line 2B", order: 4 },
        { id: "3A", name: "Line 3A", order: 5 }, { id: "3B", name: "Line 3B", order: 6 }
      ],
      machines: [
        { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", fillHeads: 2, name: "Machine 1" },
        { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 2" },
        { id: 3, displayNumber: 3, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 3" },
        { id: 4, displayNumber: 4, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 4" },
        { id: 5, displayNumber: 5, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 5" },
        { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", fillHeads: 2, name: "Machine 6" },
        { id: 7, displayNumber: 7, gram: 85, min: 0.240, max: 0.300, line: "1B", fillHeads: 2, name: "Machine 7" },
        { id: 8, displayNumber: 8, gram: 850, min: 0.200, max: 0.270, line: "1B", fillHeads: 2, name: "Machine 8" },
        { id: 9, displayNumber: 9, gram: 85, min: 0.240, max: 0.300, line: "1B", fillHeads: 2, name: "Machine 9" },
        { id: 10, displayNumber: 10, gram: 22, min: 0.200, max: 0.310, line: "1B", fillHeads: 2, name: "Machine 10" },
        { id: 11, displayNumber: 11, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 11" },
        { id: 12, displayNumber: 12, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 12" },
        { id: 13, displayNumber: 13, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 13" },
        { id: 14, displayNumber: 14, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 14" },
        { id: 15, displayNumber: 15, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 15" },
        { id: 16, displayNumber: 16, gram: 850, min: 0.200, max: 0.270, line: "2B", fillHeads: 2, name: "Machine 16" },
        { id: 17, displayNumber: 17, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 17" },
        { id: 18, displayNumber: 18, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 18" },
        { id: 19, displayNumber: 19, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 19" },
        { id: 20, displayNumber: 20, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 20" },
        { id: 21, displayNumber: 21, gram: 850, min: 0.200, max: 0.270, line: "3A", fillHeads: 2, name: "Machine 21" },
        { id: 22, displayNumber: 22, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 22" },
        { id: 23, displayNumber: 23, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 23" },
        { id: 24, displayNumber: 24, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 24" },
        { id: 25, displayNumber: 25, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 25" },
        { id: 26, displayNumber: 26, gram: 850, min: 0.200, max: 0.270, line: "3B", fillHeads: 2, name: "Machine 26" },
        { id: 27, displayNumber: 27, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 27" },
        { id: 28, displayNumber: 28, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 28" },
        { id: 29, displayNumber: 29, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 29" },
        { id: 30, displayNumber: 30, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 30" }
      ],
      gramSpecs: {
        "22": { min: 0.200, max: 0.310, piecesPerCarton: 162, piecesBreakdown: "150 pcs + 12 freebies", bagCount: 150, freebieCount: 12 },
        "45": { min: 0.210, max: 0.310, piecesPerCarton: 84, piecesBreakdown: "78 pcs + 6 freebies", bagCount: 78, freebieCount: 6 },
        "85": { min: 0.240, max: 0.300, piecesPerCarton: 52, piecesBreakdown: "48 pcs + 4 freebies", bagCount: 48, freebieCount: 4 },
        "125": { min: 0.200, max: 0.270, piecesPerCarton: 31, piecesBreakdown: "28 pcs + 3 freebies", bagCount: 28, freebieCount: 3 },
        "850": { min: 0.200, max: 0.270, piecesPerCarton: 7, piecesBreakdown: "6 pouches + 1 freebie", bagCount: 6, freebieCount: 1 }
      },
      qcCheckIntervals: {
        stringWeight: 15,
        bagInspection: 15,
        cartonInspection: 60
      },
      fillHeadWeightRanges: {
        "22":  { tooLow: { max: 128 }, low: { min: 129, max: 136 }, target: { min: 137, max: 141 }, high: { min: 142, max: 149 }, tooHigh: { min: 150 } },
        "45":  { tooLow: { max: 259 }, low: { min: 260, max: 272 }, target: { min: 273, max: 282 }, high: { min: 283, max: 290 }, tooHigh: { min: 291 } },
        "85":  { tooLow: { max: 487 }, low: { min: 488, max: 516 }, target: { min: 517, max: 536 }, high: { min: 537, max: 564 }, tooHigh: { min: 565 } },
        "125": { tooLow: { max: 487 }, low: { min: 488, max: 506 }, target: { min: 507, max: 517 }, high: { min: 518, max: 538 }, tooHigh: { min: 539 } },
        "850": { tooLow: { max: 861 }, low: { min: 862, max: 870 }, target: { min: 871, max: 900 }, high: { min: 901, max: 980 }, tooHigh: { min: 981 } }
      },
      cartonWaste: {
        targetWastePercent: 5,
        wasteAlertThreshold: 10
      },
      laminateWaste: {
        targetWastePercent: 5,
        wasteAlertThreshold: 10,
        rollsPerShift: 3,
        rollWeights: {
          "22": 51.32,
          "45": 54.40,
          "85": 51.60,
          "125": 53.70,
          "850": 49.90
        },
        sacTypes: [
          { id: 'small', label: 'Small Sac', weight: 0.080 },
          { id: 'large', label: 'Large Sac', weight: 0.160 }
        ],
        defaultSacType: 'small'
      }
    };

    await updateDatabase(DEFAULT_FACTORY_CONFIG, 'Configuration reset to factory defaults!');
  };

  const filteredMachines = (config?.machines || []).filter(m => {
    if (machineLineFilter && m.line !== machineLineFilter) return false;
    if (machineSearch && !m.name.toLowerCase().includes(machineSearch.toLowerCase()) && !String(m.id).includes(machineSearch)) return false;
    return true;
  }).sort((a,b) => a.id - b.id);

  if (loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading Admin Panel...</div></Layout>;

  return (
    <Layout title="⚙️ System Configuration" subtitle="Master Factory Control Center" maxWidth="max-w-7xl">
      
      <div className={`fixed bottom-5 right-5 px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-transform duration-300 z-50 ${toast.show ? 'translate-y-0' : 'translate-y-[150%]'} ${toast.isError ? 'bg-status-danger' : 'bg-status-success'}`}>
        {toast.message}
      </div>

      <div className="flex overflow-x-auto gap-2 mb-6 border-b border-[#333] pb-2 custom-scrollbar">
        {['machines', 'lines', 'gramspecs', 'roles', 'settings', 'qc', 'cartonwaste', 'laminatewaste', 'importexport'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-primary text-black' : 'bg-dark-card text-gray-400 hover:text-white hover:bg-[#252525]'}`}
          >
            {tab === 'machines' && '🏭 Machines'}
            {tab === 'lines' && '📋 Lines'}
            {tab === 'gramspecs' && '⚖️ Gram Specs'}
            {tab === 'roles' && '🏢 Role Definitions'}
            {tab === 'settings' && '⚙️ Global Settings'}
            {tab === 'qc' && '🔬 QC Settings'}
            {tab === 'cartonwaste' && '📦 Carton Waste'}
            {tab === 'laminatewaste' && '🗑️ Laminate Waste'}
            {tab === 'importexport' && '💾 Import / Export'}
          </button>
        ))}
      </div>

      {activeTab === 'machines' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-primary">🏭 Machine Management</h2>
            <button onClick={() => handleOpenMachineModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Machine</button>
          </div>

          <div className="flex gap-4 md:gap-6 mb-6">
            <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#444] text-center flex-1 shadow-inner"><div className="text-4xl font-bold text-primary">{config.machines?.length || 0}</div><div className="text-xs text-gray-400 uppercase tracking-wider mt-2 font-bold">🏭 Total Machines</div></div>
            <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#444] text-center flex-1 shadow-inner"><div className="text-4xl font-bold text-primary">{[...new Set((config.machines || []).map(m => m.line))].length}</div><div className="text-xs text-gray-400 uppercase tracking-wider mt-2 font-bold">📋 Production Lines</div></div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <select value={machineLineFilter} onChange={e => setMachineLineFilter(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
              <option value="">All Lines</option>
              {(config.productionLines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input type="text" value={machineSearch} onChange={e => setMachineSearch(e.target.value)} placeholder="Search by name or ID..." className="flex-1 bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider"><th className="p-3">🔢 ID</th><th className="p-3">🖥️ Display #</th><th className="p-3">📛 Name</th><th className="p-3">📋 Line</th><th className="p-3">⚖️ Gram</th><th className="p-3">🔩 Heads</th><th className="p-3">⬇️ Min</th><th className="p-3">⬆️ Max</th><th className="p-3">⚡ Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {filteredMachines.map(m => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="p-3 text-white">{m.id}</td><td className="p-3 text-primary font-bold">M{m.displayNumber || m.id}</td><td className="p-3 text-white">{m.name}</td><td className="p-3 text-gray-300">{m.line}</td><td className="p-3 text-status-warning font-bold">{m.gram}g</td><td className="p-3 text-status-warning font-bold">{m.fillHeads ?? 2}H</td><td className="p-3 text-gray-300">{m.min.toFixed(3)}</td><td className="p-3 text-gray-300">{m.max.toFixed(3)}</td>
                    <td className="p-3 flex gap-2"><button onClick={() => handleOpenMachineModal(m)} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️ Edit</button><button onClick={() => deleteMachine(m.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'lines' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-primary">📋 Production Lines</h2>
            <button onClick={() => { setLineForm({ id: '', name: '', order: (config.productionLines?.length || 0) + 1, isEdit: false }); setIsLineModalOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Line</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider"><th className="p-3">🔢 Order</th><th className="p-3">🆔 Line ID</th><th className="p-3">📛 Name</th><th className="p-3">🏭 Count</th><th className="p-3">⚡ Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {[...(config.productionLines || [])].sort((a,b)=>a.order-b.order).map(l => (
                  <tr key={l.id} className="hover:bg-white/5">
                    <td className="p-3 text-white">{l.order}</td><td className="p-3 text-primary font-bold">{l.id}</td><td className="p-3 text-white">{l.name}</td><td className="p-3 text-gray-300">{(config.machines || []).filter(m => m.line === l.id).length}</td>
                    <td className="p-3 flex gap-2"><button onClick={() => { setLineForm({ ...l, isEdit: true }); setIsLineModalOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️ Edit</button><button onClick={() => deleteLine(l.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'gramspecs' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-primary">⚖️ Gram Specifications</h2>
            <button onClick={() => { setGramForm({ oldGram: '', gram: '', min: '', max: '', pieces: '', bags: '', freebies: '', isEdit: false }); setIsGramModalOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Gram Spec</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider"><th className="p-3">⚖️ Gram</th><th className="p-3">⬇️ Min Density</th><th className="p-3">⬆️ Max Density</th><th className="p-3">📦 Pieces</th><th className="p-3">📝 Breakdown</th><th className="p-3">🛍️ Bags</th><th className="p-3">🎁 Freebies</th><th className="p-3">⚡ Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {Object.entries(config.gramSpecs || {}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([gram, spec]) => (
                  <tr key={gram} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold">{gram}g</td><td className="p-3 text-white">{spec.min.toFixed(3)}</td><td className="p-3 text-white">{spec.max.toFixed(3)}</td><td className="p-3 text-gray-300">{spec.piecesPerCarton || 'N/A'}</td>
                    <td className="p-3 text-gray-400 text-sm">{spec.piecesBreakdown || '-'}</td>
                    <td className="p-3 text-white">{spec.bagCount ?? '-'}</td>
                    <td className="p-3 text-white">{spec.freebieCount ?? '-'}</td>
                    <td className="p-3 flex gap-2"><button onClick={() => { setGramForm({ oldGram: gram, gram, min: spec.min, max: spec.max, pieces: spec.piecesPerCarton||'', breakdown: spec.piecesBreakdown||'', bags: spec.bagCount||'', freebies: spec.freebieCount||'', isEdit: true }); setIsGramModalOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️ Edit</button><button onClick={() => deleteGramSpec(gram)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🎯 FIXED: SMART STACKING FORM FOR ROLES TAB */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s]">
          {/* Department Roles */}
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
            <h2 className="text-xl font-bold text-primary mb-2">🏢 Department Access Roles</h2>
            <p className="text-sm text-gray-400 mb-6">These roles define which Pages and Menus a user can see.</p>
            
            <form onSubmit={saveDeptRole} className="flex flex-col gap-3 mb-6 bg-[#1a1a1a] p-4 rounded-lg border border-[#444]">
              <input type="text" placeholder="Category (e.g., Human Resources)" required value={newDeptRole.category} onChange={e=>setNewDeptRole({...newDeptRole, category: e.target.value})} className="w-full bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="ID (e.g., hr_staff)" required value={newDeptRole.id} onChange={e=>setNewDeptRole({...newDeptRole, id: e.target.value.toLowerCase().replace(/\s+/g, '_')})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
                <input type="text" placeholder="Label (e.g., HR Staff)" required value={newDeptRole.label} onChange={e=>setNewDeptRole({...newDeptRole, label: e.target.value})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
              </div>

              <button type="submit" className="w-full bg-primary text-black font-bold px-4 py-3 mt-1 rounded hover:bg-primary-dark transition-all">➕ Add Department Role</button>
            </form>

            <div className="space-y-4">
              {Object.entries((config.departmentRoles || []).reduce((acc, r) => {
                if (!acc[r.category]) acc[r.category] = [];
                acc[r.category].push(r);
                return acc;
              }, {})).map(([category, roles]) => (
                <div key={category}>
                  <h4 className="text-status-warning text-xs uppercase font-bold tracking-wider mb-2 border-b border-[#333] pb-1">{category}</h4>
                  <ul className="space-y-2">
                    {roles.map(r => (
                      <li key={r.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded border border-[#333]">
                        <div><span className="font-bold text-white mr-3">{r.label}</span><span className="text-xs text-gray-500 font-mono">{r.id}</span></div>
                        <button onClick={() => deleteDeptRole(r.id)} className="text-status-danger hover:text-red-400 px-2 text-xl">&times;</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Action Roles */}
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
            <h2 className="text-xl font-bold text-primary mb-2">⚡ Action Approval Roles</h2>
            <p className="text-sm text-gray-400 mb-6">These roles define which specific Buttons a user can click.</p>
            
            <form onSubmit={saveActionRole} className="flex flex-col gap-3 mb-6 bg-[#1a1a1a] p-4 rounded-lg border border-[#444]">
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="ID (e.g., forklift_op)" required value={newActionRole.id} onChange={e=>setNewActionRole({...newActionRole, id: e.target.value.toLowerCase().replace(/\s+/g, '_')})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
                <input type="text" placeholder="Label (e.g., 🚜 Forklift)" required value={newActionRole.label} onChange={e=>setNewActionRole({...newActionRole, label: e.target.value})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
              </div>
              <button type="submit" className="w-full bg-primary text-black font-bold px-4 py-3 mt-1 rounded hover:bg-primary-dark transition-all">⚡ Add Action Role</button>
            </form>

            <ul className="space-y-2">
              {(config.actionRoles || []).map(r => (
                <li key={r.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded border border-[#333]">
                  <div><span className="font-bold text-white mr-3">{r.label}</span><span className="text-xs text-gray-500 font-mono">{r.id}</span></div>
                  <button onClick={() => deleteActionRole(r.id)} className="text-status-danger hover:text-red-400 px-2 text-xl">&times;</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">⚙️ Global Factory Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">📊 Level 9 Density Rules</h3>
              <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬇️ Min Density:</label><input type="number" name="level9MinDensity" step="0.001" value={globalSettings.level9MinDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬆️ Max Density:</label><input type="number" name="level9MaxDensity" step="0.001" value={globalSettings.level9MaxDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center"><label className="text-gray-300">➗ Divisor:</label><input type="number" name="level9Divisor" step="1" value={globalSettings.level9Divisor} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🤖 BOT Density Rules</h3>
              <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬇️ Min Density:</label><input type="number" name="botMinDensity" step="0.001" value={globalSettings.botMinDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬆️ Max Density:</label><input type="number" name="botMaxDensity" step="0.001" value={globalSettings.botMaxDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center"><label className="text-gray-300">➗ Divisor:</label><input type="number" name="botDivisor" step="1" value={globalSettings.botDivisor} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🕐 Shift Times (24h)</h3>
              <div className="flex justify-between items-center mb-3"><label className="text-gray-300">☀️ Day Shift Start:</label><input type="number" name="dayShiftStart" min="0" max="23" value={globalSettings.dayShiftStart} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center"><label className="text-gray-300">🌙 Night Shift Start:</label><input type="number" name="nightShiftStart" min="0" max="23" value={globalSettings.nightShiftStart} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">👥 Packaging Teams</h3>
              <div className="mb-3">
                <label className="text-gray-300">🏷️ Team Labels (comma-separated):</label>
                <input type="text"
                  value={packagingTeamsSettings.labels}
                  onChange={e => setPackagingTeamsSettings(prev => ({ ...prev, labels: e.target.value }))}
                  placeholder="A, B, C"
                  className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="mb-3">
                <label className="text-gray-300">⭐ Default Team:</label>
                <input type="text"
                  value={packagingTeamsSettings.defaultTeam}
                  onChange={e => setPackagingTeamsSettings(prev => ({ ...prev, defaultTeam: e.target.value }))}
                  placeholder="A"
                  className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🖥️ UI Settings</h3>
              <div className="flex justify-between items-center mb-3"><label className="text-gray-300">📐 Machine Grid Columns:</label><input type="number" name="machineGridColumns" min="1" max="12" value={globalSettings.machineGridColumns} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>
          </div>
          
          <button onClick={saveGlobalSettings} className="bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">💾 Save All Settings</button>

          <div className="mt-12 pt-8 border-t border-[#333]">
            <h3 className="text-xl font-bold text-white mb-4">🔐 Master Authentication Toggle</h3>
            <div className="flex items-center gap-4 bg-[#1a1a1a] p-6 border border-[#444] rounded-xl max-w-lg">
              <label className="relative inline-block w-14 h-8 cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={authEnabled} onChange={toggleGlobalAuth} />
                <div className="w-full h-full bg-[#444] rounded-full peer peer-checked:bg-status-success transition-colors duration-300"></div>
                <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"></div>
              </label>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white">Auth is <span className={authEnabled ? "text-status-success" : "text-gray-500"}>{authEnabled ? 'ENABLED' : 'DISABLED'}</span></span>
                <span className="text-xs text-gray-400 mt-1">Disabling allows "Ghost Admin" mode without login.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qc' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">🔬 QC Settings</h2>

          {/* Check Intervals */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-status-warning mb-2">⏱️ Check Intervals</h3>
            <p className="text-sm text-gray-400 mb-4">Minimum time (in minutes) between consecutive checks per machine. Prevents overly frequent inspections.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'stringWeight', label: '🔬 String Weight Check', default: 15 },
                { key: 'bagInspection', label: '🛍️ Bag Inspection', default: 15 },
                { key: 'cartonInspection', label: '📦 Carton Inspection', default: 60 }
              ].map(item => (
                <div key={item.key} className="bg-[#1a1a1a] border border-[#444] p-4 rounded-xl">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">{item.label}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="number" min="0" value={qcSettings.checkIntervals[item.key] ?? item.default}
                      onChange={e => setQcSettings(prev => ({ ...prev, checkIntervals: { ...prev.checkIntervals, [item.key]: Number(e.target.value) } }))}
                      className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    <span className="text-gray-500 text-sm">minutes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* String Weight Ranges */}
          <h3 className="text-lg font-bold text-status-warning mb-2">⚖️ String Weight Ranges</h3>
          <p className="text-sm text-gray-400 mb-4">Configure the acceptable weight ranges per gram setting for sachet string checks.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {['22', '45', '85', '125', '850'].map(gram => {
              const range = qcSettings.weightRanges[gram];
              if (!range) return null;
              return (
                <div key={gram} className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl">
                  <h3 className="text-status-warning font-bold text-lg mb-4 border-b border-[#333] pb-2">{gram}g Settings</h3>

                  <div className="mb-3">
                    <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📉 Too Low (max)</label>
                    <input type="number" value={range.tooLow.max}
                      onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], tooLow: { max: Number(e.target.value) } } } }))}
                      className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                  </div>

                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📉 Low (min)</label>
                      <input type="number" value={range.low.min}
                        onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], low: { ...prev.weightRanges[gram].low, min: Number(e.target.value) } } } }))}
                        className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 Low (max)</label>
                      <input type="number" value={range.low.max}
                        onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], low: { ...prev.weightRanges[gram].low, max: Number(e.target.value) } } } }))}
                        className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                  </div>

                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">🎯 Target (min)</label>
                      <input type="number" value={range.target.min}
                        onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], target: { ...prev.weightRanges[gram].target, min: Number(e.target.value) } } } }))}
                        className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">🎯 Target (max)</label>
                      <input type="number" value={range.target.max}
                        onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], target: { ...prev.weightRanges[gram].target, max: Number(e.target.value) } } } }))}
                        className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                  </div>

                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 High (min)</label>
                      <input type="number" value={range.high.min}
                        onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], high: { ...prev.weightRanges[gram].high, min: Number(e.target.value) } } } }))}
                        className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 High (max)</label>
                      <input type="number" value={range.high.max}
                        onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], high: { ...prev.weightRanges[gram].high, max: Number(e.target.value) } } } }))}
                        className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 Too High (min)</label>
                    <input type="number" value={range.tooHigh.min}
                      onChange={e => setQcSettings(prev => ({ weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], tooHigh: { ...prev.weightRanges[gram].tooHigh, min: Number(e.target.value) } } } }))}
                      className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={async () => {
            await updateDatabase({ fillHeadWeightRanges: qcSettings.weightRanges, qcCheckIntervals: qcSettings.checkIntervals }, 'QC settings saved!');
          }} className="bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
            💾 Save QC Settings
          </button>
        </div>
      )}

      {activeTab === 'cartonwaste' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">📦 Carton Waste Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">⚠️ Waste Thresholds</h3>
              <div className="flex justify-between items-center mb-3">
                <label className="text-gray-300">🎯 Target Waste %:</label>
                <input type="number" min="0" max="100" step="0.5"
                  value={cartonWasteSettings.targetWastePercent}
                  onChange={e => setCartonWasteSettings(prev => ({ ...prev, targetWastePercent: Number(e.target.value) }))}
                  className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
              </div>
              <div className="text-xs text-gray-500 mt-1">Machines above this % turn red.</div>
              <div className="flex justify-between items-center mt-4 mb-3">
                <label className="text-gray-300">🔔 Alert Threshold %:</label>
                <input type="number" min="0" max="100" step="0.5"
                  value={cartonWasteSettings.wasteAlertThreshold}
                  onChange={e => setCartonWasteSettings(prev => ({ ...prev, wasteAlertThreshold: Number(e.target.value) }))}
                  className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
              </div>
              <div className="text-xs text-gray-500 mt-1">Broadcasts alert when a check exceeds this %.</div>
            </div>
          </div>

          <button onClick={async () => {
            await updateDatabase({
              cartonWaste: {
                targetWastePercent: cartonWasteSettings.targetWastePercent,
                wasteAlertThreshold: cartonWasteSettings.wasteAlertThreshold
              }
            }, 'Carton waste settings saved!');
          }} className="mt-6 bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
            💾 Save Carton Waste Settings
          </button>
        </div>
      )}

      {activeTab === 'laminatewaste' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">🗑️ Laminate Waste Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">⚠️ Waste Thresholds</h3>
              <div className="flex justify-between items-center mb-3">
                <label className="text-gray-300">🎯 Target Waste %:</label>
                <input type="number" min="0" max="100" step="0.5"
                  value={laminateWasteSettings.targetWastePercent}
                  onChange={e => setLaminateWasteSettings(prev => ({ ...prev, targetWastePercent: Number(e.target.value) }))}
                  className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
              </div>
              <div className="text-xs text-gray-500 mt-1">Machines above this % turn red.</div>
              <div className="flex justify-between items-center mt-4 mb-3">
                <label className="text-gray-300">🔔 Alert Threshold %:</label>
                <input type="number" min="0" max="100" step="0.5"
                  value={laminateWasteSettings.wasteAlertThreshold}
                  onChange={e => setLaminateWasteSettings(prev => ({ ...prev, wasteAlertThreshold: Number(e.target.value) }))}
                  className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
              </div>
              <div className="text-xs text-gray-500 mt-1">Broadcasts alert when waste exceeds this %.</div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🧻 Roll Settings</h3>
              <div className="mb-3">
                <label className="text-gray-300">📦 Rolls per Shift:</label>
                <input type="number" min="1" step="0.5"
                  value={laminateWasteSettings.rollsPerShift}
                  onChange={e => setLaminateWasteSettings(prev => ({ ...prev, rollsPerShift: Number(e.target.value) }))}
                  className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-4 mb-2 border-b border-[#333] pb-1">⚖️ Roll Weight per Gram Setting (kg)</div>
              {['22', '45', '85', '125', '850'].map(gram => (
                <div key={gram} className="flex justify-between items-center mb-2">
                  <label className="text-gray-300">{gram}g:</label>
                  <input type="number" min="0" step="0.01"
                    value={laminateWasteSettings[`rollWeight${gram}`]}
                    onChange={e => setLaminateWasteSettings(prev => ({ ...prev, [`rollWeight${gram}`]: Number(e.target.value) }))}
                    className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
                </div>
              ))}
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🛄 Sac Types</h3>
              <div className="mb-3">
                <label className="text-gray-300">🟢 Small Sac Weight (g):</label>
                <input type="number" min="0" step="1"
                  value={laminateWasteSettings.smallSacWeight}
                  onChange={e => setLaminateWasteSettings(prev => ({ ...prev, smallSacWeight: Number(e.target.value) }))}
                  className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="mb-3">
                <label className="text-gray-300">🟡 Large Sac Weight (g):</label>
                <input type="number" min="0" step="1"
                  value={laminateWasteSettings.largeSacWeight}
                  onChange={e => setLaminateWasteSettings(prev => ({ ...prev, largeSacWeight: Number(e.target.value) }))}
                  className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
            </div>
          </div>

          <button onClick={async () => {
            await updateDatabase({
              laminateWaste: {
                targetWastePercent: laminateWasteSettings.targetWastePercent,
                wasteAlertThreshold: laminateWasteSettings.wasteAlertThreshold,
                rollsPerShift: laminateWasteSettings.rollsPerShift,
                sacTypes: [
                  { id: 'small', label: 'Small Sac', weight: laminateWasteSettings.smallSacWeight / 1000 },
                  { id: 'large', label: 'Large Sac', weight: laminateWasteSettings.largeSacWeight / 1000 }
                ],
                rollWeights: {
                  "22": laminateWasteSettings.rollWeight22,
                  "45": laminateWasteSettings.rollWeight45,
                  "85": laminateWasteSettings.rollWeight85,
                  "125": laminateWasteSettings.rollWeight125,
                  "850": laminateWasteSettings.rollWeight850
                }
              }
            }, 'Laminate waste settings saved!');
          }} className="mt-6 bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
            💾 Save Laminate Waste Settings
          </button>
        </div>
      )}

      {activeTab === 'importexport' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">💾 Import / Export Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-2">📤 Export Configuration</h3>
              <p className="text-gray-400 text-sm mb-6">Download all current settings (machines, roles, rules) as a JSON file.</p>
              <button onClick={exportConfig} className="w-full bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all">📥 Download Backup</button>
            </div>
            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-2">📥 Import Configuration</h3>
              <p className="text-gray-400 text-sm mb-6">Restore settings from a previously exported backup JSON file.</p>
              <input type="file" accept=".json" ref={fileInputRef} onChange={importConfig} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#333] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#444] transition-all border border-[#555]">📤 Upload Backup File</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsMachineModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-lg shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{machineForm.isEdit ? '✏️ Edit Machine' : '➕ Add Machine'}</h2>
            <form onSubmit={saveMachine} className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">🔢 Internal ID</label>
                  <input type="number" required disabled={machineForm.isEdit} value={machineForm.id} onChange={e => setMachineForm({...machineForm, id: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary disabled:opacity-50" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">🖥️ Display Number (M#)</label>
                  <input type="number" required value={machineForm.displayNumber} onChange={e => setMachineForm({...machineForm, displayNumber: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">📛 Machine Name</label>
                <input type="text" required value={machineForm.name} onChange={e => setMachineForm({...machineForm, name: e.target.value})} placeholder="e.g., Machine 1" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">📋 Production Line</label>
                  <select required value={machineForm.line} onChange={e => setMachineForm({...machineForm, line: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
                    <option value="" disabled>Select Line</option>
                    {(config.productionLines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">⚖️ Gram Setting</label>
                  <select required value={machineForm.gram} onChange={e => handleMachineGramChange(e.target.value)} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
                    {Object.keys(config.gramSpecs || {}).sort((a,b)=>Number(a)-Number(b)).map(g => <option key={g} value={g}>{g}g</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">🔩 Fill Heads</label>
                  <input type="number" min="1" required value={machineForm.fillHeads} onChange={e => setMachineForm({...machineForm, fillHeads: Number(e.target.value)})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">⬇️ Min Density</label>
                  <input type="number" step="0.001" disabled value={machineForm.min} className="w-full mt-1 p-3 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded-lg cursor-not-allowed" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">⬆️ Max Density</label>
                  <input type="number" step="0.001" disabled value={machineForm.max} className="w-full mt-1 p-3 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded-lg cursor-not-allowed" />
                </div>
              </div>
              <div className="text-xs text-status-warning mt-[-10px] mb-2 text-center">Min/Max auto-filled from Gram Specs</div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setIsMachineModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">💾 Save Machine</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLineModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsLineModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{lineForm.isEdit ? '✏️ Edit Line' : '➕ Add Line'}</h2>
            <form onSubmit={saveLine} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">🆔 Line ID</label>
                <input type="text" required disabled={lineForm.isEdit} value={lineForm.id} onChange={e => setLineForm({...lineForm, id: e.target.value.toUpperCase()})} placeholder="e.g., 4A" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary disabled:opacity-50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">📛 Line Name</label>
                <input type="text" required value={lineForm.name} onChange={e => setLineForm({...lineForm, name: e.target.value})} placeholder="e.g., Line 4A" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">🔢 Display Order (1=Rightmost)</label>
                <input type="number" required value={lineForm.order} onChange={e => setLineForm({...lineForm, order: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsLineModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGramModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsGramModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{gramForm.isEdit ? '✏️ Edit Gram Spec' : '➕ Add Gram Spec'}</h2>
            <form onSubmit={saveGramSpec} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">⚖️ Gram Setting</label>
                <input type="number" required value={gramForm.gram} onChange={e => setGramForm({...gramForm, gram: e.target.value})} placeholder="e.g., 55" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">⬇️ Min Density</label>
                  <input type="number" required step="0.001" value={gramForm.min} onChange={e => setGramForm({...gramForm, min: e.target.value})} placeholder="0.200" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">⬆️ Max Density</label>
                  <input type="number" required step="0.001" value={gramForm.max} onChange={e => setGramForm({...gramForm, max: e.target.value})} placeholder="0.310" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">📝 Breakdown (Free Text)</label>
                <input type="text" value={gramForm.breakdown} onChange={e => setGramForm({...gramForm, breakdown: e.target.value})} placeholder="e.g., 27 strings * 6 pcs" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">🛍️ Bags per Carton</label>
                  <input type="number" min="0" value={gramForm.bags} onChange={e => setGramForm({...gramForm, bags: e.target.value})} placeholder="e.g., 150" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">🎁 Freebies per Carton</label>
                  <input type="number" min="0" value={gramForm.freebies} onChange={e => setGramForm({...gramForm, freebies: e.target.value})} placeholder="e.g., 12" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">📦 Pieces Per Carton (bags + freebies)</label>
                <input type="number" value={parseInt(gramForm.bags || 0) + parseInt(gramForm.freebies || 0) || gramForm.pieces} disabled
                  className="w-full mt-1 p-3 bg-[#121212] text-gray-400 border border-[#444] rounded-lg cursor-not-allowed" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsGramModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}