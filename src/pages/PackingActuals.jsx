// src/pages/PackingActuals.jsx
//
// Packing Actuals — record actual sachets/cartons per shift per SKU.

import { useState } from 'react';
import Layout from '../components/Layout';

export default function PackingActuals() {
  const [records, setRecords] = useState([
    { sku: '22', shift: 'DAY', team: 'A', date: '2026-11-11', plannedSachets: 113636363, actualSachets: 112000000, plannedCartons: 701459, actualCartons: 691358 },
    { sku: '85', shift: 'DAY', team: 'A', date: '2026-11-11', plannedSachets: 47058823, actualSachets: 46500000, plannedCartons: 904977, actualCartons: 894230 },
    { sku: '850', shift: 'DAY', team: 'A', date: '2026-11-11', plannedSachets: 4117647, actualSachets: 4000000, plannedCartons: 588235, actualCartons: 571428 }
  ]);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <Layout title="📦 Packing Actuals" subtitle="Record actual sachets and cartons per shift">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">Packing Actuals</h2>
        <p className="text-gray-400 text-sm">Enter actual packing numbers per shift per SKU.</p>
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
              <th className="p-3">📅 Date</th>
              <th className="p-3">☀️ Shift</th>
              <th className="p-3">👥 Team</th>
              <th className="p-3">📦 SKU</th>
              <th className="p-3">📋 Planned Sachets</th>
              <th className="p-3">✅ Actual Sachets</th>
              <th className="p-3">📦 Planned Cartons</th>
              <th className="p-3">✅ Actual Cartons</th>
              <th className="p-3">📊 Variance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {records.map((r, i) => {
              const variance = ((r.actualCartons - r.plannedCartons) / r.plannedCartons * 100).toFixed(2);
              return (
                <tr key={i} className="hover:bg-white/5">
                  <td className="p-3 text-gray-300 mono">{r.date}</td>
                  <td className="p-3 text-white">{r.shift}</td>
                  <td className="p-3 text-white">{r.team}</td>
                  <td className="p-3 text-status-warning font-bold">{r.sku}g</td>
                  <td className="p-3 text-gray-400 mono">{r.plannedSachets.toLocaleString()}</td>
                  <td className="p-3 text-white mono">{r.actualSachets.toLocaleString()}</td>
                  <td className="p-3 text-gray-400 mono">{r.plannedCartons.toLocaleString()}</td>
                  <td className="p-3 text-white mono">{r.actualCartons.toLocaleString()}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${Math.abs(parseFloat(variance)) > 5 ? 'bg-status-danger/20 text-status-danger' : Math.abs(parseFloat(variance)) > 2 ? 'bg-status-warning/20 text-status-warning' : 'bg-status-success/20 text-status-success'}`}>{variance}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
