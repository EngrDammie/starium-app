// src/pages/CreditNotes.jsx
//
// Credit Notes page — manage vendor credit notes for short/damaged receipts.

import { useState, useEffect } from 'react';
import {
  getAllCreditNotes, subscribeToCreditNotes,
  updateCreditNoteStatus, getCreditNote
} from '../services/goodsReceiptOperations';
import Layout from '../components/Layout';

export default function CreditNotes() {
  const [cns, setCns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    const unsub = subscribeToCreditNotes((c) => {
      setCns(c);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleStatusChange = async (cnNumber, newStatus) => {
    const reason = newStatus === 'REJECTED' ? window.prompt('Rejection reason:') : '';
    try {
      await updateCreditNoteStatus(cnNumber, newStatus, 'current-user', 'Current User');
      setToast(`Credit Note ${newStatus}!`, false);
    } catch (err) {
      setToast('Error: ' + err.message, true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const statusLabel = (s) => {
    const labels = {
      DRAFT: 'Draft', SENT: 'Sent', ACCEPTED: 'Accepted',
      REJECTED: 'Rejected', APPLIED: 'Applied'
    };
    return labels[s] || s;
  };

  return (
    <Layout title="🧾 Credit Notes" subtitle="Vendor credit notes for shortfalls">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">Credit Notes</h2>
        <p className="text-gray-400 text-sm">Auto-drafted when GRN received qty { '<' } PO ordered qty.</p>
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
              <th className="p-3">🧾 CN Number</th>
              <th className="p-3">📄 GRN Number</th>
              <th className="p-3">📄 PO Number</th>
              <th className="p-3">🏢 Vendor</th>
              <th className="p-3">💰 Total (₦)</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">⚡ Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {loading ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-400">Loading...</td></tr>
            ) : cns.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center text-gray-400">No credit notes.</td></tr>
            ) : (
              cns.map((cn) => (
                <tr key={cn.cnNumber} className="hover:bg-white/5">
                  <td className="p-3 text-status-warning font-bold mono">{cn.cnNumber}</td>
                  <td className="p-3 text-gray-300 mono">{cn.grnNumber}</td>
                  <td className="p-3 text-gray-300 mono">{cn.poNumber}</td>
                  <td className="p-3 text-white">{cn.vendorName}</td>
                  <td className="p-3 text-white mono">{cn.grandTotal.toLocaleString()}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${cn.status === 'ACCEPTED' ? 'bg-status-success/20 text-status-success' : cn.status === 'SENT' ? 'bg-status-warning/20 text-status-warning' : cn.status === 'REJECTED' ? 'bg-status-danger/20 text-status-danger' : cn.status === 'APPLIED' ? 'bg-status-success/20 text-status-success' : 'bg-[#333] text-gray-400'}`}>{statusLabel(cn.status)}</span></td>
                  <td className="p-3 flex gap-2">
                    {cn.status === 'DRAFT' && (
                      <button onClick={() => handleStatusChange(cn.cnNumber, 'SENT')} className="bg-status-warning/20 text-status-warning px-3 py-1 rounded hover:bg-status-warning hover:text-white">📤 Send</button>
                    )}
                    {cn.status === 'SENT' && (
                      <>
                        <button onClick={() => handleStatusChange(cn.cnNumber, 'ACCEPTED')} className="bg-status-success/20 text-status-success px-3 py-1 rounded hover:bg-status-success hover:text-white">✅ Accept</button>
                        <button onClick={() => handleStatusChange(cn.cnNumber, 'REJECTED')} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">❌ Reject</button>
                      </>
                    )}
                    {cn.status === 'ACCEPTED' && (
                      <button onClick={() => handleStatusChange(cn.cnNumber, 'APPLIED')} className="bg-primary text-black px-3 py-1 rounded hover:bg-primary-dark">💰 Apply</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 p-4 bg-[#121212] border border-[#333] rounded-xl">
        <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Credit Note Lifecycle</h5>
        <div className="text-sm text-gray-300 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-gray-400">1</span>
            <span>DRAFT</span> — Auto-created from GRN shortfall
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-gray-400">2</span>
            <span>SENT</span> — Finance sends to vendor
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-gray-400">3</span>
            <span>ACCEPTED / REJECTED</span> — Vendor responds
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-gray-400">4</span>
            <span>APPLIED</span> — Payment adjusted (₦ reduced)
          </div>
        </div>
      </div>
    </Layout>
  );
}