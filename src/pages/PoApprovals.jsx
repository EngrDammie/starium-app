// src/pages/PoApprovals.jsx
//
// PO Approvals queue — shows POs pending approval for the user's role.

import { useState, useEffect } from 'react';
import {
  getPendingApprovalsForRole, processPoApproval, getAllPurchaseOrders,
  subscribeToPurchaseOrders
} from '../services/purchaseOrderOperations';
import { useConfig } from '../context/ConfigContext';
import Layout from '../components/Layout';

export default function PoApprovals() {
  const { config } = useConfig();
  const [pos, setPos] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  // Get user's action roles from config
  const userActionRoles = config?.actionRoles?.map(r => r.id) || [];

  useEffect(() => {
    const unsub = subscribeToPurchaseOrders((p) => {
      setPos(p);
      // Filter pending approvals for user's roles
      const pend = p.filter(po => {
        if (!po.approvalState || !po.approvalState.approvalEnabled) return false;
        if (po.approvalState.status !== 'PENDING_APPROVAL') return false;
        const pendingStep = po.approvalState.steps?.find(s => s.status === 'PENDING');
        return pendingStep ? userActionRoles.includes(pendingStep.role) : false;
      });
      setPending(pend);
      setLoading(false);
    });
    return unsub;
  }, [userActionRoles]);

  const handleAction = async (poNumber, action, role, name) => {
    try {
      await processPoApproval(poNumber, action, role, name, 'current-user');
      setToast(`PO ${action.toLowerCase()}ed successfully!`, false);
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
      DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval',
      APPROVED: 'Approved', REJECTED: 'Rejected',
      CANCELLED: 'Cancelled', COMPLETED: 'Completed', PARTIAL: 'Partial'
    };
    return labels[s] || s;
  };

  return (
    <Layout title="✅ PO Approvals" subtitle="Approve or reject purchase orders">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">PO Approvals</h2>
        <p className="text-gray-400 text-sm">Purchase orders awaiting your approval.</p>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading approvals...</div>
      ) : pending.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No purchase orders pending your approval. ✅</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                <th className="p-3">📄 PO Number</th>
                <th className="p-3">🏢 Vendor</th>
                <th className="p-3">💰 Total (₦)</th>
                <th className="p-3">📋 Current Step</th>
                <th className="p-3">👤 Approver Role</th>
                <th className="p-3">⚡ Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {pending.map((po) => {
                const pendingStep = po.approvalState.steps?.find(s => s.status === 'PENDING');
                return (
                  <tr key={po.poNumber} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold mono">{po.poNumber}</td>
                    <td className="p-3 text-white">{po.vendorName}</td>
                    <td className="p-3 text-white mono">{po.totalAmount.toLocaleString()}</td>
                    <td className="p-3 text-gray-400 text-sm">Step {po.approvalState.currentStep} of {po.approvalState.totalSteps}</td>
                    <td className="p-3 text-white">{pendingStep?.label || '—'}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => handleAction(po.poNumber, 'APPROVE', pendingStep?.role, pendingStep?.label)} className="bg-status-success/20 text-status-success px-3 py-1 rounded hover:bg-status-success hover:text-white">✅ Approve</button>
                      <button onClick={() => {
                        const reason = window.prompt('Rejection reason:');
                        if (reason) handleAction(po.poNumber, 'REJECT', pendingStep?.role, pendingStep?.label);
                      }} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">❌ Reject</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 border-t border-[#333] pt-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">All Purchase Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#333] text-primary text-xs uppercase tracking-wider">
                <th className="p-3">📄 PO Number</th>
                <th className="p-3">🏢 Vendor</th>
                <th className="p-3">📊 Status</th>
                <th className="p-3">👤 Requested By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {pos.map((po) => (
                <tr key={po.poNumber} className="hover:bg-white/5">
                  <td className="p-3 text-gray-300 mono">{po.poNumber}</td>
                  <td className="p-3 text-white">{po.vendorName}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${po.status === 'APPROVED' ? 'bg-status-success/20 text-status-success' : po.status === 'PENDING_APPROVAL' ? 'bg-status-warning/20 text-status-warning' : po.status === 'REJECTED' ? 'bg-status-danger/20 text-status-danger' : 'bg-[#333] text-gray-400'}`}>{statusLabel(po.status)}</span></td>
                  <td className="p-3 text-gray-400 text-sm">{po.requestedByName || po.requestedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
