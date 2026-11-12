// src/pages/SystemConfig/ApprovalChainsTab.jsx
//
// Approval Chains — configure approval workflows per flow type.
// Each flow: toggle ON/OFF, required/optional, add/remove/reorder steps with roles.

import { useState, useEffect } from 'react';
import {
  getApprovalConfig, getApprovalSteps, initializeApprovalState,
  setApprovalChainsCache, loadApprovalChains
} from '../../services/approvalEngine';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const CONFIG_DOC = doc(db, 'config', 'settings');

async function saveApprovalChains(chains) {
  await setDoc(CONFIG_DOC, { approvalChains: chains, updatedAt: new Date() }, { merge: true });
}

const FLOW_TYPES = [
  { id: 'purchaseOrder', label: '📋 Purchase Order', description: 'PO creation and approval' },
  { id: 'goodsReceipt', label: '📥 Goods Receipt', description: 'GRN posting and verification' },
  { id: 'stockTransfer', label: '🚚 Stock Transfer', description: 'Moving stock between warehouses' },
  { id: 'bom', label: '📖 BOM / Recipe', description: 'Recipe creation and versioning' },
  { id: 'productionOrder', label: '🏭 Production Order', description: 'Production run planning' },
  { id: 'packingPlan', label: '📦 Packing Plan', description: 'Powder to sachets to cartons' }
];

const AVAILABLE_ROLES = [
  { id: 'procurement_head', label: 'Procurement Head' },
  { id: 'finance_manager', label: 'Finance Manager' },
  { id: 'plant_manager', label: 'Plant Manager' },
  { id: 'warehouse_manager', label: 'Warehouse Manager' },
  { id: 'recipe_manager', label: 'Recipe Manager' },
  { id: 'production_supervisor', label: 'Production Supervisor' },
  { id: 'super_admin', label: 'Super Admin' }
];

export default function ApprovalChainsTab({ config }) {
  const [chains, setChains] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingFlow, setEditingFlow] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  useEffect(() => {
    loadApprovalChains().then((c) => {
      setChains(c);
      setLoading(false);
    });
  }, []);

  const flowConfig = (flowId) => chains[flowId] || { enabled: false, required: false, steps: [] };

  const saveChains = async () => {
    try {
      await setDoc(CONFIG_DOC, { approvalChains: chains, updatedAt: new Date() }, { merge: true });
      setApprovalChainsCache(chains);
      setToast('Approval chains saved!', false);
    } catch (err) {
      setToast('Error saving approval chains', true);
      console.error(err);
    }
  };

  const toggleEnabled = (flowId) => {
    const next = { ...chains };
    next[flowId] = { ...flowConfig(flowId), enabled: !flowConfig(flowId).enabled };
    setChains(next);
  };

  const toggleRequired = (flowId) => {
    const next = { ...chains };
    next[flowId] = { ...flowConfig(flowId), required: !flowConfig(flowId).required };
    setChains(next);
  };

  const addStep = (flowId) => {
    const next = { ...chains };
    const cfg = flowConfig(flowId);
    const newStep = {
      step: (cfg.steps?.length || 0) + 1,
      role: 'procurement_head',
      label: 'Procurement Head'
    };
    next[flowId] = { ...cfg, steps: [...(cfg.steps || []), newStep] };
    setChains(next);
  };

  const removeStep = (flowId, stepIndex) => {
    const next = { ...chains };
    const cfg = flowConfig(flowId);
    const newSteps = cfg.steps.filter((_, i) => i !== stepIndex).map((s, i) => ({ ...s, step: i + 1 }));
    next[flowId] = { ...cfg, steps: newSteps };
    setChains(next);
  };

  const updateStepRole = (flowId, stepIndex, role) => {
    const next = { ...chains };
    const cfg = flowConfig(flowId);
    const newSteps = [...cfg.steps];
    const roleInfo = AVAILABLE_ROLES.find(r => r.id === role);
    newSteps[stepIndex] = { ...newSteps[stepIndex], role, label: roleInfo ? roleInfo.label : role };
    next[flowId] = { ...cfg, steps: newSteps };
    setChains(next);
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  if (loading) {
    return (
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary">🔗 Approval Chains</h2>
        <p className="text-gray-400 mt-2">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">🔗 Approval Chains</h2>
        <p className="text-gray-400 text-sm">Configure who approves what, and how many steps.</p>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {FLOW_TYPES.map((flow) => {
          const cfg = flowConfig(flow.id);
          return (
            <div key={flow.id} className="bg-[#1a1a1a] border border-[#444] rounded-xl p-5 hover:border-[#555] transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white">{flow.label}</h4>
                  <p className="text-xs text-gray-500 mt-1">{flow.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${cfg.enabled ? 'bg-status-success/20 text-status-success' : 'bg-status-danger/20 text-status-danger'}`}>
                    {cfg.enabled ? 'ON' : 'OFF'}
                  </span>
                  <button onClick={() => toggleEnabled(flow.id)} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white">
                    {cfg.enabled ? '🔴' : '🟢'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={cfg.required} onChange={() => toggleRequired(flow.id)} className="w-4 h-4" />
                <label className="text-xs text-gray-300">Approval required</label>
                {!cfg.required && <span className="text-xs text-gray-500 ml-2">(optional)</span>}
              </div>

              <div className="mb-3">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Approval Steps</h5>
                {cfg.steps.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No steps — auto-approve</p>
                ) : (
                  <div className="space-y-2">
                    {cfg.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#121212] border border-[#333] rounded p-2">
                        <span className="w-5 h-5 rounded bg-[#333] text-xs flex items-center justify-center text-gray-400">{step.step}</span>
                        <select
                          value={step.role}
                          onChange={e => updateStepRole(flow.id, i, e.target.value)}
                          className="flex-1 p-1 text-xs bg-[#0a0a0a] border border-[#444] rounded text-gray-300 outline-none focus:border-primary"
                        >
                          {AVAILABLE_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        <button onClick={() => removeStep(flow.id, i)} className="p-1 text-status-danger/60 hover:text-status-danger">🗑️</button>
                      </div>
                    ))}
                    <button onClick={() => addStep(flow.id)} className="w-full py-1.5 mt-2 rounded bg-[#333] text-xs text-white hover:bg-[#555]">➕ Add Step</button>
                  </div>
                )}
              </div>

              <button onClick={() => saveChains()} className="w-full py-2 rounded bg-primary text-black font-bold text-sm hover:bg-primary-dark">💾 Save</button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-[#121212] border border-[#333] rounded-xl">
        <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">How it works</h5>
        <ul className="text-sm text-gray-300 space-y-2">
          <li>• Toggle <strong>ON</strong> to require approval for this flow type.</li>
          <li>• <strong>Required</strong> means the document cannot proceed without all steps approved.</li>
          <li>• Each step must be approved by the assigned role before the next step becomes active.</li>
          <li>• Rejection at any step ends the flow.</li>
          <li>• Turn <strong>OFF</strong> to skip approval entirely (auto-approve).</li>
        </ul>
      </div>
    </div>
  );
}
