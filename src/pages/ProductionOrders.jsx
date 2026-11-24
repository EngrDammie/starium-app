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

export default function ProductionOrders() {
  const { currentUser } = useAuth();
  const { config } = useConfig();
  const [orders, setOrders] = useState([]);
  const [activeBoms, setActiveBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    bomId: '', plannedBatches: 1, plannedStartDate: '', plannedEndDate: '',
    notes: '', packingPlan: { '22': 0, '40': 0, '45': 0, '85': 0, '125': 0, '170': 0, '850': 0 }
  });
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actualsOpen, setActualsOpen] = useState(false);
  const [actualsForm, setActualsForm] = useState({ actualConsumption: [], actualPowderKg: 0, outputLotId: '' });

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
    setForm({ bomId: '', plannedBatches: 1, plannedStartDate: '', plannedEndDate: '', notes: '', packingPlan: { '22': 0, '40': 0, '45': 0, '85': 0, '125': 0, '170': 0, '850': 0 } });
    setCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.bomId || !form.plannedBatches) return showToast('BOM and batches required', true);
    try {
      const orderNumber = await createProductionOrder(form, currentUser?.email, currentUser?.email);
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
    setActualsForm({ actualConsumption, actualPowderKg: order.plannedPowderKg, outputLotId: '' });
    setSelectedOrder(order);
    setActualsOpen(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await completeProductionOrder(selectedOrder.orderNumber, currentUser?.email, currentUser?.email, actualsForm);
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
            <h3 className="text-lg font-bold mb-4">New Production Order</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">BOM (Active only)</label>
                <select value={form.bomId} onChange={e => setForm({ ...form, bomId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                  <option value="">Select BOM</option>
                  {activeBoms.map(b => <option key={b.id} value={b.id}>{b.name} v{b.version} — {b.batchOutputKg} kg/batch</option>)}
                </select>
              </div>
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
                  <input type="text" value={form.outputLotId} onChange={e => setForm({ ...form, outputLotId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="Auto-generated if empty" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Packing Plan (sachets per batch)</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {Object.entries(form.packingPlan).map(([gram, qty]) => (
                    <div key={gram} className="flex items-center gap-2">
                      <span className="text-gray-400 w-16">{gram}g</span>
                      <input type="number" min="0" value={qty} onChange={e => setForm({ ...form, packingPlan: { ...form.packingPlan, [gram]: Number(e.target.value) || 0 } })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                    </div>
                  ))}
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
                <input type="text" value={actualsForm.outputLotId} onChange={e => setActualsForm({ ...actualsForm, outputLotId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="Auto-generated if empty" />
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
    </Layout>
  );
}