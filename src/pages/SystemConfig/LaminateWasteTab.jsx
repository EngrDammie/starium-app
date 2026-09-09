// Presentational tab: laminate waste thresholds + roll/sac settings.
export default function LaminateWasteTab({ config, laminateWasteSettings, setLaminateWasteSettings, updateDatabase }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <h2 className="text-xl font-bold text-primary mb-6">🗑️ Laminate Waste Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">⚠️ Waste Thresholds</h3>
          <div className="flex justify-between items-center mb-3">
            <label className="text-gray-300">🎯 Target Waste %:</label>
            <input type="number" min="0" max="100" step="0.5"
              value={laminateWasteSettings.targetWastePercent}
              onChange={e => setLaminateWasteSettings(prev => ({ ...prev, targetWastePercent: Number(e.target.value) }))}
              className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
          </div>
          <div className="text-xs text-gray-500 mt-1">Machines above this % turn red.</div>
          <div className="flex justify-between items-center mt-4 mb-3">
            <label className="text-gray-300">🔔 Alert Threshold %:</label>
            <input type="number" min="0" max="100" step="0.5"
              value={laminateWasteSettings.wasteAlertThreshold}
              onChange={e => setLaminateWasteSettings(prev => ({ ...prev, wasteAlertThreshold: Number(e.target.value) }))}
              className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
          </div>
          <div className="text-xs text-gray-500 mt-1">Broadcasts alert when waste exceeds this %.</div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🧻 Roll Settings</h3>
          <div className="mb-3">
            <label className="text-gray-300">📦 Rolls per Shift:</label>
            <input type="number" min="1" step="0.5"
              value={laminateWasteSettings.rollsPerShift}
              onChange={e => setLaminateWasteSettings(prev => ({ ...prev, rollsPerShift: Number(e.target.value) }))}
              className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
          </div>
          <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mt-4 mb-2 border-b border-[#333] pb-1">⚖️ Roll Weight per Gram Setting (kg)</div>
          {Object.keys(config.gramSpecs || {}).sort((a,b)=>Number(a)-Number(b)).map(gram => (
            <div key={gram} className="flex justify-between items-center mb-2">
              <label className="text-gray-300">{gram}g:</label>
              <input type="number" min="0" step="0.01"
                value={laminateWasteSettings[`rollWeight${gram}`]}
                onChange={e => setLaminateWasteSettings(prev => ({ ...prev, [`rollWeight${gram}`]: Number(e.target.value) }))}
                className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
            </div>
          ))}
        </div>

        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🛄 Sac Types</h3>
          <div className="mb-3">
            <label className="text-gray-300">🟢 Small Sac Weight (g):</label>
            <input type="number" min="0" step="1"
              value={laminateWasteSettings.smallSacWeight}
              onChange={e => setLaminateWasteSettings(prev => ({ ...prev, smallSacWeight: Number(e.target.value) }))}
              className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
          </div>
          <div className="mb-3">
            <label className="text-gray-300">🟡 Large Sac Weight (g):</label>
            <input type="number" min="0" step="1"
              value={laminateWasteSettings.largeSacWeight}
              onChange={e => setLaminateWasteSettings(prev => ({ ...prev, largeSacWeight: Number(e.target.value) }))}
              className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <button onClick={async () => {
        const currentGrams = Object.keys(config.gramSpecs || {});
        const rollWeights = {};
        for (const gram of currentGrams) {
          rollWeights[gram] = laminateWasteSettings[`rollWeight${gram}`] || 0;
        }
        await updateDatabase({
          laminateWaste: {
            targetWastePercent: laminateWasteSettings.targetWastePercent,
            wasteAlertThreshold: laminateWasteSettings.wasteAlertThreshold,
            rollsPerShift: laminateWasteSettings.rollsPerShift,
            sacTypes: [
              { id: 'small', label: 'Small Sac', weight: laminateWasteSettings.smallSacWeight / 1000 },
              { id: 'large', label: 'Large Sac', weight: laminateWasteSettings.largeSacWeight / 1000 }
            ],
            rollWeights
          }
        }, 'Laminate waste settings saved!');
      }} className="mt-6 bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
        💾 Save Laminate Waste Settings
      </button>
    </div>
  );
}
