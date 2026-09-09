// Presentational tab: machine list + filters. All state/handlers live in SystemConfig.jsx.
export default function MachinesTab({
  config, filteredMachines, machineLineFilter, setMachineLineFilter,
  machineSearch, setMachineSearch, handleOpenMachineModal, deleteMachine,
}) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">🏭 Machine Management</h2>
        <button onClick={() => handleOpenMachineModal()} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Machine</button>
      </div>

      <div className="flex gap-4 md:gap-6 mb-6">
        <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#444] text-center flex-1 shadow-inner"><div className="text-4xl font-bold text-primary">{config.machines?.length || 0}</div><div className="text-xs text-gray-400 uppercase tracking-wider mt-2 font-bold">🏭 Total Machines</div></div>
        <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#444] text-center flex-1 shadow-inner"><div className="text-4xl font-bold text-primary">{[...new Set((config.machines || []).map(m => m.line))].length}</div><div className="text-xs text-gray-400 uppercase tracking-wider mt-2 font-bold">📋 Production Lines</div></div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select value={machineLineFilter} onChange={e => setMachineLineFilter(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
          <option value="">All Lines</option>
          {(config.productionLines || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input type="text" value={machineSearch} onChange={e => setMachineSearch(e.target.value)} placeholder="Search by name or ID..." className="flex-1 bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider"><th className="p-3">🔢 ID</th><th className="p-3">🖥️ Display #</th><th className="p-3">📛 Name</th><th className="p-3">📋 Line</th><th className="p-3">⚖️ Gram</th><th className="p-3">🔩 Heads</th><th className="p-3">⬇️ Min</th><th className="p-3">⬆️ Max</th><th className="p-3">⚡ Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {filteredMachines.map(m => (
              <tr key={m.id} className="hover:bg-white/5">
                <td className="p-3 text-white">{m.id}</td><td className="p-3 text-primary font-bold">M{m.displayNumber || m.id}</td><td className="p-3 text-white">{m.name}</td><td className="p-3 text-gray-300">{m.line}</td><td className="p-3 text-status-warning font-bold">{m.gram}g</td><td className="p-3 text-status-warning font-bold">{m.fillHeads ?? 2}H</td><td className="p-3 text-gray-300">{m.min.toFixed(3)}</td><td className="p-3 text-gray-300">{m.max.toFixed(3)}</td>
                <td className="p-3 flex gap-2"><button onClick={() => handleOpenMachineModal(m)} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️ Edit</button><button onClick={() => deleteMachine(m.id)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
