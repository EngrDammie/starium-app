// Presentational tab: QC check intervals + per-gram string weight ranges.
export default function QCSettingsTab({ config, qcSettings, setQcSettings, updateDatabase }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <h2 className="text-xl font-bold text-primary mb-6">🔬 QC Settings</h2>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-status-warning mb-2">⏱️ Check Intervals</h3>
        <p className="text-sm text-gray-400 mb-4">Minimum time (in minutes) between consecutive checks per machine. Prevents overly frequent inspections.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'stringWeight', label: '🔬 String Weight Check', default: 15 },
            { key: 'bagInspection', label: '🛍️ Bag Inspection', default: 15 },
            { key: 'cartonInspection', label: '📦 Carton Inspection', default: 60 }
          ].map(item => (
            <div key={item.key} className="bg-[#1a1a1a] border border-[#444] p-4 rounded-xl">
              <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">{item.label}</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min="0" value={qcSettings.checkIntervals[item.key] ?? item.default}
                  onChange={e => setQcSettings(prev => ({ ...prev, checkIntervals: { ...prev.checkIntervals, [item.key]: Number(e.target.value) } }))}
                  className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                <span className="text-gray-500 text-sm">minutes</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-lg font-bold text-status-warning mb-2">⚖️ String Weight Ranges</h3>
      <p className="text-sm text-gray-400 mb-4">Configure the acceptable weight ranges per gram setting for sachet string checks.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {Object.keys(config.gramSpecs || {}).sort((a,b)=>Number(a)-Number(b)).map(gram => {
          const range = { tooLow: { max: 0 }, low: { min: 0, max: 0 }, target: { min: 0, max: 0 }, high: { min: 0, max: 0 }, tooHigh: { min: 0 }, ...(qcSettings.weightRanges[gram] || {}) };
          return (
            <div key={gram} className="bg-[#1a1a1a] border border-[#444] p-5 rounded-xl">
              <h3 className="text-status-warning font-bold text-lg mb-4 border-b border-[#333] pb-2">{gram}g Settings</h3>

              <div className="mb-3">
                <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📉 Too Low (max)</label>
                <input type="number" value={range.tooLow.max}
                  onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], tooLow: { max: Number(e.target.value) } } } }))}
                  className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📉 Low (min)</label>
                  <input type="number" value={range.low.min}
                    onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], low: { ...prev.weightRanges[gram]?.low, min: Number(e.target.value) } } } }))}
                    className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 Low (max)</label>
                  <input type="number" value={range.low.max}
                    onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], low: { ...prev.weightRanges[gram]?.low, max: Number(e.target.value) } } } }))}
                    className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">🎯 Target (min)</label>
                  <input type="number" value={range.target.min}
                    onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], target: { ...prev.weightRanges[gram]?.target, min: Number(e.target.value) } } } }))}
                    className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">🎯 Target (max)</label>
                  <input type="number" value={range.target.max}
                    onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram], target: { ...prev.weightRanges[gram]?.target, max: Number(e.target.value) } } } }))}
                    className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>

              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 High (min)</label>
                  <input type="number" value={range.high.min}
                    onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram]?.high, min: Number(e.target.value) } } }))}
                    className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 High (max)</label>
                  <input type="number" value={range.high.max}
                    onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram]?.high, max: Number(e.target.value) } } }))}
                    className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-gray-400 text-xs uppercase tracking-wider font-bold">📈 Too High (min)</label>
                <input type="number" value={range.tooHigh.min}
                  onChange={e => setQcSettings(prev => ({ ...prev, weightRanges: { ...prev.weightRanges, [gram]: { ...prev.weightRanges[gram]?.tooHigh, min: Number(e.target.value) } } }))}
                  className="w-full mt-1 p-2 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={async () => {
        await updateDatabase({ fillHeadWeightRanges: qcSettings.weightRanges, qcCheckIntervals: qcSettings.checkIntervals }, 'QC settings saved!');
      }} className="bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
        💾 Save QC Settings
      </button>
    </div>
  );
}
