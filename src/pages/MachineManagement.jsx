// src/pages/MachineManagement.jsx
import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';

export default function MachineManagement() {
  const { config, loadingConfig } = useConfig();
  const fileInputRef = useRef(null);

  // 🎯 FIX: Old manual security checks completely stripped out!
  // ProtectedRoute handles all security before this page even loads.

  const [activeTab, setActiveTab] = useState('machines');
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [isGramModalOpen, setIsGramModalOpen] = useState(false);

  const [machineForm, setMachineForm] = useState({ id: '', displayNumber: '', name: '', line: '', gram: 125, min: '', max: '', isEdit: false });
  const [lineForm, setLineForm] = useState({ id: '', name: '', order: '', isEdit: false });
  const [gramForm, setGramForm] = useState({ oldGram: '', gram: '', min: '', max: '', pieces: '', breakdown: '', isEdit: false });
  const [gridColumns, setGridColumns] = useState(6);

  const [machineSearch, setMachineSearch] = useState('');
  const [machineLineFilter, setMachineLineFilter] = useState('');

  useEffect(() => {
    if (config?.machineGridColumns) setGridColumns(config.machineGridColumns);
  }, [config]);

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const updateDatabase = async (updates, successMsg) => {
    try {
      await setDoc(doc(db, 'config', 'settings'), {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showToast(successMsg);
      return true;
    } catch (error) {
      console.error(error);
      showToast('Error updating database', true);
      return false;
    }
  };

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
      setMachineForm({ id: maxId + 1, displayNumber: nextDisplay, name: '', line: firstLine, gram: 125, min: '', max: '', isEdit: false });
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
    let { id, displayNumber, name, line, gram, min, max, isEdit } = machineForm;
    id = parseInt(id); displayNumber = parseInt(displayNumber); gram = parseInt(gram);
    min = parseFloat(min); max = parseFloat(max);

    if (isNaN(min) || isNaN(max)) {
      const spec = config.gramSpecs?.[String(gram)];
      if (spec) { min = spec.min; max = spec.max; }
    }

    const machineData = { id, displayNumber, name, line, gram, min, max };

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
    if (!window.confirm(`Delete line ${id}? Machines on this line will need a new line.`)) return;
    const newLines = (config.productionLines || []).filter(l => l.id !== id);
    await updateDatabase({ productionLines: newLines }, 'Line deleted');
  };

  const saveGramSpec = async (e) => {
    e.preventDefault();
    const newSpecs = { ...config.gramSpecs };
    const { oldGram, gram, min, max, pieces, breakdown } = gramForm;

    if (oldGram && oldGram !== gram) delete newSpecs[oldGram];
    newSpecs[gram] = { min: parseFloat(min), max: parseFloat(max), piecesPerCarton: parseInt(pieces), piecesBreakdown: breakdown };

    if (await updateDatabase({ gramSpecs: newSpecs }, 'Gram spec saved!')) setIsGramModalOpen(false);
  };

  const deleteGramSpec = async (gram) => {
    if (!window.confirm(`Delete spec for ${gram}g?`)) return;
    const newSpecs = { ...config.gramSpecs };
    delete newSpecs[gram];
    await updateDatabase({ gramSpecs: newSpecs }, 'Gram spec deleted');
  };

  const exportConfig = () => {
    const data = {
      machines: config.machines,
      productionLines: config.productionLines,
      gramSpecs: config.gramSpecs,
      machineGridColumns: config.machineGridColumns,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starium-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exported!');
  };

  const importConfig = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!window.confirm('This will overwrite your current configuration. Continue?')) {
        e.target.value = '';
        return;
      }

      const updates = {};
      if (data.machines) updates.machines = data.machines;
      if (data.productionLines) updates.productionLines = data.productionLines;
      if (data.gramSpecs) updates.gramSpecs = data.gramSpecs;
      if (data.machineGridColumns) updates.machineGridColumns = data.machineGridColumns;

      await updateDatabase(updates, 'Configuration imported successfully!');
    } catch (error) {
      console.error('Import error:', error);
      showToast('Error importing configuration (Invalid JSON)', true);
    }
    e.target.value = '';
  };

  const resetToDefaults = async () => {
    if (!window.confirm('⚠️ This will reset ALL configuration to defaults. This cannot be undone! Are you sure?')) return;
    if (!window.confirm('Really reset? All custom machines, lines, and settings will be lost.')) return;

    const DEFAULT_FACTORY_CONFIG = {
      machineGridColumns: 6,
      productionLines: [
        { id: "1A", name: "Line 1A", order: 1 }, { id: "1B", name: "Line 1B", order: 2 },
        { id: "2A", name: "Line 2A", order: 3 }, { id: "2B", name: "Line 2B", order: 4 },
        { id: "3A", name: "Line 3A", order: 5 }, { id: "3B", name: "Line 3B", order: 6 }
      ],
      machines: [
        { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", name: "Machine 1" },
        { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 2" },
        { id: 3, displayNumber: 3, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 3" },
        { id: 4, displayNumber: 4, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 4" },
        { id: 5, displayNumber: 5, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 5" },
        { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", name: "Machine 6" },
        { id: 7, displayNumber: 7, gram: 85, min: 0.240, max: 0.300, line: "1B", name: "Machine 7" },
        { id: 8, displayNumber: 8, gram: 850, min: 0.200, max: 0.270, line: "1B", name: "Machine 8" },
        { id: 9, displayNumber: 9, gram: 85, min: 0.240, max: 0.300, line: "1B", name: "Machine 9" },
        { id: 10, displayNumber: 10, gram: 22, min: 0.200, max: 0.310, line: "1B", name: "Machine 10" },
        { id: 11, displayNumber: 11, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 11" },
        { id: 12, displayNumber: 12, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 12" },
        { id: 13, displayNumber: 13, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 13" },
        { id: 14, displayNumber: 14, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 14" },
        { id: 15, displayNumber: 15, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 15" },
        { id: 16, displayNumber: 16, gram: 850, min: 0.200, max: 0.270, line: "2B", name: "Machine 16" },
        { id: 17, displayNumber: 17, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 17" },
        { id: 18, displayNumber: 18, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 18" },
        { id: 19, displayNumber: 19, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 19" },
        { id: 20, displayNumber: 20, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 20" },
        { id: 21, displayNumber: 21, gram: 850, min: 0.200, max: 0.270, line: "3A", name: "Machine 21" },
        { id: 22, displayNumber: 22, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 22" },
        { id: 23, displayNumber: 23, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 23" },
        { id: 24, displayNumber: 24, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 24" },
        { id: 25, displayNumber: 25, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 25" },
        { id: 26, displayNumber: 26, gram: 850, min: 0.200, max: 0.270, line: "3B", name: "Machine 26" },
        { id: 27, displayNumber: 27, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 27" },
        { id: 28, displayNumber: 28, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 28" },
        { id: 29, displayNumber: 29, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 29" },
        { id: 30, displayNumber: 30, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 30" }
      ],
      gramSpecs: {
        "22": { min: 0.200, max: 0.310, piecesPerCarton: 162 },
        "45": { min: 0.210, max: 0.310, piecesPerCarton: 84 },
        "85": { min: 0.240, max: 0.300, piecesPerCarton: 52 },
        "125": { min: 0.200, max: 0.270, piecesPerCarton: 31 },
        "850": { min: 0.200, max: 0.270, piecesPerCarton: 7 }
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
    <Layout title="⚙️ Machine Admin Panel" subtitle="Manage machines, production lines, and app settings" maxWidth="max-w-6xl">
      
      <div className={`fixed bottom-5 right-5 px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-transform duration-300 z-50 ${toast.show ? 'translate-y-0' : 'translate-y-[150%]'} ${toast.isError ? 'bg-status-danger' : 'bg-status-success'}`}>
        {toast.message}
      </div>

      <div className="flex overflow-x-auto gap-2 mb-6 border-b border-[#333] pb-2 custom-scrollbar">
        {['machines', 'lines', 'gramspecs', 'settings', 'importexport'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-primary text-black' : 'bg-dark-card text-gray-400 hover:text-white hover:bg-[#252525]'}`}
          >
            {tab === 'machines' && '🏭 Machines'}
            {tab === 'lines' && '📋 Production Lines'}
            {tab === 'gramspecs' && '⚖️ Gram Specifications'}
            {tab === 'settings' && '🔧 Grid Settings'}
            {tab === 'importexport' && '💾 Import / Export'}
          </button>
        ))}
      </div>

      {activeTab === 'machines' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-primary">Machine Management</h2>
            <button onClick={() => handleOpenMachineModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">+ Add Machine</button>
          </div>

          <div className="flex gap-4 md:gap-6 mb-6">
            <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#444] text-center flex-1 shadow-inner">
              <div className="text-4xl font-bold text-primary">{config.machines?.length || 0}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mt-2 font-bold">Total Machines</div>
            </div>
            <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#444] text-center flex-1 shadow-inner">
              <div className="text-4xl font-bold text-primary">{[...new Set((config.machines || []).map(m => m.line))].length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mt-2 font-bold">Production Lines</div>
            </div>
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
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                  <th className="p-3">ID</th>
                  <th className="p-3">Display #</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Line</th>
                  <th className="p-3">Gram</th>
                  <th className="p-3">Min</th>
                  <th className="p-3">Max</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {filteredMachines.map(m => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="p-3 text-white">{m.id}</td>
                    <td className="p-3 text-primary font-bold">M{m.displayNumber || m.id}</td>
                    <td className="p-3 text-white">{m.name}</td>
                    <td className="p-3 text-gray-300">{m.line}</td>
                    <td className="p-3 text-status-warning font-bold">{m.gram}g</td>
                    <td className="p-3 text-gray-300">{m.min.toFixed(3)}</td>
                    <td className="p-3 text-gray-300">{m.max.toFixed(3)}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => handleOpenMachineModal(m)} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">Edit</button>
                      <button onClick={() => deleteMachine(m.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">Delete</button>
                    </td>
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
            <h2 className="text-xl font-bold text-primary">Production Lines</h2>
            <button onClick={() => { setLineForm({ id: '', name: '', order: (config.productionLines?.length || 0) + 1, isEdit: false }); setIsLineModalOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">+ Add Line</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                  <th className="p-3">Order</th>
                  <th className="p-3">Line ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Machine Count</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {[...(config.productionLines || [])].sort((a,b)=>a.order-b.order).map(l => (
                  <tr key={l.id} className="hover:bg-white/5">
                    <td className="p-3 text-white">{l.order}</td>
                    <td className="p-3 text-primary font-bold">{l.id}</td>
                    <td className="p-3 text-white">{l.name}</td>
                    <td className="p-3 text-gray-300">{(config.machines || []).filter(m => m.line === l.id).length}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => { setLineForm({ ...l, isEdit: true }); setIsLineModalOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">Edit</button>
                      <button onClick={() => deleteLine(l.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">Delete</button>
                    </td>
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
            <h2 className="text-xl font-bold text-primary">Gram Specifications</h2>
            <button onClick={() => { setGramForm({ oldGram: '', gram: '', min: '', max: '', pieces: '', breakdown: '', isEdit: false }); setIsGramModalOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">+ Add Gram Spec</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                  <th className="p-3">Gram</th>
                  <th className="p-3">Min Density</th>
                  <th className="p-3">Max Density</th>
                  <th className="p-3">Pieces / Carton</th>
                  <th className="p-3">Breakdown</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {Object.entries(config.gramSpecs || {}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([gram, spec]) => (
                  <tr key={gram} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold">{gram}g</td>
                    <td className="p-3 text-white">{spec.min.toFixed(3)}</td>
                    <td className="p-3 text-white">{spec.max.toFixed(3)}</td>
                    <td className="p-3 text-gray-300">{spec.piecesPerCarton || 'N/A'}</td>
                    <td className="p-3 text-gray-400 text-sm">{spec.piecesBreakdown || '-'}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => { setGramForm({ oldGram: gram, gram, min: spec.min, max: spec.max, pieces: spec.piecesPerCarton||'', breakdown: spec.piecesBreakdown||'', isEdit: true }); setIsGramModalOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">Edit</button>
                      <button onClick={() => deleteGramSpec(gram)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">Grid Settings</h2>
          <div className="max-w-md">
            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase">Machine Grid Columns</label>
            <input type="number" value={gridColumns} onChange={e => setGridColumns(e.target.value)} className="w-full bg-[#1a1a1a] text-white border border-[#444] rounded-lg p-3 outline-none focus:border-primary mb-4" min="1" max="12" />
            <p className="text-sm text-gray-500 mb-6">Number of columns displayed in the machine grid on desktop views.</p>
            <button onClick={() => updateDatabase({ machineGridColumns: parseInt(gridColumns) }, 'Grid settings saved!')} className="bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all">Save Settings</button>
          </div>
        </div>
      )}

      {activeTab === 'importexport' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
          <h2 className="text-xl font-bold text-primary mb-6">💾 Import / Export Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-2">📤 Export Configuration</h3>
              <p className="text-gray-400 text-sm mb-6">Download all current settings (machines, lines, gram specs) as a JSON file for backup.</p>
              <button onClick={exportConfig} className="w-full bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all">📥 Download Backup</button>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-2">📥 Import Configuration</h3>
              <p className="text-gray-400 text-sm mb-6">Restore settings from a previously exported backup JSON file.</p>
              <input type="file" accept=".json" ref={fileInputRef} onChange={importConfig} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#333] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#444] transition-all border border-[#555]">📤 Upload Backup File</button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-[#333]">
            <div className="bg-status-danger/10 border border-status-danger p-6 rounded-xl">
              <h3 className="text-lg font-bold text-status-danger mb-2">⚠️ Reset Configuration</h3>
              <p className="text-gray-400 text-sm mb-6">This will restore ALL settings to factory defaults (30 standard machines). This cannot be undone!</p>
              <button onClick={resetToDefaults} className="bg-status-danger text-white px-6 py-3 rounded-lg font-bold hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(244,67,54,0.3)]">🗑️ Reset to Defaults</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsMachineModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-lg shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{machineForm.isEdit ? 'Edit Machine' : 'Add Machine'}</h2>
            <form onSubmit={saveMachine} className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Internal ID</label>
                  <input type="number" required disabled={machineForm.isEdit} value={machineForm.id} onChange={e => setMachineForm({...machineForm, id: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary disabled:opacity-50" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Display Number (M#)</label>
                  <input type="number" required value={machineForm.displayNumber} onChange={e => setMachineForm({...machineForm, displayNumber: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Machine Name</label>
                <input type="text" required value={machineForm.name} onChange={e => setMachineForm({...machineForm, name: e.target.value})} placeholder="e.g., Machine 1" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Production Line</label>
                  <select required value={machineForm.line} onChange={e => setMachineForm({...machineForm, line: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
                    <option value="" disabled>Select Line</option>
                    {(config.productionLines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Gram Setting</label>
                  <select required value={machineForm.gram} onChange={e => handleMachineGramChange(e.target.value)} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
                    {Object.keys(config.gramSpecs || {}).sort((a,b)=>Number(a)-Number(b)).map(g => <option key={g} value={g}>{g}g</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Min Density</label>
                  <input type="number" step="0.001" disabled value={machineForm.min} className="w-full mt-1 p-3 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded-lg cursor-not-allowed" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Max Density</label>
                  <input type="number" step="0.001" disabled value={machineForm.max} className="w-full mt-1 p-3 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded-lg cursor-not-allowed" />
                </div>
              </div>
              <div className="text-xs text-status-warning mt-[-10px] mb-2 text-center">Min/Max auto-filled from Gram Specs</div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setIsMachineModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">Save Machine</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLineModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsLineModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{lineForm.isEdit ? 'Edit Line' : 'Add Line'}</h2>
            <form onSubmit={saveLine} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Line ID</label>
                <input type="text" required disabled={lineForm.isEdit} value={lineForm.id} onChange={e => setLineForm({...lineForm, id: e.target.value.toUpperCase()})} placeholder="e.g., 4A" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary disabled:opacity-50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Line Name</label>
                <input type="text" required value={lineForm.name} onChange={e => setLineForm({...lineForm, name: e.target.value})} placeholder="e.g., Line 4A" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Display Order (1=Rightmost)</label>
                <input type="number" required value={lineForm.order} onChange={e => setLineForm({...lineForm, order: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsLineModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGramModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIsGramModalOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{gramForm.isEdit ? 'Edit Gram Spec' : 'Add Gram Spec'}</h2>
            <form onSubmit={saveGramSpec} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Gram Setting</label>
                <input type="number" required value={gramForm.gram} onChange={e => setGramForm({...gramForm, gram: e.target.value})} placeholder="e.g., 55" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Min Density</label>
                  <input type="number" required step="0.001" value={gramForm.min} onChange={e => setGramForm({...gramForm, min: e.target.value})} placeholder="0.200" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 uppercase font-bold">Max Density</label>
                  <input type="number" required step="0.001" value={gramForm.max} onChange={e => setGramForm({...gramForm, max: e.target.value})} placeholder="0.310" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Pieces Per Carton</label>
                <input type="number" required value={gramForm.pieces} onChange={e => setGramForm({...gramForm, pieces: e.target.value})} placeholder="e.g., 162" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold">Breakdown (Optional)</label>
                <input type="text" value={gramForm.breakdown} onChange={e => setGramForm({...gramForm, breakdown: e.target.value})} placeholder="e.g., 27 strings * 6 pcs" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsGramModalOpen(false)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}