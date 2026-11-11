// src/pages/SystemConfig/VendorMasterTab.jsx
//
// Vendor Master — CRUD for vendors.

import { useState, useEffect } from 'react';
import {
  getAllVendors, createVendor, updateVendor, deleteVendor,
  subscribeToVendors
} from '../../services/inventoryOperations';

export default function VendorMasterTab({ config }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '', contactPerson: '', email: '', phone: '',
    address: '', paymentTerms: 'Net 30', taxId: '', isActive: true
  });
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    const unsub = subscribeToVendors((vs) => {
      setVendors(vs);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleOpenModal = (vendor = null) => {
    if (vendor) {
      setEditMode(true);
      setEditingId(vendor.id);
      setForm({ ...vendor, isActive: vendor.isActive !== false });
    } else {
      setEditMode(false);
      setEditingId(null);
      setForm({ name: '', contactPerson: '', email: '', phone: '', address: '', paymentTerms: 'Net 30', taxId: '', isActive: true });
    }
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editMode && editingId) {
        await updateVendor(editingId, form);
        setToast('Vendor updated!', false);
      } else {
        await createVendor(form);
        setToast('Vendor created!', false);
      }
      setOpen(false);
    } catch (err) {
      setToast('Error saving vendor', true);
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete vendor? This cannot be undone.')) return;
    try {
      await deleteVendor(id);
      setToast('Vendor deleted', false);
    } catch (err) {
      setToast('Error deleting vendor', true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">🚚 Vendor Master</h2>
        <button onClick={() => handleOpenModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Vendor</button>
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
              <th className="p-3">🏢 Vendor</th>
              <th className="p-3">👤 Contact</th>
              <th className="p-3">📧 Email</th>
              <th className="p-3">📞 Phone</th>
              <th className="p-3">📍 Address</th>
              <th className="p-3">💳 Payment Terms</th>
              <th className="p-3">🆔 Tax ID</th>
              <th className="p-3">🟢 Active</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="9" className="p-6 text-center text-gray-400">Loading vendors...</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan="9" className="p-6 text-center text-gray-400">No vendors found.</td></tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold">{v.name}</td>
                  <td className="p-3 text-white">{v.contactPerson || '—'}</td>
                  <td className="p-3 text-gray-400 text-sm mono">{v.email || '—'}</td>
                  <td className="p-3 text-gray-400 text-sm">{v.phone || '—'}</td>
                  <td className="p-3 text-gray-400 text-sm">{v.address || '—'}</td>
                  <td className="p-3 text-white">{v.paymentTerms}</td>
                  <td className="p-3 text-gray-400 text-sm mono">{v.taxId || '—'}</td>
                  <td className="p-3 text-center">{v.isActive ? '✅' : '❌'}</td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => handleOpenModal(v)} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️</button>
                    <button onClick={() => handleDelete(v.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️</button>
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
              <h3 className="text-lg font-bold text-white">{editMode ? '✏️ Edit Vendor' : '➕ Add Vendor'}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Vendor Name</label>
                <input type="text" name="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Contact Person</label>
                <input type="text" name="contactPerson" value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input type="email" name="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone</label>
                  <input type="tel" name="phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Address</label>
                <input type="text" name="address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Payment Terms</label>
                  <input type="text" name="paymentTerms" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tax ID</label>
                  <input type="text" name="taxId" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                <label className="text-sm text-gray-300">Active</label>
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
