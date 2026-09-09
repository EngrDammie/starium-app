// Presentational tab: gram specifications table.
export default function GramSpecsTab({ config, setGramForm, setIsGramModalOpen, deleteGramSpec }) {
  return (
    <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-primary">⚖️ Gram Specifications</h2>
        <button onClick={() => { setGramForm({ oldGram: '', gram: '', min: '', max: '', pieces: '', bags: '', freebies: '', isEdit: false }); setIsGramModalOpen(true); }} className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary-dark">➕ Add Gram Spec</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-primary text-primary text-xs uppercase tracking-wider"><th className="p-3">⚖️ Gram</th><th className="p-3">⬇️ Min Density</th><th className="p-3">⬆️ Max Density</th><th className="p-3">📦 Pieces</th><th className="p-3">📝 Breakdown</th><th className="p-3">🛍️ Bags</th><th className="p-3">🎁 Freebies</th><th className="p-3">⚡ Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {Object.entries(config.gramSpecs || {}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([gram, spec]) => (
              <tr key={gram} className="hover:bg-white/5">
                <td className="p-3 text-status-warning font-bold">{gram}g</td><td className="p-3 text-white">{spec.min.toFixed(3)}</td><td className="p-3 text-white">{spec.max.toFixed(3)}</td><td className="p-3 text-gray-300">{spec.piecesPerCarton || 'N/A'}</td>
                <td className="p-3 text-gray-400 text-sm">{spec.piecesBreakdown || '-'}</td>
                <td className="p-3 text-white">{spec.bagCount ?? '-'}</td>
                <td className="p-3 text-white">{spec.freebieCount ?? '-'}</td>
                <td className="p-3 flex gap-2"><button onClick={() => { setGramForm({ oldGram: gram, gram, min: spec.min, max: spec.max, pieces: spec.piecesPerCarton||'', breakdown: spec.piecesBreakdown||'', bags: spec.bagCount||'', freebies: spec.freebieCount||'', isEdit: true }); setIsGramModalOpen(true); }} className="bg-[#333] text-white px-3 py-1 rounded hover:bg-[#555]">✏️ Edit</button><button onClick={() => deleteGramSpec(gram)} className="bg-status-danger/20 text-status-danger px-3 py-1 rounded hover:bg-status-danger hover:text-white">🗑️ Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
