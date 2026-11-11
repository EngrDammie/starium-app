// src/pages/BomApprovals.jsx
//
// BOM Approvals — approve/reject recipe changes.

import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function BomApprovals() {
  const [boms, setBoms] = useState([
    {
      id: 'bom_001',
      name: 'Premium Detergent v2',
      version: 2,
      status: 'PENDING_APPROVAL',
      currentStep: 1,
      totalSteps: 2,
      steps: [
        { step: 1, role: 'recipe_manager', label: 'Recipe Manager', status: 'PENDING' },
        { step: 2, role: 'plant_manager', label: 'Plant Manager', status: 'WAITING' }
      ],
      requestedByName: 'Recipe Manager',
      createdAt: new Date().toISOString()
    }
  ]);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const handleAction = async (bomId, action) => {
    try {
      setToast(`BOM ${action.toLowerCase()}ed!`, false);
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
                const step = bom.steps.find(s => s.status === 'PENDING');
                return (
                  <tr key={bom.id} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold">{bom.name}</td>
                    <td className="p-3 text-white mono">v{bom.version}</td>
                    <td className="p-3 text-gray-400 text-sm">Step {bom.currentStep} of {bom.totalSteps}</td>
                    <td className="p-3 text-white">{step?.label || '—'}</td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => handleAction(bom.id, 'APPROVE')} className="bg-status-success/20 text-status-success px-3 py-1 rounded hover:bg-status-success hover:text-white">✅</button>
                      <button onClick={() => { const r = window.prompt('Reason:'); if (r) handleAction(bom.id, 'REJECT'); }} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">❌</button>
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
