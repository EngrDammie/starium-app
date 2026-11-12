// src/pages/PurchaseOrders.jsx
//
// Purchase Order list + create page.

import { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPurchaseOrders, createPurchaseOrder, submitPurchaseOrder,
  cancelPurchaseOrder
} from '../services/purchaseOrderOperations';
import { subscribeToVendors } from '../services/inventoryOperations';
import { subscribeToWarehouses } from '../services/inventoryOperations';
import { subscribeToItems, subscribeToBins } from '../services/inventoryOperations';
import Layout from '../components/Layout';

export default function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    vendorId: '', vendorName: '', destinationWarehouseId: '',
    expectedDeliveryDate: '', notes: '',
    lines: [{ itemId: '', itemName: '', itemCode: '', orderedQty: 0, unitOfMeasure: 'kg', unitPrice: 0, taxRate: 7.5, destinationBinId: '' }]
  });
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    const u1 = subscribeToPurchaseOrders((p) => { setPos(p); setLoading(false); });
    const u2 = subscribeToVendors((v) => setVendors(v));
    const u3 = subscribeToWarehouses((w) => setWarehouses(w));
    const u4 = subscribeToItems((i) => setItems(i));
    const u5 = subscribeToBins((b) => setBins(b));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // Filter bins by selected destination warehouse
  const availableBins = useMemo(() => {
    if (!form.destinationWarehouseId) return [];
    return bins.filter(b => b.warehouseId === form.destinationWarehouseId && b.status === 'AVAILABLE');
  }, [bins, form.destinationWarehouseId]);

  const addLine = () => setForm({ ...form, lines: [...form.lines, { itemId: '', itemName: '', itemCode: '', orderedQty: 0, unitOfMeasure: 'kg', unitPrice: 0, taxRate: 7.5, destinationBinId: '' }] });
  const removeLine = (i) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });

  const totalAmount = form.lines.reduce((sum, l) => sum + (Number(l.orderedQty) || 0) * (Number(l.unitPrice) || 0), 0);

  const validateForm = () => {
    if (!form.vendorId) return 'Vendor is required';
    if (!form.destinationWarehouseId) return 'Destination warehouse is required';
    for (const [i, line] of form.lines.entries()) {
      if (!line.itemId) return `Line ${i + 1}: Item is required`;
      if (!Number(line.orderedQty) || Number(line.orderedQty) <= 0) return `Line ${i + 1}: Quantity must be > 0`;
      if (!Number(line.unitPrice) || Number(line.unitPrice) <= 0) return `Line ${i + 1}: Unit price must be > 0`;
      if (!line.destinationBinId) return `Line ${i + 1}: Destination bin is required`;
      const binExists = availableBins.some(b => b.id === line.destinationBinId);
      if (!binExists && line.destinationBinId) return `Line ${i + 1}: Bin ${line.destinationBinId} not found in selected warehouse`;
    }
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) return setToast(error, true);
    try {
      const poNumber = await createPurchaseOrder(form, 'current-user', 'Current User');
      await submitPurchaseOrder(poNumber);
      setToast('Purchase Order created and submitted for approval!', false);
      setCreateOpen(false);
      setForm({
        vendorId: '', vendorName: '', destinationWarehouseId: '',
        expectedDeliveryDate: '', notes: '',
        lines: [{ itemId: '', itemName: '', itemCode: '', orderedQty: 0, unitOfMeasure: 'kg', unitPrice: 0, taxRate: 7.5, destinationBinId: '' }]
      });
    } catch (err) {
      setToast('Error creating PO: ' + err.message, true);
    }
  };

  const handleCancel = async (poNumber) => {
    if (!window.confirm('Cancel this PO?')) return;
    try {
      await cancelPurchaseOrder(poNumber, 'current-user', 'User cancelled');
      setToast('PO cancelled', false);
    } catch (err) {
      setToast('Error cancelling PO', true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <Layout title="📋 Purchase Orders" subtitle="Procure to Receive">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Purchase Orders</h2>
        <button onClick={() => setCreateOpen(true)} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New PO</button>
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
              <th className="p-3">📄 PO Number</th>
              <th className="p-3">🏢 Vendor</th>
              <th className="p-3">🏠 Dest. Warehouse</th>
              <th className="p-3">💰 Total (₦)</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">👤 Requested By</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-400">Loading POs...</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-400">No purchase orders.</td></tr>
            ) : (
              pos.map((po) => (
                <tr key={po.poNumber} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold mono">{po.poNumber}</td>
                  <td className="p-3 text-white">{po.vendorName}</td>
                  <td className="p-3 text-gray-400 text-sm">{po.destinationWarehouseId}</td>
                  <td className="p-3 text-white mono">{po.totalAmount.toLocaleString()}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${po.status === 'APPROVED' ? 'bg-status-success/20 text-status-success' : po.status === 'PENDING_APPROVAL' ? 'bg-status-warning/20 text-status-warning' : po.status === 'REJECTED' ? 'bg-status-danger/20 text-status-danger' : 'bg-[#333] text-gray-400'}`}>{po.status}</span></td>
                  <td className="p-3 text-gray-400 text-sm">{po.requestedByName || po.requestedBy}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => handleCancel(po.poNumber)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Cancel</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create PO Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">➕ New Purchase Order</h3>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vendor</label>
                  <select name="vendorId" value={form.vendorId} onChange={e => {
                    const v = vendors.find(x => x.id === e.target.value);
                    setForm({ ...form, vendorId: e.target.value, vendorName: v ? v.name : '' });
                  }} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                    <option value="">Select vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Destination Warehouse</label>
                  <select name="destinationWarehouseId" value={form.destinationWarehouseId} onChange={e => setForm({ ...form, destinationWarehouseId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                    <option value="">Select warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Expected Delivery Date</label>
                <input type="date" name="expectedDeliveryDate" value={form.expectedDeliveryDate} onChange={e => setForm({ ...form, expectedDeliveryDate: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <input type="text" name="notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>

              <div className="border-t border-[#333] pt-4">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Line Items</h5>
                <div className="space-y-3">
                  {form.lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end bg-[#121212] p-3 rounded border border-[#333]">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Item</label>
                        <select name={`line${i}-item`} value={line.itemId} onChange={e => {
                          const item = items.find(x => x.id === e.target.value || x.code === e.target.value);
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], itemId: item ? item.id : e.target.value, itemName: item ? item.name : '', itemCode: item ? item.code : '', unitOfMeasure: item ? item.unitOfMeasure : 'kg' };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-gray-300 outline-none focus:border-primary" required>
                          <option value="">Select item</option>
                          {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Qty</label>
                        <input type="number" value={line.orderedQty} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], orderedQty: Number(e.target.value) || 0 };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" min="1" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Unit</label>
                        <input type="text" value={line.unitOfMeasure} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], unitOfMeasure: e.target.value };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Price (₦)</label>
                        <input type="number" value={line.unitPrice} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], unitPrice: Number(e.target.value) || 0 };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" min="0.01" step="0.01" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Tax %</label>
                        <input type="number" value={line.taxRate} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], taxRate: Number(e.target.value) || 7.5 };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Bin</label>
                        <select value={line.destinationBinId} onChange={e => {
                          const newLines = [...form.lines];
                          newLines[i] = { ...newLines[i], destinationBinId: e.target.value };
                          setForm({ ...form, lines: newLines });
                        }} className="w-full p-2 bg-[#0a0a0a] border border-[#444] rounded text-white outline-none focus:border-primary" required>
                          <option value="">Select bin</option>
                          {availableBins.map(b => (
                            <option key={b.id} value={b.id}>{b.fullAddress} {b.currentItemId ? `(${b.currentItemId}: ${b.currentQty})` : '(empty)'}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeLine(i)} className="text-status-danger hover:text-white">🗑️</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addLine} className="w-full py-2 rounded bg-[#333] text-xs text-white hover:bg-[#555]">➕ Add Line</button>
                </div>
                <div className="mt-4 text-right">
                  <div className="text-lg font-bold text-white">Total: ₦{totalAmount.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Create & Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}