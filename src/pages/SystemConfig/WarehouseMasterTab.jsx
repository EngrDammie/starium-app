// src/pages/SystemConfig/WarehouseMasterTab.jsx
//
// Warehouse Master — CRUD for warehouses and bins.

import { useState, useEffect } from 'react';
import {
  getAllWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  subscribeToWarehouses,
  getAllBins, createBin, deleteBin, subscribeToBins,
  generateBinGrid, createBinsForWarehouse
} from '../../services/inventoryOperations';

export default function WarehouseMasterTab({ config }) {
  const [warehouses, setWarehouses] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedWh, setSelectedWh] = useState(null);
  const [loading, setLoading] = useState(true);

  // Warehouse modal
  const [whOpen, setWhOpen] = useState(false);
  const [whEdit, setWhEdit] = useState(false);
  const [whForm, setWhForm] = useState({ code: '', name: '', type: 'RAW_MATERIAL', zones: ['A'], isActive: true });

  // Bin modal
  const [binOpen, setBinOpen] = useState(false);
  const [binEdit, setBinEdit] = useState(false);
  const [binForm, setBinForm] = useState({ warehouseId: '', zone: '', aisle: '', rack: 1, shelf: 1, capacityKg: 5000, currentItemId: null, currentLotId: null, currentQty: 0, status: 'AVAILABLE' });

  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const warehouseTypes = [
    { id: 'RAW_MATERIAL', label: '🏭 Raw Material Warehouse' },
    { id: 'PRODUCTION_FLOOR', label: '⚙️ Production Floor' },
    { id: 'FINISHED_GOODS', label: '✅ Finished Goods Warehouse' },
    { id: 'OFFICE_STORE', label: '📄 Office Store' }
  ];

  useEffect(() => {
    const unsub1 = subscribeToWarehouses((whs) => {
      setWarehouses(whs);
      if (whs.length > 0 && !selectedWh) setSelectedWh(whs[0].id);
    });
    const unsub2 = subscribeToBins((bs) => setBins(bs));
    return () => { unsub1(); unsub2(); };
  }, [selectedWh]);

  useEffect(() => {
    if (selectedWh) {
      const whBins = bins.filter(b => b.warehouseId === selectedWh);
      // Just refresh the bins list
    }
  }, [selectedWh, bins]);

  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    try {
      if (whEdit) {
        await updateWarehouse(editingWhId, whForm);
        setToast('Warehouse updated!', false);
      } else {
        await createWarehouse(whForm);
        setToast('Warehouse created!', false);
      }
      setWhOpen(false);
    } catch (err) {
      setToast('Error saving warehouse', true);
    }
  };

  const handleDeleteWarehouse = async (id) => {
    if (!window.confirm('Delete warehouse? All bins will be lost.')) return;
    try {
      await deleteWarehouse(id);
      setToast('Warehouse deleted', false);
      setSelectedWh(null);
    } catch (err) {
      setToast('Error deleting warehouse', true);
    }
  };

  const handleGenerateBins = async () => {
    if (!selectedWh) return;
    const wh = warehouses.find(w => w.id === selectedWh);
    if (!wh) return;
    if (!window.confirm(`Generate bin grid for ${wh.name}? This will create bins across zones ${wh.zones.join(', ')}.`)) return;
    try {
      const bins = generateBinGrid(wh.code);
      const count = await createBinsForWarehouse(wh.code, bins);
      setToast(`${count} bins generated!`, false);
    } catch (err) {
      setToast('Error generating bins', true);
    }
  };

  // Bin operations
  const handleSaveBin = async (e) => {
    e.preventDefault();
    try {
      const fullAddress = `${binForm.warehouseId}-${binForm.zone}-${String(binForm.aisle).padStart(2, '0')}-${binForm.rack}-${binForm.shelf}`;
      await createBin({ ...binForm, fullAddress });
      setToast('Bin created!', false);
      setBinOpen(false);
    } catch (err) {
      setToast('Error saving bin', true);
    }
  };

  const handleDeleteBin = async (id) => {
    if (!window.confirm('Delete bin?')) return;
    try {
      await deleteBin(id);
      setToast('Bin deleted', false);
    } catch (err) {
      setToast('Error deleting bin', true);
    }
  };

  let editingWhId = null;

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const whBins = bins.filter(b => b.warehouseId === selectedWh);

  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">🏠 Warehouse Master</h2>
        <button onClick={() => { setWhEdit(false); setWhForm({ code: '', name: '', type: 'RAW_MATERIAL', zones: ['A'], isActive: true }); setWhOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Warehouse</button>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Warehouses list */}
        <div className="lg:col-span-3">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Warehouses</h3>
            <div className="space-y-2">
              {loading ? (
                <div className="text-center text-gray-400 text-xs py-4">Loading...</div>
              ) : warehouses.map((wh) => (
                <div
                  key={wh.id}
                  onClick={() => setSelectedWh(wh.id)}
                  className={`p-3 rounded border cursor-pointer hover:bg-[#252525] ${selectedWh === wh.id ? 'bg-primary/10 border-primary' : 'border-[#333]'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-white">{wh.name}</div>
                      <div className="text-xs text-gray-500">{wh.code}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${wh.isActive ? 'bg-status-success/20 text-status-success' : 'bg-status-danger/20 text-status-danger'}`}>
                      {wh.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{warehouseTypes.find(t => t.id === wh.type)?.label || wh.type}</div>
                </div>
              ))}
            </div>
          </div>
          {selectedWh && (
            <div className="mt-4">
              <button onClick={handleGenerateBins} className="w-full py-2 rounded bg-[#333] text-white text-sm hover:bg-[#555]">🔧 Generate Bin Grid</button>
              <button onClick={() => { setWhEdit(true); const wh = warehouses.find(w => w.id === selectedWh); setWhForm({ code: wh.code, name: wh.name, type: wh.type, zones: wh.zones, isActive: wh.isActive }); setWhOpen(true); }} className="w-full py-2 rounded bg-[#333] text-white text-sm mt-2 hover:bg-[#555]">✏️ Edit Warehouse</button>
              <button onClick={() => handleDeleteWarehouse(selectedWh)} className="w-full py-2 rounded bg-status-danger/20 text-status-danger text-sm mt-2 hover:bg-status-danger hover:text-white">🗑️ Delete</button>
            </div>
          )}
        </div>

        {/* Right: Bins for selected warehouse */}
        <div className="lg:col-span-9">
          {selectedWh ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">📦 Bins — {warehouses.find(w => w.id === selectedWh)?.name}</h3>
                <button onClick={() => { setBinEdit(false); setBinForm({ warehouseId: selectedWh, zone: '', aisle: '', rack: 1, shelf: 1, capacityKg: 5000, status: 'AVAILABLE' }); setBinOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary-dark">➕ Add Bin</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                      <th className="p-3">📍 Address</th>
                      <th className="p-3">📦 Zone</th>
                      <th className="p-3">🛤️ Aisle</th>
                      <th className="p-3">🔢 Rack</th>
                      <th className="p-3">🗄️ Shelf</th>
                      <th className="p-3">📦 Item</th>
                      <th className="p-3">🔢 Lot</th>
                      <th className="p-3">⚖️ Qty</th>
                      <th className="p-3">📊 Status</th>
                      <th className="p-3">⚡ Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333]">
                    {whBins.length === 0 ? (
                      <tr><td colSpan="10" className="p-6 text-center text-gray-400">No bins. Generate bin grid first.</td></tr>
                    ) : (
                      whBins.map((bin) => (
                        <tr key={bin.id} className="hover:bg-white/5">
                          <td className="p-3 text-status-warning font-bold mono">{bin.fullAddress}</td>
                          <td className="p-3 text-white">{bin.zone}</td>
                          <td className="p-3 text-white">{bin.aisle}</td>
                          <td className="p-3 text-white">{bin.rack}</td>
                          <td className="p-3 text-white">{bin.shelf}</td>
                          <td className="p-3 text-gray-400 text-sm">{bin.currentItemId || '—'}</td>
                          <td className="p-3 text-gray-400 text-sm">{bin.currentLotId || '—'}</td>
                          <td className="p-3 text-white">{bin.currentQty}</td>
                          <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-xs ${bin.status === 'AVAILABLE' ? 'bg-status-success/20 text-status-success' : bin.status === 'RESERVED' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-danger/20 text-status-danger'}`}>{bin.status}</span></td>
                          <td className="p-3 flex gap-2">
                            <button onClick={() => { setBinEdit(true); setBinForm({ ...bin }); setBinOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️</button>
                            <button onClick={() => handleDeleteBin(bin.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-500">Select a warehouse to view bins</div>
          )}
        </div>
      </div>

      {/* Warehouse Modal */}
      {whOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{whEdit ? '✏️ Edit Warehouse' : '➕ Add Warehouse'}</h3>
              <button onClick={() => setWhOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Warehouse Code</label>
                <input type="text" name="code" value={whForm.code} onChange={e => setWhForm({ ...whForm, code: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Warehouse Name</label>
                <input type="text" name="name" value={whForm.name} onChange={e => setWhForm({ ...whForm, name: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Type</label>
                <select name="type" value={whForm.type} onChange={e => setWhForm({ ...whForm, type: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                  {warehouseTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Zones (comma-separated)</label>
                <input type="text" name="zones" value={whForm.zones.join(', ')} onChange={e => setWhForm({ ...whForm, zones: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="A, B, C" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" name="isActive" checked={whForm.isActive} onChange={e => setWhForm({ ...whForm, isActive: e.target.checked })} className="w-4 h-4" />
                <label className="text-sm text-gray-300">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setWhOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bin Modal */}
      {binOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{binEdit ? '✏️ Edit Bin' : '➕ Add Bin'}</h3>
              <button onClick={() => setBinOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSaveBin} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Warehouse</label>
                <input type="text" name="warehouseId" value={binForm.warehouseId} readOnly className="w-full p-2 bg-[#121212] border border-[#444] rounded text-gray-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Zone</label>
                  <input type="text" name="zone" value={binForm.zone} onChange={e => setBinForm({ ...binForm, zone: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Aisle</label>
                  <input type="text" name="aisle" value={binForm.aisle} onChange={e => setBinForm({ ...binForm, aisle: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rack</label>
                  <input type="number" name="rack" value={binForm.rack} onChange={e => setBinForm({ ...binForm, rack: Number(e.target.value) || 1 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Shelf</label>
                  <input type="number" name="shelf" value={binForm.shelf} onChange={e => setBinForm({ ...binForm, shelf: Number(e.target.value) || 1 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Capacity (kg)</label>
                <input type="number" name="capacityKg" value={binForm.capacityKg} onChange={e => setBinForm({ ...binForm, capacityKg: Number(e.target.value) || 5000 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setBinOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
