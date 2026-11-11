// src/pages/SystemConfig/ItemMasterTab.jsx
//
// Item Master — CRUD for items (raw materials, packaging, consumables, office supplies, finished goods).

import { useState, useEffect } from 'react';
import {
  getAllItems, createItem, updateItem, deleteItem,
  subscribeToItems
} from '../../services/inventoryOperations';

export default function ItemMasterTab({ config }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', category: 'RAW_MATERIAL', unitOfMeasure: 'kg',
    defaultWarehouse: 'RM-WH', minStockLevel: 0, maxStockLevel: 0,
    standardCost: 0, isTrackedByLot: false, expiryTracking: false, isActive: true
  });
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    const unsub = subscribeToItems((items) => {
      setItems(items);
      setLoading(false);
    });
    return unsub;
  }, []);

  const categories = [
    { id: 'RAW_MATERIAL', label: '🏭 Raw Material' },
    { id: 'PACKAGING', label: '📦 Packaging' },
    { id: 'CONSUMABLE', label: '🧤 Consumable' },
    { id: 'OFFICE_SUPPLY', label: '📄 Office Supply' },
    { id: 'FINISHED_GOOD', label: '✅ Finished Good' }
  ];

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditMode(true);
      setEditingId(item.id);
      setForm({ ...item, isActive: item.isActive !== false });
    } else {
      setEditMode(false);
      setEditingId(null);
      setForm({
        code: '', name: '', category: 'RAW_MATERIAL', unitOfMeasure: 'kg',
        defaultWarehouse: 'RM-WH', minStockLevel: 0, maxStockLevel: 0,
        standardCost: 0, isTrackedByLot: false, expiryTracking: false, isActive: true
      });
    }
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editMode && editingId) {
        await updateItem(editingId, form);
        setToast('Item updated!', false);
      } else {
        await createItem(form);
        setToast('Item created!', false);
      }
      setOpen(false);
    } catch (err) {
      setToast('Error saving item', true);
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      await deleteItem(id);
      setToast('Item deleted', false);
    } catch (err) {
      setToast('Error deleting item', true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">🏭 Item Master</h2>
        <button onClick={() => handleOpenModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Item</button>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
              <th className="p-3">🔢 Code</th>
              <th className="p-3">📛 Name</th>
              <th className="p-3">📂 Category</th>
              <th className="p-3">⚖️ Unit</th>
              <th className="p-3">🏠 Default Warehouse</th>
              <th className="p-3">📉 Min Stock</th>
              <th className="p-3">📈 Max Stock</th>
              <th className="p-3">💰 Std Cost (₦)</th>
              <th className="p-3">🔢 Lot Tracked</th>
              <th className="p-3">📅 Expiry</th>
              <th className="p-3">🟢 Active</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="12" className="p-6 text-center text-gray-400">Loading items...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="12" className="p-6 text-center text-gray-400">No items found.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold mono">{item.code}</td>
                  <td className="p-3 text-white">{item.name}</td>
                  <td className="p-3 text-gray-300">
                    {categories.find(c => c.id === item.category)?.label || item.category}
                  </td>
                  <td className="p-3 text-white">{item.unitOfMeasure}</td>
                  <td className="p-3 text-gray-400 text-sm">{item.defaultWarehouse}</td>
                  <td className="p-3 text-white">{item.minStockLevel}</td>
                  <td className="p-3 text-white">{item.maxStockLevel}</td>
                  <td className="p-3 text-white mono">{item.standardCost}</td>
                  <td className="p-3 text-center">{item.isTrackedByLot ? '✅' : '❌'}</td>
                  <td className="p-3 text-center">{item.expiryTracking ? '✅' : '❌'}</td>
                  <td className="p-3 text-center">{item.isActive ? '✅' : '❌'}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => handleOpenModal(item)} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️</button>
                    <button onClick={() => handleDelete(item.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{editMode ? '✏️ Edit Item' : '➕ Add Item'}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Item Code</label>
                <input type="text" name="code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Item Name</label>
                <input type="text" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category</label>
                <select name="category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Unit of Measure</label>
                  <input type="text" name="unitOfMeasure" value={form.unitOfMeasure} onChange={e => setForm({ ...form, unitOfMeasure: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Default Warehouse</label>
                  <input type="text" name="defaultWarehouse" value={form.defaultWarehouse} onChange={e => setForm({ ...form, defaultWarehouse: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min Stock Level</label>
                  <input type="number" name="minStockLevel" value={form.minStockLevel} onChange={e => setForm({ ...form, minStockLevel: Number(e.target.value) || 0 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Stock Level</label>
                  <input type="number" name="maxStockLevel" value={form.maxStockLevel} onChange={e => setForm({ ...form, maxStockLevel: Number(e.target.value) || 0 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Standard Cost (₦)</label>
                <input type="number" name="standardCost" value={form.standardCost} onChange={e => setForm({ ...form, standardCost: Number(e.target.value) || 0 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-4 gap-4 items-end">
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="isTrackedByLot" checked={form.isTrackedByLot} onChange={e => setForm({ ...form, isTrackedByLot: e.target.checked })} className="w-4 h-4" />
                  <label className="text-sm text-gray-300">Track by Lot</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="expiryTracking" checked={form.expiryTracking} onChange={e => setForm({ ...form, expiryTracking: e.target.checked })} className="w-4 h-4" />
                  <label className="text-sm text-gray-300">Track Expiry</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="isActive" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                  <label className="text-sm text-gray-300">Active</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
