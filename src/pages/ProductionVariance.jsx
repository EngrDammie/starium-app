// src/pages/ProductionVariance.jsx
//
// Production Variance — Plan vs Actual for raw materials and packing.

import { useState } from 'react';
import Layout from '../components/Layout';

export default function ProductionVariance() {
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const rawMaterialVariance = [
    { ingredient: 'LABSA', planned: 1200, actual: 1250, variance: 50, variancePercent: 4.17 },
    { ingredient: 'SLES', planned: 800, actual: 820, variance: 20, variancePercent: 2.50 },
    { ingredient: 'Soda Ash', planned: 3000, actual: 3050, variance: 50, variancePercent: 1.67 },
    { ingredient: 'Zeolite', planned: 1500, actual: 1480, variance: -20, variancePercent: -1.33 },
    { ingredient: 'Enzyme', planned: 50, actual: 52, variance: 2, variancePercent: 4.00 },
    { ingredient: 'Fragrance', planned: 20, actual: 18, variance: -2, variancePercent: -10.00 },
    { ingredient: 'Colour', planned: 10, actual: 10, variance: 0, variancePercent: 0.00 },
    { ingredient: 'Filler', planned: 4930, actual: 4900, variance: -30, variancePercent: -0.61 }
  ];

  const packingVariance = [
    { sku: '22g', planned: 701459, actual: 691358, variance: -10101, variancePercent: -1.44 },
    { sku: '85g', planned: 904977, actual: 894230, variance: -10747, variancePercent: -1.19 },
    { sku: '850g', planned: 588235, actual: 571428, variance: -16807, variancePercent: -2.86 }
  ];

  const powderVariance = { planned: 10000, actual: 9950, variance: -50, variancePercent: -0.50 };

  return (
    <Layout title="📊 Production Variance" subtitle="Planned vs Actual — raw materials and packing">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-primary">Production Variance</h2>
        <p className="text-gray-400 text-sm">Compare planned vs actual consumption and output.</p>
      </div>

      {toast.show && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${toast.isError ? 'bg-status-danger/20 text-status-danger' : 'bg-status-success/20 text-status-success'}`}>
          {toast.message}
        </div>
      )}

      {/* Powder Output Variance */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">🏭 Powder Output</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333]">
            <div className="text-xs text-gray-400 uppercase">Planned (kg)</div>
            <div className="text-2xl font-bold text-white">{powderVariance.planned.toLocaleString()}</div>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333]">
            <div className="text-xs text-gray-400 uppercase">Actual (kg)</div>
            <div className="text-2xl font-bold text-white">{powderVariance.actual.toLocaleString()}</div>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333]">
            <div className="text-xs text-gray-400 uppercase">Variance (kg)</div>
            <div className="text-2xl font-bold text-white">{powderVariance.variance > 0 ? '+' : ''}{powderVariance.variance}</div>
          </div>
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#333]">
            <div className="text-xs text-gray-400 uppercase">Variance %</div>
            <div className="text-2xl font-bold text-white">{powderVariance.variancePercent}%</div>
          </div>
        </div>
      </div>

      {/* Raw Material Variance */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">🧪 Raw Material Variance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                <th className="p-3">🧪 Ingredient</th>
                <th className="p-3">📋 Planned (kg)</th>
                <th className="p-3">✅ Actual (kg)</th>
                <th className="p-3">📊 Variance (kg)</th>
                <th className="p-3">📈 Variance %</th>
                <th className="p-3">⚠️ Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {rawMaterialVariance.map((r) => {
                const status = Math.abs(r.variancePercent) > 5 ? 'CRITICAL' : Math.abs(r.variancePercent) > 2 ? 'WARNING' : 'OK';
                return (
                  <tr key={r.ingredient} className="hover:bg-white/5">
                    <td className="p-3 text-white">{r.ingredient}</td>
                    <td className="p-3 text-gray-400 mono">{r.planned}</td>
                    <td className="p-3 text-white mono">{r.actual}</td>
                    <td className="p-3 text-white mono">{r.variance > 0 ? '+' : ''}{r.variance}</td>
                    <td className="p-3 text-white mono">{r.variancePercent > 0 ? '+' : ''}{r.variancePercent}%</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${status === 'OK' ? 'bg-status-success/20 text-status-success' : status === 'WARNING' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-danger/20 text-status-danger'}`}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packing Variance */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">📦 Packing Variance (Cartons)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider">
                <th className="p-3">📦 SKU</th>
                <th className="p-3">📋 Planned Cartons</th>
                <th className="p-3">✅ Actual Cartons</th>
                <th className="p-3">📊 Variance</th>
                <th className="p-3">📈 Variance %</th>
                <th className="p-3">⚠️ Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {packingVariance.map((r) => {
                const status = Math.abs(r.variancePercent) > 5 ? 'CRITICAL' : Math.abs(r.variancePercent) > 2 ? 'WARNING' : 'OK';
                return (
                  <tr key={r.sku} className="hover:bg-white/5">
                    <td className="p-3 text-status-warning font-bold">{r.sku}</td>
                    <td className="p-3 text-gray-400 mono">{r.planned.toLocaleString()}</td>
                    <td className="p-3 text-white mono">{r.actual.toLocaleString()}</td>
                    <td className="p-3 text-white mono">{r.variance > 0 ? '+' : ''}{r.variance.toLocaleString()}</td>
                    <td className="p-3 text-white mono">{r.variancePercent > 0 ? '+' : ''}{r.variancePercent}%</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${status === 'OK' ? 'bg-status-success/20 text-status-success' : status === 'WARNING' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-danger/20 text-status-danger'}`}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 p-4 bg-[#121212] border border-[#333] rounded-xl">
        <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">Variance Thresholds</h5>
        <div className="text-sm text-gray-300 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-status-success/20 text-status-success flex items-center justify-center text-xs">✓</span>
            <span>OK: &lt; 2% variance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-status-warning/20 text-status-warning flex items-center justify-center text-xs">⚠</span>
            <span>WARNING: 2% – 5% variance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-status-danger/20 text-status-danger flex items-center justify-center text-xs">✗</span>
            <span>CRITICAL: &gt; 5% variance</span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Threshold (5%) is configurable in System Config → Approval Chains.</p>
        </div>
      </div>
    </Layout>
  );
}
