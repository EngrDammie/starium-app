// src/components/MachineGrid.jsx
import { useConfig } from '../context/ConfigContext';

export default function MachineGrid({ density, selectedMachines = [], overrideMachines = [], onMachineClick }) {
  const { config } = useConfig();
  const numDensity = parseFloat(density);

  if (isNaN(numDensity)) return null;

  // 🎯 FIX: Dynamically pull the lines from the database, exactly like your Vanilla App
  // We sort by b.order - a.order to arrange them Right to Left (3B on left, 1A on right)
  const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);
  
  const getMachineSpec = (machine) => {
    const spec = config.gramSpecs?.[String(machine.gram)];
    return {
      min: spec ? spec.min : machine.min,
      max: spec ? spec.max : machine.max
    };
  };

  return (
    <div className="flex gap-2 md:gap-3 max-w-4xl mx-auto justify-between mt-6">
      {lines.map(lineObj => {
        
        // Find machines for this specific line, and sort them top-to-bottom
        const lineMachines = (config.machines || [])
          .filter(m => m.line === lineObj.id)
          .sort((a, b) => (a.displayNumber || a.id) - (b.displayNumber || b.id));

        // If a line is empty in the database, don't draw an empty column
        if (lineMachines.length === 0) return null;

        return (
          <div key={lineObj.id} className="flex flex-col gap-2 md:gap-3 flex-1">
            {lineMachines.map(m => {
              const spec = getMachineSpec(m);
              const isMatch = numDensity >= spec.min && numDensity <= spec.max && 
                              numDensity >= config.level9MinDensity && numDensity <= config.level9MaxDensity;
              
              const isSelected = selectedMachines.includes(m.id);
              const isOverride = overrideMachines.includes(m.id);

              let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer relative ";
              
              if (isSelected || isOverride) {
                btnClass += "bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black border-2 border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.5)] hover:scale-105";
              } 
              else if (isMatch) {
                btnClass += "bg-gradient-to-br from-status-success to-[#00C853] text-black border-2 border-status-success shadow-[0_0_10px_rgba(0,230,118,0.3)] hover:scale-105";
              } 
              else {
                btnClass += "bg-dark-bg text-gray-400 border-2 border-[#444] opacity-40 hover:opacity-100 hover:scale-105";
              }

              return (
                <button 
                  key={m.id}
                  onClick={() => onMachineClick(m, isMatch, isSelected)}
                  className={btnClass}
                >
                  M{m.displayNumber || m.id}
                  {isOverride && <span className="absolute -top-2 -right-2 text-[10px]">⚠️</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}