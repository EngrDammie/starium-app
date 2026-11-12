// src/pages/Boms.jsx
//
// BOM / Recipe management — CRUD for recipes with ingredients, yield %, versioning.

import { useState, useEffect } from 'react';
import {
  createBom, submitBomForApproval, processBomApproval, activateBom, archiveBom, deleteBom, cloneBom,
  subscribeToBoms, getAllBoms, getActiveBoms, getPendingApprovalsForRole
} from '../services/bomOperations';
import { useConfig } from '../context/ConfigContext';
import Layout from '../components/Layout';

export default function Boms() {
  const { config } = useConfig();
  const [boms, setBoms] = useState([]);
  const [activeBoms, setActiveBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingBom, setEditingBom] = useState(null);
  const [form, setForm] = useState({
    name: '', version: 1, yieldPercent: 86.9, category: 'DETERGENT_POWDER',
    ingredients: [{ itemId: '', itemName: '', itemCode: '', kgPerBatch: 0, unitOfMeasure: 'kg', isCritical: true, notes: '' }]
  });
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const userActionRoles = config?.actionRoles?.map(r => r.id) || [];
  const userDeptRoles = config?.departmentRoles?.map(r => r.id) || [];

  useEffect(() => {
    const u1 = subscribeToBoms((b) => setBoms(b));
    const u2 = subscribeToBoms((b) => setActiveBoms(b.filter(bom => bom.status === 'ACTIVE')), { status: 'ACTIVE' });
    return () => { u1(); u2(); };
  }, []);

  const userCanCreate = userDeptRoles.includes('recipe_manager');
  const userCanApprove = userActionRoles.includes('recipe_manager') || userActionRoles.includes('plant_manager');

  const addIngredient = () => setForm({ ...form, ingredients: [...form.ingredients, { itemId: '', itemName: '', itemCode: '', kgPerBatch: 0, unitOfMeasure: 'kg', isCritical: true, notes: '' }] });
  const removeIngredient = (i) => setForm({ ...form, ingredients: form.ingredients.filter((_, idx) => idx !== i) });

  const handleOpenModal = (bom = null) => {
    if (bom) {
      setEditMode(true);
      setEditingBom(bom);
      setForm({
        name: bom.name,
        version: bom.version,
        yieldPercent: bom.yieldPercent,
        category: bom.category,
        ingredients: bom.ingredients.map(ing => ({ ...ing }))
      });
    } else {
      setEditMode(false);
      setEditingBom(null);
      setForm({ name: '', version: 1, yieldPercent: 86.9, category: 'DETERGENT_POWDER', ingredients: [{ itemId: '', itemName: '', itemCode: '', kgPerBatch: 0, unitOfMeasure: 'kg', isCritical: true, notes: '' }] });
    }
    setCreateOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editMode && editingBom) {
        await updateBom(editingBom.id, form);
        setToast('BOM updated!', false);
      } else {
        await createBom(form, 'current-user', 'Current User');
        setToast('BOM created!', false);
      }
      setCreateOpen(false);
    } catch (err) {
      setToast('Error saving BOM: ' + err.message, true);
    }
  };

  const handleSubmit = async (bomId) => {
    try {
      await submitBomForApproval(bomId);
      setToast('BOM submitted for approval!', false);
    } catch (err) {
      setToast('Error: ' + err.message, true);
    }
  };

  const handleClone = async (bom) => {
    const newVersion = (bom.version || 1) + 1;
    if (!window.confirm(`Clone ${bom.name} v${bom.version} as v${newVersion}?`)) return;
    try {
      await cloneBom(bom.id, newVersion, 'current-user', 'Current User');
      setToast('BOM cloned!', false);
    } catch (err) {
      setToast('Error: ' + err.message, true);
    }
  };

  const handleActivate = async (bomId) => {
    try {
      await activateBom(bomId);
      setToast('BOM activated!', false);
    } catch (err) {
      setToast('Error: ' + err.message, true);
    }
  };

  const handleDelete = async (bomId) => {
    if (!window.confirm('Delete this BOM?')) return;
    try {
      await deleteBom(bomId);
      setToast('BOM deleted', false);
    } catch (err) {
      setToast('Error: ' + err.message, true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const statusLabel = (s) => {
    const labels = { DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved', ACTIVE: 'Active', ARCHIVED: 'Archived', REJECTED: 'Rejected' };
    return labels[s] || s;
  };

  const statusColor = (s) => {
    if (s === 'ACTIVE') return 'bg-status-success/20 text-status-success';
    if (s === 'PENDING_APPROVAL') return 'bg-status-warning/20 text-status-warning';
    if (s === 'REJECTED') return 'bg-status-danger/20 text-status-danger';
    if (s === 'ARCHIVED') return 'bg-[#333] text-gray-400';
    return 'bg-[#333] text-gray-400';
  };

  return (
    <Layout title="📖 BOMs / Recipes" subtitle="Recipe management for production">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">BOMs / Recipes</h2>
        {userCanCreate && (
          <button onClick={() => handleOpenModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New Recipe</button>
        )}
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {/* Active BOMs for Production */}
      {activeBoms.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Active BOMs (Ready for Production)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                  <th className="p-3">📖 Recipe</th>
                  <th className="p-3">🔢 Version</th>
                  <th className="p-3">⚖️ Yield %</th>
                  <th className="p-3">📥 Input (kg)</th>
                  <th className="p-3">📤 Output (kg)</th>
                  <th className="p-3">🧪 Ingredients</th>
                  <th className="p-3">⚡ Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]">
                {activeBoms.map((bom) => (
                  <tr key={bom.id} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold">{bom.name}</td>
                    <td className="p-3 text-white mono">v{bom.version}</td>
                    <td className="p-3 text-white">{bom.yieldPercent}%</td>
                    <td className="p-3 text-white">{bom.batchInputKg}</td>
                    <td className="p-3 text-white">{bom.batchOutputKg}</td>
                    <td className="p-3 text-white">{bom.ingredients.length}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => handleClone(bom)} className="bg-primary/20 text-primary px-3 py-1 rounded text-xs hover:bg-primary hover:text-white">📋 Clone</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All BOMs */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
              <th className="p-3">📖 Recipe</th>
              <th className="p-3">🔢 Version</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">⚖️ Yield %</th>
              <th className="p-3">📥 Input (kg)</th>
              <th className="p-3">📤 Output (kg)</th>
              <th className="p-3">🧪 Ingredients</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="8" className="p-6 text-center text-gray-400">Loading BOMs...</td></tr>
            ) : boms.length === 0 ? (
              <tr><td colSpan="8" className="p-6 text-center text-gray-400">No BOMs found.</td></tr>
            ) : (
              boms.map((bom) => (
                <tr key={bom.id} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold">{bom.name}</td>
                  <td className="p-3 text-white mono">v{bom.version}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${statusColor(bom.status)}`}>{statusLabel(bom.status)}</span></td>
                  <td className="p-3 text-white">{bom.yieldPercent}%</td>
                  <td className="p-3 text-white">{bom.batchInputKg}</td>
                  <td className="p-3 text-white">{bom.batchOutputKg}</td>
                  <td className="p-3 text-white">{bom.ingredients.length}</td>
                  <td className="p-3 flex gap-2">
                    {bom.status === 'DRAFT' && userCanCreate && (
                      <button onClick={() => handleOpenModal(bom)} className="bg-[#333] text-white px-3 py-1 rounded text-xs hover:bg-[#555]">✏️ Edit</button>
                    )}
                    {bom.status === 'DRAFT' && userCanCreate && (
                      <button onClick={() => handleSubmit(bom.id)} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">📤 Submit</button>
                    )}
                    {bom.status === 'APPROVED' && userCanCreate && (
                      <button onClick={() => handleActivate(bom.id)} className="bg-primary/20 text-primary px-3 py-1 rounded text-xs hover:bg-primary hover:text-white">✅ Activate</button>
                    )}
                    {(bom.status === 'DRAFT' || bom.status === 'REJECTED') && userCanCreate && (
                      <button onClick={() => handleDelete(bom.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">🗑️</button>
                    )}
                    {bom.status !== 'ARCHIVED' && (
                      <button onClick={() => handleClone(bom)} className="bg-primary/20 text-primary px-3 py-1 rounded text-xs hover:bg-primary hover:text-white">📋 Clone</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit BOM Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{editMode ? '✏️ Edit Recipe' : '➕ New Recipe'}</h3>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Recipe Name</label>
                  <input type="text" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Version</label>
                  <input type="number" name="version" value={form.version} onChange={e => setForm({ ...form, version: Number(e.target.value) || 1 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
              </div>
            </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Yield %</label>
                  <input type="number" name="yieldPercent" value={form.yieldPercent} onChange={e => setForm({ ...form, yieldPercent: Number(e.target.value) || 86.9 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" step="0.1" min="0" max="100" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select name="category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                    <option value="DETERGENT_POWDER">Detergent Powder</option>
                    <option value="LIQUID_DETERGENT">Liquid Detergent</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>

              <div className="border-t border-[#333] pt-4">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Ingredients</h5>
                <div className="space-y-3">
                  {form.ingredients.map((ing, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end bg-[#121212] p-3 rounded border border-[#333]">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Item</label>
                        <input type="text" value={ing.itemName} onChange={e => {
                          const newIngs = [...form.ingredients];
                          newIngs[i] = { ...newIngs[i], itemName: e.target.value };
                          setForm({ ...form, ingredients: newIngs });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Code</label>
                        <input type="text" value={ing.itemCode} onChange={e => {
                          const newIngs = [...form.ingredients];
                          newIngs[i] = { ...newIngs[i], itemCode: e.target.value };
                          setForm({ ...form, ingredients: newIngs });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Qty/Batch</label>
                        <input type="number" value={ing.kgPerBatch} onChange={e => {
                          const newIngs = [...form.ingredients];
                          newIngs[i] = { ...newIngs[i], kgPerBatch: Number(e.target.value) || 0 };
                          setForm({ ...form, ingredients: newIngs });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" min="0.01" step="0.01" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Unit</label>
                        <input type="text" value={ing.unitOfMeasure} onChange={e => {
                          const newIngs = [...form.ingredients];
                          newIngs[i] = { ...newIngs[i], unitOfMeasure: e.target.value };
                          setForm({ ...form, ingredients: newIngs });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" name={`ing${i}-critical`} checked={ing.isCritical} onChange={e => {
                          const newIngs = [...form.ingredients];
                          newIngs[i] = { ...newIngs[i], isCritical: e.target.checked };
                          setForm({ ...form, ingredients: newIngs });
                        }} className="w-4 h-4" />
                        <label className="text-xs text-gray-300">Critical</label>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Notes</label>
                        <input type="text" value={ing.notes} onChange={e => {
                          const newIngs = [...form.ingredients];
                          newIngs[i] = { ...newIngs[i], notes: e.target.value };
                          setForm({ ...form, ingredients: newIngs });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeIngredient(i)} className="text-status-danger hover:text-white">🗑️</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addIngredient} className="w-full py-2 rounded bg-[#333] text-xs text-white hover:bg-[#555]">➕ Add Ingredient</button>
                </div>

              <div className="flex justify-end gap-2 pt-6">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}