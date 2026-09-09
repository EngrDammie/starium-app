// Presentational machine-detail view for the QC Sachet page.
// All data fetching + save handlers live in the parent; this only renders
// the detail card (round history, check buttons, dialogs).
import Layout from '../Layout';
import QCStringWeightDialog from '../QCStringWeightDialog';
import QCBagInspectionDialog from '../QCBagInspectionDialog';
import QCCartonInspectionDialog from '../QCCartonInspectionDialog';

export default function QCSachetMachineDetail({
  selectedMachine, machineRecords, swRoundNumber,
  swTimeLeft, bagInspectionLocked, bagInspectionReady, biTimeLeft,
  cartonInspectionLocked, cartonInspectionReady, ciTimeLeft,
  formatCountdown, handleBackToGrid, setDialogType, dialogType,
  swPreviousRecord, handleSaveStringWeight,
  biPreviousRecord, batchNumber, stringWeightRecord, handleSaveBagInspection,
  biRoundNumber, ciPreviousRecord, handleSaveCartonInspection, ciRoundNumber,
  saving,
}) {
  return (
    <Layout title="QC Sachet Production Checks" subtitle={selectedMachine ? `Machine M${selectedMachine.displayNumber || selectedMachine.id}` : ''} maxWidth="max-w-4xl">
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <button onClick={handleBackToGrid} className="text-primary hover:text-primary-dark text-sm font-bold mb-4">&larr; Back to Machines</button>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              Machine M{selectedMachine.displayNumber || selectedMachine.id}
              <span className="text-sm text-gray-400 font-normal ml-2">
                Line {selectedMachine.line} ({selectedMachine.gram}g · {selectedMachine.fillHeads ?? 2}H)
              </span>
            </h2>
          </div>
          <div className="text-right">
            <div className="text-primary font-bold text-lg">Round {swRoundNumber}</div>
            <div className="text-xs text-gray-500">{machineRecords.length} total round{machineRecords.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {machineRecords.length > 0 && (
          <div className="mb-4 bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider px-4 pt-3 pb-1">🔬 String Weight Checks — Round History</div>
            <div className="hidden md:flex items-center px-4 py-1 text-[10px] text-gray-500 uppercase tracking-wider font-bold border-t border-[#333]">
              <span className="shrink-0 w-14">Round</span>
              <span className="flex-1 text-center">Weights</span>
              <span className="shrink-0 w-16 text-center">Result</span>
              <span className="shrink-0 w-28 text-center">Staff</span>
              <span className="shrink-0 w-14 text-right">Time</span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              {machineRecords.map((r) => (
                <div key={r.id || r.roundNumber} className={`flex items-center px-4 py-2 text-xs border-t border-[#333] last:border-b-0 ${!r.synced ? 'opacity-50' : ''}`}>
                  <span className="text-primary font-bold shrink-0 w-14">R{r.roundNumber}{!r.synced && <span className="ml-1 text-status-warning" title="Pending sync">⏳</span>}</span>
                  <div className="flex gap-2 flex-1 justify-center">
                    {(r.weights || []).map((w, i) => (
                      <span key={i} className="text-white font-bold">{w}g</span>
                    ))}
                  </div>
                  <span className={`shrink-0 w-16 text-center ${r.meetsCriteria === 'Y' ? 'text-status-success' : 'text-status-danger'}`}>
                    {r.meetsCriteria === 'Y' ? '✓ Meets' : '✗ No'}
                  </span>
                  <span className="text-gray-300 shrink-0 w-28 text-center">{r.checkedBy || 'Unknown'}</span>
                  <span className="text-gray-500 shrink-0 w-14 text-right">{r.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => swTimeLeft > 0 ? null : setDialogType('stringWeight')}
            className={`flex-1 py-4 rounded-xl font-bold transition-all ${swTimeLeft > 0 ? 'bg-[#1a1a1a] border-2 border-[#444] text-gray-600 cursor-not-allowed' : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-black'}`}>
            {swTimeLeft > 0
              ? `⏳ String Weight Check (${formatCountdown(swTimeLeft)})`
              : '✅ String Weight Check'}
          </button>

          {bagInspectionLocked ? (
            <button disabled
              className="flex-1 py-4 bg-[#1a1a1a] border-2 border-[#444] rounded-xl font-bold text-gray-600 cursor-not-allowed">
              🔒 Bag Inspection <span className="text-[10px] block">requires String Weight R1</span>
            </button>
          ) : (
            <button onClick={() => bagInspectionReady ? setDialogType('bagInspection') : null}
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${!bagInspectionReady ? 'bg-[#1a1a1a] border-2 border-[#444] text-gray-600 cursor-not-allowed' : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-black'}`}>
              {biTimeLeft > 0
                ? `⏳ Bag Inspection (${formatCountdown(biTimeLeft)})`
                : '✅ Bag Inspection'}
            </button>
          )}

          {cartonInspectionLocked ? (
            <button disabled
              className="flex-1 py-4 bg-[#1a1a1a] border-2 border-[#444] rounded-xl font-bold text-gray-600 cursor-not-allowed">
              🔒 Carton Inspection <span className="text-[10px] block">requires String Weight R1</span>
            </button>
          ) : (
            <button onClick={() => cartonInspectionReady ? setDialogType('cartonInspection') : null}
              className={`flex-1 py-4 rounded-xl font-bold transition-all ${!cartonInspectionReady ? 'bg-[#1a1a1a] border-2 border-[#444] text-gray-600 cursor-not-allowed' : 'bg-primary/20 border-2 border-primary text-primary hover:bg-primary hover:text-black'}`}>
              {ciTimeLeft > 0
                ? `⏳ Carton Inspection (${formatCountdown(ciTimeLeft)})`
                : '✅ Carton Inspection'}
            </button>
          )}
        </div>
      </div>

      {dialogType === 'stringWeight' && (
        <QCStringWeightDialog
          machine={selectedMachine}
          roundNumber={swRoundNumber}
          previousRecord={swPreviousRecord}
          onSave={handleSaveStringWeight}
          onClose={() => setDialogType(null)}
          saving={saving}
        />
      )}

      {dialogType === 'bagInspection' && (
        <QCBagInspectionDialog
          machine={selectedMachine}
          roundNumber={biRoundNumber}
          previousRecord={biPreviousRecord}
          batchNumber={batchNumber}
          stringWeightRecord={stringWeightRecord}
          onSave={handleSaveBagInspection}
          onClose={() => setDialogType(null)}
          saving={saving}
        />
      )}

      {dialogType === 'cartonInspection' && (
        <QCCartonInspectionDialog
          machine={selectedMachine}
          roundNumber={ciRoundNumber}
          previousRecord={ciPreviousRecord}
          batchNumber={batchNumber}
          stringWeightRecord={stringWeightRecord}
          onSave={handleSaveCartonInspection}
          onClose={() => setDialogType(null)}
          saving={saving}
        />
      )}
    </Layout>
  );
}
