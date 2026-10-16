// src/components/userAccess/EmployeeAccessTab.jsx
//
// Access management BY PERSON rather than by email address.
//
// WHY THIS TAB EXISTS (task 1.6):
// User Roles listed accounts — an email plus some permissions. HR thinks in
// people and staff numbers, so every elevation meant working out which of a
// list of addresses was Robert Eneh in Maintenance. This tab lists employees
// with their SAP number and department, and grants access from there.
//
// Two states, deliberately separated:
//   - Employees WITHOUT a login, who need an account created
//   - Employees WITH a login, whose access can be changed
// Combining them makes it impossible to miss anyone still locked out.
//
// PRIVILEGE: super_admin is never granted from this tab. `mayGrantSuperAdmin`
// lives in UserManagement.jsx; this component simply never offers it.

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { subscribeToAccessView, updateUserAccess } from '../../services/userAccessOperations';
import { createLoginForEmployee } from '../../services/employeeOperations';

const inputCls = 'w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary';
const labelCls = 'text-xs text-gray-400 uppercase font-bold block mb-1';

function AccessBadge({ person }) {
  if (person.loginBroken) {
    return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-status-danger/50 bg-status-danger/15 text-status-danger">Broken link</span>;
  }
  if (!person.hasLogin) {
    return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-gray-600 bg-gray-500/15 text-gray-400">No login</span>;
  }
  const s = person.accessSummary;
  const cls = s.isSuper
    ? 'border-status-success/40 bg-status-success/15 text-status-success'
    : s.isLeaveOnly
      ? 'border-[#66b3ff]/40 bg-[#2196F3]/15 text-[#66b3ff]'
      : 'border-primary/40 bg-primary/15 text-primary';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${cls}`}>
      {s.isSuper ? 'Super Admin' : s.isLeaveOnly ? 'Leave only' : s.label}
    </span>
  );
}

export default function EmployeeAccessTab() {
  const { currentUser } = useAuth();
  const { config, loadingConfig } = useConfig();

  const [view, setView] = useState({ people: [], unlinked: [], ready: false });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('no-login');
  const [target, setTarget] = useState(null);      // employee being granted/changed
  const [password, setPassword] = useState('');
  const [deptRoles, setDeptRoles] = useState([]);
  const [actionRoles, setActionRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => subscribeToAccessView(setView), []);

  const groupedDeptRoles = useMemo(() => {
    const list = (config?.departmentRoles || []).reduce((acc, role) => {
      if (!acc[role.category]) acc[role.category] = [];
      acc[role.category].push(role);
      return acc;
    }, {});
    return Object.entries(list);
  }, [config]);

  const toggle = (id, current, setFn) => {
    if (current.includes(id)) setFn(current.filter(x => x !== id));
    else setFn([...current, id]);
  };

  const openGrant = (person) => {
    setTarget(person);
    setPassword('');
    setFormError('');
    // Pre-fill from the existing account so "change access" starts from
    // today's truth rather than blank.
    setDeptRoles(person.role?.departmentRoles || []);
    setActionRoles(person.role?.actionRoles || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setFormError('');
    const by = currentUser?.email || null;

    // Existing login: just change the roles.
    if (target.hasLogin) {
      const result = await updateUserAccess(
        target.linkedUserUid,
        { departmentRoles: deptRoles, actionRoles: actionRoles },
        by,
      );
      setBusy(false);
      if (!result.ok) { setFormError(result.error); return; }
      setTarget(null);
      return;
    }

    // No login yet: create one WITH the chosen roles in a single action.
    if (deptRoles.length === 0 && actionRoles.length === 0) {
      setBusy(false);
      setFormError('Choose at least one department role, or leave the account with no access.');
      return;
    }
    const result = await createLoginForEmployee(target, {
      password,
      departmentRoles: deptRoles,
      actionRoles: actionRoles,
      createdBy: by,
    });
    setBusy(false);
    if (!result.ok) { setFormError(result.error); return; }
    setTarget(null);
  };

  const term = search.trim().toLowerCase();
  const filtered = view.people.filter(p => {
    if (filter === 'no-login' && p.hasLogin) return false;
    if (filter === 'has-login' && !p.hasLogin) return false;
    if (filter === 'leave-only' && !p.accessSummary?.isLeaveOnly) return false;
    if (!term) return true;
    return [p.fullName, p.sapNumber, p.departmentLabel, p.cadreDesignation]
      .filter(Boolean).some(f => String(f).toLowerCase().includes(term));
  });

  const noLoginCount = view.people.filter(p => !p.hasLogin).length;
  const leaveOnlyCount = view.people.filter(p => p.accessSummary?.isLeaveOnly).length;

  if (loadingConfig) {
    return <div className="text-center text-white py-10">Loading roles…</div>;
  }

  return (
    <div>
      {/* Accounts with no employee record — surfaced, not hidden. */}
      {view.unlinked.length > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/50 rounded-xl px-4 py-3 mb-4 text-sm">
          ⚠️ <strong>{view.unlinked.length}</strong> account{view.unlinked.length > 1 ? 's have' : ' has'} no employee
          record: <span className="mono text-xs">{view.unlinked.map(u => u.email).join(', ')}</span>.
          <div className="text-gray-400 text-xs mt-1">
            They can use the factory but have no HR record, so no leave. Link them from the roster, or create the employee record first.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search name, SAP number, department…"
          className="md:col-span-2 bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary"
        />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
          <option value="no-login">Needs a login ({noLoginCount})</option>
          <option value="leave-only">Leave only ({leaveOnlyCount})</option>
          <option value="has-login">Has access ({view.people.filter(p => p.hasLogin).length})</option>
          <option value="all">Everyone ({view.people.length})</option>
        </select>
      </div>

      {/* List */}
      <div className="overflow-x-auto">
        {!view.ready ? (
          <p className="text-gray-500 text-center py-8">Loading employees…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">🔑</div>
            <p className="font-bold text-white">Nobody matches that filter</p>
            <button onClick={() => { setSearch(''); setFilter('all'); }}
              className="mt-3 text-sm text-primary underline">Show everyone</button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">SAP No.</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Name</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Department</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Current access</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 mono text-cyan-300 text-xs">{p.sapNumber || '—'}</td>
                  <td className="p-3">
                    <div className="text-white font-bold">{p.fullName || '—'}</div>
                    <div className="text-gray-500 text-xs">{p.cadreDesignation}</div>
                    {p.isSampleData && (
                      <span className="text-status-warning text-[10px] uppercase font-bold">🧪 Sample</span>
                    )}
                  </td>
                  <td className="p-3 text-gray-400">{p.departmentLabel || p.department || '—'}</td>
                  <td className="p-3"><AccessBadge person={p} /></td>
                  <td className="p-3 text-right">
                    {p.loginBroken ? (
                      <span className="text-status-danger text-xs">Fix on roster</span>
                    ) : p.accessSummary?.isSuper ? (
                      <span className="text-gray-500 text-xs">Owner</span>
                    ) : (
                      <button onClick={() => openGrant(p)}
                        className="bg-primary text-black px-3 py-1.5 rounded font-bold text-xs hover:bg-primary-dark transition-colors">
                        {p.hasLogin ? '⚙️ Change access' : '🔑 Grant access'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Grant / change access */}
      {target && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 animate-[fadeIn_0.2s_ease]"
          onClick={() => !busy && setTarget(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[95%] max-w-2xl shadow-[0_0_30px_rgba(0,188,212,0.3)] overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-lg font-bold mb-1 text-center uppercase tracking-wider">
              {target.hasLogin ? '⚙️ Change Access' : '🔑 Grant Access'}
            </h2>
            <p className="text-center text-gray-500 mb-5 text-sm">
              {target.fullName} <span className="mono text-gray-600">{target.sapNumber}</span>
              {' · '}{target.departmentLabel}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {!target.hasLogin && (
                <div>
                  <label className={labelCls}>Temporary password *</label>
                  <input type="text" required minLength={6} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={inputCls} />
                  <p className="text-gray-500 text-xs mt-1">
                    Write it down and hand it over directly. They can change it after signing in.
                  </p>
                </div>
              )}

              <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-lg">
                <h3 className="text-primary font-bold text-xs uppercase tracking-wider mb-3">🏢 Department Access</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {groupedDeptRoles.map(([category, roles]) => (
                    <div key={category}>
                      <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">{category}</h4>
                      <div className="flex flex-col gap-2">
                        {roles.map(r => (
                          <label key={r.id} className="flex items-center gap-2 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 accent-primary"
                              checked={deptRoles.includes(r.id)}
                              onChange={() => toggle(r.id, deptRoles, setDeptRoles)} />
                            <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{r.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {deptRoles.length === 0 && (
                  <p className="text-[#66b3ff] text-xs mt-3">
                    No department selected — this login will only ever see their own leave.
                  </p>
                )}
              </div>

              <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-lg">
                <h3 className="text-primary font-bold text-xs uppercase tracking-wider mb-3">⚡ Approval Powers</h3>
                <div className="flex flex-wrap gap-3">
                  {(config?.actionRoles || []).map(r => (
                    <label key={r.id} className="flex items-center gap-2 p-2 px-3 bg-dark-card rounded-full cursor-pointer hover:bg-[#252525] border border-[#333] transition-colors">
                      <input type="checkbox" className="w-4 h-4 accent-primary"
                        checked={actionRoles.includes(r.id)}
                        onChange={() => toggle(r.id, actionRoles, setActionRoles)} />
                      <span className="text-white text-xs font-bold">{r.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  Leave approval powers are added with the Leave Policy settings in the next phase.
                </p>
              </div>

              {formError && (
                <div className="bg-status-danger/15 border border-status-danger text-status-danger rounded-lg px-4 py-3 text-sm font-bold">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex gap-4">
                <button type="button" onClick={() => setTarget(null)} disabled={busy}
                  className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors disabled:opacity-50">✖️ Cancel</button>
                <button type="submit" disabled={busy}
                  className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {busy ? 'Saving…' : '💾 Save Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}