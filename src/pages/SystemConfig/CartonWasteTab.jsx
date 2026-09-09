// Presentational tab: carton waste thresholds.
export default function CartonWasteTab({ cartonWasteSettings, setCartonWasteSettings, updateDatabase }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <h2 className="text-xl font-bold text-primary mb-6">📦 Carton Waste Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">⚠️ Waste Thresholds</h3>
          <div className="flex justify-between items-center mb-3">
            <label className="text-gray-300">🎯 Target Waste %:</label>
            <input type="number" min="0" max="100" step="0.5"
              value={cartonWasteSettings.targetWastePercent}
              onChange={e => setCartonWasteSettings(prev => ({ ...prev, targetWastePercent: Number(e.target.value) }))}
              className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
          </div>
          <div className="text-xs text-gray-500 mt-1">Machines above this % turn red.</div>
          <div className="flex justify-between items-center mt-4 mb-3">
            <label className="text-gray-300">🔔 Alert Threshold %:</label>
            <input type="number" min="0" max="100" step="0.5"
              value={cartonWasteSettings.wasteAlertThreshold}
              onChange={e => setCartonWasteSettings(prev => ({ ...prev, wasteAlertThreshold: Number(e.target.value) }))}
              className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
          </div>
          <div className="text-xs text-gray-500 mt-1">Broadcasts alert when a check exceeds this %.</div>
        </div>
      </div>

      <button onClick={async () => {
        await updateDatabase({
          cartonWaste: {
            targetWastePercent: cartonWasteSettings.targetWastePercent,
            wasteAlertThreshold: cartonWasteSettings.wasteAlertThreshold
          }
        }, 'Carton waste settings saved!');
      }} className="mt-6 bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
        💾 Save Carton Waste Settings
      </button>
    </div>
  );
}
