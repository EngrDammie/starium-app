import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { getStringWeightStatus } from '../services/qcStringWeightOperations';

const formatName = (str) => {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function OverallBadge({ result }) {
  if (!result) return <span className="text-gray-600">-</span>;
  if (result === 'pass') return <span className="text-status-success font-bold text-xs">✓ Pass</span>;
  if (result === 'conditional') return <span className="text-[#FF9800] font-bold text-xs">⚠ Conditional</span>;
  return <span className="text-status-danger font-bold text-xs">✗ Fail</span>;
}

function SectionHeader({ icon, title, count }) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#333]">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">{icon} {title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{count} record{count !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}

export default function QCSachetReport() {
  const { config, loadingConfig } = useConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('DAY');
  const [teamFilter, setTeamFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');

  const [swRecords, setSwRecords] = useState([]);
  const [biRecords, setBiRecords] = useState([]);
  const [ciRecords, setCiRecords] = useState([]);
  const [approvalData, setApprovalData] = useState(null);

  const machines = config?.machines || [];
  const teams = config?.packagingTeams?.labels || ['A', 'B', 'C'];

  const fetchData = useCallback(async () => {
    if (!date || !shift) return;
    setLoading(true);
    setError('');

    try {
      const approvalDocId = `qc_string_weight_${shift}_${date}`;

      const swQuery = query(
        collection(db, 'qc_string_weight_checks'),
        where('approvalDocId', '==', approvalDocId),
        orderBy('roundNumber', 'asc')
      );
      const biQuery = query(
        collection(db, 'qc_bag_inspection_checks'),
        where('approvalDocId', '==', approvalDocId),
        orderBy('roundNumber', 'asc')
      );
      const ciQuery = query(
        collection(db, 'qc_carton_inspection_checks'),
        where('approvalDocId', '==', approvalDocId),
        orderBy('roundNumber', 'asc')
      );

      const [swSnap, biSnap, ciSnap] = await Promise.all([
        getDocs(swQuery),
        getDocs(biQuery),
        getDocs(ciQuery)
      ]);

      let sw = swSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      let bi = biSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      let ci = ciSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch approval data
      try {
        const approvalRef = doc(db, 'shift_approvals', approvalDocId);
        const approvalSnap = await getDoc(approvalRef);
        if (approvalSnap.exists()) setApprovalData({ id: approvalSnap.id, ...approvalSnap.data() });
        else setApprovalData(null);
      } catch { setApprovalData(null); }

      // Apply team filter
      if (teamFilter !== 'all') {
        sw = sw.filter(r => r.team === teamFilter);
        bi = bi.filter(r => r.team === teamFilter);
        ci = ci.filter(r => r.team === teamFilter);
      }

      // Apply machine filter
      if (machineFilter !== 'all') {
        const mId = machineFilter;
        sw = sw.filter(r => String(r.machineId) === mId);
        bi = bi.filter(r => String(r.machineId) === mId);
        ci = ci.filter(r => String(r.machineId) === mId);
      }

      setSwRecords(sw);
      setBiRecords(bi);
      setCiRecords(ci);
    } catch (err) {
      console.error('Report fetch error:', err);
      setError('Failed to fetch report data. Ensure the required Firestore indexes exist.');
    } finally {
      setLoading(false);
    }
  }, [date, shift, teamFilter, machineFilter]);

  useEffect(() => {
    if (!loadingConfig) fetchData();
  }, [loadingConfig, fetchData]);

  const getMachineLabel = (machineId) => {
    const m = machines.find(m => String(m.id) === String(machineId));
    return `M${m?.displayNumber || machineId}`;
  };

  const getMachineGram = (machineId) => {
    const m = machines.find(m => String(m.id) === String(machineId));
    return m?.gram || '-';
  };

  const approversList = [];
  if (approvalData) {
    if (approvalData.qc_supervisor) approversList.push({ ...approvalData.qc_supervisor, roleLabel: 'QC Supervisor' });
    if (approvalData.line_leader) approversList.push({ ...approvalData.line_leader, roleLabel: 'Line Leader' });
  }

  const csvEscape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;

  const exportToCSV = () => {
    const rows = [];
    rows.push(['QC Sachet Production Report', '', '', '', '', '', '', '']);
    rows.push([`Date: ${date}`, `Shift: ${shift}`, `Team: ${teamFilter === 'all' ? 'All' : teamFilter}`, '', '', '', '', '']);
    rows.push([]);

    if (swRecords.length) {
      rows.push(['STRING WEIGHT CHECKS', '', '', '', '', '', '', '']);
      rows.push(['Time', 'Machine', 'Round', 'Weights', 'Result', 'Batch', 'Team', 'Staff']);
      swRecords.forEach(r => {
        const weights = (r.weights || []).join(' ');
        rows.push([csvEscape(formatTime(r.createdAt)), csvEscape(getMachineLabel(r.machineId)), `R${r.roundNumber}`, weights, r.meetsCriteria === 'Y' ? 'Meets' : 'No', r.batchNumber || '', r.team || '', r.checkedBy || '']);
      });
      rows.push([]);
    }

    if (biRecords.length) {
      rows.push(['BAG INSPECTION CHECKS', '', '', '', '', '', '', '', '', '', '', '']);
      rows.push(['Time', 'Machine', 'Round', 'Leakage', 'Dirt/Print', 'Completeness', 'Freebies', 'Perforation', 'Perfume', 'Overall', 'Team', 'Staff']);
      biRecords.forEach(r => {
        rows.push([csvEscape(formatTime(r.createdAt)), csvEscape(getMachineLabel(r.machineId)), `R${r.roundNumber}`, r.leakage || '', r.dirtPrintQuality || '', r.completenessSachets || '', r.freebiesPresence || '', r.perforation || '', r.perfumeOdour || '', r.overallResult || '', r.team || '', r.checkedBy || '']);
      });
      rows.push([]);
    }

    if (ciRecords.length) {
      rows.push(['CARTON INSPECTION CHECKS', '', '', '', '', '', '', '', '', '', '', '']);
      rows.push(['Time', 'Machine', 'Round', 'Detergent/Dust', 'Carton Print', 'Seal Quality', 'Carton Damage', 'Code Read', 'Overall', 'Team', 'Staff']);
      ciRecords.forEach(r => {
        rows.push([csvEscape(formatTime(r.createdAt)), csvEscape(getMachineLabel(r.machineId)), `R${r.roundNumber}`, r.detergentDust || '', r.cartonPrintQuality || '', r.sealQuality || '', r.cartonDamage || '', r.cartonCodeReadability || '', r.overallResult || '', r.team || '', r.checkedBy || '']);
      });
      rows.push([]);
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qc_sachet_${shift}_${date}.csv`;
    link.click();
  };

  if (loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading...</div></Layout>;

  return (
    <Layout title="QC Sachet Production Report" subtitle="String weights, bag and carton inspection summary" maxWidth="max-w-7xl">
      <style>{`
        .sw-too-low { color: #B71C1C; }
        .sw-low { color: #E65100; }
        .sw-target { color: #2E7D32; }
        .sw-high { color: #E65100; }
        .sw-too-high { color: #B71C1C; }
        @media print {
          @page { size: landscape; margin: 8mm; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          * { color: #000 !important; }
          .sw-too-low { color: #B71C1C !important; }
          .sw-low { color: #E65100 !important; }
          .sw-target { color: #2E7D32 !important; }
          .sw-high { color: #E65100 !important; }
          .sw-too-high { color: #B71C1C !important; }
          .text-status-success { color: #00E676 !important; }
          .text-status-danger { color: #F44336 !important; }
          .text-\\[\\#FF9800\\] { color: #FF9800 !important; }
          .bg-dark-card { background: #fff !important; border-color: #ddd !important; }
          .text-gray-400, .text-gray-500, .text-gray-600, .text-gray-300 { color: #333 !important; }
          .border-\\[\\#333\\], .border-\\[\\#222\\] { border-color: #ddd !important; }
          .bg-\\[\\#1a1a1a\\] { background: #f9f9f9 !important; }
          input, select { border-color: #ccc !important; background: #fff !important; }
          th { background: #f5f5f5 !important; }
          header { display: block !important; background: #fff !important; border-bottom: 3px solid #000 !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Filters */}
      <div className="no-print bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-2 rounded-lg text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Shift</label>
            <select value={shift} onChange={e => setShift(e.target.value)}
              className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-2 rounded-lg text-sm outline-none focus:border-primary">
              <option value="DAY">Day</option>
              <option value="NIGHT">Night</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Team</label>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
              className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-2 rounded-lg text-sm outline-none focus:border-primary">
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t} value={t}>Team {t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block mb-1">Machine</label>
            <select value={machineFilter} onChange={e => setMachineFilter(e.target.value)}
              className="bg-[#1a1a1a] text-white border border-[#444] px-3 py-2 rounded-lg text-sm outline-none focus:border-primary">
              <option value="all">All Machines</option>
              {machines.sort((a, b) => (a.displayNumber || a.id) - (b.displayNumber || b.id)).map(m => (
                <option key={m.id} value={String(m.id)}>M{m.displayNumber || m.id} ({m.gram}g)</option>
              ))}
            </select>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="bg-primary text-black font-bold px-6 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-status-danger/10 border border-status-danger text-status-danger p-4 rounded-xl mb-6 text-sm font-bold">
          {error}
        </div>
      )}

      {/* Print / Export buttons */}
      <div className="no-print flex items-center gap-3 mb-4">
        <button onClick={() => window.print()} className="bg-[#333] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#444] transition-colors">🖨️ Print</button>
        <button onClick={exportToCSV} className="bg-[#2196F3] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors">📥 Export CSV</button>
        <span className="text-xs text-gray-500">{(swRecords.length + biRecords.length + ciRecords.length)} records loaded</span>
      </div>

      {/* Shift Info Header */}
      <div className="bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Date</span>
              <span className="text-white font-bold text-lg">{date}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Shift</span>
              <span className="text-primary font-bold text-lg">{shift}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Team</span>
              <span className="text-white font-bold text-lg">{teamFilter === 'all' ? 'All' : `Team ${teamFilter}`}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Machine</span>
              <span className="text-white font-bold text-lg">{machineFilter === 'all' ? 'All' : machines.find(m => String(m.id) === machineFilter)?.displayNumber || machineFilter}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Total Checks</span>
              <span className="text-white font-bold text-lg">{swRecords.length + biRecords.length + ciRecords.length}</span>
            </div>
          </div>

          {/* Approvers */}
          <div className="flex flex-wrap items-center gap-2">
            {approversList.length > 0 ? (
              approversList.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#333] px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-status-success text-sm">✓</span>
                  <span className="text-gray-300 font-medium">{formatName(a.name)}</span>
                  <span className="text-gray-500">{a.roleLabel}</span>
                  <span className="text-gray-600">{formatTime(a.timestamp)}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-xs italic">No approvals yet</div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20 text-lg">Loading report data...</div>
      ) : (
        <>
          {/* ===== SECTION 1: STRING WEIGHTS ===== */}
          <div className="bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg mb-6">
            <SectionHeader icon="🔬" title="String Weight Checks" count={swRecords.length} />

            {swRecords.length === 0 ? (
              <div className="text-gray-600 text-sm italic py-8 text-center">No string weight records found for the selected filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase tracking-wider border-b border-[#333]">
                      <th className="text-left py-2 pr-2">Time</th>
                      <th className="text-left px-2">Machine</th>
                      <th className="text-center px-2">Round</th>
                      <th className="text-left px-2">Weights</th>
                      <th className="text-center px-2">Result</th>
                      <th className="text-center px-2">Batch</th>
                      <th className="text-center px-2">Team</th>
                      <th className="text-center px-2">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swRecords.map((r, idx) => (
                      <tr key={r.id || idx} className="border-b border-[#222] hover:bg-white/5 transition-colors">
                        <td className="py-2.5 pr-2 text-gray-500 whitespace-nowrap">{formatTime(r.createdAt)}</td>
                        <td className="pr-2 text-white font-bold whitespace-nowrap">
                          {getMachineLabel(r.machineId)}
                          <span className="text-gray-500 font-normal ml-1">({getMachineGram(r.machineId)}g)</span>
                        </td>
                        <td className="text-center px-2 text-primary font-bold">R{r.roundNumber}</td>
                        <td className="px-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(r.weights || []).map((w, i) => {
                              const status = getStringWeightStatus(getMachineGram(r.machineId), w, config);
                              const cls = status ? `sw-${status.level}` : '';
                              return (
                                <span key={i}
                                  className={`text-xs font-bold ${cls} ${cls ? '' : 'text-white'}`}>{w}g</span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="text-center px-2">
                          {r.meetsCriteria === 'Y'
                            ? <span className="text-status-success font-bold">✓ Meets</span>
                            : <span className="text-status-danger font-bold">✗ No</span>}
                        </td>
                        <td className="text-center px-2 text-gray-400">{r.batchNumber || '-'}</td>
                        <td className="text-center px-2 text-gray-400">Team {r.team}</td>
                        <td className="text-center px-2 text-gray-300">{r.checkedBy || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== SECTION 2: BAG INSPECTION ===== */}
          <div className="bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg mb-6">
            <SectionHeader icon="🛍️" title="Bag Inspection Checks" count={biRecords.length} />

            {biRecords.length === 0 ? (
              <div className="text-gray-600 text-sm italic py-8 text-center">No bag inspection records found for the selected filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase tracking-wider border-b border-[#333]">
                      <th className="text-left py-2 pr-2">Time</th>
                      <th className="text-left px-2">Machine</th>
                      <th className="text-center px-2">Round</th>
                      <th className="text-center px-2">Leakage</th>
                      <th className="text-center px-2">Dirt/Print</th>
                      <th className="text-center px-2">Completeness</th>
                      <th className="text-center px-2">Freebies</th>
                      <th className="text-center px-2">Perforation</th>
                      <th className="text-center px-2">Perfume</th>
                      <th className="text-center px-2">Overall</th>
                      <th className="text-center px-2">Team</th>
                      <th className="text-center px-2">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biRecords.map((r, idx) => {
                      const criteria = { leakage: r.leakage, dirtPrintQuality: r.dirtPrintQuality, completenessSachets: r.completenessSachets, freebiesPresence: r.freebiesPresence, perforation: r.perforation, perfumeOdour: r.perfumeOdour };
                      return (
                        <tr key={r.id || idx} className="border-b border-[#222] hover:bg-white/5 transition-colors">
                          <td className="py-2.5 pr-2 text-gray-500 whitespace-nowrap">{formatTime(r.createdAt)}</td>
                          <td className="pr-2 text-white font-bold">{getMachineLabel(r.machineId)}</td>
                          <td className="text-center px-2 text-primary font-bold">R{r.roundNumber}</td>
                          {Object.entries(criteria).map(([key, val]) => (
                            <td key={key} className="text-center px-2">
                              <span className={`font-bold text-xs ${val === 'A' ? 'text-status-success' : val === 'M' ? 'text-[#FF9800]' : val === 'U' ? 'text-status-danger' : 'text-gray-600'}`}>
                                {val || '-'}
                              </span>
                            </td>
                          ))}
                          <td className="text-center px-2"><OverallBadge result={r.overallResult} /></td>
                          <td className="text-center px-2 text-gray-400">Team {r.team}</td>
                          <td className="text-center px-2 text-gray-300">{r.checkedBy || 'Unknown'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== SECTION 3: CARTON INSPECTION ===== */}
          <div className="bg-dark-card p-4 md:p-6 rounded-xl border border-[#333] shadow-lg mb-6">
            <SectionHeader icon="📦" title="Carton Inspection Checks" count={ciRecords.length} />

            {ciRecords.length === 0 ? (
              <div className="text-gray-600 text-sm italic py-8 text-center">No carton inspection records found for the selected filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase tracking-wider border-b border-[#333]">
                      <th className="text-left py-2 pr-2">Time</th>
                      <th className="text-left px-2">Machine</th>
                      <th className="text-center px-2">Round</th>
                      <th className="text-center px-2">Detergent/Dust</th>
                      <th className="text-center px-2">Carton Print</th>
                      <th className="text-center px-2">Seal Quality</th>
                      <th className="text-center px-2">Carton Damage</th>
                      <th className="text-center px-2">Code Read</th>
                      <th className="text-center px-2">Overall</th>
                      <th className="text-center px-2">Team</th>
                      <th className="text-center px-2">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ciRecords.map((r, idx) => {
                      const criteria = { detergentDust: r.detergentDust, cartonPrintQuality: r.cartonPrintQuality, sealQuality: r.sealQuality, cartonDamage: r.cartonDamage, cartonCodeReadability: r.cartonCodeReadability };
                      return (
                        <tr key={r.id || idx} className="border-b border-[#222] hover:bg-white/5 transition-colors">
                          <td className="py-2.5 pr-2 text-gray-500 whitespace-nowrap">{formatTime(r.createdAt)}</td>
                          <td className="pr-2 text-white font-bold">{getMachineLabel(r.machineId)}</td>
                          <td className="text-center px-2 text-primary font-bold">R{r.roundNumber}</td>
                          {Object.entries(criteria).map(([key, val]) => (
                            <td key={key} className="text-center px-2">
                              <span className={`font-bold text-xs ${val === 'A' ? 'text-status-success' : val === 'U' ? 'text-status-danger' : 'text-gray-600'}`}>
                                {val || '-'}
                              </span>
                            </td>
                          ))}
                          <td className="text-center px-2"><OverallBadge result={r.overallResult} /></td>
                          <td className="text-center px-2 text-gray-400">Team {r.team}</td>
                          <td className="text-center px-2 text-gray-300">{r.checkedBy || 'Unknown'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
