// src/pages/UserManagement.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import EmployeeAccessTab from '../components/userAccess/EmployeeAccessTab';
import {
  subscribeToAccessView, syncEmailToEmployee, syncNameToEmployee,
} from '../services/userAccessOperations';

export default function UserManagement() {
  const { systemRole, currentUser, departmentRoles } = useAuth();
  const { config, loadingConfig } = useConfig();
  const navigate = useNavigate();

  const [message, setMessage] = useState({ type: '', text: '' });

  // 🎯 NEW: Name states
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSystemRole, setNewSystemRole] = useState('standard');
  const [newDeptRoles, setNewDeptRoles] = useState(['qc_staff']);
  const [newActionRoles, setNewActionRoles] = useState([]);

  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [activeTab, setActiveTab] = useState('people');
  // Joined view so the Logins tab can show which employee each account
  // belongs to. Without this the page lists bare email addresses.
  const [accessView, setAccessView] = useState({ people: [], ready: false });

  // ─── Who may manage access ───────────────────────────────────────────────
  // DECISION (16 Oct 2026): hr_manager can manage access. HR is precisely the
  // role that grants and revokes it, and the previous hardcoded email gate
  // meant only the founder could elevate anyone.
  //
  // BUT the Add form and the Edit modal both offer 'Super Admin (God Mode)'.
  // Opening the page to hr_manager as-is would therefore let that role hand
  // out god-mode — a privilege-escalation path. So access is split in two:
  //   manageAccounts — may open the page and grant department/approval roles
  //   mayGrantSuperAdmin — may create or grant super_admin. Founder only.
  const isSuperAdmin = systemRole === 'super_admin' || currentUser?.email === 'dammieoptimus@gmail.com';
  const mayManageAccounts = isSuperAdmin || departmentRoles.includes('hr_manager');
  const mayGrantSuperAdmin = isSuperAdmin;

  useEffect(() => {
    if (!mayManageAccounts) {
      // Inline message, not window.alert. The alert was a blocking modal that
      // cannot be styled and cannot be read at a glance on a tablet — and in
      // the redirect-loop incident it fired repeatedly, which is how the
      // problem surfaced as "messages keep popping up".
      navigate('/no-access', { replace: true });
    }
    // No data fetch here on purpose: the joined subscription below owns that,
    // and it must be declared before this effect runs.
  }, [mayManageAccounts, navigate]);

  // Joined employee↔account view. This is now the single live source for the
  // page: it feeds both the Employees tab and the Logins table cross-reference,
  // so a second getDocs call that could disagree with it is gone.
  useEffect(() => {
    if (!mayManageAccounts) return;
    return subscribeToAccessView(setAccessView);
  }, [mayManageAccounts]);

  // The Logins table reads from accessView.roles (the joined subscription),
// which keeps employees and accounts in step without a second getDocs round
// trip that could disagree with it.
  const users = accessView.roles;

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleToggleRole = (roleId, currentArray, setArrayFn) => {
    if (currentArray.includes(roleId)) setArrayFn(currentArray.filter(id => id !== roleId));
    else setArrayFn([...currentArray, roleId]);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newFirstName || !newLastName || !newEmail || !newPassword) return showMessage('Please fill all required fields', 'error');
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters', 'error');
    // Same defence-in-depth check as handleSaveEdit: hr_manager may manage
      // accounts but must never be able to create one with god-mode.
      if (newSystemRole === 'super_admin' && !mayGrantSuperAdmin) {
        return showMessage('Only the system owner can create a Super Admin.', 'error');
      }

    try {
      showMessage('Creating user...', 'success');
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, returnSecureToken: true })
      });
      const userData = await response.json();
      if (!response.ok) throw new Error(userData.error?.message || 'Failed to create user');

      // 🎯 NEW: Save names to database
      await setDoc(doc(db, 'user_roles', userData.localId), {
        firstName: newFirstName.toLowerCase().trim(),
        lastName: newLastName.toLowerCase().trim(),
        email: newEmail,
        systemRole: newSystemRole,
        departmentRoles: newDeptRoles,
        actionRoles: newActionRoles,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email
      });

      setNewFirstName(''); setNewLastName(''); setNewEmail(''); setNewPassword(''); 
      setNewSystemRole('standard'); setNewDeptRoles(['qc_staff']); setNewActionRoles([]);
      showMessage('User created successfully!', 'success');
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    // Defence in depth: the <select> already hides Super Admin from
      // hr_manager, but a hidden option is not a control. Re-check here so the
      // write path cannot mint a god-mode account from a crafted request.
      if (editUser.systemRole === 'super_admin' && !mayGrantSuperAdmin) {
        showMessage('Only the system owner can grant Super Admin.', 'error');
        return;
      }
      try {
        await updateDoc(doc(db, 'user_roles', editUser.id), {
        firstName: editUser.firstName.toLowerCase().trim(),
        lastName: editUser.lastName.toLowerCase().trim(),
        systemRole: editUser.systemRole,
        departmentRoles: editUser.departmentRoles,
        actionRoles: editUser.actionRoles,
        // Task 1.6 clears this on elevation; doing it here stops a promoted
        // user from keeping a flag that claims they are still leave-only.
        ...(editUser.departmentRoles?.length > 0 ? { restrictedToOwnLeave: false } : {}),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email
      });

      // Keep the employee's own record in step (task 1.6).
      // Nothing else writes email or name back onto `employees`, so without
      // this the roster shows a stale address forever after a rename here.
      const linkedPerson = accessView.people.find(p => p.linkedUserUid === editUser.id);
      if (linkedPerson) {
        const nameChanged =
          linkedPerson.firstName !== editUser.firstName.toLowerCase().trim() ||
          linkedPerson.lastName !== editUser.lastName.toLowerCase().trim();
        if (nameChanged) {
          await syncNameToEmployee(
            linkedPerson.id,
            { firstName: editUser.firstName, lastName: editUser.lastName },
            currentUser.email,
          ).catch(() => {});
        }
        if (linkedPerson.email !== editUser.email) {
          await syncEmailToEmployee(linkedPerson.id, editUser.email, currentUser.email).catch(() => {});
        }
      }

      showMessage('User updated!', 'success');
      setEditUser(null);
    } catch (error) {
      showMessage('Error updating user', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    try {
      await deleteDoc(doc(db, 'user_roles', deleteUser.id));
      showMessage('User removed from database!', 'success');
      setDeleteUser(null);
    } catch (error) {
      showMessage('Error deleting user', 'error');
    }
  };

  const getBadgeFormat = (roleId) => {
    let label = roleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let color = 'bg-gray-500/20 text-gray-400 border-gray-600';
    if (roleId.includes('qc')) color = 'bg-[#00BCD4]/20 text-[#00BCD4] border-[#00BCD4]/50';
    else if (roleId.includes('prod')) color = 'bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/50';
    else if (roleId.includes('hr')) color = 'bg-[#E91E63]/20 text-[#E91E63] border-[#E91E63]/50';
    return { label, color };
  };

  const groupedDeptRoles = (config?.departmentRoles || []).reduce((acc, role) => {
    if (!acc[role.category]) acc[role.category] = [];
    acc[role.category].push(role);
    return acc;
  }, {});

  if (loadingConfig || (mayManageAccounts && !accessView.ready)) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading User Data...</div></Layout>;

  return (
    <Layout title="🔐 User Management" subtitle="Manage accounts, roles, and security" maxWidth="max-w-7xl">
      
      {message.text && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white shadow-lg z-50 animate-[fadeIn_0.3s_ease-out] ${message.type === 'error' ? 'bg-status-danger' : 'bg-status-success'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs: grant access BY PERSON, or edit accounts directly. */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('people')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-colors border ${activeTab === 'people' ? 'bg-primary text-black border-primary' : 'bg-dark-card text-gray-400 border-[#333] hover:text-white'}`}>
          👥 Employees
        </button>
        <button onClick={() => setActiveTab('accounts')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-colors border ${activeTab === 'accounts' ? 'bg-primary text-black border-primary' : 'bg-dark-card text-gray-400 border-[#333] hover:text-white'}`}>
          🔑 Logins
        </button>
      </div>

      {activeTab === 'people' && (
        <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-16">
          <h2 className="text-xl font-bold text-primary mb-2">👥 Grant Access By Employee</h2>
          <p className="text-sm text-gray-400 mb-6">
            Pick a person by name and staff number. Their details come from the roster — no email addresses to guess from.
          </p>
          <EmployeeAccessTab />
        </div>
      )}

      {activeTab === 'accounts' && (<>
      {!mayGrantSuperAdmin && (
        <div className="bg-status-warning/10 border border-status-warning/50 text-status-warning rounded-xl px-4 py-3 mb-6 text-sm">
          🔒 You can manage department and approval roles. <strong>Super Admin</strong> is reserved for the system owner.
        </div>
      )}

      {/* Add User Section */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">➕ Add New User</h2>
        <p className="text-sm text-gray-400 mb-6">
          For accounts with no employee record — an IT contractor, for example. Factory staff should be
          granted access from the <strong>Employees</strong> tab so their leave works too.
        </p>
        <form onSubmit={handleAddUser} className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="👤 First Name" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} required className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            <input type="text" placeholder="👤 Last Name" value={newLastName} onChange={e => setNewLastName(e.target.value)} required className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="email" placeholder="📧 Email Address" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            <input type="password" placeholder="🔒 Temp Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            
            <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-2 flex items-center gap-2">
              <label className="text-gray-400 text-sm font-bold pl-2">🔐 System Role:</label>
              <select value={newSystemRole} onChange={e => setNewSystemRole(e.target.value)} className="bg-transparent text-white font-bold outline-none flex-1" disabled={!mayGrantSuperAdmin}>
                <option value="standard">Standard User</option>
                {/* God mode is founder-only — see mayGrantSuperAdmin. Without
                    this, hr_manager could mint a super admin from this page. */}
                {mayGrantSuperAdmin && <option value="super_admin">Super Admin (God Mode)</option>}
              </select>
            </div>
            {!mayGrantSuperAdmin && (
              <p className="text-gray-500 text-xs mt-2">
                Super Admin is reserved for the system owner and cannot be granted here.
              </p>
            )}
          </div>

          {newSystemRole !== 'super_admin' && (
            <div className="bg-[#1a1a1a] border border-[#333] p-5 rounded-lg">
                  <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">🏢 Department Access</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(groupedDeptRoles).map(([deptName, roles]) => (
                  <div key={deptName} className="bg-dark-card p-4 rounded-lg border border-[#333]">
                    <h4 className="text-white font-bold text-xs uppercase mb-3 pb-2 border-b border-[#333]">{deptName}</h4>
                    <div className="flex flex-col gap-2">
                      {roles.map(role => (
                        <label key={role.id} className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" className="w-4 h-4 accent-primary" checked={newDeptRoles.includes(role.id)} onChange={() => handleToggleRole(role.id, newDeptRoles, setNewDeptRoles)} />
                          <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newSystemRole !== 'super_admin' && (
            <div className="bg-[#1a1a1a] border border-[#333] p-5 rounded-lg">
                  <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">⚡ Approval Powers</h3>
              <div className="flex flex-wrap gap-3">
                {(config?.actionRoles || []).map(role => (
                  <label key={role.id} className="flex items-center gap-2 p-2 px-4 bg-dark-card rounded-full cursor-pointer hover:bg-[#252525] border border-[#333] transition-colors">
                    <input type="checkbox" className="w-4 h-4 accent-primary" checked={newActionRoles.includes(role.id)} onChange={() => handleToggleRole(role.id, newActionRoles, setNewActionRoles)} />
                    <span className="text-white text-sm font-bold">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="bg-primary text-black font-bold py-3 px-8 rounded-lg hover:bg-primary-dark transition-colors self-start shadow-[0_0_15px_rgba(0,188,212,0.3)]">
            👤 Create User
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-16 overflow-x-auto">
        <h2 className="text-xl font-bold text-primary mb-6">👥 All Users</h2>
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">👤 Name</th>
                <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Employee</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">📧 Email</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">🔐 System Role</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">🏢 Departments</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">⚡ Approval Roles</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider text-right">⚡ Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {users.map(user => {
              const sysRole = user.systemRole || (user.role === 'admin' ? 'super_admin' : 'standard');
              const deptRoles = user.departmentRoles || (user.role === 'admin' ? ['All'] : [user.role || 'staff']);
              
              // Formatting the name for display
              let fName = user.firstName || '';
              let lName = user.lastName || '';
              let displayName = '';
              if (fName && lName) {
                displayName = `${fName.charAt(0).toUpperCase() + fName.slice(1)} ${lName.charAt(0).toUpperCase() + lName.slice(1)}`;
              } else {
                displayName = <span className="text-gray-500 italic">No Name Set</span>;
              }

              return (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 text-white font-bold">{displayName}</td>
                  <td className="p-3 text-gray-400">{user.email}</td>
                    {/* Cross-reference: which person is this account? Without
                        this the table is a list of addresses with no people. */}
                    <td className="p-3">
                      {(() => {
                        const person = accessView.people.find(p => p.linkedUserUid === user.id);
                        if (!person) return <span className="text-status-warning text-xs italic">No employee record</span>;
                        return (
                          <div>
                            <span className="text-white font-bold text-sm">{person.fullName}</span>
                            <div className="mono text-cyan-300 text-xs">{person.sapNumber}</div>
                          </div>
                        );
                      })()}
                    </td>
                  
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      sysRole === 'super_admin' ? 'bg-status-success/20 text-status-success border border-status-success/30' : 'bg-gray-500/20 text-gray-400 border border-gray-600'
                    }`}>
                      {sysRole.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="p-3">
                    {sysRole === 'super_admin' ? (
                      <span className="text-gray-500 italic text-sm">Full Access</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {deptRoles.length > 0 ? deptRoles.map(r => {
                          const badge = getBadgeFormat(r);
                          return <span key={r} className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${badge.color}`}>{badge.label}</span>;
                        }) : <span className="text-gray-600 italic text-sm">None</span>}
                      </div>
                    )}
                  </td>

                  <td className="p-3">
                    {sysRole === 'super_admin' ? (
                      <span className="text-gray-500 italic text-sm">Full Access</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(user.actionRoles || []).length > 0 ? (user.actionRoles || []).map(r => {
                          const found = (config?.actionRoles || []).find(a => a.id === r);
                          return <span key={r} className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-[#00BCD4]/50 bg-[#00BCD4]/20 text-[#00BCD4]">{found?.label || r.replace(/_/g, ' ')}</span>;
                        }) : <span className="text-gray-600 italic text-sm">None</span>}
                      </div>
                    )}
                  </td>

                  <td className="p-3 flex gap-2 justify-end">
                    <button onClick={() => setEditUser({...user, systemRole: sysRole, departmentRoles: deptRoles, actionRoles: user.actionRoles || user.approvalRoles || [], firstName: user.firstName || '', lastName: user.lastName || ''})} className="bg-[#2196F3] text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-blue-600 transition-colors">✏️ Edit</button>
                    <button onClick={() => setDeleteUser(user)} className="bg-status-danger text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-red-600 transition-colors">🗑️ Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setEditUser(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[95%] max-w-2xl shadow-[0_0_30px_rgba(0,188,212,0.3)] overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-2 text-center uppercase tracking-wider">✏️ Edit User Profile</h2>
            <p className="text-center text-gray-500 mb-6">{editUser.email}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold block mb-1">👤 First Name</label>
                <input type="text" value={editUser.firstName} onChange={e => setEditUser({...editUser, firstName: e.target.value})} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold block mb-1">👤 Last Name</label>
                <input type="text" value={editUser.lastName} onChange={e => setEditUser({...editUser, lastName: e.target.value})} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-4 flex items-center justify-between mb-6">
              <label className="text-gray-400 text-sm font-bold uppercase">🔐 System Role:</label>
              <select value={editUser.systemRole} onChange={e => setEditUser({...editUser, systemRole: e.target.value})} className="bg-dark-card text-white font-bold outline-none border border-[#444] rounded p-2 focus:border-primary" disabled={!mayGrantSuperAdmin}>
                <option value="standard">Standard User</option>
                {/* Founder-only, for the same reason as the Add form. */}
                {mayGrantSuperAdmin && <option value="super_admin">Super Admin (God Mode)</option>}
              </select>
              {!mayGrantSuperAdmin && editUser.systemRole === 'super_admin' && (
                <p className="text-gray-500 text-xs mt-2">
                  This account is a Super Admin and cannot be changed here.
                </p>
              )}
            </div>

            {editUser.systemRole !== 'super_admin' && (
              <>
                <div className="mb-6 border border-[#333] p-4 rounded-lg bg-[#1a1a1a]">
              <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">🏢 Department Access</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(groupedDeptRoles).map(([deptName, roles]) => (
                      <div key={deptName}>
                        <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">{deptName}</h4>
                        <div className="flex flex-col gap-2">
                          {roles.map(role => (
                            <label key={role.id} className="flex items-center gap-2 cursor-pointer group">
                              <input type="checkbox" className="w-4 h-4 accent-primary" checked={editUser.departmentRoles.includes(role.id)} onChange={() => handleToggleRole(role.id, editUser.departmentRoles, (newRoles) => setEditUser({...editUser, departmentRoles: newRoles}))} />
                              <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{role.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6 border border-[#333] p-4 rounded-lg bg-[#1a1a1a]">
              <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">⚡ Approval Powers</h3>
                  <div className="flex flex-wrap gap-3">
                    {(config?.actionRoles || []).map(role => (
                      <label key={role.id} className="flex items-center gap-2 p-2 px-3 bg-dark-card rounded-full cursor-pointer hover:bg-[#252525] border border-[#333] transition-colors">
                        <input type="checkbox" className="w-4 h-4 accent-primary" checked={editUser.actionRoles.includes(role.id)} onChange={() => handleToggleRole(role.id, editUser.actionRoles, (newRoles) => setEditUser({...editUser, actionRoles: newRoles}))} />
                        <span className="text-white text-xs font-bold">{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-4 mt-6">
              <button onClick={() => setEditUser(null)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]">💾 Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setDeleteUser(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-status-danger w-[90%] max-w-sm shadow-[0_0_30px_rgba(244,67,54,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-status-danger text-xl font-bold mb-2 text-center uppercase tracking-wider">🗑️ Delete User?</h2>
            <p className="text-center text-gray-400 mb-6">Are you sure you want to remove <br/><strong className="text-white">{deleteUser.email}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-status-danger text-white rounded-lg font-bold hover:bg-red-600 transition-colors">🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}
      </>)}

    </Layout>
  );
}