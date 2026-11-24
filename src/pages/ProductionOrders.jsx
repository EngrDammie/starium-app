// src/pages/ProductionOrders.jsx
//
// Production Orders — plan batches from BOMs, track actuals vs planned.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import {
  createProductionOrder, submitProductionOrder, processProductionOrderApproval,
  startProductionOrder, completeProductionOrder,
  subscribeToProductionOrders
} from '../services/productionOperations';
import { subscribeToBoms, getActiveBoms } from '../services/bomOperations';
import Layout from '../components/Layout';

const SKU_IDS = ['22', '40', '45', '85', '125', '170', '850'];

const generateLotNumber = (prefix = 'L-FG') => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${dateStr}-${random}`;
};

export default function ProductionOrders() {
  const { currentUser } = useAuth();
  const { config } = useConfig();
  const [orders, setOrders] = useState([]);
  const [activeBoms, setActiveBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    bomId: '', plannedBatches: 1, plannedStartDate: '', plannedEndDate: '',
    notes: '', outputLotId: '', packingPlan: { '22': 15, '40': 20, '45': 25, '85': 10, '125': 15, '170': 10, '850': 5 }
  });
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actualsOpen, setActualsOpen] = useState(false);
  const [actualsForm, setActualsForm] = useState({ actualConsumption: [], actualPowderKg: 0, outputLotId: '' });
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);

  // Ensure packing plan sums to 100%
  const normalizePackingPlan = useCallback((plan) => {
    const total = Object.values(plan).reduce((sum, v) => sum + Number(v || 0), 0);
    if (total === 0) return plan;
    const normalized = {};
    Object.entries(plan).forEach(([k, v]) => {
      normalized[k] = Math.round((Number(v || 0) / total) * 10000) / 100;
    });
    const keys = Object.keys(normalized);
    const currentTotal = keys.reduce((sum, k) => sum + normalized[k], 0);
    if (currentTotal !== 100 && keys.length > 0) {
      const maxKey = keys.reduce((a, b) => normalized[a] > normalized[b] ? a : b);
      normalized[maxKey] = Math.round((normalized[maxKey] + (100 - currentTotal)) * 100) / 100;
    }
    return normalized;
  }, []);

  // Find selected BOM for live calculations
  const selectedBom = activeBoms.find(b => b.id === form.bomId);
  
  // Live batch calculations
  const batchInputKg = selectedBom ? selectedBom.batchInputKg * form.plannedBatches : 0;
  const batchOutputKg = selectedBom ? selectedBom.batchOutputKg * form.plannedBatches : 0;
  const totalInputKg = selectedBom ? selectedBom.ingredients.reduce((sum, ing) => sum + Number(ing.kgPerBatch || 0), 0) * form.plannedBatches : 0;
  const totalOutputKg = totalInputKg * (selectedBom?.yieldPercent || 100) / 100;

  const userActionRoles = config?.actionRoles?.map(r => r.id) || [];
  const userDeptRoles = config?.departmentRoles?.map(r => r.id) || [];

  useEffect(() => {
    const u1 = subscribeToProductionOrders((o) => { setOrders(o); setLoading(false); });
    const u2 = getActiveBoms().then(setActiveBoms);
    return () => { u1(); };
  }, []);

  const userCanCreate = userDeptRoles.includes('production_supervisor');
  const userCanApprove = userActionRoles.includes('production_supervisor') || userActionRoles.includes('plant_manager');
  const userCanStart = userDeptRoles.includes('production_supervisor');
  const userCanRecord = userDeptRoles.includes('production_supervisor') || userDeptRoles.includes('production_operator');

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const handleOpenCreate = () => {
    setForm({ bomId: '', plannedBatches: 1, plannedStartDate: '', plannedEndDate: '', notes: '', outputLotId: generateLotNumber(), packingPlan: { '22': 15, '40': 20, '45': 25, '85': 10, '125': 15, '170': 10, '850': 5 } });
    setCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.bomId || !form.plannedBatches) return showToast('BOM and batches required', true);
    try {
      const finalForm = {
        ...form,
        outputLotId: form.outputLotId.trim() || generateLotNumber(),
        packingPlan: normalizePackingPlan(form.packingPlan)
      };
      const orderNumber = await createProductionOrder(finalForm, currentUser?.email, currentUser?.email);
      showToast(`Production order ${orderNumber} created!`, false);
      setCreateOpen(false);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  };

  const handleSubmit = async (orderNumber) => {
    try {
      await submitProductionOrder(orderNumber);
      showToast('Order submitted for approval!', false);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  };

  const handleStart = async (orderNumber) => {
    try {
      await startProductionOrder(orderNumber, currentUser?.email, currentUser?.email);
      showToast('Production started!', false);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  };

  const handleOpenActuals = (order) => {
    // Pre-fill actuals form with planned consumption
    const actualConsumption = order.plannedConsumption.map(p => ({
      itemId: p.itemId,
      itemName: p.itemName,
      plannedQty: p.plannedQty,
      actualQty: p.plannedQty,
      unitOfMeasure: p.unitOfMeasure,
      lotId: ''
    }));
    setActualsForm({ actualConsumption, actualPowderKg: order.plannedPowderKg, outputLotId: generateLotNumber() });
    setSelectedOrder(order);
    setActualsOpen(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const finalActuals = {
        ...actualsForm,
        outputLotId: actualsForm.outputLotId.trim() || generateLotNumber()
      };
      await completeProductionOrder(selectedOrder.orderNumber, currentUser?.email, currentUser?.email, finalActuals);
      showToast('Production completed!', false);
      setActualsOpen(false);
      setSelectedOrder(null);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  };

  const handleCancel = async (orderNumber) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      // TODO: implement cancelProductionOrder
      showToast('Not implemented yet', true);
    } catch (err) {
      showToast('Error: ' + err.message, true);
    }
  };

  const statusLabel = (s) => {
    const labels = { DRAFT: 'Draft', PLANNED: 'Planned', PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved', RELEASED: 'Released', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
    return labels[s] || s;
  };

  const statusColor = (s) => {
    if (s === 'COMPLETED') return 'bg-status-success/20 text-status-success';
    if (s === 'IN_PROGRESS') return 'bg-status-warning/20 text-status-warning';
    if (s === 'APPROVED' || s === 'RELEASED') return 'bg-primary/20 text-primary';
    if (s === 'PENDING_APPROVAL') return 'bg-status-warning/20 text-status-warning';
    if (s === 'CANCELLED') return 'bg-status-danger/20 text-status-danger';
    return 'bg-[#333] text-gray-400';
  };

  const pendingApprovals = orders.filter(o => {
    if (!o.approvalState || !o.approvalState.approvalEnabled) return false;
    if (o.approvalState.status !== 'PENDING_APPROVAL') return false;
    const step = o.approvalState.steps?.find(s => s.status === 'PENDING');
    return step ? userActionRoles.includes(step.role) : false;
  });

  const formatQty = (val) => Number(val).toFixed(2).replace(/\.00$/, '');

  return (
    <Layout title="🏭 Production Orders" subtitle="Plan and track production runs">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Production Orders</h2>
        {userCanCreate && (
          <button onClick={handleOpenCreate} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New Order</button>
        )}
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="mb-6 p-4 bg-status-warning/10 border border-status-warning/30 rounded-xl">
          <h4 className="text-sm font-bold text-status-warning mb-2">⏳ Pending Your Approval</h4>
          <div className="space-y-2">
            {pendingApprovals.map((o) => {
              const step = o.approvalState.steps?.find(s => s.status === 'PENDING');
              return (
                <div key={o.orderNumber} className="flex justify-between items-center bg-[#121212] p-3 rounded border border-[#333]">
                  <div>
                    <div className="text-sm text-white">{o.orderNumber}</div>
                    <div className="text-xs text-gray-400">{o.bomName} v{o.bomVersion}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => processProductionOrderApproval(o.orderNumber, 'APPROVE', step?.role, step?.label, currentUser?.email)} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">✅ Approve</button>
                    <button onClick={() => { const r = window.prompt('Rejection reason:'); if (r) processProductionOrderApproval(o.orderNumber, 'REJECT', step?.role, step?.label, currentUser?.email); }} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">❌ Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
              <th className="p-3">🏭 Order Number</th>
              <th className="p-3">📖 BOM</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">🔢 Batches</th>
              <th className="p-3">📦 Powder (kg)</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-400">No production orders.</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.orderNumber} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold mono">{o.orderNumber}</td>
                  <td className="p-3 text-white">{o.bomName} v{o.bomVersion}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${statusColor(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td className="p-3 text-white">{o.plannedBatches}</td>
                  <td className="p-3 text-white">{formatQty(o.plannedPowderKg)}</td>
                  <td className="p-3 flex gap-2">
                    {o.status === 'DRAFT' && userCanCreate && (
                      <button onClick={() => handleSubmit(o.orderNumber)} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">📤 Submit</button>
                    )}
                    {o.status === 'PENDING_APPROVAL' && userCanApprove && (
                      <span className="text-xs text-status-warning">Awaiting approval...</span>
                    )}
                    {(o.status === 'APPROVED' || o.status === 'RELEASED') && userCanStart && (
                      <button onClick={() => handleStart(o.orderNumber)} className="bg-primary text-black px-3 py-1 rounded text-xs hover:bg-primary-dark">▶️ Start</button>
                    )}
                    {o.status === 'IN_PROGRESS' && userCanRecord && (
                      <button onClick={() => handleOpenActuals(o)} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">📝 Actuals</button>
                    )}
                    {o.status === 'IN_PROGRESS' && userCanRecord && (
                      <button onClick={() => handleComplete(o.orderNumber)} className="bg-primary/20 text-primary px-3 py-1 rounded text-xs hover:bg-primary hover:text-white">🏁 Complete</button>
                    )}
                    {(o.status === 'DRAFT' || o.status === 'PLANNED') && userCanCreate && (
                      <button onClick={() => handleCancel(o.orderNumber)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">🗑️ Cancel</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Order Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setCreateOpen(false)}>
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">New Production Order</h3>
              <div className="flex items-center gap-2">
                {selectedBom && (
                  <button type="button" onClick={() => { setViewingBom(selectedBom); setViewOpen(true); }} className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded text-xs hover:bg-blue-500/30 hover:text-white">👁️ View Recipe</button>
                )}
                <button type="button" onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
              </div>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">BOM (Active only)</label>
                <select value={form.bomId} onChange={e => setForm({ ...form, bomId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                  <option value="">Select BOM</option>
                  {activeBoms.map(b => <option key={b.id} value={b.id}>{b.name} v{b.version} — {b.batchOutputKg} kg/batch</option>)}
                </select>
              </div>
              {/* Live Batch Calculation */}
              {selectedBom && (
                <div className="bg-[#0a0a0a] border border-primary/30 rounded-lg p-4 mb-4">
                  <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">📊 Expected Production (per batch × {form.plannedBatches})</h5>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="bg-[#121212] p-4 rounded border border-[#333]">
                      <div className="text-xs text-gray-400 mb-1">Total Input (kg)</div>
                      <div className="text-2xl font-bold text-status-warning font-mono">{formatQty(totalInputKg)}</div>
                      <div className="text-xs text-gray-500 mt-1">{selectedBom.ingredients.length} ingredients × {form.plannedBatches} batch(es)</div>
                    </div>
                    <div className="bg-[#121212] p-4 rounded border border-[#333]">
                      <div className="text-xs text-gray-400 mb-1">Expected Output (kg) @ {selectedBom.yieldPercent}%</div>
                      <div className="text-2xl font-bold text-status-success font-mono">{formatQty(totalOutputKg)}</div>
                      <div className="text-xs text-gray-500 mt-1">Input × Yield% = {formatQty(totalInputKg)} × {selectedBom.yieldPercent}%</div>
                    </div>
                  </div>
                  <div className="bg-[#121212] p-3 rounded border border-[#333]">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400">Per-batch Input:</span> <span className="text-white font-mono">{formatQty(selectedBom.batchInputKg)} kg</span></div>
                      <div><span className="text-gray-400">Per-batch Output:</span> <span className="text-white font-mono">{formatQty(selectedBom.batchOutputKg)} kg</span></div>
                      <div><span className="text-gray-400">Batches:</span> <span className="text-white font-mono">{form.plannedBatches}</span></div>
                      <div><span className="text-gray-400">Yield:</span> <span className="text-white font-mono">{selectedBom.yieldPercent}%</span></div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Total Output = Total Input × Yield% = {formatQty(totalInputKg)} × {selectedBom.yieldPercent}% = {formatQty(totalOutputKg)} kg</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Planned Batches</label>
                  <input type="number" min="1" value={form.plannedBatches} onChange={e => setForm({ ...form, plannedBatches: Number(e.target.value) || 1 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Planned Start Date</label>
                  <input type="date" value={form.plannedStartDate} onChange={e => setForm({ ...form, plannedStartDate: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Planned End Date</label>
                  <input type="date" value={form.plannedEndDate} onChange={e => setForm({ ...form, plannedEndDate: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Output Lot #</label>
                  <input type="text" value={form.outputLotId} onChange={e => setForm({ ...form, outputLotId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                  <p className="text-xs text-gray-500 mt-1">Auto-generated (format: L-FG-YYYYMMDD-XXXXX) — editable</p>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Packing Plan (% per sachet size — total = 100%)</label>
                <div className="space-y-2">
                  {SKU_IDS.map((gram) => (
                    <div key={gram} className="flex items-center gap-3">
                      <span className="text-gray-400 w-16 text-xs">{gram}g</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={form.packingPlan[gram] || 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          const updated = { ...form.packingPlan, [gram]: val };
                          setForm({ ...form, packingPlan: normalizePackingPlan(updated) });
                        }}
                        className="flex-1 h-2 bg-[#121212] appearance-none cursor-pointer accent-primary"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={form.packingPlan[gram] || 0}
                        onChange={e => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          const updated = { ...form.packingPlan, [gram]: val };
                          setForm({ ...form, packingPlan: normalizePackingPlan(updated) });
                        }}
                        className="w-16 p-1 bg-[#121212] border border-[#444] rounded text-white text-xs outline-none focus:border-primary text-center"
                      />
                      <span className="text-xs text-gray-400 w-4">%</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="w-16">Total</span>
                    <div className="flex-1 h-2 bg-[#333] rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${Object.values(form.packingPlan).reduce((a, b) => a + Number(b || 0), 0)}%` }}></div>
                    </div>
                    <span className="font-bold text-white w-10" style={{ color: Object.values(form.packingPlan).reduce((a, b) => a + Number(b || 0), 0) === 100 ? '#4ade80' : '#f87171' }}>
                      {Object.values(form.packingPlan).reduce((a, b) => a + Number(b || 0), 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 bg-[#333] text-white rounded hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-black rounded font-bold hover:bg-primary-dark">💾 Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Actuals Modal */}
      {actualsOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => { setActualsOpen(false); setSelectedOrder(null); }}>
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Record Actuals: {selectedOrder.orderNumber}</h3>
            <form onSubmit={handleComplete}>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Output Lot #</label>
                <input type="text" value={actualsForm.outputLotId} onChange={e => setActualsForm({ ...actualsForm, outputLotId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                <p className="text-xs text-gray-500 mt-1">Auto-generated (format: L-FG-YYYYMMDD-XXXXX) — editable</p>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Actual Output (kg)</label>
                <input type="number" step="0.01" min="0" value={actualsForm.actualPowderKg} onChange={e => setActualsForm({ ...actualsForm, actualPowderKg: Number(e.target.value) || 0 })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
              </div>
              <div className="mb-4">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Actual Consumption</h5>
                <div className="space-y-2 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#333] text-primary text-xs uppercase tracking-wider">
                        <th className="p-2">🧪 Ingredient</th>
                        <th className="p-2">📦 Planned (kg)</th>
                        <th className="p-2">📝 Actual (kg)</th>
                        <th className="p-2">🔢 Lot #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actualsForm.actualConsumption.map((c, i) => (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="p-2 text-white">{c.itemName}</td>
                          <td className="p-2 text-gray-400">{c.plannedQty}</td>
                          <td className="p-2">
                            <input type="number" step="0.01" min="0" value={c.actualQty} onChange={e => { const nc = [...actualsForm.actualConsumption]; nc[i] = { ...nc[i], actualQty: Number(e.target.value) || 0 }; setActualsForm({ ...actualsForm, actualConsumption: nc }); }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={c.lotId} onChange={e => { const nc = [...actualsForm.actualConsumption]; nc[i] = { ...nc[i], lotId: e.target.value }; setActualsForm({ ...actualsForm, actualConsumption: nc }); }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="Required" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setActualsOpen(false); setSelectedOrder(null); }} className="px-4 py-2 bg-[#333] text-white rounded hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-black rounded font-bold hover:bg-primary-dark">🏁 Complete Production</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Recipe Modal */}
      {viewOpen && viewingBom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={() => { setViewOpen(false); setViewingBom(null); }}>
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{viewingBom.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                  <span>Version: <span className="text-white font-mono">v{viewingBom.version}</span></span>
                  <span className={`px-2 py-0.5 rounded ${statusColor(viewingBom.status)}`}>{statusLabel(viewingBom.status)}</span>
                  <span>Category: <span className="text-white">{viewingBom.category?.replace(/_/g, ' ')}</span></span>
                </div>
              </div>
              <button onClick={() => { setViewOpen(false); setViewingBom(null); }} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-[#121212] p-4 rounded border border-[#333]">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">📊 Batch Summary (per batch)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Yield %</span><span className="text-white font-bold">{viewingBom.yieldPercent}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Input (kg)</span><span className="text-white font-bold">{formatQty(viewingBom.batchInputKg)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Output (kg)</span><span className="text-white font-bold">{formatQty(viewingBom.batchOutputKg)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Ingredients</span><span className="text-white font-bold">{viewingBom.ingredients.length}</span></div>
                </div>
              </div>
              <div className="bg-[#121212] p-4 rounded border border-[#333]">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">📋 Expected for {form.plannedBatches} Batch(es)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Total Input (kg)</span><span className="text-white font-bold">{formatQty(viewingBom.batchInputKg * form.plannedBatches)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Expected Output (kg)</span><span className="text-white font-bold">{formatQty((viewingBom.batchInputKg * form.plannedBatches) * (viewingBom.yieldPercent || 100) / 100)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Batches</span><span className="text-white font-bold">{form.plannedBatches}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Yield %</span><span className="text-white font-bold">{viewingBom.yieldPercent}%</span></div>
                </div>
              </div>
            </div>

            {/* Ingredients Table with Batch Multiplication */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">🧪 Ingredients ({viewingBom.ingredients.length}) — Quantities × {form.plannedBatches} Batch(es)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                      <th className="p-3">#</th>
                      <th className="p-3">🧪 Item</th>
                      <th className="p-3">🔢 Code</th>
                      <th className="p-3">⚖️ Per Batch (kg)</th>
                      <th className="p-3">⚖️ Total (kg)</th>
                      <th className="p-3">⚖️ Unit</th>
                      <th className="p-3">⭐ Critical</th>
                      <th className="p-3">📝 Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#333]">
                    {viewingBom.ingredients.map((ing, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-3 text-white mono">{i + 1}</td>
                        <td className="p-3 text-white">{ing.itemName}</td>
                        <td className="p-3 text-gray-400 font-mono text-sm">{ing.itemCode || '—'}</td>
                        <td className="p-3 text-white">{formatQty(ing.kgPerBatch)}</td>
                        <td className="p-3 text-white font-bold">{formatQty(ing.kgPerBatch * form.plannedBatches)}</td>
                        <td className="p-3 text-white">{ing.unitOfMeasure}</td>
                        <td className="p-3 text-center">{ing.isCritical ? <span className="text-status-success">✅ Yes</span> : <span className="text-gray-400">No</span>}</td>
                        <td className="p-3 text-gray-400 text-sm">{ing.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval History */}
            {viewingBom.approvalState && viewingBom.approvalState.steps && viewingBom.approvalState.steps.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">✅ Approval History</h4>
                <div className="space-y-2">
                  {viewingBom.approvalState.steps.map((step, i) => (
                    <div key={i} className="bg-[#121212] p-3 rounded border border-[#333] flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${step.status === 'APPROVED' ? 'bg-status-success/20 text-status-success' : step.status === 'REJECTED' ? 'bg-status-danger/20 text-status-danger' : step.status === 'PENDING' ? 'bg-status-warning/20 text-status-warning' : 'bg-[#333] text-gray-400'}`}>
                          {step.status}
                        </span>
                        <span className="text-white">{step.label || step.role}</span>
                        {step.status === 'APPROVED' && step.approvedByName && <span className="text-xs text-gray-400">by {step.approvedByName}</span>}
                        {step.status === 'REJECTED' && step.rejectedByName && <span className="text-xs text-gray-400">by {step.rejectedByName}</span>}
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        {step.approvedAt && <div>Approved: {new Date(step.approvedAt.seconds * 1000).toLocaleString()}</div>}
                        {step.rejectedAt && <div>Rejected: {new Date(step.rejectedAt.seconds * 1000).toLocaleString()}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-[#333]">
              <button onClick={() => { setViewOpen(false); setViewingBom(null); }} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}