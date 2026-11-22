// src/pages/StockTransfers.jsx
//
// Stock Transfer page — move stock from any warehouse to any warehouse.
// Two-step: Warehouse ISSUES → Production/Destination RECEIVES.
// Configurable approval (default ON per Plant Manager decision).

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createStockTransfer, submitStockTransfer, processTransferApproval,
  issueStockTransfer, receiveStockTransfer, cancelStockTransfer,
  subscribeToStockTransfers, getStockTransfer
} from '../services/stockTransferOperations';
import { subscribeToWarehouses } from '../services/inventoryOperations';
import { subscribeToItems } from '../services/inventoryOperations';
import { subscribeToBinsByWarehouse, getStockForBin } from '../services/inventoryOperations';
import { useConfig } from '../context/ConfigContext';
import { generateTransferPdf, downloadPdf } from '../services/pdfGenerator';
import Layout from '../components/Layout';

export default function StockTransfers() {
  const { config } = useConfig();
  const { currentUser } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]); // bins for currently selected warehouses only
  const [binStock, setBinStock] = useState({}); // binId -> stock array from ledger
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    fromWarehouseId: '', fromWarehouseName: '',
    toWarehouseId: '', toWarehouseName: '',
    notes: '',
    lines: [{ itemId: '', itemName: '', itemCode: '', lotId: '', requestedQty: 0, unitOfMeasure: 'kg', fromBinId: '', toBinId: '' }]
  });
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [receiveOverrides, setReceiveOverrides] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const userActionRoles = config?.actionRoles?.map(r => r.id) || [];
  const userDeptRoles = config?.departmentRoles?.map(r => r.id) || [];

  // Track unsubscribes for bin subscriptions
  const binUnsubscribesRef = useRef({});

  // Subscribe to transfers, warehouses, items
  useEffect(() => {
    const u1 = subscribeToStockTransfers((t) => { setTransfers(t); setLoading(false); });
    const u2 = subscribeToWarehouses((w) => setWarehouses(w));
    const u3 = subscribeToItems((i) => setItems(i));
    return () => { u1(); u2(); u3(); };
  }, []);

  // Determine which warehouses we need bins for
  const neededWarehouseIds = useMemo(() => {
    const set = new Set();
    if (form.fromWarehouseId) set.add(form.fromWarehouseId);
    if (form.toWarehouseId) set.add(form.toWarehouseId);
    if (selectedTransfer?.toWarehouseId) set.add(selectedTransfer.toWarehouseId);
    return set;
  }, [form.fromWarehouseId, form.toWarehouseId, selectedTransfer?.toWarehouseId]);

  // Stable key for useEffect dependency (avoids Set reference changes)
  const neededWarehousesKey = Array.from(neededWarehouseIds).sort().join(',');

  // Subscribe to bins for selected warehouses only
  useEffect(() => {
    // Clean up previous subscriptions
    Object.values(binUnsubscribesRef.current).forEach(unsub => unsub());
    binUnsubscribesRef.current = {};

    if (neededWarehouseIds.size === 0) {
      setBins([]);
      setBinStock({});
      return;
    }

    const allBins = [];
    neededWarehouseIds.forEach(whId => {
      const unsub = subscribeToBinsByWarehouse(whId, (binsForWh) => {
        allBins.push(...binsForWh);
        setBins([...allBins]);
      });
      binUnsubscribesRef.current[whId] = unsub;
    });

    return () => {
      Object.values(binUnsubscribesRef.current).forEach(unsub => unsub());
      binUnsubscribesRef.current = {};
    };
  }, [neededWarehousesKey]);

  // Filter bins by warehouse (currentQty lives in stock_ledger, not bin doc)
  const fromBins = useMemo(() => {
    if (!form.fromWarehouseId) return [];
    return bins.filter(b => b.warehouseId === form.fromWarehouseId && b.status === 'AVAILABLE');
  }, [bins, form.fromWarehouseId]);

  const toBins = useMemo(() => {
    if (!form.toWarehouseId) return [];
    return bins.filter(b => b.warehouseId === form.toWarehouseId && b.status === 'AVAILABLE');
  }, [bins, form.toWarehouseId]);

  const receiveBins = useMemo(() => {
    if (!selectedTransfer) return [];
    return bins.filter(b => b.warehouseId === selectedTransfer.toWarehouseId && b.status === 'AVAILABLE');
  }, [bins, selectedTransfer]);

  // Fetch stock only for bins that are actually displayed in dropdowns
  const fetchStockForBins = useCallback(async (binList) => {
    if (!binList?.length) return;
    // Use functional update to avoid binStock in dependency array
    setBinStock(prevStockMap => {
      const stockMap = { ...prevStockMap };
      let hasChanges = false;
      binList.forEach(bin => {
        if (!stockMap[bin.id]) {
          // Fire-and-forget fetch, update when resolved
          getStockForBin(bin.id).then(stock => {
            if (stock.length > 0) {
              setBinStock(current => ({ ...current, [bin.id]: stock }));
            }
          });
          hasChanges = true;
        }
      });
      // Return current map immediately; async updates will trigger re-render
      return hasChanges ? stockMap : prevStockMap;
    });
  }, []);

  // Trigger stock fetch when filtered bins change
  useEffect(() => {
    const relevantBins = [...fromBins, ...toBins, ...receiveBins];
    fetchStockForBins(relevantBins);
  }, [fromBins, toBins, receiveBins, fetchStockForBins]);

  const userCanIssue = userDeptRoles.includes('warehouse_clerk') || userDeptRoles.includes('warehouse_manager');
  const userCanReceive = userDeptRoles.includes('production_operator') || userDeptRoles.includes('production_supervisor');
  const userCanApprove = userActionRoles.includes('warehouse_manager');

  const addLine = () => setForm({ ...form, lines: [...form.lines, { itemId: '', itemName: '', itemCode: '', lotId: '', requestedQty: 0, unitOfMeasure: 'kg', fromBinId: '', toBinId: '' }] });
  const removeLine = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const transferNumber = await createStockTransfer(form, currentUser?.email, currentUser?.email);
      await submitStockTransfer(transferNumber);
      setToast('Stock transfer created and submitted for approval!', false);
      setCreateOpen(false);
      setForm({
        fromWarehouseId: '', fromWarehouseName: '',
        toWarehouseId: '', toWarehouseName: '',
        notes: '',
        lines: [{ itemId: '', itemName: '', itemCode: '', lotId: '', requestedQty: 0, unitOfMeasure: 'kg', fromBinId: '', toBinId: '' }]
      });
    } catch (err) {
      console.error('[handleSave] Error:', err);
      setToast('Error creating transfer: ' + err.message, true);
    }
  };

  const handleIssue = async () => {
    if (!selectedTransfer) return;
    try {
      console.log('[handleIssue] Issuing transfer:', selectedTransfer.transferNumber, 'user:', currentUser?.email);
      await issueStockTransfer(selectedTransfer.transferNumber, currentUser?.email, currentUser?.email);
      console.log('[handleIssue] Success');
      setToast('Stock issued! Awaiting receipt at destination.', false);
      setIssueOpen(false);
    } catch (err) {
      console.error('[handleIssue] Error:', err);
      setToast('Error issuing: ' + err.message, true);
    }
  };

  const handleReceive = async () => {
    if (!selectedTransfer) return;
    try {
      console.log('[handleReceive] Receiving transfer:', selectedTransfer.transferNumber, 'user:', currentUser?.email, 'overrides:', receiveOverrides);
      await receiveStockTransfer(selectedTransfer.transferNumber, currentUser?.email, currentUser?.email, receiveOverrides);
      console.log('[handleReceive] Success');
      setToast('Stock received at destination!', false);
      setReceiveOpen(false);
      setReceiveOverrides({});
    } catch (err) {
      console.error('[handleReceive] Error:', err);
      setToast('Error receiving: ' + err.message, true);
    }
  };

  const handleCancel = async (tn) => {
    if (!window.confirm('Cancel this transfer?')) return;
    try {
      await cancelStockTransfer(tn, currentUser?.email, 'User cancelled');
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

  const processTransferApproval = async (transferNumber, action, role, label, userId) => {
    if (action === 'REJECT') {
      const reason = window.prompt('Rejection reason:');
      if (!reason) return;
      // Call the actual reject function with reason
    }
    // Use the imported processTransferApproval from stockTransferOperations
    const { processTransferApproval: doProcess } = await import('../services/stockTransferOperations');
    await doProcess(transferNumber, action, role, label, userId);
  };

  return (
    <Layout title="🚚 Stock Transfers" subtitle="Move stock between warehouses">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Stock Transfers</h2>
        <button onClick={() => { setReceiveOverrides({}); setCreateOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New Transfer</button>
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
                    <button onClick={() => processTransferApproval(t.transferNumber, 'APPROVE', step?.role, step?.label, 'current-user')} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">✅ Approve</button>
                    <button onClick={() => { const r = window.prompt('Reason:'); if (r) processTransferApproval(t.transferNumber, 'REJECT', step?.role, step?.label, 'current-user'); }} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">❌ Reject</button>
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
                    <button onClick={() => downloadTransferPdf(t)} className="bg-primary/20 text-primary px-3 py-1 rounded text-xs hover:bg-primary hover:text-white">📄 PDF</button>
                    {t.status === 'APPROVED' && userCanIssue && (
                      <button onClick={() => { setReceiveOverrides({}); setSelectedTransfer(t); setIssueOpen(true); }} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">📤 Issue</button>
                    )}
                    {t.status === 'IN_TRANSIT' && userCanReceive && (
                      <button onClick={() => { setReceiveOverrides({}); setSelectedTransfer(t); setReceiveOpen(true); }} className="bg-primary text-black px-3 py-1 rounded text-xs hover:bg-primary-dark">📥 Receive</button>
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setCreateOpen(false)}>
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">New Stock Transfer</h3>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From Warehouse</label>
                  <select value={form.fromWarehouseId} onChange={e => setForm({ ...form, fromWarehouseId: e.target.value, fromWarehouseName: warehouses.find(w => w.id === e.target.value)?.name || '' })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To Warehouse</label>
                  <select value={form.toWarehouseId} onChange={e => setForm({ ...form, toWarehouseId: e.target.value, toWarehouseName: warehouses.find(w => w.id === e.target.value)?.name || '' })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-400">Items</label>
                  <button type="button" onClick={addLine} className="text-xs text-primary hover:underline">+ Add Line</button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-6 gap-2 items-center">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Item</label>
                        <select value={line.itemId} onChange={e => {
                          const item = items.find(it => it.id === e.target.value);
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], itemId: e.target.value, itemName: item?.name || '', itemCode: item?.code || '', unitOfMeasure: item?.unitOfMeasure || 'kg' };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                          <option value="">Select item</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.code} — {it.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Qty (kg)</label>
                        <input type="number" step="0.01" min="0" value={line.requestedQty} onChange={e => { const newLines = [...form.lines]; newLines[i] = { ...newLines[i], requestedQty: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines: newLines }); }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">From Bin</label>
                        <select value={line.fromBinId} onChange={e => { const newLines = [...form.lines]; newLines[i] = { ...newLines[i], fromBinId: e.target.value }; setForm({ ...form, lines: newLines }); }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                          <option value="">Select bin</option>
                          {fromBins.map(b => <option key={b.id} value={b.id}>{b.fullAddress || b.code}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">To Bin</label>
                        <select value={line.toBinId} onChange={e => { const newLines = [...form.lines]; newLines[i] = { ...newLines[i], toBinId: e.target.value }; setForm({ ...form, lines: newLines }); }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
                          <option value="">Select bin</option>
                          {toBins.map(b => <option key={b.id} value={b.id}>{b.fullAddress || b.code}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={() => removeLine(i)} className="text-status-danger hover:underline text-xs">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 bg-[#333] text-white rounded hover:bg-[#444]">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-black rounded font-bold hover:bg-primary-dark">Create & Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Transfer Modal */}
      {issueOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setIssueOpen(false)}>
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Issue Transfer: {selectedTransfer.transferNumber}</h3>
            <div className="mb-4 text-sm text-gray-400">
              {selectedTransfer.fromWarehouseName} → {selectedTransfer.toWarehouseName}
            </div>
            <div className="space-y-2 mb-4">
              {selectedTransfer.lines.map((line, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{line.itemName} ({line.itemCode})</span>
                  <span className="font-bold">{line.requestedQty} {line.unitOfMeasure}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIssueOpen(false)} className="px-4 py-2 bg-[#333] text-white rounded hover:bg-[#444]">Cancel</button>
              <button onClick={handleIssue} className="px-4 py-2 bg-status-success text-white rounded font-bold hover:bg-status-success/90">📤 Confirm Issue</button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Transfer Modal */}
      {receiveOpen && selectedTransfer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setReceiveOpen(false)}>
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Receive Transfer: {selectedTransfer.transferNumber}</h3>
            <div className="mb-4 text-sm text-gray-400">
              {selectedTransfer.fromWarehouseName} → {selectedTransfer.toWarehouseName}
            </div>
            <div className="space-y-3 mb-4">
              {selectedTransfer.lines.map((line, i) => {
                const stockForItem = binStock[line.fromBinId] || [];
                const availableStock = stockForItem.find(s => s.itemId === line.itemId)?.qty || 0;
                const override = receiveOverrides[line.itemId] ?? line.requestedQty;
                return (
                  <div key={i} className="bg-[#121212] p-3 rounded border border-[#333]">
                    <div className="flex justify-between text-xs mb-2">
                      <span>{line.itemName} ({line.itemCode})</span>
                      <span className="text-gray-400">Available in bin: {availableStock} {line.unitOfMeasure}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Qty to Receive</label>
                        <input type="number" step="0.01" min="0" max={line.requestedQty} value={override} onChange={e => setReceiveOverrides({ ...receiveOverrides, [line.itemId]: parseFloat(e.target.value) || 0 })} className="w-full p-2 bg-[#1a1a1a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">To Bin</label>
                        <select value={line.toBinId} onChange={e => { const newLines = [...selectedTransfer.lines]; newLines[i] = { ...newLines[i], toBinId: e.target.value }; setSelectedTransfer({ ...selectedTransfer, lines: newLines }); }} className="w-full p-2 bg-[#1a1a1a] border border-[#444] rounded text-white outline-none focus:border-primary">
                          <option value="">Select bin</option>
                          {receiveBins.map(b => <option key={b.id} value={b.id}>{b.fullAddress || b.code}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Requested</label>
                        <div className="p-2 bg-[#1a1a1a] border border-[#444] rounded text-white text-sm">{line.requestedQty} {line.unitOfMeasure}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReceiveOpen(false)} className="px-4 py-2 bg-[#333] text-white rounded hover:bg-[#444]">Cancel</button>
              <button onClick={handleReceive} className="px-4 py-2 bg-primary text-black rounded font-bold hover:bg-primary-dark">📥 Confirm Receive</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}