// src/pages/Boms.jsx
//
// BOM / Recipe management — CRUD for recipes with ingredients, yield %, versioning.

import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

export default function Boms() {
  const [boms, setBoms] = useState([
    {
      id: 'premium_v1',
      name: 'Premium Detergent',
      version: 1,
      status: 'ACTIVE',
      yieldPercent: 86.9,
      batchInputKg: 1151,
      batchOutputKg: 1000,
      ingredients: [
        { itemId: 'LABSA', itemName: 'LABSA', kgPerBatch: 120 },
        { itemId: 'SLES', itemName: 'SLES', kgPerBatch: 80 },
        { itemId: 'SODA_ASH', itemName: 'Soda Ash', kgPerBatch: 300 },
        { itemId: 'ZEOLITE', itemName: 'Zeolite', kgPerBatch: 150 },
        { itemId: 'ENZYME', itemName: 'Enzyme', kgPerBatch: 5 },
        { itemId: 'FRAGRANCE', itemName: 'Fragrance', kgPerBatch: 2 },
        { itemId: 'COLOUR', itemName: 'Colour', kgPerBatch: 1 },
        { itemId: 'FILLER', itemName: 'Filler', kgPerBatch: 493 }
      ]
    }
  ]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const handleSave = async (e) => {
    e.preventDefault();
    setToast('BOM saved!', false);
    setOpen(false);
  };

  const showToast = (msg, isError) => {
    setToast({ show: true, message: msg, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  return (
    <Layout title="📖 BOMs / Recipes" subtitle="Recipe management for production">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">BOMs / Recipes</h2>
        <button onClick={() => setOpen(true)} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ New Recipe</button>
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
              <th className="p-3">📖 Recipe</th>
              <th className="p-3">🔢 Version</th>
              <th className="p-3">📊 Status</th>
              <th className="p-3">⚖️ Yield %</th>
              <th className="p-3">📥 Input (kg)</th>
              <th className="p-3">📤 Output (kg)</th>
              <th className="p-3">🧪 Ingredients</th>
              <th className="p-3">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {boms.map((bom) => (
              <tr key={bom.id} className="hover:bg-white/5">
                <td className="p-3 text-status-warning font-bold">{bom.name}</td>
                <td className="p-3 text-white mono">v{bom.version}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${bom.status === 'ACTIVE' ? 'bg-status-success/20 text-status-success' : 'bg-[#333] text-gray-400'}`}>{bom.status}</span></td>
                <td className="p-3 text-white">{bom.yieldPercent}%</td>
                <td className="p-3 text-white">{bom.batchInputKg}</td>
                <td className="p-3 text-white">{bom.batchOutputKg}</td>
                <td className="p-3 text-white">{bom.ingredients.length}</td>
                <td className="p-3 flex gap-2">
                  <button className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️</button>
                  <button className="bg-primary text-black px-3 py-1 rounded text-sm font-bold hover:bg-primary-dark">➡️ Use</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New BOM Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">➕ New Recipe</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Recipe Name</label>
                <input type="text" className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Yield %</label>
                  <input type="number" value="86.9" className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Batch Output (kg)</label>
                  <input type="number" value="1000" className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ingredients</label>
                <p className="text-xs text-gray-500">LABSA, SLES, Soda Ash, Zeolite, Enzyme, Fragrance, Colour, Filler</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded bg-[#333] text-white hover:bg-[#555]">Cancel</button>
                <button type="submit" className="px-6 py-2 rounded bg-primary text-black font-bold hover:bg-primary-dark">💾 Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
