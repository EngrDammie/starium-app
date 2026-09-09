// Presentational tab: global factory settings + master auth toggle.
export default function GlobalSettingsTab({
  globalSettings, handleGlobalSettingsChange,
  packagingTeamsSettings, setPackagingTeamsSettings,
  saveGlobalSettings, authEnabled, toggleGlobalAuth,
}) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <h2 className="text-xl font-bold text-primary mb-6">⚙️ Global Factory Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">📊 Level 9 Density Rules</h3>
          <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬇️ Min Density:</label><input type="number" name="level9MinDensity" step="0.001" value={globalSettings.level9MinDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
          <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬆️ Max Density:</label><input type="number" name="level9MaxDensity" step="0.001" value={globalSettings.level9MaxDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
          <div className="flex justify-between items-center"><label className="text-gray-300">➗ Divisor:</label><input type="number" name="level9Divisor" step="1" value={globalSettings.level9Divisor} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🤖 BOT Density Rules</h3>
          <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬇️ Min Density:</label><input type="number" name="botMinDensity" step="0.001" value={globalSettings.botMinDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
          <div className="flex justify-between items-center mb-3"><label className="text-gray-300">⬆️ Max Density:</label><input type="number" name="botMaxDensity" step="0.001" value={globalSettings.botMaxDensity} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
          <div className="flex justify-between items-center"><label className="text-gray-300">➗ Divisor:</label><input type="number" name="botDivisor" step="1" value={globalSettings.botDivisor} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🕐 Shift Times (24h)</h3>
          <div className="flex justify-between items-center mb-3"><label className="text-gray-300">☀️ Day Shift Start:</label><input type="number" name="dayShiftStart" min="0" max="23" value={globalSettings.dayShiftStart} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
          <div className="flex justify-between items-center"><label className="text-gray-300">🌙 Night Shift Start:</label><input type="number" name="nightShiftStart" min="0" max="23" value={globalSettings.nightShiftStart} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">👥 Packaging Teams</h3>
          <div className="mb-3">
            <label className="text-gray-300">🏷️ Team Labels (comma-separated):</label>
            <input type="text"
              value={packagingTeamsSettings.labels}
              onChange={e => setPackagingTeamsSettings(prev => ({ ...prev, labels: e.target.value }))}
              placeholder="A, B, C"
              className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
          </div>
          <div className="mb-3">
            <label className="text-gray-300">⭐ Default Team:</label>
            <input type="text"
              value={packagingTeamsSettings.defaultTeam}
              onChange={e => setPackagingTeamsSettings(prev => ({ ...prev, defaultTeam: e.target.value }))}
              placeholder="A"
              className="w-full mt-1 p-3 bg-[#121212] border border-[#444] rounded text-white outline-none focus:border-primary" />
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">🖥️ UI Settings</h3>
          <div className="flex justify-between items-center mb-3"><label className="text-gray-300">📐 Machine Grid Columns:</label><input type="number" name="machineGridColumns" min="1" max="12" value={globalSettings.machineGridColumns} onChange={handleGlobalSettingsChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
        </div>
      </div>

      <button onClick={saveGlobalSettings} className="bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">💾 Save All Settings</button>

      <div className="mt-12 pt-8 border-t border-[#333]">
        <h3 className="text-xl font-bold text-white mb-4">🔐 Master Authentication Toggle</h3>
        <div className="flex items-center gap-4 bg-[#1a1a1a] p-6 border border-[#444] rounded-xl max-w-lg">
          <label className="relative inline-block w-14 h-8 cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={authEnabled} onChange={toggleGlobalAuth} />
            <div className="w-full h-full bg-[#444] rounded-full peer peer-checked:bg-status-success transition-colors duration-300"></div>
            <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"></div>
          </label>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white">Auth is <span className={authEnabled ? "text-status-success" : "text-gray-500"}>{authEnabled ? 'ENABLED' : 'DISABLED'}</span></span>
            <span className="text-xs text-gray-400 mt-1">Disabling allows "Ghost Admin" mode without login.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
