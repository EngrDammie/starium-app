// src/pages/LeaveReport.jsx
//
// The HR report (task 6.3).
//
// WHAT QUESTION THIS PAGE ANSWERS: "who has leave, who has taken it, who is
// away, and where is coverage thin?" — the questions HR gets asked by
// management, in one screen rather than a cabinet of paper forms.
//
// THE BALANCES HERE ARE DERIVED, NOT STORED. Each row recomputes entitlement
// (pro-rated by joining date), days taken (summed from approved history) and
// outstanding through the same pure engine the request form uses. There is no
// second implementation of the arithmetic anywhere in the app, so this report
// can never quietly disagree with what an employee sees on My Leave.
//
// REASONS ARE NOT SHOWN. Same rule as the dashboard card: this is a coverage
// and balance view, and approving someone is different from being entitled to
// know why they were ill.

import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { subscribeToLeaveRequests } from '../services/leaveOperations';
import { subscribeToEmployees } from '../services/employeeOperations';
import { prepareLeaveRequest } from '../services/leaveOperations';
import { toLocalDate, getLeaveYear } from '../services/leaveCalculations';

const fmt = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

function Stat({ icon, label, value, sub, tone = 'text-white' }) {
  return (
    <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-5 rounded-2xl shadow-lg">
      <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{icon} {label}</div>
      <div className={`text-4xl font-black ${tone}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

export default function LeaveReport() {
  const { config, loadingConfig } = useConfig();
  const policy = config?.leavePolicy;

  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  useEffect(() => subscribeToLeaveRequests(setRequests), []);
  useEffect(() => subscribeToEmployees(setEmployees), []);

  const departments = useMemo(
    () => [...new Set(employees.map(e => e.departmentLabel || e.department).filter(Boolean))].sort(),
    [employees],
  );

  const leaveYear = useMemo(
    () => getLeaveYear(new Date(), policy) ?? new Date().getFullYear(),
    [policy],
  );

  // One row per ACTIVE employee: their derived balance in the current leave
  // year, computed by the same engine the form uses. Rejected and cancelled
  // requests contribute nothing; approved history is the ledger.
  const rows = useMemo(() => {
    if (!policy) return [];
    return employees
      .filter(e => e.employmentStatus !== 'inactive')
      .map(e => {
        const mine = requests.filter(r => r.employeeId === e.id);
        const prepared = prepareLeaveRequest(
          { leaveType: 'annual', leaveCommences: '', leaveEnds: '' },
          { policy, employee: e, existingRequests: mine },
        );
        const pending = mine.filter(r => String(r.status || '').startsWith('pending_')).length;
        const approvedThisYear = mine.filter(r =>
          r.status === 'approved' && getLeaveYear(r.leaveCommences, policy) === leaveYear);
        return {
          id: e.id,
          name: e.fullName,
          sapNumber: e.sapNumber,
          department: e.departmentLabel || e.department,
          dateJoined: e.dateJoined,
          entitled: prepared.entitlement,
          carryOver: prepared.carryOver,
          taken: prepared.alreadyTaken,
          outstanding: prepared.balance?.outstandingBefore ?? 0,
          pending,
          approvedThisYear: approvedThisYear.length,
          onLeaveToday: approvedThisYear.some(r => {
            const now = new Date();
            const s = toLocalDate(r.leaveCommences);
            const en = toLocalDate(r.leaveEnds);
            return s && en && now >= s && now <= en;
          }),
        };
      });
  }, [employees, requests, policy, leaveYear]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (deptFilter !== 'all' && r.department !== deptFilter) return false;
      if (!q) return true;
      return (r.name || '').toLowerCase().includes(q)
        || (r.sapNumber || '').toLowerCase().includes(q);
    });
  }, [rows, search, deptFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const awayNow = requests.filter(r => {
      if (r.status !== 'approved') return false;
      const s = toLocalDate(r.leaveCommences);
      const e = toLocalDate(r.leaveEnds);
      return s && e && now >= s && now <= e;
    });
    const pending = requests.filter(r => String(r.status || '').startsWith('pending_'));
    const approvedDays = requests
      .filter(r => r.status === 'approved' && getLeaveYear(r.leaveCommences, policy) === leaveYear)
      .reduce((sum, r) => sum + (r.requestedDays || 0), 0);
    return { awayNow: awayNow.length, pending: pending.length, approvedDays };
  }, [requests, policy, leaveYear]);

  // Coverage risk: departments where enough people are away on overlapping
  // dates to trigger the policy's conflict threshold. The report is where HR
  // plans cover, so this is a headline rather than a footnote.
  const coverageRisks = useMemo(() => {
    if (!policy?.conflictThreshold) return [];
    const now = new Date();
    const away = requests.filter(r => {
      if (r.status !== 'approved') return false;
      const s = toLocalDate(r.leaveCommences);
      const e = toLocalDate(r.leaveEnds);
      return s && e && now >= s && now <= e;
    });
    const byDept = {};
    for (const r of away) {
      const dept = r.departmentLabel || r.department || '—';
      byDept[dept] = (byDept[dept] || 0) + 1;
    }
    return Object.entries(byDept)
      .filter(([, n]) => n >= policy.conflictThreshold)
      .map(([dept, n]) => ({ dept, n }));
  }, [requests, policy]);

  if (loadingConfig) {
    return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading…</div></Layout>;
  }

  return (
    <Layout title="📊 Leave Report" subtitle={`Leave year ${leaveYear} · balances derived from request history`} maxWidth="max-w-7xl">
      <div className="flex flex-col gap-6 pb-16">

        {/* Headline numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon="🏝️" label="Away today" value={stats.awayNow} sub="approved leave covering today"
            tone={stats.awayNow > 0 ? 'text-status-warning' : 'text-status-success'} />
          <Stat icon="⏳" label="Awaiting approval" value={stats.pending} sub="somewhere in the chain" />
          <Stat icon="✅" label="Approved days" value={stats.approvedDays} sub={`taken in ${leaveYear}`} />
          <Stat icon="👥" label="Active employees" value={filtered.length} sub={deptFilter === 'all' ? 'on the roster' : `in ${deptFilter}`} />
        </div>

        {coverageRisks.length > 0 && (
          <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-5 py-4">
            <h3 className="text-status-warning font-bold text-sm mb-1">⚠️ Coverage risk</h3>
            {coverageRisks.map(r => (
              <p key={r.dept} className="text-gray-300 text-sm">
                <strong className="text-white">{r.dept}</strong> has {r.n} people away at the same
                time — at or above the conflict threshold of {policy.conflictThreshold}. Consider
                holding further requests from this department until someone returns.
              </p>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SAP number…"
            className="flex-1 min-w-[240px] bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary text-sm"
          />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary text-sm"
          >
            <option value="all">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* The balance table */}
        <div className="bg-dark-card border border-[#333] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#333]">
                <th className="p-3">Employee</th>
                <th className="p-3">SAP</th>
                <th className="p-3">Department</th>
                <th className="p-3 text-right">Entitled</th>
                <th className="p-3 text-right">Carried</th>
                <th className="p-3 text-right">Taken</th>
                <th className="p-3 text-right">Outstanding</th>
                <th className="p-3 text-center">Pending</th>
                <th className="p-3 text-center">Today</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-6 text-center text-gray-500">No employees match.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="border-b border-[#222] hover:bg-[#1a1a1a] transition-colors">
                  <td className="p-3 text-white font-medium">
                    {r.name || '—'}
                    {r.dateJoined && (
                      <div className="text-[10px] text-gray-500">joined {fmt(r.dateJoined)}</div>
                    )}
                  </td>
                  <td className="p-3 mono text-gray-400 text-xs">{r.sapNumber || '—'}</td>
                  <td className="p-3 text-gray-400">{r.department || '—'}</td>
                  <td className="p-3 text-right text-white">{r.entitled}</td>
                  <td className="p-3 text-right text-gray-400">{r.carryOver || 0}</td>
                  <td className="p-3 text-right text-gray-300">{r.taken}</td>
                  <td className={`p-3 text-right font-bold ${r.outstanding < 0 ? 'text-status-danger' : 'text-status-success'}`}>
                    {r.outstanding}
                  </td>
                  <td className="p-3 text-center">
                    {r.pending > 0
                      ? <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-status-warning/20 text-status-warning border border-status-warning/40">{r.pending}</span>
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="p-3 text-center">
                    {r.onLeaveToday
                      ? <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-status-success/20 text-status-success border border-status-success/40">🏝️ away</span>
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-gray-500 text-xs">
          Entitlement is pro-rated for staff who joined mid-year and takes carry-over into
          account. &ldquo;Taken&rdquo; counts approved leave in {leaveYear} only. Rejected and
          cancelled requests count towards nothing. These are the same figures each employee
          sees on their own My Leave screen — there is no second calculation anywhere.
        </p>
      </div>
    </Layout>
  );
}
