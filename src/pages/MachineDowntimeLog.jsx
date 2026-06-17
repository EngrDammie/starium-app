import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { queryMachineDowntime } from '../services/machineDowntimeOperations';

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDelta(ms) {
  if (ms < 1000) return '< 1s';
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatShortDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getEventIcon(type) {
  switch (type) {
    case 'STOPPED': return '🔴';
    case 'ISSUE_APPENDED': return '🟠';
    case 'ISSUE_SOLVED': return '🟢';
    case 'STARTED': return '✅';
    default: return '●';
  }
}

function getEventColor(type) {
  switch (type) {
    case 'STOPPED': return 'text-status-danger';
    case 'ISSUE_APPENDED': return 'text-status-warning';
    case 'ISSUE_SOLVED': return 'text-status-success';
    case 'STARTED': return 'text-status-success';
    default: return 'text-white';
  }
}

function getEventBg(type) {
  switch (type) {
    case 'STOPPED': return 'bg-status-danger/5';
    case 'ISSUE_APPENDED': return 'bg-status-warning/5';
    case 'ISSUE_SOLVED': return 'bg-status-success/5';
    case 'STARTED': return 'bg-status-success/5';
    default: return '';
  }
}

function extractEvents(records) {
  const events = [];
  for (const r of records) {
    const stoppedAt = r.stoppedAt?.toDate?.();
    if (!stoppedAt) continue;

    const initialIssues = [];
    const appendedIssues = [];

    for (const issue of (r.issues || [])) {
      const createdAt = issue.createdAt?.toDate ? issue.createdAt.toDate() : null;
      const isAppended = createdAt && (createdAt.getTime() - stoppedAt.getTime() > 5000);
      if (isAppended) {
        appendedIssues.push({ issue, createdAt });
      } else {
        initialIssues.push(issue);
      }
    }

    events.push({
      machineId: r.machineId,
      machineDisplayNumber: r.machineDisplayNumber,
      machineName: r.machineName,
      line: r.line,
      gram: r.gram,
      type: 'STOPPED',
      time: stoppedAt,
      by: r.stoppedBy,
      issues: initialIssues,
      recordId: r.id,
    });

    for (const { issue, createdAt } of appendedIssues) {
      events.push({
        machineId: r.machineId,
        machineDisplayNumber: r.machineDisplayNumber,
        line: r.line,
        type: 'ISSUE_APPENDED',
        time: createdAt,
        issue,
        recordId: r.id,
      });
    }

    for (const issue of (r.issues || [])) {
      const solvedAt = issue.solvedAt?.toDate ? issue.solvedAt.toDate() : (issue.solvedAt || null);
      if (solvedAt) {
        events.push({
          machineId: r.machineId,
          machineDisplayNumber: r.machineDisplayNumber,
          line: r.line,
          type: 'ISSUE_SOLVED',
          time: solvedAt,
          by: issue.solvedBy,
          issue,
          recordId: r.id,
        });
      }
    }

    const startedAt = r.startedAt?.toDate?.();
    if (startedAt) {
      events.push({
        machineId: r.machineId,
        machineDisplayNumber: r.machineDisplayNumber,
        line: r.line,
        gram: r.gram,
        type: 'STARTED',
        time: startedAt,
        by: r.startedBy,
        recordId: r.id,
      });
    }
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

function groupEventsByMachine(events) {
  const map = {};
  for (const e of events) {
    const key = e.machineDisplayNumber || e.machineId || 'unknown';
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return map;
}

function formatStoppedIssues(issues) {
  if (!issues || issues.length === 0) return 'No issues reported';
  return issues.map(i => i.label).join(', ');
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function MachineDowntimeLog() {
  const { config } = useConfig();
  const { systemRole, departmentRoles } = useAuth();
  const [date, setDate] = useState(todayStr);
  const [shift, setShift] = useState('DAY');
  const [machineNumber, setMachineNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [records, setRecords] = useState(null);
  const [generated, setGenerated] = useState(false);

  const canView = systemRole === 'super_admin' || departmentRoles.some(r => ['qc_manager', 'prod_manager', 'packaging_manager'].includes(r));

  const events = useMemo(() => {
    if (!records) return [];
    return extractEvents(records);
  }, [records]);

  const grouped = useMemo(() => {
    return groupEventsByMachine(events);
  }, [events]);

  const machinesAffected = Object.keys(grouped).length;

  const totalDowntime = useMemo(() => {
    let total = 0;
    for (const machineKey in grouped) {
      const machineEvents = grouped[machineKey];
      let stopTime = null;
      for (const e of machineEvents) {
        if (e.type === 'STOPPED') stopTime = e.time;
        else if (e.type === 'STARTED' && stopTime) {
          total += e.time - stopTime;
          stopTime = null;
        }
      }
      if (stopTime) total += Date.now() - stopTime;
    }
    return total;
  }, [grouped]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setRecords(null);
    setGenerated(false);
    try {
      const result = await queryMachineDowntime({
        date,
        shift,
        machineNumber: machineNumber.trim() || null,
        dayShiftStart: config.dayShiftStart ?? 7,
        nightShiftStart: config.nightShiftStart ?? 19,
      });
      setRecords(result);
      setGenerated(true);
    } catch (err) {
      setError(err.message || 'Failed to load downtime log');
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <Layout title="Machine Downtime Log" subtitle="View machine downtime history" maxWidth="max-w-7xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Machine Downtime Log" subtitle="Chronological log of all machine events" maxWidth="max-w-7xl">
      {/* Filters */}
      <div className="bg-dark-card border border-[#333] rounded-2xl p-4 md:p-6 mb-6 animate-[fadeIn_0.3s_ease-out]">
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#444] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="w-full md:w-40">
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Shift</label>
            <select
              value={shift}
              onChange={e => setShift(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#444] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
            >
              <option value="DAY">🌞 Day</option>
              <option value="NIGHT">🌙 Night</option>
              <option value="ALL">📅 All</option>
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-1.5">Machine Number</label>
            <input
              type="text"
              value={machineNumber}
              onChange={e => setMachineNumber(e.target.value)}
              placeholder="e.g. 6 (leave blank for all)"
              className="w-full bg-[#1a1a1a] border border-[#444] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors placeholder-gray-600"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full md:w-auto px-8 py-2.5 bg-primary text-black font-bold rounded-lg hover:bg-status-success transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed text-sm whitespace-nowrap"
          >
            {loading ? 'Loading...' : '📊 Generate'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-status-danger/10 border border-status-danger/30 rounded-xl p-4 mb-6 text-status-danger text-sm animate-[fadeIn_0.3s_ease-out]">
          {error}
        </div>
      )}

      {/* Summary */}
      {generated && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-5 rounded-2xl shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Events</h3>
            <div className="text-3xl font-black text-white">{events.length}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-5 rounded-2xl shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Machines Affected</h3>
            <div className="text-3xl font-black text-white">{machinesAffected}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-5 rounded-2xl shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Downtime</h3>
            <div className="text-3xl font-black text-white">{formatDelta(totalDowntime)}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-5 rounded-2xl shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Records</h3>
            <div className="text-3xl font-black text-white">{records?.length || 0}</div>
          </div>
        </div>
      )}

      {/* No results */}
      {generated && !loading && !error && events.length === 0 && (
        <div className="text-center py-20 text-gray-500 animate-[fadeIn_0.3s_ease-out]">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-lg font-bold">No downtime events found</p>
          <p className="text-sm text-gray-600 mt-1">Try a different date, shift, or machine number.</p>
        </div>
      )}

      {/* Timeline cards */}
      {generated && !loading && !error && events.length > 0 && (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
          {Object.entries(grouped).map(([machineKey, machineEvents]) => {
            const first = machineEvents[0];
            const last = machineEvents[machineEvents.length - 1];
            return (
              <div key={machineKey} className="bg-dark-card border border-[#333] rounded-2xl overflow-hidden shadow-lg hover:border-[#444] transition-colors">
                {/* Machine header */}
                <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-6 py-4 border-b border-[#333]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        🏭 M{machineKey} {first.machineName ? `· ${first.machineName}` : ''}
                      </h3>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {first.line ? `${first.line}  ·  ` : ''}{first.gram ? `${first.gram}g` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{machineEvents.length} event{machineEvents.length !== 1 ? 's' : ''}</span>
                      <span className="text-gray-600">|</span>
                      <span>{formatShortDate(first.time)}</span>
                    </div>
                  </div>
                </div>

                {/* Event rows */}
                <div className="divide-y divide-[#222]">
                  {machineEvents.map((e, idx) => {
                    const prev = idx > 0 ? machineEvents[idx - 1] : null;
                    const delta = prev ? e.time - prev.time : null;
                    return (
                      <div key={`${e.type}-${e.recordId}-${idx}`} className={`px-6 py-3 ${getEventBg(e.type)} hover:bg-[#1a1a1a] transition-colors`}>
                        <div className="flex items-start gap-4">
                          {/* Time column */}
                          <div className="w-20 flex-shrink-0 pt-0.5">
                            <span className="text-gray-400 text-sm font-mono tabular-nums">{formatTime(e.time)}</span>
                          </div>

                          {/* Icon */}
                          <div className="w-8 flex-shrink-0 text-center pt-0.5 text-lg">
                            {getEventIcon(e.type)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {e.type === 'STOPPED' && (
                              <div>
                                <span className={`font-bold text-sm ${getEventColor(e.type)}`}>STOPPED</span>
                                <span className="text-gray-400 text-sm ml-2">by {e.by || 'Unknown'}</span>
                                <div className="text-gray-500 text-xs mt-0.5">
                                  Issues: {formatStoppedIssues(e.issues)}
                                </div>
                              </div>
                            )}
                            {e.type === 'ISSUE_APPENDED' && (
                              <div>
                                <span className={`font-bold text-sm ${getEventColor(e.type)}`}>ISSUE ADDED</span>
                                <span className="text-gray-300 text-sm ml-2">{e.issue?.label || 'Unknown issue'}</span>
                              </div>
                            )}
                            {e.type === 'ISSUE_SOLVED' && (
                              <div>
                                <span className={`font-bold text-sm ${getEventColor(e.type)}`}>SOLVED</span>
                                <span className="text-gray-300 text-sm ml-2">{e.issue?.label || 'Unknown issue'}</span>
                                {e.by && <span className="text-gray-500 text-sm ml-2">— {e.by}</span>}
                              </div>
                            )}
                            {e.type === 'STARTED' && (
                              <div>
                                <span className={`font-bold text-sm ${getEventColor(e.type)}`}>STARTED</span>
                                <span className="text-gray-400 text-sm ml-2">by {e.by || 'Unknown'}</span>
                              </div>
                            )}
                          </div>

                          {/* Delta */}
                          <div className="w-24 flex-shrink-0 text-right pt-0.5">
                            {delta !== null && (
                              <span className="text-gray-600 text-xs font-mono tabular-nums">
                                {delta < 0 ? '' : `Δ ${formatDelta(delta)}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
