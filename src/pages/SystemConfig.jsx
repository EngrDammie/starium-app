// src/pages/SystemConfig.jsx
//
// Admin panel shell. Owns ALL state + Firestore handlers; each tab is a
// presentational component under src/pages/SystemConfig/. To add a tab:
// add it to SYSTEM_TABS, create the component, branch it in the render below.
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { SYSTEM_TABS } from './SystemConfig/tabs';
import { DEFAULT_FACTORY_CONFIG } from './SystemConfig/factoryDefaults';
import MachinesTab from './SystemConfig/MachinesTab';
import LinesTab from './SystemConfig/LinesTab';
import GramSpecsTab from './SystemConfig/GramSpecsTab';
import RolesTab from './SystemConfig/RolesTab';
import GlobalSettingsTab from './SystemConfig/GlobalSettingsTab';
import QCSettingsTab from './SystemConfig/QCSettingsTab';
import CartonWasteTab from './SystemConfig/CartonWasteTab';
import LaminateWasteTab from './SystemConfig/LaminateWasteTab';
import PalletTransferTab from './SystemConfig/PalletTransferTab';
import ImportExportTab from './SystemConfig/ImportExportTab';
import { MachineModal, LineModal, GramModal } from './SystemConfig/ConfigModals';

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

  // Pallet Transfer Settings State
  const [palletTransferSettings, setPalletTransferSettings] = useState({
    palletSizes: { "22": 100, "45": 100, "85": 80, "125": 60, "850": 20 }
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
      const currentGrams = Object.keys(config?.gramSpecs || {});
      const updates = {
        targetWastePercent: lw.targetWastePercent ?? 5,
        wasteAlertThreshold: lw.wasteAlertThreshold ?? 10,
        rollsPerShift: lw.rollsPerShift ?? 3,
        smallSacWeight: (lw.sacTypes?.find(s => s.id === 'small')?.weight || 0.080) * 1000,
        largeSacWeight: (lw.sacTypes?.find(s => s.id === 'large')?.weight || 0.160) * 1000
      };
      for (const gram of currentGrams) {
        updates[`rollWeight${gram}`] = lw.rollWeights?.[gram] ?? 0;
      }
      setLaminateWasteSettings(updates);
    }
    if (config?.palletTransfer) {
      const pt = config.palletTransfer;
      const currentGrams = Object.keys(config?.gramSpecs || {});
      const reconciled = {};
      for (const gram of currentGrams) {
        reconciled[gram] = pt.palletSizes?.[gram] || 80;
      }
      setPalletTransferSettings({
        palletSizes: reconciled
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

    try {
      const configRef = doc(db, 'config', 'settings');
      const savedSizes = config.palletTransfer?.palletSizes || {};
      const savedRanges = config.fillHeadWeightRanges || {};
      const savedRollWeights = config.laminateWaste?.rollWeights || {};
      const updates = { gramSpecs: newSpecs, updatedAt: serverTimestamp() };

      if (oldGram && oldGram !== gram) {
        if (oldGram in savedSizes) {
          updates[`palletTransfer.palletSizes.${oldGram}`] = deleteField();
          updates[`palletTransfer.palletSizes.${gram}`] = savedSizes[oldGram];
        }
        if (oldGram in savedRanges) {
          updates[`fillHeadWeightRanges.${oldGram}`] = deleteField();
          updates[`fillHeadWeightRanges.${gram}`] = savedRanges[oldGram];
        }
        if (oldGram in savedRollWeights) {
          updates[`laminateWaste.rollWeights.${oldGram}`] = deleteField();
          updates[`laminateWaste.rollWeights.${gram}`] = savedRollWeights[oldGram];
        }
      } else {
        if (!(gram in savedSizes)) updates[`palletTransfer.palletSizes.${gram}`] = 80;
        if (!(gram in savedRanges)) {
          updates[`fillHeadWeightRanges.${gram}`] = {
            tooLow: { max: 0 }, low: { min: 0, max: 0 },
            target: { min: 0, max: 0 }, high: { min: 0, max: 0 }, tooHigh: { min: 0 }
          };
        }
        if (!(gram in savedRollWeights)) updates[`laminateWaste.rollWeights.${gram}`] = 0;
      }

      await updateDoc(configRef, updates);
      showToast('Gram spec saved!');
      setIsGramModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('Error saving gram spec', true);
    }
  };

  const deleteGramSpec = async (gram) => {
    if (!window.confirm(`Delete spec for ${gram}g?`)) return;
    try {
      const configRef = doc(db, 'config', 'settings');
      await updateDoc(configRef, {
        [`gramSpecs.${gram}`]: deleteField(),
        [`palletTransfer.palletSizes.${gram}`]: deleteField(),
        [`fillHeadWeightRanges.${gram}`]: deleteField(),
        [`laminateWaste.rollWeights.${gram}`]: deleteField(),
        updatedAt: serverTimestamp()
      });
      showToast('Gram spec deleted');
    } catch (error) {
      console.error(error);
      showToast('Error deleting gram spec', true);
    }
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
        {SYSTEM_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-black' : 'bg-dark-card text-gray-400 hover:text-white hover:bg-[#252525]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'machines' && (
        <MachinesTab
          config={config}
          filteredMachines={filteredMachines}
          machineLineFilter={machineLineFilter}
          setMachineLineFilter={setMachineLineFilter}
          machineSearch={machineSearch}
          setMachineSearch={setMachineSearch}
          handleOpenMachineModal={handleOpenMachineModal}
          deleteMachine={deleteMachine}
        />
      )}

      {activeTab === 'lines' && (
        <LinesTab
          config={config}
          setLineForm={setLineForm}
          setIsLineModalOpen={setIsLineModalOpen}
          deleteLine={deleteLine}
        />
      )}

      {activeTab === 'gramspecs' && (
        <GramSpecsTab
          config={config}
          setGramForm={setGramForm}
          setIsGramModalOpen={setIsGramModalOpen}
          deleteGramSpec={deleteGramSpec}
        />
      )}

      {activeTab === 'roles' && (
        <RolesTab
          config={config}
          newDeptRole={newDeptRole}
          setNewDeptRole={setNewDeptRole}
          saveDeptRole={saveDeptRole}
          deleteDeptRole={deleteDeptRole}
          newActionRole={newActionRole}
          setNewActionRole={setNewActionRole}
          saveActionRole={saveActionRole}
          deleteActionRole={deleteActionRole}
        />
      )}

      {activeTab === 'settings' && (
        <GlobalSettingsTab
          globalSettings={globalSettings}
          handleGlobalSettingsChange={handleGlobalSettingsChange}
          packagingTeamsSettings={packagingTeamsSettings}
          setPackagingTeamsSettings={setPackagingTeamsSettings}
          saveGlobalSettings={saveGlobalSettings}
          authEnabled={authEnabled}
          toggleGlobalAuth={toggleGlobalAuth}
        />
      )}

      {activeTab === 'qc' && (
        <QCSettingsTab
          config={config}
          qcSettings={qcSettings}
          setQcSettings={setQcSettings}
          updateDatabase={updateDatabase}
        />
      )}

      {activeTab === 'cartonwaste' && (
        <CartonWasteTab
          cartonWasteSettings={cartonWasteSettings}
          setCartonWasteSettings={setCartonWasteSettings}
          updateDatabase={updateDatabase}
        />
      )}

      {activeTab === 'laminatewaste' && (
        <LaminateWasteTab
          config={config}
          laminateWasteSettings={laminateWasteSettings}
          setLaminateWasteSettings={setLaminateWasteSettings}
          updateDatabase={updateDatabase}
        />
      )}

      {activeTab === 'palletransfer' && (
        <PalletTransferTab
          config={config}
          palletTransferSettings={palletTransferSettings}
          setPalletTransferSettings={setPalletTransferSettings}
          updateDatabase={updateDatabase}
        />
      )}

      {activeTab === 'importexport' && (
        <ImportExportTab
          exportConfig={exportConfig}
          importConfig={importConfig}
          fileInputRef={fileInputRef}
        />
      )}

      {/* --- MODALS --- */}
      {isMachineModalOpen && (
        <MachineModal
          config={config}
          machineForm={machineForm}
          setMachineForm={setMachineForm}
          handleMachineGramChange={handleMachineGramChange}
          saveMachine={saveMachine}
          onClose={() => setIsMachineModalOpen(false)}
        />
      )}

      {isLineModalOpen && (
        <LineModal
          lineForm={lineForm}
          setLineForm={setLineForm}
          saveLine={saveLine}
          onClose={() => setIsLineModalOpen(false)}
        />
      )}

      {isGramModalOpen && (
        <GramModal
          gramForm={gramForm}
          setGramForm={setGramForm}
          saveGramSpec={saveGramSpec}
          onClose={() => setIsGramModalOpen(false)}
        />
      )}

    </Layout>
  );
}
