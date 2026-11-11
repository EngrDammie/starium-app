// src/pages/StockTransfers.jsx
//
// Stock Transfer page — move stock from any warehouse to any warehouse.
// Two-step: Warehouse ISSUES → Production/Destination RECEIVES.
// Configurable approval (default ON per Plant Manager decision).

import { useState, useEffect } from 'react';
import {
  createStockTransfer, submitStockTransfer, processTransferApproval,
  issueStockTransfer, receiveStockTransfer, cancelStockTransfer,
  subscribeToStockTransfers, getAllStockTransfers, getPendingApprovalsForRole
} from '../services/stockTransferOperations';
import { getAllWarehouses, subscribeToWarehouses } from '../services/inventoryOperations';
import { getAllItems, subscribeToItems } from '../services/inventoryOperations';
import { getAllBins, subscribeToBins } from '../services/inventoryOperations';
import { useConfig } from '../context/ConfigContext';
import Layout from '../components/Layout';

export default function StockTransfers() {
  const { config } = useConfig();
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    fromWarehouseId: '', fromWarehouseName: '',
    toWarehouseId: '', toWarehouseName: '',
    notes: '',
    lines: [{ itemId: '', itemName: '', lotId: '', requestedQty: 0, unitOfMeasure: 'kg', fromBinId: '', toBinId: '' }]
  });
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const userActionRoles = config?.actionRoles?.map(r => r.id) || [];
  const userDeptRoles = config?.departmentRoles?.map(r => r.id) || [];

  useEffect(() => {
    const u1 = subscribeToStockTransfers((t) => { setTransfers(t); setLoading(false); });
    const u2 = subscribeToWarehouses((w) => setWarehouses(w));
    const u3 = subscribeToItems((i) => setItems(i));
    const u4 = subscribeToBins((b) => setBins(b));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const userCanIssue = userDeptRoles.includes('warehouse_clerk') || userDeptRoles.includes('warehouse_manager');
  const userCanReceive = userDeptRoles.includes('production_operator') || userDeptRoles.includes('production_supervisor');
  const userCanApprove = userActionRoles.includes('warehouse_manager');

  const addLine = () => setForm({ ...form, lines: [...form.lines, { itemId: '', itemName: '', lotId: '', requestedQty: 0, unitOfMeasure: 'kg', fromBinId: '', toBinId: '' }] });
  const removeLine = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const transferNumber = await createStockTransfer(form, 'current-user', 'Current User');
      // Submit for approval if approval chain enabled
      await submitStockTransfer(transferNumber);
      setToast('Stock transfer created and submitted for approval!', false);
      setCreateOpen(false);
      setForm({
        fromWarehouseId: '', fromWarehouseName: '',
        toWarehouseId: '', toWarehouseName: '',
        notes: '',
        lines: [{ itemId: '', itemName: '', lotId: '', requestedQty: 0, unitOfMeasure: 'kg', fromBinId: '', toBinId: '' }]
      });
    } catch (err) {
      setToast('Error creating transfer: ' + err.message, true);
    }
  };

  const handleIssue = async () => {
    if (!selectedTransfer) return;
    try {
      await issueStockTransfer(selectedTransfer.transferNumber, 'current-user', 'Current User');
      setToast('Stock issued! Awaiting receipt at destination.', false);
      setIssueOpen(false);
    } catch (err) {
      setToast('Error issuing: ' + err.message, true);
    }
  };

  const handleReceive = async (receivedOverrides) => {
    if (!selectedTransfer) return;
    try {
      await receiveStockTransfer(selectedTransfer.transferNumber, 'current-user', 'Current User', receivedOverrides);
      setToast('Stock received at destination!', false);
      setReceiveOpen(false);
    } catch (err) {
      setToast('Error receiving: ' + err.message, true);
    }
  };

  const handleCancel = async (tn) => {
    if (!window.confirm('Cancel this transfer?')) return;
    try {
      await cancelStockTransfer(tn, 'current-user', 'User cancelled');
      setToast('Transfer cancelled', false);
    } catch (err) {
      setToast('Error cancelling transfer', true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const statusLabel = (s) => {
    const labels = {
      DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval',
      APPROVED: 'Approved', IN_TRANSIT: 'In Transit',
      COMPLETED: 'Completed', CANCELLED: 'Cancelled', PARTIAL: 'Partial', REJECTED: 'Rejected'
    };
    return labels[s] || s;
  };

  const pendingApprovals = transfers.filter(t => {
    if (!t.approvalState || !t.approvalState.approvalEnabled) return false;
    if (t.approvalState.status !== 'PENDING_APPROVAL') return false;
    const step = t.approvalState.steps?.find(s => s.status === 'PENDING');
    return step ? userActionRoles.includes(step.role) : false;
  });

  return (
    <Layout title="🚚 Stock Transfers" subtitle="Move stock between warehouses">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Stock Transfers</h2>
        <button onClick={() => setCreateOpen(true)} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New Transfer</button>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {/* Pending Approvals (if approval ON) */}
      {pendingApprovals.length > 0 && (
        <div className="mb-6 p-4 bg-status-warning/10 border border-status-warning/30 rounded-xl">
          <h4 className="text-sm font-bold text-status-warning mb-2">⏳ Pending Your Approval</h4>
          <div className="space-y-2">
            {pendingApprovals.map((t) => {
              const step = t.approvalState.steps?.find(s => s.status === 'PENDING');
              return (
                <div key={t.transferNumber} className="flex justify-between items-center bg-[#121212] p-3 rounded border border-[#333]">
                  <div>
                    <div className="text-sm text-white">{t.transferNumber}</div>
                    <div className="text-xs text-gray-400">{t.fromWarehouseName} → {t.toWarehouseName}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => processTransferApproval(t.transferNumber, 'APPROVE', step?.role, step?.label, 'current-user')} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">✅</button>
                    <button onClick={() => { const r = window.prompt('Reason:'); if (r) processTransferApproval(t.transferNumber, 'REJECT', step?.role, step?.label, 'current-user'); }} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">❌</button>
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
              <th className="p-3">🚚 Transfer Number</th>
              <th className="p-3">📤 From</th>
              <th className="p-3">📥 To</th>
              <th className="p-3">📦 Items</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-400">Loading...</td></tr>
            ) : transfers.length === 0 ? (
              <tr><td colSpan="6" className="p-6 text-center text-gray-400">No stock transfers.</td></tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.transferNumber} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold mono">{t.transferNumber}</td>
                  <td className="p-3 text-gray-400 text-sm">{t.fromWarehouseName}</td>
                  <td className="p-3 text-gray-400 text-sm">{t.toWarehouseName}</td>
                  <td className="p-3 text-white">{t.lines.length}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${t.status === 'COMPLETED' ? 'bg-status-success/20 text-status-success' : t.status === 'IN_TRANSIT' ? 'bg-status-warning/20 text-status-warning' : t.status === 'PENDING_APPROVAL' ? 'bg-status-warning/20 text-status-warning' : t.status === 'CANCELLED' || t.status === 'REJECTED' ? 'bg-status-danger/20 text-status-danger' : 'bg-[#333] text-gray-400'}`}>{statusLabel(t.status)}</span></td>
                  <td className="p-3 flex gap-2">
                    {t.status === 'APPROVED' && userCanIssue && (
                      <button onClick={() => { setSelectedTransfer(t); setIssueOpen(true); }} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">📤 Issue</button>
                    )}
                    {t.status === 'IN_TRANSIT' && userCanReceive && (
                      <button onClick={() => { setSelectedTransfer(t); setReceiveOpen(true); }} className="bg-primary text-black px-3 py-1 rounded text-xs hover:bg-primary-dark">📥 Receive</button>
                    )}
                    {(t.status === 'DRAFT' || t.status === 'REJECTED') && (
                      <button onClick={() => handleCancel(t.transferNumber)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">🗑️ Cancel</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Transfer Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">➕ New Stock Transfer</h3>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From Warehouse</label>
                  <select name="fromWarehouseId" value={form.fromWarehouseId} onChange={e => {
                    const w = warehouses.find(x => x.id === e.target.value);
                    setForm({ ...form, fromWarehouseId: e.target.value, fromWarehouseName: w ? w.name : '' });
                  }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                    <option value="">Select source warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To Warehouse</label>
                  <select name="toWarehouseId" value={form.toWarehouseId} onChange={e => {
                    const w = warehouses.find(x => x.id === e.target.value);
                    setForm({ ...form, toWarehouseId: e.target.value, toWarehouseName: w ? w.name : '' });
                  }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                    <option value="">Select destination warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <input type="text" name="notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>

              <div className="border-t border-[#333] pt-4">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Items to Transfer</h5>
                <div className="space-y-3">
                  {form.lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end bg-[#121212] p-3 rounded border border-[#333]">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Item</label>
                        <select name={`line${i}-item`} value={line.itemId} onChange={e => {
                          const item = items.find(x => x.id === e.target.value);
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], itemId: item ? item.id : '', itemName: item ? item.name : '', unitOfMeasure: item ? item.unitOfMeasure : 'kg' };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-gray-300 outline-none focus:border-primary">
                          <option value="">Select item</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Qty</label>
                        <input type="number" value={line.requestedQty} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], requestedQty: Number(e.target.value) || 0 };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Unit</label>
                        <div className="text-sm text-gray-400">{line.unitOfMeasure}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">From Bin</label>
                        <input type="text" value={line.fromBinId} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], fromBinId: e.target.value };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="e.g. RM-WH-A-03-2-1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">To Bin</label>
                        <input type="text" value={line.toBinId} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], toBinId: e.target.value };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="e.g. PF-L9-BIN-01" />
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeLine(i)} className="text-status-danger hover:text-white">🗑️</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addLine} className="w-full py-2 rounded bg-[#333] text-xs text-white hover:bg-[#555]">➕ Add Line</button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Create Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {issueOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">📤 Issue Stock</h3>
              <button onClick={() => setIssueOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <p className="text-gray-400 mb-6">Issuing transfer <span className="text-white font-mono">{selectedTransfer.transferNumber}</span> from warehouse clerk.</p>
            <p className="text-sm text-gray-300 mb-6">This will decrease stock at <span className="text-white">{selectedTransfer.fromWarehouseName}</span> and mark as IN_TRANSIT.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIssueOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
              <button onClick={handleIssue} className="px-6 py-2 rounded bg-status-success text-black font-bold hover:bg-status-success">📤 Confirm Issue</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">📥 Receive Stock</h3>
              <button onClick={() => setReceiveOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <p className="text-gray-400 mb-6">Receiving transfer <span className="text-white font-mono">{selectedTransfer.transferNumber}</span> at <span className="text-white">{selectedTransfer.toWarehouseName}</span>.</p>
            <div className="space-y-3">
              {selectedTransfer.lines.map((line) => (
                <div key={line.lineNumber} className="bg-[#121212] p-3 rounded border border-[#333]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white">{line.itemName}</span>
                    <span className="text-xs text-gray-400">Issued: {line.issuedQty} {line.unitOfMeasure}</span>
                  </div>
                  <input type="number" placeholder="Received qty" className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" onChange={(e) => {
                    const overrides = { ...(receiveOverrides || {}), [line.lineNumber]: Number(e.target.value) || 0 };
                    // Use state for overrides
                  }} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-6">
              <button onClick={() => setReceiveOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
              <button onClick={() => handleReceive({})} className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">📥 Confirm Receive</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
