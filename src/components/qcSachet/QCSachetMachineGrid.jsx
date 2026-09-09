// Presentational machine grid for the QC Sachet page.
// Status + queued logic live in the parent; this only renders buttons.
export default function QCSachetMachineGrid({
  lines, config, queuedSW, queuedBI, queuedCI,
  getMachineStatus, getMachineLatestRound, handleMachineClick,
}) {
  return (
    <div className="flex gap-2 md:gap-3 max-w-4xl mx-auto justify-between mt-4">
      {lines.map(lineObj => {
        const lineMachines = (config.machines || [])
          .filter(m => m.line === lineObj.id)
          .sort((a, b) => (a.displayNumber || a.id) - (b.displayNumber || b.id));
        if (lineMachines.length === 0) return null;
        return (
          <div key={lineObj.id} className="flex flex-col gap-2 md:gap-3 flex-1">
            {lineMachines.map(m => {
              const status = getMachineStatus(m.id);
              const latest = getMachineLatestRound(m.id);
              const hasQueuedSW = queuedSW.some(q => q.machineId === m.id);
              const hasQueuedBI = queuedBI.some(q => q.machineId === m.id);
              const hasQueuedCI = queuedCI.some(q => q.machineId === m.id);
              const isQueued = hasQueuedSW || hasQueuedBI || hasQueuedCI;
              let btnClass = "py-3 px-1 md:px-2 rounded-lg font-bold text-xs md:text-sm transition-all cursor-pointer relative flex flex-col items-center gap-1 justify-center min-h-[80px] ";
              if (status === 'unchecked' && isQueued) {
                btnClass += "bg-gradient-to-br from-status-warning to-[#e68900] text-white border-2 border-status-warning shadow-[0_0_10px_rgba(255,152,0,0.4)] hover:scale-105";
              } else if (status === 'checked') {
                btnClass += "bg-gradient-to-br from-status-success to-[#00C853] text-black border-2 border-status-success shadow-[0_0_10px_rgba(0,230,118,0.3)] hover:scale-105";
              } else if (status === 'high-waste') {
                btnClass += "bg-gradient-to-br from-status-danger to-[#D50000] text-white border-2 border-status-danger shadow-[0_0_10px_rgba(244,67,54,0.4)] hover:scale-105";
              } else {
                btnClass += "bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300 border-2 border-gray-600 hover:scale-105 hover:border-gray-500";
              }
              return (
                <button key={m.id} onClick={() => handleMachineClick(m)} className={btnClass}>
                  <span>M{m.displayNumber || m.id} · {m.gram}g</span>
                  {latest && <span className="text-[10px] leading-tight opacity-80">R{latest.roundNumber}</span>}
                  {isQueued && <span className="text-[10px] leading-tight text-status-warning">⏳ pending</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
