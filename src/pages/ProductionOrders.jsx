// src/pages/ProductionOrders.jsx
//
// Production Orders — plan batches from BOMs, track actuals vs planned.

import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function ProductionOrders() {
  const [orders, setOrders] = useState([
    {
      orderNumber: 'PO-2026-11-11-0001',
      bomName: 'Premium Detergent',
      bomVersion: 1,
      status: 'RELEASED',
      plannedBatches: 10,
      plannedPowderKg: 10000,
      plannedConsumption: [
        { itemId: 'LABSA', itemName: 'LABSA', plannedQty: 1200 },
        { itemId: 'SLES', itemName: 'SLES', plannedQty: 800 },
        { itemId: 'SODA_ASH', itemName: 'Soda Ash', plannedQty: 3000 }
      ],
      actualConsumption: [],
      actualPowderKg: 0,
      createdAt: new Date().toISOString()
    }
  ]);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const statusLabel = (s) => {
    const labels = { PLANNED: 'Planned', RELEASED: 'Released', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
    return labels[s] || s;
  };

  return (
    <Layout title="🏭 Production Orders" subtitle="Plan and track production runs">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Production Orders</h2>
        <button className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New Order</button>
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
              <th className="p-3">🏭 Order Number</th>
              <th className="p-3">📖 BOM</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">🔢 Batches</th>
              <th className="p-3">📦 Powder (kg)</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {orders.map((o) => (
              <tr key={o.orderNumber} className="hover:bg-white/5">
                <td className="p-3 text-status-warning font-bold mono">{o.orderNumber}</td>
                <td className="p-3 text-white">{o.bomName}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${o.status === 'COMPLETED' ? 'bg-status-success/20 text-status-success' : o.status === 'IN_PROGRESS' ? 'bg-status-warning/20 text-status-warning' : 'bg-[#333] text-gray-400'}`}>{statusLabel(o.status)}</span></td>
                <td className="p-3 text-white">{o.plannedBatches}</td>
                <td className="p-3 text-white">{o.plannedPowderKg}</td>
                <td className="p-3 flex gap-2">
                  <button className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">📋 Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 p-4 bg-[#121212] border border-[#333] rounded-xl">
        <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Planned Consumption (Order PO-2026-11-11-0001)</h5>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#333] text-primary text-xs uppercase tracking-wider">
                <th className="p-3">🧪 Ingredient</th>
                <th className="p-3">📦 Planned (kg)</th>
              </tr>
            </thead>
            <tbody>
              {orders[0].plannedConsumption.map((c, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="p-3 text-gray-300">{c.itemName}</td>
                  <td className="p-3 text-white">{c.plannedQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
