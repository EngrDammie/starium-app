// src/pages/SystemConfig/ItemMasterTab.jsx
//
// Item Master — CRUD for items (raw materials, packaging, consumables, office supplies, finished goods).
// Item categories are stored in Firestore (item_categories collection) — no hardcoded list.

import { useState, useEffect, useCallback } from 'react';
import {
  getAllItems, createItem, updateItem, deleteItem,
  subscribeToItems,
  createCategory, updateCategory, deleteCategory,
  subscribeToCategories
} from '../../services/inventoryOperations';
import Layout from '../../components/Layout';

const DEFAULT_CATEGORIES = [
  { id: 'RAW_MATERIAL', label: 'Raw Material', description: 'Primary production inputs', isActive: true },
  { id: 'PACKAGING', label: 'Packaging', description: 'Packaging materials', isActive: true },
  { id: 'CONSUMABLE', label: 'Consumable', description: 'Consumable supplies', isActive: true },
  { id: 'OFFICE_SUPPLY', label: 'Office Supply', description: 'Office supplies', isActive: true },
  { id: 'FINISHED_GOOD', label: 'Finished Good', description: 'Finished products', isActive: true }
];

export default function ItemMasterTab({ config }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [catEditMode, setCatEditMode] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', category: 'RAW_MATERIAL', unitOfMeasure: 'kg',
    defaultWarehouse: 'RM-WH', minStockLevel: 0, maxStockLevel: 0,
    standardCost: 0, isTrackedByLot: false, expiryTracking: false, isActive: true
  });
  const [catForm, setCatForm] = useState({ id: '', label: '', description: '', isActive: true });
  const [editingId, setEditingId] = useState(null);
  const [editingCatId, setEditingCatId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    const unsubItems = subscribeToItems((items) => {
      setItems(items);
      setLoading(false);
    });
    const unsubCats = subscribeToCategories((cats) => {
      setCategories(cats);
      // Auto-seed default categories if collection is empty
      if (cats.length === 0) {
        DEFAULT_CATEGORIES.forEach(cat => {
          createCategory(cat).catch(() => {}); // ignore if already exists
        });
      }
    });
    return () => { unsubItems(); unsubCats(); };
  }, []);

  // ─── CATEGORY HELPERS ──────────────────────────────────────────────

  const defaultCategoryId = categories.length > 0 ? categories[0].id : 'RAW_MATERIAL';

  useEffect(() => {
    if (!form.category || !categories.find(c => c.id === form.category)) {
      setForm(prev => ({ ...prev, category: defaultCategoryId }));
    }
  }, [categories, defaultCategoryId, form.category]);

  const handleOpenCatModal = (cat = null) => {
    if (cat) {
      setCatEditMode(true);
      setEditingCatId(cat.id);
      setCatForm({ id: cat.id, label: cat.label, description: cat.description || '', isActive: cat.isActive !== false });
    } else {
      setCatEditMode(false);
      setEditingCatId(null);
      setCatForm({ id: '', label: '', description: '', isActive: true });
    }
    setCatOpen(true);
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    if (!catForm.id.trim()) return setToast('Category ID is required', true);
    if (!catForm.label.trim()) return setToast('Category label is required', true);
    try {
      if (catEditMode && editingCatId) {
        await updateCategory(editingCatId, {
          label: catForm.label,
          description: catForm.description,
          isActive: catForm.isActive
        });
        setToast('Category updated!', false);
      } else {
        await createCategory(catForm);
        setToast('Category created!', false);
      }
      setCatOpen(false);
    } catch (err) {
      setToast('Error saving category: ' + err.message, true);
      console.error(err);
    }
  };

  const handleDeleteCat = async (id) => {
    // Check if any items use this category
    const itemsUsingCat = items.filter(i => i.category === id);
    if (itemsUsingCat.length > 0) {
      return setToast(`Cannot delete: ${itemsUsingCat.length} item(s) use this category`, true);
    }
    if (!window.confirm('Delete this category? This cannot be undone.')) return;
    try {
      await deleteCategory(id);
      setToast('Category deleted', false);
    } catch (err) {
      setToast('Error deleting category: ' + err.message, true);
    }
  };

  // ─── ITEM HELPERS ──────────────────────────────────────────────────

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditMode(true);
      setEditingId(item.id);
      setForm({ ...item, isActive: item.isActive !== false });
    } else {
      setEditMode(false);
      setEditingId(null);
      setForm({
        code: '', name: '', category: defaultCategoryId, unitOfMeasure: 'kg',
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
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-primary">🏭 Item Master</h2>
          <p className="text-xs text-gray-500">Items and item categories</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleOpenCatModal()} className="bg-[#333] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#555] text-sm">➕ Category</button>
          <button onClick={() => handleOpenModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Item</button>
        </div>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {/* ─── CATEGORIES SECTION ────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">📂 Item Categories</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                <th className="p-3">🔢 ID</th>
                <th className="p-3">📛 Label</th>
                <th className="p-3">📝 Description</th>
                <th className="p-3">🟢 Active</th>
                <th className="p-3">📦 Items</th>
                <th className="p-3">⚡ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {categories.length === 0 ? (
                <tr><td colSpan="6" className="p-6 text-center text-gray-400">No categories defined. Add one to get started.</td></tr>
              ) : (
                categories.map((cat) => {
                  const itemCount = items.filter(i => i.category === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-white/5">
                      <td className="p-3 text-status-warning font-bold mono">{cat.id}</td>
                      <td className="p-3 text-white">{cat.label}</td>
                      <td className="p-3 text-gray-400 text-sm">{cat.description || '—'}</td>
                      <td className="p-3 text-center">{cat.isActive ? '✅' : '❌'}</td>
                      <td className="p-3 text-white">{itemCount}</td>
                      <td className="p-3 flex gap-2">
                        <button onClick={() => handleOpenCatModal(cat)} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️</button>
                        {itemCount === 0 && (
                          <button onClick={() => handleDeleteCat(cat.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️</button>
                        )}
                        {itemCount > 0 && (
                          <button disabled className="bg-[#444] text-gray-500 px-3 py-1 rounded cursor-not-allowed" title="Items use this category">🗑️</button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ITEMS SECTION ─────────────────────────────────────────── */}
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

      {/* ─── ITEM MODAL ────────────────────────────────────────────── */}
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
                <select name="category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                  {categories.map(c => (
                    <option key={c.id} value={c.id} disabled={!c.isActive}>
                      {c.isActive ? c.label : `❌ ${c.label} (inactive)`}
                    </option>
                  ))}
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

      {/* ─── CATEGORY MODAL ────────────────────────────────────────── */}
      {catOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{catEditMode ? '✏️ Edit Category' : '➕ Add Category'}</h3>
              <button onClick={() => setCatOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSaveCat} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category ID</label>
                <input type="text" name="id" value={catForm.id} onChange={e => setCatForm({ ...catForm, id: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="e.g. RAW_MATERIAL" required />
                <p className="text-xs text-gray-500 mt-1">Used as the stored value. No spaces, lowercase or UPPER_SNAKE_CASE.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Label</label>
                <input type="text" name="label" value={catForm.label} onChange={e => setCatForm({ ...catForm, label: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="e.g. Raw Material" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input type="text" name="description" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="e.g. Primary production inputs" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="isActive" checked={catForm.isActive} onChange={e => setCatForm({ ...catForm, isActive: e.target.checked })} className="w-4 h-4" />
                <label className="text-sm text-gray-300">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setCatOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}