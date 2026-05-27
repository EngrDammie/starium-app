// src/components/MachineModal.jsx
import { useConfig } from '../context/ConfigContext';

export default function MachineModal({ isOpen, onClose, machine, isMatch, isSelected, onToggleSelect, onOverride }) {
  const { config } = useConfig();

  if (!isOpen || !machine) return null;

  const spec = config.gramSpecs?.[String(machine.gram)];
  const min = spec ? spec.min : machine.min;
  const max = spec ? spec.max : machine.max;
  
  // Carton Breakdown logic from your old app
  let cartonContent = 'N/A';
  if (spec && spec.piecesPerCarton) {
    cartonContent = spec.piecesBreakdown 
      ? `${spec.piecesPerCarton} pieces (${spec.piecesBreakdown})` 
      : `${spec.piecesPerCarton} pieces`;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]" onClick={onClose}>
      {/* Click propagation stop prevents modal from closing when clicking inside it */}
      <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-8 rounded-2xl border-2 border-primary shadow-[0_20px_60px_rgba(0,188,212,0.3)] max-w-sm w-[90%]" onClick={e => e.stopPropagation()}>
        
        <h2 className="text-primary text-2xl font-bold mb-5 text-center">Machine Details</h2>
        
        <div className="flex flex-col gap-3 text-sm mb-6">
          <div className="flex justify-between border-b border-[#333] pb-2">
            <span className="text-gray-400">Machine ID:</span>
            <span className="text-primary font-bold">M{machine.displayNumber || machine.id}</span>
          </div>
          <div className="flex justify-between border-b border-[#333] pb-2">
            <span className="text-gray-400">Line:</span>
            <span className="text-primary font-bold">{machine.line}</span>
          </div>
          <div className="flex justify-between border-b border-[#333] pb-2">
            <span className="text-gray-400">Gram Setting:</span>
            <span className="text-primary font-bold">{machine.gram}g</span>
          </div>
          <div className="flex justify-between border-b border-[#333] pb-2">
            <span className="text-gray-400">Density Range:</span>
            <span className="text-primary font-bold">{min.toFixed(3)} - {max.toFixed(3)}</span>
          </div>
          <div className="flex justify-between border-b border-[#333] pb-2">
            <span className="text-gray-400">Carton Content:</span>
            <span className="text-primary font-bold text-right w-1/2">{cartonContent}</span>
          </div>
        </div>

        <label className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl cursor-pointer mb-4 hover:bg-primary/20 transition">
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={onToggleSelect} 
            className="w-5 h-5 accent-primary cursor-pointer"
          />
          <span className="text-white font-bold text-sm">Select for powder collection</span>
        </label>

        {/* Show Override button ONLY if it doesn't naturally match and isn't selected yet */}
        {!isMatch && !isSelected && (
          <button 
            onClick={onOverride}
            className="w-full py-3 mb-4 bg-status-warning text-black font-bold rounded-lg hover:bg-[#FFB74D] transition-transform hover:scale-105"
          >
            ⚠️ Override & Select
          </button>
        )}

        <button 
          onClick={onClose}
          className="w-full py-3 bg-primary text-black font-bold rounded-lg hover:bg-status-success transition-transform hover:scale-105"
        >
          Close
        </button>

      </div>
    </div>
  );
}