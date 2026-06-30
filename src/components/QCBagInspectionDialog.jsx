import { useState, useEffect, useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { computeOverallResult } from '../services/qcBagInspectionOperations';

const CRITERIA = [
  {
    key: 'leakage', label: 'Leakage (Horizontal/Vertical Seal Test)',
    options: ['A', 'U'],
    descriptions: {
      A: 'Seal is strong enough to prevent leaks after slight elongation.',
      U: 'Seal breaks or loosens before the surrounding material stretches.'
    }
  },
  {
    key: 'dirtPrintQuality', label: 'Dirt & Print Quality',
    options: ['A', 'U'],
    descriptions: {
      A: 'Bag is free of powder, oil, glue, or dirt; print is complete and high quality.',
      U: 'Visible dirt impacting appearance, unreadable barcodes/characters, or ink smears.'
    }
  },
  {
    key: 'completenessSachets', label: 'Completeness of Sachets (Bag Count)',
    options: ['A', 'U'],
    descriptions: {
      A: 'Meets packing standard — see breakdown above.',
      U: 'Any undercount or overcount against the defined standard.'
    }
  },
  {
    key: 'freebiesPresence', label: 'Presence & Completeness of Freebies',
    options: ['A', 'U'],
    descriptions: {
      A: 'Carton freebies are complete, undamaged, and match the approved SKU quantity.',
      U: 'Freebies are incomplete, defective, or unperforated.'
    }
  },
  {
    key: 'perforation', label: 'Perforation (Chain Bags)',
    options: ['A', 'U'],
    descriptions: {
      A: 'Perforation separates easily manually with no bag sifting afterward.',
      U: 'Bags cannot be separated or sifting occurs after separation.'
    }
  },
  {
    key: 'perfumeOdour', label: 'Perfume Odour Test',
    options: ['A', 'M', 'U'],
    descriptions: {
      A: 'Expected sensory and satisfactory intensity.',
      M: 'Mild perfume intensity.',
      U: 'No perfume or very low intensity.'
    }
  }
];

export default function QCBagInspectionDialog({
  machine, roundNumber, previousRecord, batchNumber, stringWeightRecord,
  onSave, onClose, saving
}) {
  const { config } = useConfig();

  const [values, setValues] = useState({});
  const [remarks, setRemarks] = useState('');

  const overallResult = useMemo(() => computeOverallResult(values), [values]);

  const allFilled = CRITERIA.every(c => values[c.key] !== undefined && values[c.key] !== '');
  const canSave = allFilled;

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      leakage: values.leakage,
      dirtPrintQuality: values.dirtPrintQuality,
      completenessSachets: values.completenessSachets,
      freebiesPresence: values.freebiesPresence,
      perforation: values.perforation,
      perfumeOdour: values.perfumeOdour,
      overallResult,
      remarks,
      batchNumber
    });
  };

  const gramSpec = config?.gramSpecs?.[String(machine.gram)];

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
            Bag Inspection — Round {roundNumber}
            <span className="text-sm text-gray-400 font-normal ml-2">
              M{machine.displayNumber || machine.id} · {machine.gram}g · {machine.fillHeads}H
            </span>
          </h2>
          <button onClick={() => !saving && onClose()} className="text-gray-500 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="mb-4 bg-[#1a1a1a] border border-[#444] p-3 rounded-lg">
          <span className="text-gray-400 text-sm">Batch Number:</span>
          <span className="text-primary font-bold ml-2">{batchNumber || 'N/A'}</span>
          {stringWeightRecord && (
            <span className="text-gray-500 text-xs ml-3">from String Weight Round {stringWeightRecord.roundNumber}</span>
          )}
        </div>

        {previousRecord ? (
          <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-xl mb-4">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">
              Previous Bag Inspection (#{previousRecord.roundNumber}) — checked by <span className="text-primary font-bold">{previousRecord.checkedBy || 'Unknown'}</span> at {formatTime(previousRecord.createdAt)}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {CRITERIA.map(c => (
                <span key={c.key} className={`px-2 py-0.5 rounded ${previousRecord[c.key] === 'A' ? 'bg-status-success/20 text-status-success' : previousRecord[c.key] === 'M' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-danger/20 text-status-danger'}`}>
                  {c.label.split('(')[0].trim()}: {previousRecord[c.key]}
                </span>
              ))}
            </div>
            <div className={`text-xs mt-2 font-bold ${previousRecord.overallResult === 'pass' ? 'text-status-success' : previousRecord.overallResult === 'conditional' ? 'text-status-warning' : 'text-status-danger'}`}>
              Overall: {previousRecord.overallResult === 'pass' ? '✅ Pass' : previousRecord.overallResult === 'conditional' ? '⚠️ Conditional' : '❌ Fail'}
            </div>
          </div>
        ) : (
          <div className="bg-status-warning/10 border border-status-warning/30 p-4 rounded-xl mb-4">
            <div className="text-xs text-status-warning uppercase font-bold tracking-wider mb-1">First bag inspection round</div>
            <div className="text-sm text-gray-400">Evaluate all 6 criteria below for this machine.</div>
          </div>
        )}

        {gramSpec?.bagCount != null && (
          <div className="bg-[#1a1a1a] border border-[#444] p-3 rounded-xl mb-4 text-center">
            <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">Packing Standard for {machine.gram}g</span>
            <div className="text-white font-bold text-sm mt-1">
              {gramSpec.bagCount} bags + {gramSpec.freebieCount} freebies = {gramSpec.bagCount + gramSpec.freebieCount} pieces per carton
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          {CRITERIA.map(c => {
            const val = values[c.key];
            let statusColor = 'border-[#444]';
            if (val === 'A') statusColor = 'border-status-success';
            else if (val === 'M') statusColor = 'border-status-warning';
            else if (val === 'U') statusColor = 'border-status-danger';

            return (
              <div key={c.key} className={`bg-[#1a1a1a] border ${statusColor} p-4 rounded-xl transition-colors`}>
                <label className="text-white text-sm font-bold block mb-2">{c.label}</label>
                <select value={val || ''} onChange={e => handleChange(c.key, e.target.value)}
                  className="w-full p-2.5 bg-[#121212] text-white border border-[#444] rounded-lg outline-none focus:border-primary text-sm">
                  <option value="">Select...</option>
                  {c.options.map(opt => (
                    <option key={opt} value={opt}>
                      {opt === 'A' ? 'Acceptable (A)' : opt === 'M' ? 'Marginally Acceptable (M)' : 'Unacceptable (U)'}
                    </option>
                  ))}
                </select>
                {val && (
                  <div className={`mt-2 text-xs p-2 rounded ${val === 'A' ? 'bg-status-success/10 text-status-success' : val === 'M' ? 'bg-status-warning/10 text-status-warning' : 'bg-status-danger/10 text-status-danger'}`}>
                    {c.descriptions[val]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {allFilled && (
          <div className={`text-center text-sm font-bold mb-4 p-3 rounded-lg ${overallResult === 'pass' ? 'bg-status-success/20 text-status-success' : overallResult === 'conditional' ? 'bg-status-warning/20 text-status-warning' : 'bg-status-danger/20 text-status-danger'}`}>
            Overall Result: {overallResult === 'pass' ? '✅ Pass — All criteria acceptable' : overallResult === 'conditional' ? '⚠️ Conditional — Some criteria marginally acceptable' : '❌ Fail — One or more criteria unacceptable'}
          </div>
        )}

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
