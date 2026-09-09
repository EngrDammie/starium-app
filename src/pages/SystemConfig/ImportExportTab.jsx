// Presentational tab: config backup import/export.
export default function ImportExportTab({ exportConfig, importConfig, fileInputRef }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <h2 className="text-xl font-bold text-primary mb-6">💾 Import / Export Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-2">📤 Export Configuration</h3>
          <p className="text-gray-400 text-sm mb-6">Download all current settings (machines, roles, rules) as a JSON file.</p>
          <button onClick={exportConfig} className="w-full bg-primary text-black px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all">📥 Download Backup</button>
        </div>
        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-lg font-bold text-white mb-2">📥 Import Configuration</h3>
          <p className="text-gray-400 text-sm mb-6">Restore settings from a previously exported backup JSON file.</p>
          <input type="file" accept=".json" ref={fileInputRef} onChange={importConfig} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#333] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#444] transition-all border border-[#555]">📤 Upload Backup File</button>
        </div>
      </div>
    </div>
  );
}
