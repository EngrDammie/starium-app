// src/pages/EmployeeRoster.jsx
//
// The HR master record screen.
//
// WHY IT EXISTS:
// The app's sidebar already advertised "Employee Roster" at /employees, but no
// route or component existed behind it — a dead link an HR user could click and
// get nothing. This page closes that gap.
//
// It is also the hard prerequisite for Leave Management. `user_roles` is a
// door-key list (who can log in, what they may do); it has no SAP number, job
// title, department or shift, and it cannot describe someone who never logs in.
// Every leave form asks for those fields. Hence this page.
//
// Access: hr_staff and hr_manager, plus super_admin. The guard below is an
// in-page check, not just a hidden menu item — a hidden link is not a locked
// door, and the address bar still works.

import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import {
  EMPLOYMENT_STATUS, subscribeToEmployees,
  createEmployee, updateEmployee, deleteEmployee,
  deactivateEmployee, reactivateEmployee,
} from '../services/employeeOperations';
import { seedSampleEmployees, SAMPLE_EMPLOYEES } from '../services/employeeSeed';

const inputCls = 'w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary';
const labelCls = 'text-xs text-gray-400 uppercase font-bold block mb-1';

const EMPTY_FORM = {
  firstName: '', lastName: '', sapNumber: '', cadreDesignation: '',
  department: '', departmentLabel: '', shift: 'DAY',
  phone: '', email: '', address: '', dateJoined: '',
  employmentStatus: EMPLOYMENT_STATUS.ACTIVE,
};

function StatCard({ icon, label, value, sub, tone = '' }) {
  return (
    <div className="bg-gradient-to-br from-[#1E1E1E] to-[#252525] border border-[#333] p-6 rounded-2xl shadow-lg">
      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{icon} {label}</h3>
      <div className={`text-4xl font-black ${tone || 'text-white'}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    [EMPLOYMENT_STATUS.ACTIVE]: 'bg-status-success/20 text-status-success border border-status-success/30',
    [EMPLOYMENT_STATUS.INACTIVE]: 'bg-gray-500/20 text-gray-400 border border-gray-600',
    [EMPLOYMENT_STATUS.SUSPENDED]: 'bg-status-warning/20 text-status-warning border border-status-warning/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${map[status] || map[EMPLOYMENT_STATUS.INACTIVE]}`}>
      {String(status || EMPLOYMENT_STATUS.INACTIVE).replace('_', ' ')}
    </span>
  );
}

export default function EmployeeRoster() {
  const { systemRole, departmentRoles, currentUser } = useAuth();
  const { config, loadingConfig } = useConfig();

  const [employees, setEmployees] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const canView = systemRole === 'super_admin'
    || departmentRoles.some(r => ['hr_staff', 'hr_manager'].includes(r));

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  }, []);

  // Loading is DERIVED, not set inside the effect. Calling setState
  // synchronously in an effect body causes a cascading render (React 19 flags
  // this outright). The subscription callback is the only place we write
  // state, and it fires from Firestore rather than during render.
  useEffect(() => {
    if (!canView) return;
    const unsubscribe = subscribeToEmployees((list) => {
      setEmployees(list);
      setListLoaded(true);
    });
    return unsubscribe;
  }, [canView]);

  const departments = config?.hrDepartments || [];
  const shifts = config?.hrShifts || [];

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (deptFilter !== 'all' && e.department !== deptFilter) return false;
      if (statusFilter === 'active' && e.employmentStatus !== EMPLOYMENT_STATUS.ACTIVE) return false;
      if (statusFilter === 'inactive' && e.employmentStatus === EMPLOYMENT_STATUS.ACTIVE) return false;
      if (!term) return true;
      return [e.fullName, e.firstName, e.lastName, e.sapNumber, e.cadreDesignation, e.phone]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(term));
    });
  }, [employees, search, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.employmentStatus === EMPLOYMENT_STATUS.ACTIVE);
    const withLogin = employees.filter(e => e.linkedUserUid).length;
    const depts = new Set(active.map(e => e.department).filter(Boolean)).size;
    const samples = employees.filter(e => e.isSampleData).length;
    return { total: employees.length, active: active.length, withLogin, depts, samples };
  }, [employees]);

  // ─── Form handling ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, department: departments[0]?.id || '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (employee) => {
    setEditing(employee);
    setForm({
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      sapNumber: employee.sapNumber || '',
      cadreDesignation: employee.cadreDesignation || '',
      department: employee.department || '',
      departmentLabel: employee.departmentLabel || '',
      shift: employee.shift || 'DAY',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      dateJoined: employee.dateJoined || '',
      employmentStatus: employee.employmentStatus || EMPLOYMENT_STATUS.ACTIVE,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleDepartmentChange = (id) => {
    const dept = departments.find(d => d.id === id);
    setForm(f => ({ ...f, department: id, departmentLabel: dept?.label || id }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const by = currentUser?.email || null;
    // Firestore Timestamp, not a string — the roster displays the joined date.
    const payload = {
      ...form,
      dateJoined: form.dateJoined ? new Date(form.dateJoined) : null,
    };

    const result = editing
      ? await updateEmployee(editing.id, payload, by)
      : await createEmployee(payload, by);

    setSaving(false);

    if (!result.ok) { setFormError(result.error || 'Could not save this employee.'); return; }
    showMessage(editing ? 'Employee updated.' : 'Employee added to the roster.');
    setFormOpen(false);
  };

  // Idempotent: keyed on SAP number, so a second run updates rather than
  // duplicating. Seeded records are flagged isSampleData so it is always
  // obvious which rows are fictional.
  const handleSeed = async () => {
    setSeeding(true);
    const result = await seedSampleEmployees(currentUser?.email || null);
    setSeeding(false);
    setConfirmSeed(false);
    if (result.failed === 0) {
      showMessage(`${SAMPLE_EMPLOYEES.length} sample employees saved.`);
    } else {
      showMessage(`Seeded with ${result.failed} failure(s): ${result.errors[0]}`, 'error');
    }
  };

  const handleToggleActive = async (employee) => {
    const by = currentUser?.email || null;
    const goingInactive = employee.employmentStatus === EMPLOYMENT_STATUS.ACTIVE;
    const result = goingInactive
      ? await deactivateEmployee(employee.id, by)
      : await reactivateEmployee(employee.id, by);
    if (result.ok) {
      showMessage(goingInactive
        ? `${employee.fullName || employee.sapNumber} deactivated. Leave history kept.`
        : `${employee.fullName || employee.sapNumber} reactivated.`);
    } else {
      showMessage(result.error || 'Could not change status.', 'error');
    }
  };

  const handleDelete = async () => {
    const employee = confirmDelete;
    if (!employee) return;
    const result = await deleteEmployee(employee.id);
    setConfirmDelete(null);
    if (result.ok) showMessage('Employee permanently removed.', 'error');
    else showMessage(result.error || 'Could not delete.', 'error');
  };

  // ─── Access guard ─────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <Layout title="Employee Roster" subtitle="HR master records" maxWidth="max-w-6xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
          <p className="text-sm">Employee records are available to HR staff only.</p>
        </div>
      </Layout>
    );
  }

  if (loadingConfig || (canView && !listLoaded)) {
    return (
      <Layout title="Loading..." >
        <div className="text-center text-white mt-10">Loading employee records…</div>
      </Layout>
    );
  }

  return (
    <Layout title="📋 Employee Roster" subtitle="Every person in the factory, with their job details" maxWidth="max-w-7xl">

      {message.text && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white shadow-lg z-50 animate-[fadeIn_0.3s_ease-out] ${message.type === 'error' ? 'bg-status-danger' : 'bg-status-success'}`}>
          {message.text}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-[fadeIn_0.3s_ease-out]">
        <StatCard icon="👥" label="Active staff" value={stats.active} sub={`of ${stats.total} records`} />
        <StatCard icon="🏢" label="Departments" value={stats.depts} sub="in use" />
        <StatCard
          icon="🔑" label="With app login" value={stats.withLogin}
          sub={stats.samples > 0 ? `${stats.total - stats.withLogin} without · ${stats.samples} sample` : `${stats.total - stats.withLogin} without`}
          tone={stats.total - stats.withLogin > 0 ? 'text-status-warning' : 'text-status-success'}
        />
        <StatCard icon="🗂️" label="Showing" value={filtered.length} sub={`of ${stats.total} records`} />
      </div>

      {/* Toolbar */}
      <div className="bg-dark-card p-4 rounded-xl border border-[#333] shadow-lg mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search name, SAP number, designation…"
            className="md:col-span-2 bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary"
          />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
            <option value="all">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary">
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
        <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
          <p className="text-gray-500 text-sm">
            Staff without an app login still appear here — they simply cannot sign in.
            HR lodges their leave requests on their behalf.
          </p>
          <div className="flex gap-3 flex-wrap self-start">
            <button onClick={() => setConfirmSeed(true)}
              className="bg-[#333] text-white font-bold py-3 px-5 rounded-lg hover:bg-[#444] transition-colors">
              🧪 Load sample data
            </button>
            <button onClick={openAdd}
              className="bg-primary text-black font-bold py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]">
              ➕ Add Employee
            </button>
          </div>
        </div>
      </div>

      {/* Sample-data disclosure: fictional rows must never be mistaken for staff. */}
      {stats.samples > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/50 text-status-warning rounded-xl px-4 py-3 mb-4 text-sm">
          🧪 <strong>{stats.samples}</strong> of these records are{' '}
          <strong>sample data</strong> — invented names and test phone numbers, safe to delete.
        </div>
      )}

      {/* Table */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-16 overflow-x-auto">
        {employees.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">👥</div>
            <p className="font-bold text-white mb-1">No employees on the roster yet</p>
            <p className="text-sm mb-6">Add your first employee to start filling leave forms automatically.</p>
            <button onClick={openAdd} className="bg-primary text-black font-bold py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors">
              ➕ Add the first employee
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-bold text-white">No employees match those filters</p>
            <button onClick={() => { setSearch(''); setDeptFilter('all'); setStatusFilter('all'); }}
              className="mt-4 text-sm text-primary underline">Clear filters</button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">SAP No.</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Name</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Designation</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Department</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Shift</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Status</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Login</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {filtered.map(e => {
                const isActive = e.employmentStatus === EMPLOYMENT_STATUS.ACTIVE;
                return (
                  <tr key={e.id} className={`hover:bg-white/5 transition-colors ${isActive ? '' : 'opacity-55'}`}>
                    <td className="p-3 mono text-cyan-300 text-xs">{e.sapNumber || '—'}</td>
                    <td className="p-3">
                      <div className="text-white font-bold">{e.fullName || <span className="text-gray-500 italic">No name set</span>}</div>
                      {e.phone && <div className="text-gray-500 text-xs mt-0.5">{e.phone}</div>}
                    </td>
                    <td className="p-3 text-gray-400">{e.cadreDesignation || '—'}</td>
                    <td className="p-3 text-gray-400">{e.departmentLabel || e.department || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-[#666] text-gray-300">
                        {e.shift || 'DAY'}
                      </span>
                    </td>
                    <td className="p-3"><StatusBadge status={e.employmentStatus} /></td>
                    <td className="p-3">
                      {e.linkedUserUid
                        ? <span className="text-status-success text-xs font-bold">🔑 Linked</span>
                        : <span className="text-gray-600 text-xs">None</span>}
                      {e.isSampleData && (
                        <span className="block mt-1 text-status-warning text-[10px] uppercase font-bold">🧪 Sample</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(e)}
                          className="bg-[#2196F3] text-white px-3 py-1.5 rounded font-bold text-xs hover:bg-blue-600 transition-colors">✏️ Edit</button>
                        <button onClick={() => handleToggleActive(e)}
                          className={`px-3 py-1.5 rounded font-bold text-xs text-white transition-colors ${isActive ? 'bg-status-warning hover:bg-yellow-500' : 'bg-status-success hover:bg-[#00C853]'}`}>
                          {isActive ? '⏸ Deactivate' : '▶️ Reactivate'}
                        </button>
                        <button onClick={() => setConfirmDelete(e)}
                          className="bg-status-danger text-white px-3 py-1.5 rounded font-bold text-xs hover:bg-red-600 transition-colors">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease]"
          onClick={() => setFormOpen(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[95%] max-w-3xl shadow-[0_0_30px_rgba(0,188,212,0.3)] overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-1 text-center uppercase tracking-wider">
              {editing ? '✏️ Edit Employee' : '➕ Add Employee'}
            </h2>
            <p className="text-center text-gray-500 mb-6 text-sm">
              These details fill in automatically on every leave request.
            </p>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>First name *</label>
                  <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last name *</label>
                  <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>SAP number *</label>
                  <input required value={form.sapNumber} onChange={e => setForm({ ...form, sapNumber: e.target.value })}
                    placeholder="ST-0001" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Cadre / Designation</label>
                  <input value={form.cadreDesignation} onChange={e => setForm({ ...form, cadreDesignation: e.target.value })}
                    placeholder="Production Officer" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Department *</label>
                  <select required value={form.department} onChange={e => handleDepartmentChange(e.target.value)} className={inputCls}>
                    <option value="" disabled>Select…</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Shift</label>
                  <select value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })} className={inputCls}>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date joined</label>
                  <input type="date" value={form.dateJoined || ''} onChange={e => setForm({ ...form, dateJoined: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Contact address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Employment status</label>
                <select value={form.employmentStatus} onChange={e => setForm({ ...form, employmentStatus: e.target.value })} className={inputCls}>
                  <option value={EMPLOYMENT_STATUS.ACTIVE}>Active</option>
                  <option value={EMPLOYMENT_STATUS.INACTIVE}>Inactive</option>
                  <option value={EMPLOYMENT_STATUS.SUSPENDED}>Suspended</option>
                </select>
              </div>

              {formError && (
                <div className="bg-status-danger/15 border border-status-danger text-status-danger rounded-lg px-4 py-3 text-sm font-bold">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex gap-4 mt-2">
                <button type="button" onClick={() => setFormOpen(false)}
                  className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(0,188,212,0.3)]">
                  {saving ? 'Saving…' : '💾 Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seed confirmation */}
      {confirmSeed && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-[fadeIn_0.2s_ease]"
          onClick={() => !seeding && setConfirmSeed(false)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-status-warning w-[90%] max-w-md shadow-[0_0_30px_rgba(255,152,0,0.3)]"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-status-warning text-xl font-bold mb-2 text-center uppercase tracking-wider">🧪 Load Sample Data?</h2>
            <p className="text-center text-gray-400 mb-3 text-sm">
              Adds <strong className="text-white">{SAMPLE_EMPLOYEES.length} fictional employees</strong> across
              every department, for demos and testing.
            </p>
            <p className="text-center text-gray-500 text-xs mb-6">
              Names are invented and phone numbers use Nigeria's reserved 0700 test range.
              Rows are tagged <span className="mono">isSampleData</span> and can be deleted freely.
              Safe to run more than once — records are matched on SAP number, not duplicated.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSeed(false)} disabled={seeding}
                className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors disabled:opacity-50">✖️ Cancel</button>
              <button onClick={handleSeed} disabled={seeding}
                className="flex-1 py-3 bg-status-warning text-black rounded-lg font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50">
                {seeding ? 'Seeding…' : '🧪 Load'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-[fadeIn_0.2s_ease]"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-status-danger w-[90%] max-w-md shadow-[0_0_30px_rgba(244,67,54,0.3)]"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-status-danger text-xl font-bold mb-2 text-center uppercase tracking-wider">🗑️ Delete Permanently?</h2>
            <p className="text-center text-gray-400 mb-2 text-sm">
              This removes <strong className="text-white">{confirmDelete.fullName}</strong> ({confirmDelete.sapNumber}) permanently.
            </p>
            <p className="text-center text-status-warning text-xs mb-6">
              ⚠️ Their leave history and balances go with this record. Prefer “Deactivate” instead — it keeps the history.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 py-3 bg-status-danger text-white rounded-lg font-bold hover:bg-red-600 transition-colors">🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}