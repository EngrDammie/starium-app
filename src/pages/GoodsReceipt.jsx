// src/pages/GoodsReceipt.jsx
//
// Goods Receipt Note (GRN) page — receive items from vendors against POs.
// Auto-drafts credit note when received < ordered.

import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPurchaseOrders,
  updatePoLineReceivedQty
} from '../services/purchaseOrderOperations';
import {
  createGoodsReceipt, subscribeToGoodsReceipts,
  createCreditNoteFromGrn
} from '../services/goodsReceiptOperations';
import { subscribeToWarehouses, subscribeToBins } from '../services/inventoryOperations';
import Layout from '../components/Layout';

export default function GoodsReceipt() {
  const [pos, setPos] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [bins, setBins] = useState([]);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [form, setForm] = useState({
    poId: '', poNumber: '', vendorId: '', vendorName: '',
    warehouseId: '', invoiceNumber: '', notes: '',
    lines: []
  });
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [showCreditNote, setShowCreditNote] = useState(false);

  useEffect(() => {
    const u1 = subscribeToPurchaseOrders((p) => {
      setPos(p.filter(po => po.status === 'APPROVED' || po.status === 'PARTIAL'));
      setLoading(false);
    });
    const u2 = subscribeToGoodsReceipts((g) => setGrns(g));
    const u3 = subscribeToWarehouses((w) => setWarehouses(w));
    const u4 = subscribeToBins((b) => setBins(b));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // Filter bins by selected warehouse
  const availableBins = useMemo(() => {
    if (!form.warehouseId) return [];
    return bins.filter(b => b.warehouseId === form.warehouseId && b.status === 'AVAILABLE');
  }, [bins, form.warehouseId]);

  const openReceive = (po) => {
    const lines = po.lines.map(line => ({
      poLineNumber: line.lineNumber,
      itemId: line.itemId,
      itemName: line.itemName,
      itemCode: line.itemCode,
      orderedQty: line.orderedQty,
      receivedQty: 0,
      unitOfMeasure: line.unitOfMeasure,
      lotNumber: '',
      expiryDate: '',
      binId: line.destinationBinId || '', // pre-fill from PO
      condition: 'GOOD',
      notes: ''
    }));
    setSelectedPo(po);
    setForm({
      poId: po.poNumber,
      poNumber: po.poNumber,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      warehouseId: po.destinationWarehouseId,
      invoiceNumber: '', notes: '',
      lines
    });
    setReceiveOpen(true);
    setShowCreditNote(false);
  };

  const updateLine = (i, field, value) => {
    const newLines = [...form.lines];
    newLines[i] = { ...newLines[i], [field]: value };
    setForm({ ...form, lines: newLines });
  };

  const validateForm = () => {
    for (const [i, line] of form.lines.entries()) {
      if (Number(line.receivedQty) < 0) {
        return `Line ${i + 1}: Received quantity cannot be negative`;
      }
      if (Number(line.receivedQty) > Number(line.orderedQty)) {
        // Allow over-receipt but warn
        console.warn(`Line ${i + 1}: Received (${line.receivedQty}) exceeds ordered (${line.orderedQty})`);
      }
      if (!line.lotNumber.trim()) {
        return `Line ${i + 1}: Lot number is required`;
      }
      if (!line.binId.trim()) {
        return `Line ${i + 1}: Bin location is required`;
      }
      // Check bin exists in selected warehouse
      const binExists = availableBins.some(b => b.id === line.binId);
      if (!binExists && line.binId) {
        return `Line ${i + 1}: Bin ${line.binId} not found in selected warehouse`;
      }
    }
    if (!form.warehouseId) return 'Warehouse is required';
    return null;
  };

  const handlePostGRN = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) return setToast(error, true);
    try {
      const { grnNumber, hasShortfall, shortLines } = await createGoodsReceipt(form, 'current-user', 'Current User');
      setToast(`GRN ${grnNumber} posted successfully!`, false);
      setReceiveOpen(false);
      if (hasShortfall) {
        setShowCreditNote(true);
        setToast(`Shortfall detected on ${shortLines.length} line(s). Create credit note?`, false);
      }
    } catch (err) {
      setToast('Error posting GRN: ' + err.message, true);
    }
  };

  const handleCreateCreditNote = async () => {
    try {
      const cnNumber = await createCreditNoteFromGrn(form.poNumber, 'current-user', 'Current User');
      setToast(`Credit Note ${cnNumber} created!`, false);
      setShowCreditNote(false);
    } catch (err) {
      setToast('Error creating credit note: ' + err.message, true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <Layout title="📥 Goods Receipt (GRN)" subtitle="Receive items from vendors">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Goods Receipt</h2>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {/* Approved POs to receive */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Approved POs Ready for Receipt</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                <th className="p-3">📄 PO Number</th>
                <th className="p-3">🏢 Vendor</th>
                <th className="p-3">💰 Total (₦)</th>
                <th className="p-3">🏠 Dest. Warehouse</th>
                <th className="p-3">⚡ Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {loading ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-400">Loading...</td></tr>
              ) : pos.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-gray-400">No approved POs awaiting receipt.</td></tr>
              ) : (
                pos.map((po) => (
                  <tr key={po.poNumber} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold mono">{po.poNumber}</td>
                    <td className="p-3 text-white">{po.vendorName}</td>
                    <td className="p-3 text-white mono">{po.totalAmount.toLocaleString()}</td>
                    <td className="p-3 text-gray-400 text-sm">{po.destinationWarehouseId}</td>
                    <td className="p-3">
                      <button onClick={() => openReceive(po)} className="bg-primary text-black px-3 py-1 rounded text-sm font-bold hover:bg-primary-dark">📥 Receive</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent GRNs */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Recent GRNs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#333] text-primary text-xs uppercase tracking-wider">
                <th className="p-3">📥 GRN Number</th>
                <th className="p-3">📄 PO Number</th>
                <th className="p-3">🏢 Vendor</th>
                <th className="p-3">📦 Received</th>
                <th className="p-3">⚖️ Ordered</th>
                <th className="p-3">📊 Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {grns.map((grn) => (
                <tr key={grn.grnNumber} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold mono">{grn.grnNumber}</td>
                  <td className="p-3 text-gray-300 mono">{grn.poNumber}</td>
                  <td className="p-3 text-white">{grn.vendorName}</td>
                  <td className="p-3 text-white">{grn.totalReceived}</td>
                  <td className="p-3 text-white">{grn.totalOrdered}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${grn.creditNoteCreated ? 'bg-status-warning/20 text-status-warning' : 'bg-[#333] text-gray-400'}`}>{grn.creditNoteCreated ? 'Credit Note' : 'Posted'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receive Modal */}
      {receiveOpen && selectedPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">📥 Receive: {selectedPo.poNumber}</h3>
              <button onClick={() => setReceiveOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handlePostGRN} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vendor</label>
                  <input type="text" value={form.vendorName} readOnly className="w-full p-2 bg-[#121212] border border-[#444] rounded text-gray-400" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Warehouse</label>
                  <select name="warehouseId" value={form.warehouseId} onChange={e => setForm({ ...form, warehouseId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Invoice Number</label>
                  <input type="text" name="invoiceNumber" value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" placeholder="e.g. INV-0087" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <input type="text" name="notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>

              <div className="border-t border-[#333] pt-4">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Received Items</h5>
                <div className="space-y-3">
                  {form.lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-9 gap-3 items-end bg-[#121212] p-3 rounded border border-[#333]">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Item</label>
                        <div className="text-sm text-white">{line.itemName} ({line.itemCode})</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Ordered</label>
                        <div className="text-sm text-gray-400">{line.orderedQty} {line.unitOfMeasure}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Received</label>
                        <input type="number" value={line.receivedQty} onChange={e => updateLine(i, 'receivedQty', Number(e.target.value) || 0)} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" min="0" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Unit</label>
                        <div className="text-sm text-gray-400">{line.unitOfMeasure}</div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Lot #</label>
                        <input type="text" value={line.lotNumber} onChange={e => updateLine(i, 'lotNumber', e.target.value)} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" required />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Expiry</label>
                        <input type="date" value={line.expiryDate} onChange={e => updateLine(i, 'expiryDate', e.target.value)} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Bin</label>
                        <select value={line.binId} onChange={e => updateLine(i, 'binId', e.target.value)} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                          <option value="">Select bin</option>
                          {availableBins.map(b => (
                            <option key={b.id} value={b.id}>{b.fullAddress} {b.currentItemId ? `(${b.currentItemId})` : '(empty)'}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Condition</label>
                        <select name={`line${i}-condition`} value={line.condition} onChange={e => updateLine(i, 'condition', e.target.value)} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary">
                          <option value="GOOD">Good</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="SHORT">Short</option>
                          <option value="WRONG_ITEM">Wrong Item</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6">
                <button type="button" onClick={() => setReceiveOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">📥 Post GRN</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Note Prompt */}
      {showCreditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-status-warning mb-4">⚠️ Shortfall Detected</h3>
            <p className="text-gray-300 mb-6">Some items were received in lesser quantity than ordered. Would you like to create a Credit Note for the vendor?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreditNote(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Not Now</button>
              <button onClick={handleCreateCreditNote} className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">🧾 Create Credit Note</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}