// src/pages/MyLeave.jsx
//
// The employee's own leave screen: balance, and every request they have made
// with its position in the approval chain.
//
// WHY THIS IS THE ONE HR PAGE NOT GATED TO hr_staff:
// any employee may need to request leave, so this is available to every signed-in
// user — declared `openToAll` in navigation.js. A restricted employee holds an
// EMPTY departmentRoles array, so without that flag they could see no page at
// all and would land on /no-access forever.
//
// The request form itself is modal, so this stays one page rather than adding a
// second route for staff who mostly just want to check their balance.

import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import LeaveRequestForm from '../components/leave/LeaveRequestForm';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import {
  subscribeToLeaveRequests, cancelLeaveRequest, confirmResumption, prepareLeaveRequest,
} from '../services/leaveOperations';
import { useEmployeeRecord } from '../hooks/useEmployeeRecord';

const statusStyle = {
  pending_supervisor: 'bg-status-warning/20 text-status-warning border-status-warning/40',
  pending_hod: 'bg-status-warning/20 text-status-warning border-status-warning/40',
  pending_hr: 'bg-status-warning/20 text-status-warning border-status-warning/40',
  approved: 'bg-status-success/20 text-status-success border-status-success/40',
  rejected: 'bg-status-danger/20 text-status-danger border-status-danger/40',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-600',
};

const statusLabel = {
  pending_supervisor: 'Awaiting supervisor',
  pending_hod: 'Awaiting HOD',
  pending_hr: 'Awaiting Head of HR',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function fmt(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Stepper({ request, policy }) {
  const stages = policy?.stages || [];
  if (!stages.length) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-3">
      {stages.map((stage, i) => {
        const entry = request.workflow?.[stage.id];
        const done = entry?.status === 'approved';
        const rejected = entry?.status === 'rejected';
        return (
          <div key={stage.id} className="flex items-center gap-1">
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
              done ? 'bg-status-success/20 text-status-success border-status-success/40'
                : rejected ? 'bg-status-danger/20 text-status-danger border-status-danger/40'
                : 'border-[#333] text-gray-500'}`}>
              {done ? '✓ ' : rejected ? '✕ ' : ''}{stage.label}
            </span>
            {i < stages.length - 1 && <span className="text-gray-700 text-xs">→</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function MyLeave() {
  const { currentUser, systemRole } = useAuth();
  const { config, loadingConfig } = useConfig();
  const policy = config?.leavePolicy;

  const employee = useEmployeeRecord();
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!employee?.id) return;
    return subscribeToLeaveRequests(setRequests, { employeeId: employee.id });
  }, [employee?.id]);

  // Balance derived from the request history — the same figures the form
  // shows, so the two can never disagree. With no dates passed, the engine
  // reports the CURRENT leave year with nothing yet requested, which is
  // exactly what this screen wants.
  const balance = useMemo(() => {
    if (!policy || !employee) return null;
    return prepareLeaveRequest(
      { leaveType: 'annual', leaveCommences: '', leaveEnds: '' },
      { policy, employee, existingRequests: requests },
    );
  }, [policy, employee, requests]);

  const finalStageId = policy?.stages?.[policy.stages.length - 1]?.id;

  const needsResumption = useMemo(() => {
    if (!policy?.requireResumptionConfirmation) return [];
    return requests.filter(r =>
      r.status === 'approved'
      && !r.closedAt
      && r.resumptionDate
      && new Date() >= new Date(r.resumptionDate),
    );
  }, [requests, policy]);

  const handleCancel = async (r) => {
    if (!window.confirm('Cancel this leave request?')) return;
    setBusyId(r.id);
    const res = await cancelLeaveRequest(r.id, {
      employeeId: employee.id,
      user: { email: currentUser?.email },
      policy,
      isAdmin: systemRole === 'super_admin',
    });
    setBusyId(null);
    setNotice(res.ok ? { ok: true, text: 'Request cancelled.' } : { ok: false, text: res.error });
  };

  const handleConfirmReturn = async (r) => {
    setBusyId(r.id);
    const res = await confirmResumption(r.id, {
      employeeId: employee.id,
      user: { email: currentUser?.email },
    });
    setBusyId(null);
    setNotice(res.ok ? { ok: true, text: 'Thank you — your return is confirmed and the record is closed.' } : { ok: false, text: res.error });
  };

  if (loadingConfig) {
    return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading…</div></Layout>;
  }

  if (showForm) {
    return <LeaveRequestForm />;
  }

  if (!employee) {
    return (
      <Layout title="My Leave" subtitle="Your balance and requests" maxWidth="max-w-3xl">
        <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-lg font-bold text-white mb-2">No employee record linked to this login</h2>
          <p className="text-gray-400 text-sm">
            Ask HR to add you to the roster and link this account on{' '}
            <strong className="text-white">Administration → User Roles → Employees</strong>.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="🗓️ My Leave" subtitle={`${employee.fullName} · ${employee.departmentLabel || employee.department}`} maxWidth="max-w-5xl">
      <div className="flex flex-col gap-6 pb-16">

        {notice && (
          <div className={`rounded-xl px-5 py-3 text-sm ${notice.ok ? 'bg-status-success/10 border border-status-success/50 text-status-success' : 'bg-status-danger/10 border border-status-danger/50 text-status-danger'}`}>
            {notice.text}
          </div>
        )}

        {needsResumption.length > 0 && (
          <div className="bg-primary/10 border border-primary/50 rounded-xl px-5 py-4">
            <h3 className="text-primary font-bold text-sm mb-2">👋 You are due back</h3>
            <p className="text-gray-400 text-xs mb-3">
              The paper form asks staff to confirm on resumption of duty. Confirming closes the record
              so HR has something to reconcile against.
            </p>
            {needsResumption.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap bg-dark-card border border-[#333] rounded-lg p-3 mt-2">
                <span className="text-sm text-white">{fmt(r.leaveCommences)} → {fmt(r.leaveEnds)} · {r.requestedDays} days</span>
                <button onClick={() => handleConfirmReturn(r)} disabled={busyId === r.id}
                  className="bg-primary text-black font-bold px-4 py-2 rounded-lg text-xs hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {busyId === r.id ? 'Confirming…' : '✓ Confirm my return'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Balance */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Entitled', value: balance?.entitlement ?? 0, tone: 'text-white' },
            { label: 'Already taken', value: balance?.alreadyTaken ?? 0, tone: 'text-white' },
            { label: 'Carried over', value: balance?.carryOver ?? 0, tone: 'text-white' },
            {
              label: 'Available',
              value: balance?.balance?.outstandingBefore ?? 0,
              tone: 'text-status-success',
            },
          ].map(s => (
            <div key={s.label} className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-5 rounded-2xl shadow-lg">
              <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{s.label}</div>
              <div className={`text-4xl font-black ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <button onClick={() => setShowForm(true)}
          className="self-start bg-primary text-black font-bold py-4 px-10 rounded-lg hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]">
          📝 Request Leave
        </button>

        {/* History */}
        <div>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">
            My requests ({requests.length})
          </h3>
          {requests.length === 0 ? (
            <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm">No requests yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map(r => {
                const canCancel = r.status?.startsWith('pending_') && r.workflow?.[finalStageId]?.status !== 'approved';
                return (
                  <div key={r.id} className="bg-dark-card border border-[#333] rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold">{r.leaveTypeLabel || r.leaveType}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${statusStyle[r.status] || ''}`}>
                            {statusLabel[r.status] || r.status}
                          </span>
                          {r.lodgedBy && (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-status-warning/50 text-status-warning">
                              🧑‍💼 Lodged by HR
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400 text-sm mt-1">
                          {fmt(r.leaveCommences)} → {fmt(r.leaveEnds)} · {r.requestedDays} working days
                          {r.resumptionDate ? ` · resumes ${fmt(r.resumptionDate)}` : ''}
                        </div>
                        {r.purpose && <div className="text-gray-500 text-xs mt-1">Reason: {r.purpose}</div>}
                        {r.rejectedReason && (
                          <div className="text-status-danger text-xs mt-1">Reason for rejection: {r.rejectedReason}</div>
                        )}
                      </div>
                      {canCancel && (
                        <button onClick={() => handleCancel(r)} disabled={busyId === r.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#333] text-gray-300 hover:bg-status-danger hover:text-white transition-colors disabled:opacity-50">
                          Cancel
                        </button>
                      )}
                    </div>
                    <Stepper request={r} policy={policy} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}