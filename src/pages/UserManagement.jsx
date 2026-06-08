// src/pages/UserManagement.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';

export default function UserManagement() {
  const { systemRole, currentUser } = useAuth();
  const { config, loadingConfig } = useConfig();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (systemRole !== 'super_admin' && currentUser?.email !== 'dammieoptimus@gmail.com') {
      alert("⛔ Access Denied! Only administrators can access this page.");
      navigate('/');
    } else {
      loadData();
    }
  }, [systemRole, currentUser, navigate]);

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'user_roles'));
      const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      usersList.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Error loading data:", error);
      showMessage("Failed to load users data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = (roleId, currentArray, setArrayFn) => {
    if (currentArray.includes(roleId)) setArrayFn(currentArray.filter(id => id !== roleId));
    else setArrayFn([...currentArray, roleId]);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newFirstName || !newLastName || !newEmail || !newPassword) return showMessage('Please fill all required fields', 'error');
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters', 'error');

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
      loadData();
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      await updateDoc(doc(db, 'user_roles', editUser.id), {
        firstName: editUser.firstName.toLowerCase().trim(),
        lastName: editUser.lastName.toLowerCase().trim(),
        systemRole: editUser.systemRole,
        departmentRoles: editUser.departmentRoles,
        actionRoles: editUser.actionRoles,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email
      });
      showMessage('User updated!', 'success');
      setEditUser(null);
      loadData();
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
      loadData();
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

  if (loading || loadingConfig) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading User Data...</div></Layout>;

  return (
    <Layout title="🔐 User Management" subtitle="Manage accounts, roles, and security" maxWidth="max-w-7xl">
      
      {message.text && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white shadow-lg z-50 animate-[fadeIn_0.3s_ease-out] ${message.type === 'error' ? 'bg-status-danger' : 'bg-status-success'}`}>
          {message.text}
        </div>
      )}

      {/* Add User Section */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-6">
        <h2 className="text-xl font-bold text-primary mb-6">➕ Add New User</h2>
        <form onSubmit={handleAddUser} className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="First Name" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} required className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            <input type="text" placeholder="Last Name" value={newLastName} onChange={e => setNewLastName(e.target.value)} required className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="email" placeholder="Email Address" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            <input type="password" placeholder="Temp Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            
            <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-2 flex items-center gap-2">
              <label className="text-gray-400 text-sm font-bold pl-2">System Role:</label>
              <select value={newSystemRole} onChange={e => setNewSystemRole(e.target.value)} className="bg-transparent text-white font-bold outline-none flex-1">
                <option value="standard">Standard User</option>
                <option value="super_admin">Super Admin (God Mode)</option>
              </select>
            </div>
          </div>

          {newSystemRole !== 'super_admin' && (
            <div className="bg-[#1a1a1a] border border-[#333] p-5 rounded-lg">
              <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">Department Access</h3>
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
              <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">Approval Powers</h3>
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
            Create User
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg mb-16 overflow-x-auto">
        <h2 className="text-xl font-bold text-primary mb-6">👥 All Users</h2>
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Name</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Email</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">System Role</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Departments</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider text-right">Actions</th>
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

                  <td className="p-3 flex gap-2 justify-end">
                    <button onClick={() => setEditUser({...user, systemRole: sysRole, departmentRoles: deptRoles, actionRoles: user.actionRoles || user.approvalRoles || [], firstName: user.firstName || '', lastName: user.lastName || ''})} className="bg-[#2196F3] text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-blue-600 transition-colors">Edit</button>
                    <button onClick={() => setDeleteUser(user)} className="bg-status-danger text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-red-600 transition-colors">Delete</button>
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
            <h2 className="text-primary text-xl font-bold mb-2 text-center uppercase tracking-wider">Edit User Profile</h2>
            <p className="text-center text-gray-500 mb-6">{editUser.email}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold block mb-1">First Name</label>
                <input type="text" value={editUser.firstName} onChange={e => setEditUser({...editUser, firstName: e.target.value})} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold block mb-1">Last Name</label>
                <input type="text" value={editUser.lastName} onChange={e => setEditUser({...editUser, lastName: e.target.value})} className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-4 flex items-center justify-between mb-6">
              <label className="text-gray-400 text-sm font-bold uppercase">System Role:</label>
              <select value={editUser.systemRole} onChange={e => setEditUser({...editUser, systemRole: e.target.value})} className="bg-dark-card text-white font-bold outline-none border border-[#444] rounded p-2 focus:border-primary">
                <option value="standard">Standard User</option>
                <option value="super_admin">Super Admin (God Mode)</option>
              </select>
            </div>

            {editUser.systemRole !== 'super_admin' && (
              <>
                <div className="mb-6 border border-[#333] p-4 rounded-lg bg-[#1a1a1a]">
                  <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">Department Access</h3>
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
                  <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">Approval Powers</h3>
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
              <button onClick={() => setEditUser(null)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]">Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setDeleteUser(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-status-danger w-[90%] max-w-sm shadow-[0_0_30px_rgba(244,67,54,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-status-danger text-xl font-bold mb-2 text-center uppercase tracking-wider">Delete User?</h2>
            <p className="text-center text-gray-400 mb-6">Are you sure you want to remove <br/><strong className="text-white">{deleteUser.email}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-3 bg-status-danger text-white rounded-lg font-bold hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}