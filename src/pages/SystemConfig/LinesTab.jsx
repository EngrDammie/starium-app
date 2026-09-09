// Presentational tab: production lines table.
export default function LinesTab({ config, setLineForm, setIsLineModalOpen, deleteLine }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">📋 Production Lines</h2>
        <button onClick={() => { setLineForm({ id: '', name: '', order: (config.productionLines?.length || 0) + 1, isEdit: false }); setIsLineModalOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Line</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider"><th className="p-3">🔢 Order</th><th className="p-3">🆔 Line ID</th><th className="p-3">📛 Name</th><th className="p-3">🏭 Count</th><th className="p-3">⚡ Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {[...(config.productionLines || [])].sort((a,b)=>a.order-b.order).map(l => (
              <tr key={l.id} className="hover:bg-white/5">
                <td className="p-3 text-white">{l.order}</td><td className="p-3 text-primary font-bold">{l.id}</td><td className="p-3 text-white">{l.name}</td><td className="p-3 text-gray-300">{(config.machines || []).filter(m => m.line === l.id).length}</td>
                <td className="p-3 flex gap-2"><button onClick={() => { setLineForm({ ...l, isEdit: true }); setIsLineModalOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️ Edit</button><button onClick={() => deleteLine(l.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
