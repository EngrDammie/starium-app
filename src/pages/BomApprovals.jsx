// src/pages/BomApprovals.jsx
//
// BOM Approvals — approve/reject recipe changes.

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import {
  subscribeToBoms, processBomApproval
} from '../services/bomOperations';
import Layout from '../components/Layout';

export default function BomApprovals() {
  const { currentUser } = useAuth();
  const { config } = useConfig();
  const [boms, setBoms] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const userActionRoles = config?.actionRoles?.map(r => r.id) || [];

  useEffect(() => {
    const unsub = subscribeToBoms((b) => {
      // Filter to only BOMs pending approval where current user is the approver
      const pending = b.filter(bom => {
        if (!bom.approvalState || !bom.approvalState.approvalEnabled) return false;
        if (bom.approvalState.status !== 'PENDING_APPROVAL') return false;
        const step = bom.approvalState.steps?.find(s => s.status === 'PENDING');
        return step ? userActionRoles.includes(step.role) : false;
      });
      setBoms(pending);
    });
    return unsub;
  }, [userActionRoles]);

  const handleAction = async (bomId, action, role, label) => {
    try {
      await processBomApproval(bomId, action, role, label, currentUser?.email);
      setToast(`BOM ${action === 'APPROVE' ? 'approved' : 'rejected'}!`, false);
    } catch (err) {
      setToast('Error: ' + err.message, true);
    }
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <Layout title="✅ BOM Approvals" subtitle="Approve or reject recipe changes">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">BOM Approvals</h2>
        <p className="text-gray-400 text-sm">Recipes awaiting your approval.</p>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {boms.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No BOMs pending approval. ✅</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                <th className="p-3">📖 Recipe</th>
                <th className="p-3">🔢 Version</th>
                <th className="p-3">📋 Step</th>
                <th className="p-3">👤 Approver Role</th>
                <th className="p-3">⚡ Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {boms.map((bom) => {
                const step = bom.approvalState.steps?.find(s => s.status === 'PENDING');
                return (
                  <tr key={bom.id} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold">{bom.name}</td>
                    <td className="p-3 text-white mono">v{bom.version}</td>
                    <td className="p-3 text-gray-400 text-sm">Step {bom.approvalState.currentStep} of {bom.approvalState.totalSteps}</td>
                    <td className="p-3 text-white">{step?.label || '—'}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => handleAction(bom.id, 'APPROVE', step?.role, step?.label)} className="bg-status-success/20 text-status-success px-3 py-1 rounded text-xs hover:bg-status-success hover:text-white">✅ Approve</button>
                      <button onClick={() => { const r = window.prompt('Rejection reason:'); if (r) handleAction(bom.id, 'REJECT', step?.role, step?.label); }} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded text-xs hover:bg-status-danger hover:text-white">❌ Reject</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}