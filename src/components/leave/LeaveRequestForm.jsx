// src/components/leave/LeaveRequestForm.jsx
//
// Section 1 and Section 2 of the paper Leave Request Form, digitised.
//
// THE CORE IMPROVEMENT OVER PAPER: three boxes the paper form asks staff to
// hand-calculate — "Annual Leave Days entitled", "No. of days already taken"
// and "Outstanding No. of Days after this Vacation" — are READ-ONLY system
// values here. That is what removes the arithmetic error found in the sample
// form (21 − 8 − 4 = 9, not the 11 written on it).
//
// They update LIVE as dates are chosen. No Calculate button: a staff member
// filling this on a phone should see the consequence of a date change
// immediately, not after pressing something.
//
// All arithmetic comes from leaveCalculations.js, which is proven by unit tests.
// This file renders and collects. It performs no date maths of its own.

import { useState, useEffect, useMemo } from 'react';
import Layout from '../Layout';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useNetwork } from '../../context/NetworkContext';
import { subscribeToLeaveRequests, prepareLeaveRequest, createLeaveRequest } from '../../services/leaveOperations';
import { validateLeaveRequest } from '../../services/leaveCalculations';
import { useEmployeeRecord } from '../../hooks/useEmployeeRecord';

const inputCls = 'w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary';
const labelCls = 'text-xs text-gray-400 uppercase font-bold block mb-1';
const readOnlyCls = 'w-full bg-[#121212] text-gray-400 border border-[#2a2a2a] p-3 rounded-lg cursor-not-allowed';

function StatBox({ label, value, sub, tone = '' }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</div>
      <div className={`text-2xl font-black ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function LeaveRequestForm({ lodgedFor = null }) {
  const { currentUser, userFullName } = useAuth();
  const { config, loadingConfig } = useConfig();
  const { isOnline } = useNetwork();

  const policy = config?.leavePolicy;
  // The employee this request is filed against. Lodged-on-behalf wins over the
  // signed-in user, because HR must never accidentally file a request against
  // themselves while entering someone else's details.
  const employee = useEmployeeRecord(lodgedFor);
  const [existingRequests, setExistingRequests] = useState([]);

  const [leaveType, setLeaveType] = useState('annual');
  const [leaveCommences, setLeaveCommences] = useState('');
  const [leaveEnds, setLeaveEnds] = useState('');
  const [purpose, setPurpose] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverTo, setHandoverTo] = useState('');
  const [confirmedName, setConfirmedName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Existing requests, needed to derive "days already taken" and to spot
  // overlaps. This is what makes the balance derived rather than a counter.
  useEffect(() => {
    if (!employee?.id) return;
    return subscribeToLeaveRequests(setExistingRequests, { employeeId: employee.id });
  }, [employee?.id]);

  // Live figures. Recomputed on every change — the whole point of the form.
  const prepared = useMemo(() => {
    if (!policy || !employee) return null;
    return prepareLeaveRequest(
      { leaveType, leaveCommences, leaveEnds, purpose, handoverNote },
      { policy, employee, existingRequests },
    );
  }, [policy, employee, existingRequests, leaveType, leaveCommences, leaveEnds, purpose, handoverNote]);

  const errors = useMemo(() => {
    if (!policy || !employee || !prepared) return [];
    return validateLeaveRequest(
      { leaveType, leaveCommences, leaveEnds, purpose, handoverNote, requestedDays: prepared.requestedDays },
      policy,
      { balance: prepared.balance, existingRequests, employeeId: employee.id, department: employee.department },
    );
  }, [policy, employee, prepared, existingRequests, leaveType, leaveCommences, leaveEnds, purpose, handoverNote]);

  const canSubmit = errors.length === 0 && agreed && confirmedName.trim().length > 1 && !!prepared?.requestedDays;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const res = await createLeaveRequest(
      {
        leaveType, leaveCommences, leaveEnds, purpose,
        handoverNote, handoverTo,
        contactAddress: employee.address,
        contactPhone: employee.phone,
        contactEmail: employee.email,
        applicantConfirmed: agreed,
        applicantConfirmedName: confirmedName,
        lodgedOnBehalf: !!lodgedFor,
      },
      {
        policy, employee, existingRequests,
        user: { email: currentUser?.email },
        isOnline,
      },
    );
    setSubmitting(false);
    setResult(res);
  };

  if (loadingConfig) {
    return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading leave settings…</div></Layout>;
  }

  // No employee record is a NORMAL state and must never look like "no leave".
  if (!employee) {
    return (
      <Layout title="Request Leave" subtitle="Section 1 & 2 of the Leave Request Form" maxWidth="max-w-4xl">
        <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-lg font-bold text-white mb-2">No employee record linked to this login</h2>
          <p className="text-gray-400 text-sm mb-6">
            Leave requests are filed against an employee record, and yours is not linked to this
            account yet. HR can link it on{' '}
            <strong className="text-white">Administration → User Roles → Employees</strong>, or add
            you to the roster first.
          </p>
          <p className="text-gray-500 text-xs">
            Showing a balance of zero here would read as &ldquo;you have no leave&rdquo;, which is
            not the same problem at all.
          </p>
        </div>
      </Layout>
    );
  }

  if (result?.ok) {
    return (
      <Layout title="Request Leave" subtitle="Submitted" maxWidth="max-w-3xl">
        <div className="bg-dark-card border border-[#333] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">{result.offline ? '⏳' : '✅'}</div>
          <h2 className="text-lg font-bold text-white mb-2">
            {result.offline ? 'Saved — waiting to send' : 'Leave request submitted'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {result.offline
              ? 'You appear to be offline, so this is saved on your device and will send automatically when the connection returns.'
              : `Waiting for ${policy?.stages?.[0]?.label || 'your supervisor'} to approve.`}
          </p>
          <button onClick={() => { setResult(null); setLeaveCommences(''); setLeaveEnds(''); setAgreed(false); setConfirmedName(''); setPurpose(''); setHandoverNote(''); setShowErrors(false); }}
            className="bg-primary text-black font-bold py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors">
            📝 Request more leave
          </button>
        </div>
      </Layout>
    );
  }

  const handoverRequired = policy?.requireHandoverNote
    && (prepared?.requestedDays || 0) >= (policy?.handoverNoteRequiredDays || 999);

  return (
    <Layout title="Request Leave" subtitle="Section 1 & 2 of the Leave Request Form" maxWidth="max-w-5xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-16">

        {lodgedFor && (
          <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-5 py-3 text-sm text-status-warning">
            🧑‍💼 <strong>Lodging on behalf of {employee.fullName}</strong> ({employee.sapNumber}).
            The request will carry a &ldquo;Lodged by HR&rdquo; badge so approvers know it was not
            filled in by the employee.
          </div>
        )}

        {/* ── Section 1 ── */}
        <div className="bg-dark-card border border-[#333] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#333]">
            <span className="text-primary font-bold text-sm uppercase tracking-wider">Section 1</span>
            <span className="text-gray-500 text-sm">Completed by staff — details fill in automatically</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className={labelCls}>Name</label><input value={employee.fullName || ''} readOnly className={readOnlyCls} /></div>
            <div><label className={labelCls}>Cadre / Designation</label><input value={employee.cadreDesignation || '—'} readOnly className={readOnlyCls} /></div>
            <div><label className={labelCls}>SAP No.</label><input value={employee.sapNumber || '—'} readOnly className={readOnlyCls} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div><label className={labelCls}>Department</label><input value={employee.departmentLabel || employee.department || '—'} readOnly className={readOnlyCls} /></div>
            <div><label className={labelCls}>Shift</label><input value={employee.shift || 'DAY'} readOnly className={readOnlyCls} /></div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>Type of leave *</label>
            <div className="flex flex-wrap gap-2">
              {(policy?.leaveTypes || []).map(t => (
                <button key={t.id} type="button" onClick={() => setLeaveType(t.id)}
                  className={`px-4 py-2.5 rounded-lg font-bold text-sm border transition-colors ${leaveType === t.id ? 'bg-primary text-black border-primary' : 'border-[#444] text-gray-400 hover:border-[#666]'}`}>
                    {leaveType === t.id ? '✓ ' : ''}{t.label}
                  </button>
              ))}
            </div>
          </div>

          {/* Conditional field, exactly like the paper form's "If Casual Leave,
              please specify purpose". */}
          {prepared?.leaveType?.requiresPurpose && (
            <div className="mt-4">
              <label className={labelCls}>Reason for {prepared.leaveType.label} *</label>
              <textarea value={purpose} onChange={e => setPurpose(e.target.value)} rows={2}
                placeholder="e.g. Family emergency"
                className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className={labelCls}>Leave commences *</label>
              <input type="date" required value={leaveCommences} onChange={e => setLeaveCommences(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Leave ends *</label>
              <input type="date" required value={leaveEnds} onChange={e => setLeaveEnds(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Resumption date</label>
              <input
                readOnly
                value={prepared?.resumptionDate
                  ? `${prepared.resumptionDate.getFullYear()}-${String(prepared.resumptionDate.getMonth() + 1).padStart(2, '0')}-${String(prepared.resumptionDate.getDate()).padStart(2, '0')}`
                  : ''}
                className={readOnlyCls}
                title="Calculated automatically as the next working day"
              />
            </div>
          </div>

          {/* The four hand-calculated boxes, now read-only. */}
          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
              Leave year {prepared?.leaveYear ?? '—'} — worked out for you
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatBox label="Entitled" value={prepared?.entitlement ?? 0} sub="days this year" />
              <StatBox label="Already taken" value={prepared?.alreadyTaken ?? 0} sub="approved leave" />
              <StatBox label="This request" value={prepared?.requestedDays ?? 0} sub="working days"
                tone={prepared?.requestedDays ? 'text-primary' : ''} />
              <StatBox
                label="Outstanding after"
                value={prepared?.balance?.outstandingAfter ?? 0}
                sub={prepared?.balance?.exceedsBalance ? 'exceeds balance' : 'days remaining'}
                tone={prepared?.balance?.exceedsBalance ? 'text-status-danger' : 'text-status-success'}
              />
            </div>
          </div>

          {/* Replaces the paper form's hand-written "Public Holidays included
              (give dates)" box. */}
          {prepared?.excludedDays?.length > 0 && (
            <div className="mt-4 bg-[#1a1a1a] border border-[#333] rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                Public holidays and non-working days in this range — not deducted
              </div>
              <div className="flex flex-wrap gap-2">
                {prepared.excludedDays.map(day => (
                  <span key={day.date} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121212] border border-[#444] text-xs">
                    <span className="mono text-cyan-300">{day.date}</span>
                    <span className="text-gray-300">{day.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Overlap vs conflict, the two distinct findings. */}
          {prepared?.overlap?.overlapCount > 0 && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm border ${prepared.overlap.isConflict ? 'bg-status-warning/10 border-status-warning/50 text-status-warning' : 'bg-[#1a1a1a] border-[#333] text-gray-400'}`}>
              {prepared.overlap.isConflict
                ? `⚠️ ${prepared.overlap.sameDepartment.length} people in ${employee.departmentLabel || 'your department'} are already away then. You will need to arrange cover.`
                : `ℹ️ ${prepared.overlap.overlapCount} colleague${prepared.overlap.overlapCount > 1 ? 's are' : ' is'} also away during these dates. Not a problem, just so you know.`}
            </div>
          )}

          {/* Contact while away — prefilled, editable. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#333]">
            <div><label className={labelCls}>Contact phone</label><input defaultValue={employee.phone || ''} readOnly className={readOnlyCls} /></div>
            <div><label className={labelCls}>Contact e-mail</label><input defaultValue={employee.email || ''} readOnly className={readOnlyCls} /></div>
            <div><label className={labelCls}>Leave year</label><input value={prepared?.leaveYear ?? ''} readOnly className={readOnlyCls} /></div>
          </div>
        </div>

        {/* ── Section 2 ── */}
        <div className="bg-dark-card border border-[#333] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#333]">
            <span className="text-primary font-bold text-sm uppercase tracking-wider">Section 2</span>
            <span className="text-gray-500 text-sm">Declaration &amp; handover</span>
          </div>

          <p className="text-gray-400 text-sm mb-4">
            &ldquo;I will do / I have already done my handover note to&nbsp;___, and I accept to cover
            for the staff proceeding on leave.&rdquo;
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Handing over to {handoverRequired ? '*' : ''}</label>
              <input value={handoverTo} onChange={e => setHandoverTo(e.target.value)}
                placeholder="Colleague's name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Declaration — type your full name *</label>
              <input value={confirmedName} onChange={e => setConfirmedName(e.target.value)}
                placeholder={userFullName || 'Your full name'} className={inputCls} />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>Handover note {handoverRequired ? '*' : ''}</label>
            <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)} rows={3}
              placeholder="What is being handed over, and anything the next person must watch."
              className={inputCls} />
            {handoverRequired && (
              <p className="text-xs text-status-warning mt-1">
                Required for leave of {policy.handoverNoteRequiredDays} working days or more. In a
                factory an unclear handover is how a machine sits unreported for days.
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 mt-4 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="w-5 h-5 accent-primary mt-0.5" />
            <span className="text-sm text-gray-300">
              I confirm these details are correct and I have handed over my work.
            </span>
          </label>
        </div>

        {/* All failures at once, not just the first. */}
        {showErrors && errors.length > 0 && (
          <div className="bg-status-danger/10 border border-status-danger rounded-xl px-5 py-4">
            <h3 className="text-status-danger font-bold text-sm mb-2">Fix these before submitting</h3>
            <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        {!isOnline && (
          <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-5 py-3 text-sm text-status-warning">
            ⏳ You are offline. You can still submit — this will be saved on your device and sent
            automatically when the connection returns.
          </div>
        )}

        <button type="submit" disabled={submitting || !canSubmit}
          className="self-start bg-primary text-black font-bold py-4 px-10 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 shadow-[0_0_15px_rgba(0,188,212,0.3)]">
          {submitting ? 'Submitting…' : '📤 Submit Leave Request'}
        </button>

        <p className="text-gray-500 text-xs -mt-2">
          Your request goes to {policy?.stages?.[0]?.label || 'your supervisor'} first, then{' '}
          {policy?.stages?.slice(1).map(s => s.label).join(', then ') || 'the remaining approvers'}.
          You will not be granted leave until the last signature is in.
        </p>
      </form>
    </Layout>
  );
}