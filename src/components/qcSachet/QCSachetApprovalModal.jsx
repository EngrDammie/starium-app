// Presentational shift-approval modal for the QC Sachet page.
// Approval writes live in the parent (submitApproval); this only renders.
export default function QCSachetApprovalModal({
  shiftInfo, machineStats, approvalData, formatTime,
  canApproveQcSupervisor, canApproveLineLeader,
  submitApproval, approvalLoading, onClose,
}) {
  const approversList = [];
  if (approvalData) {
    if (approvalData.qc_supervisor) approversList.push(approvalData.qc_supervisor);
    if (approvalData.line_leader) approversList.push(approvalData.line_leader);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-card border border-[#333] rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#333]">
          <h2 className="text-lg font-bold text-white">📋 Shift Approval — {shiftInfo.shift} {shiftInfo.date}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="p-5">
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 uppercase tracking-wider border-b border-[#333]">
                  <th className="text-left py-2 pr-2">Machine</th>
                  <th className="text-center px-2">Gram</th>
                  <th className="text-center px-2">Line</th>
                  <th className="text-center px-2">Batch</th>
                  <th className="text-center px-2">SW</th>
                  <th className="text-center px-2">BI</th>
                  <th className="text-center px-2">CI</th>
                  <th className="text-center pl-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {machineStats.map(({ machine, swRounds, biRounds, ciRounds, latestSW }) => (
                  <tr key={machine.id} className="border-b border-[#222]">
                    <td className="py-2 pr-2 text-white font-bold">M{machine.displayNumber || machine.id}</td>
                    <td className="text-center px-2 text-gray-400">{machine.gram}g</td>
                    <td className="text-center px-2 text-gray-400">{machine.line}</td>
                    <td className="text-center px-2 text-gray-300">{latestSW?.batchNumber || '-'}</td>
                    <td className="text-center px-2">
                      <span className={`font-bold ${swRounds > 0 ? 'text-status-success' : 'text-gray-500'}`}>{swRounds}</span>
                    </td>
                    <td className="text-center px-2">
                      <span className={`font-bold ${biRounds > 0 ? 'text-status-success' : 'text-gray-500'}`}>{biRounds}</span>
                    </td>
                    <td className="text-center px-2">
                      <span className={`font-bold ${ciRounds > 0 ? 'text-status-success' : 'text-gray-500'}`}>{ciRounds}</span>
                    </td>
                    <td className="text-center pl-2">
                      {latestSW ? (
                        <span className={latestSW.meetsCriteria === 'Y' ? 'text-status-success' : 'text-status-danger'}>
                          {latestSW.meetsCriteria === 'Y' ? '✓' : '✗'}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#333] pt-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Approvals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-bold text-sm">🔍 QC Supervisor</span>
                  {approvalData?.qc_supervisor ? (
                    <span className="text-status-success text-xs flex items-center gap-1">✓ {approvalData.qc_supervisor.name} <span className="text-gray-500">{formatTime(approvalData.qc_supervisor.timestamp)}</span></span>
                  ) : (
                    <span className="text-gray-500 text-xs">Pending</span>
                  )}
                </div>
                {!approvalData?.qc_supervisor && canApproveQcSupervisor && (
                  <button onClick={() => submitApproval('qc_supervisor')} disabled={approvalLoading}
                    className="w-full mt-2 bg-primary/20 border border-primary text-primary hover:bg-primary hover:text-black py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
                    {approvalLoading ? 'Approving...' : '✅ Approve as QC Supervisor'}
                  </button>
                )}
              </div>

              <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-bold text-sm">👷 Line Leader</span>
                  {approvalData?.line_leader ? (
                    <span className="text-status-success text-xs flex items-center gap-1">✓ {approvalData.line_leader.name} <span className="text-gray-500">{formatTime(approvalData.line_leader.timestamp)}</span></span>
                  ) : (
                    <span className="text-gray-500 text-xs">Pending</span>
                  )}
                </div>
                {!approvalData?.line_leader && canApproveLineLeader && (
                  <button onClick={() => submitApproval('line_leader')} disabled={approvalLoading}
                    className="w-full mt-2 bg-primary/20 border border-primary text-primary hover:bg-primary hover:text-black py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
                    {approvalLoading ? 'Approving...' : '✅ Approve as Line Leader'}
                  </button>
                )}
              </div>
            </div>

            {approversList.length === 2 && (
              <div className="mt-4 text-center">
                <span className="text-status-success text-sm font-bold">✅ All approvals complete — shift is fully approved</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
