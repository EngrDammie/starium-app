import { useState, useMemo, useEffect } from 'react';

const PRESET_CARTON_AMOUNTS = [500, 1000, 2000, 5000, 10000];

function formatNum(n) {
  return Number(n).toLocaleString('en-GB');
}

export default function PalletCalculatorModal({ open, onClose, grams, palletSizesConfig }) {
  const [gram, setGram] = useState('');
  const [customDivisor, setCustomDivisor] = useState('');
  const [useCustomDivisor, setUseCustomDivisor] = useState(false);
  const [totalCartons, setTotalCartons] = useState('');
  const [entryMode, setEntryMode] = useState('cartons'); // 'cartons' | 'pallets'

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const divisor = useMemo(() => {
    if (useCustomDivisor) {
      const n = Number(customDivisor);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    if (!gram) return 0;
    const n = Number(palletSizesConfig?.[gram]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [useCustomDivisor, customDivisor, gram, palletSizesConfig]);

  const calc = useMemo(() => {
    const total = Number(totalCartons);
    if (!Number.isFinite(total) || total < 0 || divisor <= 0) return null;
    if (entryMode === 'cartons') {
      const fullPallets = Math.floor(total / divisor);
      const leftoverCartons = total % divisor;
      const partialsUsed = leftoverCartons > 0 ? 1 : 0;
      const totalPalletSlots = fullPallets + partialsUsed;
      const capacity = totalPalletSlots * divisor;
      const unusedCapacity = capacity - total;
      const utilization = capacity > 0 ? (total / capacity) * 100 : 0;
      return {
        fullPallets, leftoverCartons, totalPalletSlots,
        capacity, unusedCapacity, utilization, totalCartons: total,
      };
    }
    const palletsRequested = Math.max(0, Math.floor(total));
    const computedCartons = palletsRequested * divisor;
    return {
      fullPallets: palletsRequested, leftoverCartons: 0,
      totalPalletSlots: palletsRequested, capacity: computedCartons,
      unusedCapacity: 0, utilization: 100, totalCartons: computedCartons,
    };
  }, [totalCartons, divisor, entryMode]);

  if (!open) return null;

  const activeDivisorLabel = useCustomDivisor
    ? `${customDivisor || 0} cartons`
    : (gram ? `${palletSizesConfig?.[gram] ?? '—'} cartons` : '—');

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] animate-[fadeIn_0.2s_ease] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-2 border-primary rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(255,107,0,0.35)] overflow-hidden animate-[fadeIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b-2 border-primary/40 flex justify-between items-center bg-gradient-to-r from-[#1E1E1E] to-[#2d2d2d]">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧮</span>
            <div>
              <h2 className="text-2xl font-black text-primary tracking-widest uppercase">Pallet Calculator</h2>
              <p className="text-xs text-gray-400 mt-0.5">Loading & waybill quantity breakdown</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-4xl leading-none transition-colors" aria-label="Close">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#121212] rounded-xl mb-6 border border-[#333]">
            {[
              { id: 'cartons', label: '🧾 Cartons → Pallets' },
              { id: 'pallets', label: '🏗️ Pallets → Cartons' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => { setEntryMode(m.id); setTotalCartons(''); }}
                className={`p-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                  entryMode === m.id
                    ? 'bg-gradient-to-br from-primary to-[#e55a00] text-white shadow-[0_0_15px_rgba(255,107,0,0.4)]'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Gram + divisor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-primary font-bold mb-2 text-sm">⚖️ Gram / SKU</label>
              <select
                value={gram}
                onChange={(e) => { setGram(e.target.value); setUseCustomDivisor(false); }}
                disabled={useCustomDivisor}
                className="w-full p-3 bg-[#121212] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">— Select Gram —</option>
                {grams.map((g) => (
                  <option key={g} value={g}>{g}g</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-primary font-bold mb-2 text-sm">
                📐 Cartons per Pallet <span className="text-gray-500 font-normal">(divisor)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={useCustomDivisor ? customDivisor : (gram ? (palletSizesConfig?.[gram] ?? '') : '')}
                  onChange={(e) => {
                    setUseCustomDivisor(true);
                    setCustomDivisor(e.target.value);
                  }}
                  placeholder="e.g. 100"
                  className="flex-1 p-3 bg-[#121212] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary transition-all"
                />
                {useCustomDivisor && (
                  <button
                    onClick={() => { setUseCustomDivisor(false); setCustomDivisor(''); }}
                    className="px-3 bg-[#1a1a1a] border-2 border-gray-800 rounded-lg text-xs text-gray-400 hover:text-primary hover:border-primary transition-all whitespace-nowrap"
                    title="Use the saved pallet size for this gram"
                  >
                    Use default
                  </button>
                )}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Using: <span className="text-primary font-bold">{activeDivisorLabel}</span></div>
            </div>
          </div>

          {/* Total cartons input */}
          <div className="mb-6">
            <label className="block text-primary font-bold mb-3 text-sm text-center">
              {entryMode === 'cartons' ? '🔢 Total Cartons to Load' : '🏗️ Number of Pallets'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={totalCartons}
                onChange={(e) => setTotalCartons(e.target.value)}
                placeholder={entryMode === 'cartons' ? 'e.g. 1,250' : 'e.g. 12'}
                className="w-full p-5 text-4xl font-black text-center text-white bg-[#121212] border-2 border-gray-800 rounded-2xl outline-none focus:border-primary transition-all tabular-nums"
                autoFocus
              />
            </div>
            {entryMode === 'cartons' && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {PRESET_CARTON_AMOUNTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setTotalCartons(String(p))}
                    className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-xs text-gray-400 hover:text-primary hover:border-primary transition-all font-medium"
                  >
                    {formatNum(p)}
                  </button>
                ))}
                <button
                  onClick={() => setTotalCartons('')}
                  className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-xs text-gray-500 hover:text-status-danger hover:border-status-danger transition-all font-medium"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Result */}
          {calc ? (
            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
              {/* Headline result */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#121212] border-2 border-primary/40 rounded-xl p-4 text-center shadow-[0_0_20px_rgba(255,107,0,0.15)]">
                  <div className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-1">🏗️ Full Pallets</div>
                  <div className="text-4xl font-black text-primary tabular-nums">{formatNum(calc.fullPallets)}</div>
                </div>
                <div className={`rounded-xl p-4 text-center border-2 ${calc.leftoverCartons > 0 ? 'border-status-warning/50 bg-status-warning/5' : 'border-[#333] bg-[#121212]'}`}>
                  <div className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-1">📦 Leftover Cartons</div>
                  <div className={`text-4xl font-black tabular-nums ${calc.leftoverCartons > 0 ? 'text-status-warning' : 'text-gray-600'}`}>{formatNum(calc.leftoverCartons)}</div>
                </div>
                <div className="bg-[#121212] border-2 border-[#333] rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 uppercase font-bold tracking-wider mb-1">🚚 Total Pallet Slots</div>
                  <div className="text-4xl font-black text-white tabular-nums">{formatNum(calc.totalPalletSlots)}</div>
                </div>
              </div>

              {/* Breakdown / detail */}
              <div className="bg-dark-card border border-[#333] rounded-xl p-5">
                <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">📊 Breakdown</div>
                <div className="space-y-2 text-sm">
                  <Row label="Total cartons entered" value={`${formatNum(calc.totalCartons)} cartons`} />
                  <Row label="Cartons per pallet" value={`${formatNum(divisor)} cartons`} />
                  <Row label="Full pallets" value={`${formatNum(calc.fullPallets)} × ${formatNum(divisor)} = ${formatNum(calc.fullPallets * divisor)}`} />
                  {calc.leftoverCartons > 0 && (
                    <Row label="Partial pallet" value={`1 pallet with ${formatNum(calc.leftoverCartons)} carton${calc.leftoverCartons !== 1 ? 's' : ''}`} highlight />
                  )}
                  <div className="h-px bg-[#333] my-1" />
                  <Row label={entryMode === 'cartons' ? 'Total pallet slots needed' : 'Computed cartons'} value={`${formatNum(entryMode === 'cartons' ? calc.totalPalletSlots : calc.capacity)} ${entryMode === 'cartons' ? 'pallets' : 'cartons'}`} strong />
                </div>
              </div>

              {/* Utilization bar (cartons mode only) */}
              {entryMode === 'cartons' && (
                <div className="bg-dark-card border border-[#333] rounded-xl p-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Truck Fill Efficiency</span>
                    <span className={`text-sm font-black ${calc.utilization >= 95 ? 'text-status-success' : calc.utilization >= 70 ? 'text-status-warning' : 'text-status-danger'}`}>
                      {calc.utilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-[#121212] rounded-full overflow-hidden border border-[#333]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${calc.utilization >= 95 ? 'bg-status-success' : calc.utilization >= 70 ? 'bg-status-warning' : 'bg-status-danger'}`}
                      style={{ width: `${Math.min(100, calc.utilization)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    {calc.unusedCapacity > 0
                      ? `${formatNum(calc.unusedCapacity)} empty slot${calc.unusedCapacity !== 1 ? 's' : ''} on the partial pallet — ${formatNum(divisor - calc.leftoverCartons)} more carton${(divisor - calc.leftoverCartons) !== 1 ? 's' : ''} would complete it.`
                      : 'Every pallet is completely full — no wasted space.'}
                  </div>
                </div>
              )}

              {/* Equation */}
              <div className="bg-primary/10 border-2 border-primary/30 rounded-xl p-4 text-center font-mono text-sm text-gray-300">
                {entryMode === 'cartons' ? (
                  <>
                    {formatNum(calc.totalCartons)} ÷ {formatNum(divisor)} ={' '}
                    <span className="text-primary font-bold">{formatNum(calc.fullPallets)}</span> pallets
                    {calc.leftoverCartons > 0 && (
                      <> + <span className="text-status-warning font-bold">{formatNum(calc.leftoverCartons)}</span> cartons</>
                    )}
                  </>
                ) : (
                  <>
                    {formatNum(calc.fullPallets)} × {formatNum(divisor)} ={' '}
                    <span className="text-primary font-bold">{formatNum(calc.capacity)}</span> cartons
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <div className="text-5xl mb-3 opacity-40">🚚</div>
              <p className="text-sm">
                {!gram && !useCustomDivisor
                  ? 'Select a gram (or enter a custom pallet size) and enter a quantity to see the breakdown.'
                  : divisor <= 0
                    ? 'Enter a valid pallet size (cartons per pallet) to calculate.'
                    : `Enter the ${entryMode === 'cartons' ? 'total cartons' : 'number of pallets'} to compute the breakdown.`}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#333] bg-gradient-to-r from-[#1E1E1E] to-[#2d2d2d] flex justify-between items-center">
          <span className="text-[11px] text-gray-500">Tip: press <kbd className="px-1.5 py-0.5 bg-[#121212] border border-[#333] rounded text-primary text-xs">Esc</kbd> to close</span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-br from-primary to-[#e55a00] text-white rounded-lg font-bold uppercase tracking-wide text-sm hover:shadow-[0_0_20px_rgba(255,107,0,0.5)] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, highlight }) {
  return (
    <div className={`flex justify-between items-center ${strong ? 'text-white font-bold text-base' : 'text-gray-300'}`}>
      <span className={highlight ? 'text-status-warning' : ''}>{label}</span>
      <span className={`tabular-nums ${highlight ? 'text-status-warning font-bold' : strong ? 'text-primary' : 'text-white'}`}>{value}</span>
    </div>
  );
}
