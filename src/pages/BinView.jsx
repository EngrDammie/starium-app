// src/pages/BinView.jsx
//
// Bin View — see what's in each bin across warehouses.

import { useState, useEffect } from 'react';
import {
  getAllWarehouses, subscribeToWarehouses,
  getAllBins, subscribeToBins, getStockForBin
} from '../services/inventoryOperations';
import Layout from '../components/Layout';

function BinView() {
  const [warehouses, setWarehouses] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedWh, setSelectedWh] = useState(null);
  const [binStock, setBinStock] = useState({});
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    const u1 = subscribeToWarehouses((w) => { setWarehouses(w); if (w.length > 0 && !selectedWh) setSelectedWh(w[0].id); });
    const u2 = subscribeToBins((b) => setBins(b));
    return () => { u1(); u2(); };
  }, [selectedWh]);

  useEffect(() => {
    if (!selectedWh) return;
    const whBins = bins.filter(b => b.warehouseId === selectedWh);
    if (whBins.length === 0) {
      setBinStock({});
      return;
    }
    setStockLoading(true);
    const stockPromises = whBins.map(async (bin) => {
      const stock = await getStockForBin(bin.id);
      return { binId: bin.id, stock };
    });
    Promise.all(stockPromises).then(results => {
      const map = {};
      results.forEach(r => { map[r.binId] = r.stock; });
      setBinStock(map);
      setStockLoading(false);
    });
  }, [selectedWh, bins]);

  const whBins = bins.filter(b => b.warehouseId === selectedWh);
  const binsWithStock = whBins.filter(bin => (binStock[bin.id] || []).length > 0);

  // Helper to render the common header
  const Header = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">Bin View</h2>
      </div>
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Warehouse</label>
          <select
            value={selectedWh}
            onChange={e => setSelectedWh(e.target.value)}
            className="w-full p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary"
          >
            <option value="">Select warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </div>
      </div>
    </>
  );

  // Early return for no warehouse selected
  if (!selectedWh) {
    return (
      <Layout title="Bin View" subtitle="Stock by bin and warehouse">
        <Header />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full text-center py-20 text-gray-500">Select a warehouse to view bins</div>
        </div>
      </Layout>
    );
  }

  if (stockLoading) {
    return (
      <Layout title="Bin View" subtitle="Stock by bin and warehouse">
        <Header />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full text-center py-20 text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              <span>Loading bin stock...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (whBins.length === 0) {
    return (
      <Layout title="Bin View" subtitle="Stock by bin and warehouse">
        <Header />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full text-center py-20 text-gray-500">No bins found for this warehouse.</div>
        </div>
      </Layout>
    );
  }

  if (binsWithStock.length === 0) {
    return (
      <Layout title="Bin View" subtitle="Stock by bin and warehouse">
        <Header />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full text-center py-20 text-gray-500">No stock in bins for this warehouse.</div>
        </div>
      </Layout>
    );
  }

  // Main render with bins that have stock
  return (
    <Layout title="Bin View" subtitle="Stock by bin and warehouse">
      <Header />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stockLoading ? (
          <div className="col-span-full text-center py-20 text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
              <span>Loading bin stock...</span>
            </div>
          </div>
        ) : whBins.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-500">No bins found for this warehouse.</div>
        ) : binsWithStock.length === 0 ? (
          <div className="col-span-full text-center py-20 text-gray-500">No stock in bins for this warehouse.</div>
        ) : (
          binsWithStock.map((bin) => {
            const stock = binStock[bin.id] || [];
            const totalQty = stock.reduce((sum, s) => sum + s.qty, 0);
            let statusClass = 'bg-status-danger/20 text-status-danger';
            if (bin.status === 'AVAILABLE') statusClass = 'bg-status-success/20 text-status-success';
            else if (bin.status === 'RESERVED') statusClass = 'bg-status-warning/20 text-status-warning';
            return (
              <div key={bin.id} className="bg-[#1a1a1a] border border-[#444] rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-status-warning font-bold mono text-sm">{bin.fullAddress}</div>
                    <div className="text-xs text-gray-500 mt-1">Zone {bin.zone} · Aisle {bin.aisle} · Rack {bin.rack} · Shelf {bin.shelf}</div>
                  </div>
                  <span className={"px-2 py-0.5 rounded text-xs " + statusClass}>
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
    </Layout>
  );
}

export default BinView;