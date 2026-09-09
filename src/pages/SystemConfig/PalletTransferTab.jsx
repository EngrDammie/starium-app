// Presentational tab: per-gram pallet sizes.
export default function PalletTransferTab({ config, palletTransferSettings, setPalletTransferSettings, updateDatabase }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <h2 className="text-xl font-bold text-primary mb-6">📦 Pallet Transfer Settings</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-[#444] p-6 rounded-xl">
          <h3 className="text-status-warning text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#333] pb-2">📐 Pallet Sizes (cartons per pallet)</h3>
          {Object.keys(config?.gramSpecs || { '22': {}, '45': {}, '85': {}, '125': {}, '850': {} }).sort((a, b) => Number(a) - Number(b)).map(gram => (
            <div key={gram} className="flex justify-between items-center mb-2">
              <label className="text-gray-300">{gram}g:</label>
              <input type="number" min="1" step="1"
                value={palletTransferSettings.palletSizes[gram] || ''}
                onChange={e => {
                  const val = Number(e.target.value);
                  setPalletTransferSettings(prev => ({
                    ...prev,
                    palletSizes: { ...prev.palletSizes, [gram]: val }
                  }));
                }}
                className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" />
            </div>
          ))}
          <div className="text-xs text-gray-500 mt-2">Cartons per pallet for each gram setting.</div>
        </div>
      </div>

      <button onClick={async () => {
        const currentGrams = Object.keys(config?.gramSpecs || {});
        const reconciled = {};
        for (const gram of currentGrams) {
          const existing = palletTransferSettings.palletSizes[gram];
          reconciled[gram] = existing || 80;
        }
        await updateDatabase({
          palletTransfer: {
            palletSizes: reconciled
          }
        }, 'Pallet transfer settings saved!');
      }} className="mt-6 bg-primary text-black px-10 py-3 rounded-lg font-bold hover:bg-primary-dark transition-all text-lg shadow-[0_0_15px_rgba(0,188,212,0.3)]">
        💾 Save Pallet Transfer Settings
      </button>
    </div>
  );
}
