// src/pages/BinView.jsx
//
// Bin View — see what's in each bin across warehouses.

import { useState, useEffect } from 'react';
import {
  getAllWarehouses, subscribeToWarehouses,
  getAllBins, subscribeToBins, getStockForBin
} from '../services/inventoryOperations';
import Layout from '../components/Layout';

export default function BinView() {
  const [warehouses, setWarehouses] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedWh, setSelectedWh] = useState(null);
  const [binStock, setBinStock] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeToWarehouses((w) => { setWarehouses(w); if (w.length > 0 && !selectedWh) setSelectedWh(w[0].id); });
    const u2 = subscribeToBins((b) => setBins(b));
    return () => { u1(); u2(); };
  }, [selectedWh]);

  useEffect(() => {
    if (!selectedWh) return;
    const whBins = bins.filter(b => b.warehouseId === selectedWh);
    const stockPromises = whBins.map(async (bin) => {
      const stock = await getStockForBin(bin.id);
      return { binId: bin.id, stock };
    });
    Promise.all(stockPromises).then(results => {
      const map = {};
      results.forEach(r => { map[r.binId] = r.stock; });
      setBinStock(map);
    });
  }, [selectedWh, bins]);

  const whBins = bins.filter(b => b.warehouseId === selectedWh);

  return (
    <Layout title="📦 Bin View" subtitle="Stock by bin and warehouse">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Bin View</h2>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Warehouse</label>
          <select value={selectedWh} onChange={e => setSelectedWh(e.target.value)} className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary">
            <option value="">Select warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </div>
      </div>

      {!selectedWh ? (
        <div className="text-center py-20 text-gray-500">Select a warehouse to view bins</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {whBins.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-500">No bins found for this warehouse.</div>
          ) : (
            whBins.map((bin) => {
              const stock = binStock[bin.id] || [];
              const totalQty = stock.reduce((sum, s) => sum + s.qty, 0);
              return (
                <div key={bin.id} className="bg-[#1a1a1a] border border-[#444] rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-status-warning font-bold mono text-sm">{bin.fullAddress}</div>
                      <div className="text-xs text-gray-500 mt-1">Zone {bin.zone} · Aisle {bin.aisle} · Rack {bin.rack} · Shelf {bin.shelf}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${bin.status === 'AVAILABLE' ? 'bg-status-success/20 text-status-success' : bin.status === 'RESERVED' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-danger/20 text-status-danger'}`}>
                      {bin.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-3">Capacity: {bin.capacityKg} kg</div>
                  {stock.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">Empty</div>
                  ) : (
                    <div className="space-y-2">
                      {stock.map((s) => (
                        <div key={s.itemId + '|' + s.lotId} className="flex justify-between items-center bg-[#121212] p-2 rounded border border-[#333]">
                          <div>
                            <div className="text-xs text-white">{s.itemId}</div>
                            <div className="text-[10px] text-gray-500">Lot: {s.lotId || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-white font-bold">{s.qty}</div>
                            <div className="text-[10px] text-gray-400">{s.unitOfMeasure}</div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-[#333]/50">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Total</span>
                          <span className="text-white font-bold">{totalQty}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Layout>
  );
}
