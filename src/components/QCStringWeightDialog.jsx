import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { getStringWeightStatus } from '../services/qcStringWeightOperations';

export default function QCStringWeightDialog({
  machine, roundNumber, previousRecord,
  onSave, onClose, saving
}) {
  const { config } = useConfig();
  const fillHeads = machine.fillHeads ?? 2;
  const isFirstRound = !previousRecord;
  const machineBatchNumber = previousRecord?.batchNumber || '';

  const [weights, setWeights] = useState(Array(fillHeads).fill(''));
  const [batchInput, setBatchInput] = useState(machineBatchNumber);
  const [meetsCriteria, setMeetsCriteria] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    setBatchInput(machineBatchNumber);
  }, [machineBatchNumber]);

  const handleWeightChange = (index, value) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const newWeights = [...weights];
    newWeights[index] = cleaned;
    setWeights(newWeights);
  };

  const allFilled = weights.every(w => w !== '' && !isNaN(w) && Number(w) > 0);
  const weightStatuses = weights.map(w => getStringWeightStatus(machine.gram, w, config));
  const allInTarget = allFilled && weightStatuses.every(s => s?.level === 'target');
  const outOfRangeCount = weightStatuses.filter(s => s && s.level !== 'target').length;
  const canSave = allFilled && meetsCriteria !== '' && (!isFirstRound || batchInput.trim() !== '');

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      weights: weights.map(Number),
      weightStatuses: weightStatuses.map(s => s?.level || 'unknown'),
      allInTarget,
      outOfRangeCount,
      meetsCriteria,
      remarks,
      batchNumber: isFirstRound ? batchInput.trim() : machineBatchNumber
    });
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => !saving && onClose()}>
      <div className="bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-6 rounded-2xl border-2 border-primary shadow-[0_20px_60px_rgba(0,188,212,0.3)] max-w-xl w-[95%] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-primary text-xl font-bold">
            String Weight Check — Round {roundNumber}
            <span className="text-sm text-gray-400 font-normal ml-2">
              M{machine.displayNumber || machine.id} · {machine.gram}g · {fillHeads}H
            </span>
          </h2>
          <button onClick={() => !saving && onClose()} className="text-gray-500 hover:text-white text-2xl">&times;</button>
        </div>

        {isFirstRound ? (
          <div className="mb-4">
            <label className="text-gray-300 text-sm font-bold">Batch Number:</label>
            <input type="text" required value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              placeholder="Enter batch number for this machine"
              className="w-full mt-1 p-3 bg-[#121212] text-white border border-[#444] rounded-lg outline-none focus:border-primary" />
          </div>
        ) : machineBatchNumber && (
          <div className="mb-4 bg-[#1a1a1a] border border-[#444] p-3 rounded-lg">
            <span className="text-gray-400 text-sm">Batch Number:</span>
            <span className="text-primary font-bold ml-2">{machineBatchNumber}</span>
            <span className="text-gray-500 text-xs ml-3">(entered in Round 1)</span>
          </div>
        )}

        <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl mb-4">
          {previousRecord ? (
            <>
              <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">
                Previous Round (#{previousRecord.roundNumber}) — checked by <span className="text-primary font-bold">{previousRecord.checkedBy || 'Unknown'}</span> at {formatTime(previousRecord.createdAt)}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {previousRecord.weights?.map((w, i) => (
                  <span key={i} className="text-gray-300">
                    String {i + 1}: <span className="text-white font-bold">{w}g</span>
                    <span className={`text-xs ml-1 ${getStringWeightStatus(machine.gram, w, config)?.text || 'text-gray-500'}`}>
                      ({getStringWeightStatus(machine.gram, w, config)?.label || '?'})
                    </span>
                  </span>
                ))}
              </div>
              <div className="text-xs mt-2">
                {previousRecord.allInTarget
                  ? <span className="text-status-success">✅ All {fillHeads} sachet strings within target range</span>
                  : <span className="text-status-danger">⚠️ {previousRecord.outOfRangeCount} of {fillHeads} sachet strings outside target</span>
                }
                {previousRecord.meetsCriteria === 'Y'
                  ? <span className="text-status-success ml-3">✓ Meets criteria</span>
                  : <span className="text-status-danger ml-3">✗ Does not meet criteria</span>
                }
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-status-warning uppercase font-bold tracking-wider mb-1">
                First round of the shift
              </div>
              <div className="text-sm text-gray-400">
                Enter the batch number above and record all string weights for this machine.
              </div>
            </>
          )}
        </div>

        <div className="mb-4">
          <label className="text-gray-300 text-sm font-bold mb-2 block">String Weights (grams):</label>
          <div className="flex gap-3 justify-center flex-wrap">
            {Array.from({ length: fillHeads }).map((_, i) => {
              const status = weightStatuses[i];
              return (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">String {i + 1}</span>
                  <input type="text" inputMode="decimal"
                    value={weights[i]}
                    onChange={e => handleWeightChange(i, e.target.value)}
                    className={`w-20 p-3 rounded-lg text-center font-bold text-sm outline-none transition-all bg-[#121212] text-white border-2 ${status ? `${status.border} ${status.bg}` : 'border-[#444]'}`} />
                  {status && (
                    <span className={`text-[10px] mt-1 font-bold ${status.text}`}>{status.label}</span>
                  )}
                </div>
              );
            })}
          </div>
          {allFilled && (
            <div className={`text-center mt-2 text-xs font-bold ${allInTarget ? 'text-status-success' : 'text-status-danger'}`}>
              {allInTarget
                ? `✅ All ${fillHeads} sachet strings within target range`
                : `⚠️ ${outOfRangeCount} of ${fillHeads} sachet strings outside target range`
              }
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="text-gray-300 text-sm font-bold block mb-2">Meets success criteria?</label>
          <select value={meetsCriteria} onChange={e => setMeetsCriteria(e.target.value)}
            className="w-full p-3 bg-[#121212] text-white border border-[#444] rounded-lg outline-none focus:border-primary">
            <option value="">Select...</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="text-gray-300 text-sm font-bold block mb-2">Remarks (optional):</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
            rows={2}
            className="w-full p-3 bg-[#121212] text-white border border-[#444] rounded-lg outline-none focus:border-primary resize-none" />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
