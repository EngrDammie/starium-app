// The three entity modals for the System Config panel.
// Props-owned by SystemConfig.jsx; this file only renders.
export function MachineModal({ config, machineForm, setMachineForm, handleMachineGramChange, saveMachine, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-lg shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
        <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{machineForm.isEdit ? '✏️ Edit Machine' : '➕ Add Machine'}</h2>
        <form onSubmit={saveMachine} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">🔢 Internal ID</label>
              <input type="number" required disabled={machineForm.isEdit} value={machineForm.id} onChange={e => setMachineForm({...machineForm, id: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary disabled:opacity-50" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">🖥️ Display Number (M#)</label>
              <input type="number" required value={machineForm.displayNumber} onChange={e => setMachineForm({...machineForm, displayNumber: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">📛 Machine Name</label>
            <input type="text" required value={machineForm.name} onChange={e => setMachineForm({...machineForm, name: e.target.value})} placeholder="e.g., Machine 1" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">📋 Production Line</label>
              <select required value={machineForm.line} onChange={e => setMachineForm({...machineForm, line: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
                <option value="" disabled>Select Line</option>
                {(config.productionLines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">⚖️ Gram Setting</label>
              <select required value={machineForm.gram} onChange={e => handleMachineGramChange(e.target.value)} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
                {Object.keys(config.gramSpecs || {}).sort((a,b)=>Number(a)-Number(b)).map(g => <option key={g} value={g}>{g}g</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">🔩 Fill Heads</label>
              <input type="number" min="1" required value={machineForm.fillHeads} onChange={e => setMachineForm({...machineForm, fillHeads: Number(e.target.value)})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">⬇️ Min Density</label>
              <input type="number" step="0.001" disabled value={machineForm.min} className="w-full mt-1 p-3 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded-lg cursor-not-allowed" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">⬆️ Max Density</label>
              <input type="number" step="0.001" disabled value={machineForm.max} className="w-full mt-1 p-3 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded-lg cursor-not-allowed" />
            </div>
          </div>
          <div className="text-xs text-status-warning mt-[-10px] mb-2 text-center">Min/Max auto-filled from Gram Specs</div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">💾 Save Machine</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LineModal({ lineForm, setLineForm, saveLine, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
        <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{lineForm.isEdit ? '✏️ Edit Line' : '➕ Add Line'}</h2>
        <form onSubmit={saveLine} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">🆔 Line ID</label>
            <input type="text" required disabled={lineForm.isEdit} value={lineForm.id} onChange={e => setLineForm({...lineForm, id: e.target.value.toUpperCase()})} placeholder="e.g., 4A" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">📛 Line Name</label>
            <input type="text" required value={lineForm.name} onChange={e => setLineForm({...lineForm, name: e.target.value})} placeholder="e.g., Line 4A" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">🔢 Display Order (1=Rightmost)</label>
            <input type="number" required value={lineForm.order} onChange={e => setLineForm({...lineForm, order: e.target.value})} className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">💾 Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GramModal({ gramForm, setGramForm, saveGramSpec, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-sm shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
        <h2 className="text-primary text-xl font-bold mb-6 text-center uppercase tracking-wider">{gramForm.isEdit ? '✏️ Edit Gram Spec' : '➕ Add Gram Spec'}</h2>
        <form onSubmit={saveGramSpec} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">⚖️ Gram Setting</label>
            <input type="number" required value={gramForm.gram} onChange={e => setGramForm({...gramForm, gram: e.target.value})} placeholder="e.g., 55" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">⬇️ Min Density</label>
              <input type="number" required step="0.001" value={gramForm.min} onChange={e => setGramForm({...gramForm, min: e.target.value})} placeholder="0.200" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">⬆️ Max Density</label>
              <input type="number" required step="0.001" value={gramForm.max} onChange={e => setGramForm({...gramForm, max: e.target.value})} placeholder="0.310" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">📝 Breakdown (Free Text)</label>
            <input type="text" value={gramForm.breakdown} onChange={e => setGramForm({...gramForm, breakdown: e.target.value})} placeholder="e.g., 27 strings * 6 pcs" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">🛍️ Bags per Carton</label>
              <input type="number" min="0" value={gramForm.bags} onChange={e => setGramForm({...gramForm, bags: e.target.value})} placeholder="e.g., 150" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 uppercase font-bold">🎁 Freebies per Carton</label>
              <input type="number" min="0" value={gramForm.freebies} onChange={e => setGramForm({...gramForm, freebies: e.target.value})} placeholder="e.g., 12" className="w-full mt-1 p-3 bg-[#1a1a1a] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase font-bold">📦 Pieces Per Carton (bags + freebies)</label>
            <input type="number" value={parseInt(gramForm.bags || 0) + parseInt(gramForm.freebies || 0) || gramForm.pieces} disabled
              className="w-full mt-1 p-3 bg-[#121212] text-gray-400 border border-[#444] rounded-lg cursor-not-allowed" />
          </div>
          <div className="flex gap-3 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">💾 Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
