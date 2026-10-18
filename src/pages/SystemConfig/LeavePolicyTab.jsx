// src/pages/SystemConfig/LeavePolicyTab.jsx
//
// Presentational tab: edits the `leavePolicy` block from ConfigContext.
//
// WHY THIS TAB IS THE POINT OF THE WHOLE PHASE:
// every value on this screen is an ASSUMPTION. HR has not confirmed the leave
// policy yet, so the app ships with defensible defaults taken from the paper
// Leave Request Form, the Nigerian Labour Act, and standard practice.
//
// This screen is the promise that those assumptions are cheap to correct. A
// change here is a number typed into a field, not a code change by a
// developer. That is the difference between building this now with defaults
// and waiting for HR before starting.
//
// Purely presentational, like the other tabs: all state and Firestore writes
// live in SystemConfig.jsx.
import { useState } from 'react';

const inputCls = 'w-full bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary';

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs text-gray-400 uppercase font-bold block mb-1">{label}</label>
      {children}
      {hint && <p className="text-gray-500 text-xs mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, tone = 'primary' }) {
  const on = checked;
  const activeCls = tone === 'amber'
    ? 'bg-status-warning/20 border-status-warning text-status-warning'
    : 'bg-primary/20 border-primary text-primary';
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${on ? activeCls : 'border-[#333] text-gray-400 hover:border-[#555]'}`}
    >
      <span className="font-bold text-sm">{on ? '✓ ' : '○ '}{label}</span>
      {hint && <span className="block text-xs mt-0.5 opacity-70">{hint}</span>}
    </button>
  );
}

const DAY_NAMES = [
  { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function LeavePolicyTab({
  leavePolicy, setLeavePolicy, saveLeavePolicy, users,
}) {
  const [newHoliday, setNewHoliday] = useState({ date: '', label: '' });

  const p = leavePolicy;
  const set = (patch) => setLeavePolicy({ ...p, ...patch });

  const holidays = p.publicHolidays || [];
  const nonWorking = p.nonWorkingDays || [];

  const toggleDay = (day) => {
    set({ nonWorkingDays: nonWorking.includes(day) ? nonWorking.filter(d => d !== day) : [...nonWorking, day] });
  };

  const addHoliday = () => {
    if (!newHoliday.date) return;
    const label = newHoliday.label.trim() || 'Public holiday';
    set({ publicHolidays: [...holidays, { date: newHoliday.date, label }].sort((a, b) => a.date.localeCompare(b.date)) });
    setNewHoliday({ date: '', label: '' });
  };

  const removeHoliday = (date) => set({ publicHolidays: holidays.filter(h => h.date !== date) });

  const toggleType = (typeId, patch) => {
    set({
      leaveTypes: p.leaveTypes.map(t => (t.id === typeId ? { ...t, ...patch } : t)),
    });
  };

  const setStageDeputy = (stageId, userUid, userName) => {
    set({
      stages: p.stages.map(s => (s.id === stageId
        ? { ...s, deputyUserUid: userUid || null, deputyName: userUid ? userName : null }
        : s)),
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-16 animate-[fadeIn_0.3s]">

      {/* The framing matters: HR must understand these are proposals. */}
      <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-5 py-4">
        <h3 className="text-status-warning font-bold text-sm mb-1">⚠️ These are working assumptions, not confirmed policy</h3>
        <p className="text-gray-400 text-xs leading-relaxed">
          Leave Management is being built before HR has confirmed the rules. Everything below was chosen from the
          paper Leave Request Form, the Nigerian Labour Act, and standard practice. <strong>Change anything here and
          it takes effect immediately</strong> — no developer needed. The full list with reasoning is in the
          Leave Management blueprint document, section 04.
        </p>
      </div>

      {/* Leave types */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">📋 Leave Types</h2>
        <p className="text-sm text-gray-400 mb-5">
          The five types on the paper form. <strong>Balance tracked</strong> means the type draws from a day
          allowance; <strong>Purpose required</strong> shows a reason box on the request form.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className="p-2 border-b border-[#333] text-gray-400 text-xs uppercase tracking-wider">Type</th>
                <th className="p-2 border-b border-[#333] text-gray-400 text-xs uppercase tracking-wider">Balance tracked</th>
                <th className="p-2 border-b border-[#333] text-gray-400 text-xs uppercase tracking-wider">Purpose required</th>
              </tr>
            </thead>
            <tbody>
              {p.leaveTypes.map(t => (
                <tr key={t.id}>
                  <td className="p-2 text-white font-bold">{t.label}</td>
                  <td className="p-2">
                    <input type="checkbox" checked={t.balanceTracked}
                      onChange={e => toggleType(t.id, { balanceTracked: e.target.checked })} className="w-4 h-4 accent-primary" />
                  </td>
                  <td className="p-2">
                    <input type="checkbox" checked={t.requiresPurpose}
                      onChange={e => toggleType(t.id, { requiresPurpose: e.target.checked })} className="w-4 h-4 accent-primary" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entitlements */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">📊 Entitlements</h2>
        <p className="text-sm text-gray-400 mb-5">
          The Nigerian Labour Act requires <strong>at least 6 working days</strong> annual leave after 12 months
          of service. The figure below is what the company actually grants.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Annual leave (working days)" hint="Currently 21, per the paper form.">
            <input type="number" min="0" value={p.annualEntitlementDays}
              onChange={e => set({ annualEntitlementDays: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Casual leave (working days)" hint="0 means unlimited and approved on merit.">
            <input type="number" min="0" value={p.casualEntitlementDays}
              onChange={e => set({ casualEntitlementDays: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Maternity (weeks)" hint="Labour Act minimum is 12 weeks.">
            <input type="number" min="0" value={p.maternityDurationWeeks}
              onChange={e => set({ maternityDurationWeeks: Number(e.target.value) })} className={inputCls} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle
            label="Pro-rate allowance for new joiners"
            hint="Someone who joined halfway through the year gets a share, not zero and not a full year."
            checked={p.proRateNewJoiners}
            onChange={v => set({ proRateNewJoiners: v })}
          />
        </div>
      </div>

      {/* Carry-over + notice */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-5">🔄 Carry-over &amp; Notice</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Leave year starts" hint="1 = January–December.">
            <select value={p.leaveYearStartMonth} onChange={e => set({ leaveYearStartMonth: Number(e.target.value) })} className={inputCls}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="Notice required (working days)" hint="The form says 'notice of one week'.">
            <input type="number" min="0" value={p.noticeRequiredDays}
              onChange={e => set({ noticeRequiredDays: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Max carry-over (days)" hint="Unused leave above this lapses at year end.">
            <input type="number" min="0" value={p.maxCarryOverDays} disabled={!p.allowCarryOver}
              onChange={e => set({ maxCarryOverDays: Number(e.target.value) })} className={`${inputCls} disabled:opacity-40`} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <Toggle label="Allow carry-over" checked={p.allowCarryOver} onChange={v => set({ allowCarryOver: v })} />
          <Toggle
            label="Warn about expiring leave" tone="amber"
            hint="Tell HR before days lapse silently."
            checked={p.warnOnHighBalance} onChange={v => set({ warnOnHighBalance: v })}
          />
          <Toggle
            label="Require a reason when rejecting"
            hint="The employee deserves to know why."
            checked={p.requireRejectionReason} onChange={v => set({ requireRejectionReason: v })}
          />
        </div>
      </div>

      {/* The most important setting on the page */}
      <div className="bg-dark-card p-6 rounded-xl border-2 border-primary shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">📆 Non-Working Days</h2>
        <p className="text-sm text-gray-400 mb-4">
          <strong className="text-white">The single most important setting on this screen.</strong> Every day
          count in the whole system is calculated from this. If the factory runs Saturdays, tick Saturday —
          otherwise every balance on every screen is wrong.
        </p>
        <div className="flex gap-2 flex-wrap">
          {DAY_NAMES.map(d => {
            const off = nonWorking.includes(d.day);
            return (
              <button key={d.day} type="button" onClick={() => toggleDay(d.day)}
                className={`px-4 py-2.5 rounded-lg font-bold text-sm border transition-colors ${off ? 'bg-primary text-black border-primary' : 'border-[#444] text-gray-400 hover:border-[#666]'}`}>
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="text-gray-500 text-xs mt-3">
          Highlighted days are excluded from every leave calculation. Currently:
          <strong className="text-white"> {nonWorking.length === 0 ? 'none — the factory runs every day' : nonWorking.map(d => DAY_NAMES.find(n => n.day === d)?.label).join(', ')}</strong>
        </p>
      </div>

      {/* Public holidays */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">🇳🇬 Public Holidays</h2>
        <p className="text-sm text-gray-400 mb-5">
          Seeded with the dates the Federal Government declared for 2026. These move every year — update this
          list each January.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="date" value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} className={inputCls} />
          <input type="text" placeholder="Holiday name" value={newHoliday.label}
            onChange={e => setNewHoliday({ ...newHoliday, label: e.target.value })} className={inputCls} />
          <button onClick={addHoliday} disabled={!newHoliday.date}
            className="bg-primary text-black font-bold px-5 py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 whitespace-nowrap">
            ➕ Add
          </button>
        </div>
        {holidays.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No public holidays set. Every weekday will count.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holidays.map(h => (
              <span key={h.date} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#444] text-sm">
                <span className="mono text-cyan-300 text-xs">{h.date}</span>
                <span className="text-gray-300">{h.label}</span>
                <button onClick={() => removeHoliday(h.date)} className="text-gray-500 hover:text-status-danger text-base leading-none">&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Approval chain */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">✅ Approval Chain</h2>
        <p className="text-sm text-gray-400 mb-5">
          The three signatures on the paper form, <strong>strictly in order</strong>. Each stage unlocks the next.
          A deputy stops the chain deadlocking when the usual approver is on leave.
        </p>
        <div className="flex flex-col gap-3">
          {p.stages.map((s, i) => (
            <div key={s.id} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-lg bg-primary text-black font-black text-sm flex items-center justify-center">{i + 1}</span>
                <span className="text-white font-bold">{s.label}</span>
                <span className="text-gray-500 text-xs ml-auto mono">{s.actionRole}</span>
              </div>
              <select
                value={s.deputyUserUid || ''}
                onChange={e => {
                  const u = (users || []).find(x => x.id === e.target.value);
                  setStageDeputy(s.id, e.target.value, u ? (u.email || u.id) : null);
                }}
                className={inputCls}
              >
                <option value="">No deputy — approvals will stall if this person is on leave</option>
                {(users || []).map(u => (
                  <option key={u.id} value={u.id}>{u.email || u.firstName || u.id}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-5">⚖️ Request Rules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Toggle label="Allow negative balances" hint="Off: a request can never exceed the allowance."
            checked={p.allowNegativeBalance} onChange={v => set({ allowNegativeBalance: v })} tone="amber" />
          <Toggle label="Approvers may override the balance" hint="Lets HR approve an exception deliberately."
            checked={p.allowApproverOverride} onChange={v => set({ allowApproverOverride: v })} />
          <Toggle label="Require a handover note" checked={p.requireHandoverNote} onChange={v => set({ requireHandoverNote: v })} />
          <Toggle label="Confirm return on resumption" hint="Closes the record when staff come back."
            checked={p.requireResumptionConfirmation} onChange={v => set({ requireResumptionConfirmation: v })} />
          <Toggle label="Auto-approve short leave" tone="amber"
            hint="Off deliberately: in a factory an absent operator can stop a line."
            checked={p.autoApproveShortLeave} onChange={v => set({ autoApproveShortLeave: v })} />
        </div>
        {p.requireHandoverNote && (
          <div className="mt-4 max-w-xs">
            <Field label="Handover note required for leave of (days or more)">
              <input type="number" min="1" value={p.handoverNoteRequiredDays}
                onChange={e => set({ handoverNoteRequiredDays: Number(e.target.value) })} className={inputCls} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label="Overlapping leave" hint="'warn' allows it and flags it. 'block' refuses it.">
            <select value={p.overlapBehaviour} onChange={e => set({ overlapBehaviour: e.target.value })} className={inputCls}>
              <option value="warn">Warn but allow</option>
              <option value="block">Block the request</option>
            </select>
          </Field>
          <Field label="Conflict threshold (people per department)" hint="Warn when this many overlap.">
            <input type="number" min="2" value={p.conflictThreshold}
              onChange={e => set({ conflictThreshold: Number(e.target.value) })} className={inputCls} />
          </Field>
        </div>
      </div>

      <button onClick={saveLeavePolicy}
        className="self-start bg-primary text-black font-bold py-4 px-10 rounded-lg hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]">
        💾 Save Leave Policy
      </button>
    </div>
  );
}