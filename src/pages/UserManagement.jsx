// src/pages/UserManagement.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

export default function UserManagement() {
  const { userRole, currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Add User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [newApprovalRoles, setNewApprovalRoles] = useState([]);

  // Modals State
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  // Admin Check
  useEffect(() => {
    if (userRole !== 'admin' && currentUser?.email !== 'dammieoptimus@gmail.com') {
      alert("⛔ Access Denied! Only administrators can access this page.");
      navigate('/');
    } else {
      loadData();
    }
  }, [userRole, currentUser, navigate]);

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load Auth Settings
      const authDoc = await getDoc(doc(db, 'config', 'auth_settings'));
      if (authDoc.exists()) {
        setAuthEnabled(authDoc.data().authEnabled);
      }

      // 2. Load Users
      const usersSnap = await getDocs(collection(db, 'user_roles'));
      const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort by creation date
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

  const toggleGlobalAuth = async () => {
    const newState = !authEnabled;
    
    // Only dammieoptimus can disable auth (from your vanilla logic)
    if (!newState && authEnabled && currentUser?.email !== 'dammieoptimus@gmail.com') {
      showMessage("⚠️ Only the master admin can disable authentication!", "error");
      return;
    }

    try {
      await setDoc(doc(db, 'config', 'auth_settings'), {
        authEnabled: newState,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setAuthEnabled(newState);
      showMessage(`✅ Authentication ${newState ? 'enabled' : 'disabled'}!`);
    } catch (error) {
      console.error("Error toggling auth:", error);
      showMessage("❌ Error updating authentication settings", "error");
    }
  };

  const handleApprovalRoleToggle = (role, stateArray, setStateArray) => {
    if (stateArray.includes(role)) {
      setStateArray(stateArray.filter(r => r !== role));
    } else {
      setStateArray([...stateArray, role]);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return showMessage('Please fill in email and password', 'error');
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters', 'error');

    try {
      showMessage('Creating user...', 'success');

      // 🎯 FIX: Using Firebase REST API to create user without logging out the admin!
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, returnSecureToken: true })
      });

      const userData = await response.json();

      if (!response.ok) {
        throw new Error(userData.error?.message || 'Failed to create user');
      }

      // Save roles to Firestore
      await setDoc(doc(db, 'user_roles', userData.localId), {
        email: newEmail,
        role: newRole,
        approvalRoles: newApprovalRoles,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email
      });

      // Clear Form
      setNewEmail(''); setNewPassword(''); setNewRole('staff'); setNewApprovalRoles([]);
      showMessage('User created successfully!', 'success');
      loadData();
      
    } catch (error) {
      console.error("Error adding user:", error);
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      await updateDoc(doc(db, 'user_roles', editUser.id), {
        role: editUser.role,
        approvalRoles: editUser.approvalRoles,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email
      });
      showMessage('User roles updated!', 'success');
      setEditUser(null);
      loadData();
    } catch (error) {
      console.error("Error updating user:", error);
      showMessage('Error updating roles', 'error');
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
      console.error("Error deleting user:", error);
      showMessage('Error deleting user', 'error');
    }
  };

  const approvalRoleLabels = {
    'buggy_supervisor': '🔧 Buggy Supervisor',
    'plc_operator': '⚡ PLC Operator',
    'production_manager': '🏭 Production Manager',
    'qc_manager': '✅ QC Manager',
    'qc_supervisor': '🔍 QC Supervisor'
  };

  if (loading) return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading User Data...</div></Layout>;

  return (
    <Layout title="🔐 User Management" subtitle="Manage accounts, roles, and global security" maxWidth="max-w-6xl">
      
      {message.text && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white shadow-lg z-50 animate-[fadeIn_0.3s_ease-out] ${message.type === 'error' ? 'bg-status-danger' : 'bg-status-success'}`}>
          {message.text}
        </div>
      )}

      {/* Global Auth Toggle */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.3s] mb-6">
        <h2 className="text-xl font-bold text-primary mb-4">🔐 Authentication Settings</h2>
        <div className="flex items-center gap-4 mb-4">
          {/* Custom Toggle Switch */}
          <label className="relative inline-block w-14 h-8 cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={authEnabled} onChange={toggleGlobalAuth} />
            <div className="w-full h-full bg-[#444] rounded-full peer peer-checked:bg-primary transition-colors duration-300"></div>
            <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 peer-checked:translate-x-6"></div>
          </label>
          <span className="text-lg font-bold text-white">
            Auth is currently: <span className={authEnabled ? "text-status-success" : "text-gray-500"}>{authEnabled ? 'ENABLED' : 'DISABLED'}</span>
          </span>
        </div>
        <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-lg text-sm text-gray-400">
          <p>ℹ️ When <strong>disabled</strong>: Anyone can access the app without login.</p>
          <p>When <strong>enabled</strong>: Users must log in to access the app.</p>
          <p>Anyone can <strong>turn auth ON</strong>. Only the master admin can <strong>turn auth OFF</strong>.</p>
        </div>
      </div>

      {/* Add User Section */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.4s] mb-6">
        <h2 className="text-xl font-bold text-primary mb-6">➕ Add New User</h2>
        <form onSubmit={handleAddUser} className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-4">
            <input type="email" placeholder="Email Address" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="flex-1 bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            <input type="password" placeholder="Temporary Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="flex-1 bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary" />
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary w-full md:w-48">
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="bg-[#1a1a1a] border border-[#333] p-4 rounded-lg">
            <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-3">Approval Roles (Executive Pages)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(approvalRoleLabels).map(([roleKey, label]) => (
                <label key={roleKey} className="flex items-center gap-3 p-3 bg-dark-card rounded-lg cursor-pointer hover:bg-[#252525] border border-[#333] transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-primary" 
                    checked={newApprovalRoles.includes(roleKey)}
                    onChange={() => handleApprovalRoleToggle(roleKey, newApprovalRoles, setNewApprovalRoles)}
                  />
                  <span className="text-white text-sm font-bold">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="bg-primary text-black font-bold py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors self-start">
            Create User
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg animate-[fadeIn_0.5s] mb-16 overflow-x-auto">
        <h2 className="text-xl font-bold text-primary mb-6">👥 All Users</h2>
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Email</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Page Role</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Approval Roles</th>
              <th className="p-3 border-b-2 border-primary text-primary text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#333]">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-white/5 transition-colors">
                <td className="p-3 text-white font-bold">{user.email}</td>
                <td className="p-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    user.role === 'admin' ? 'bg-primary/20 text-primary' : 
                    user.role === 'manager' ? 'bg-[#2196F3]/20 text-[#2196F3]' : 
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-3 text-sm text-gray-300">
                  {user.approvalRoles?.length > 0 
                    ? user.approvalRoles.map(r => approvalRoleLabels[r]?.split(' ')[0]).join(' ') 
                    : <span className="text-gray-600 italic">None</span>}
                </td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => setEditUser({...user, approvalRoles: user.approvalRoles || []})} className="bg-[#2196F3] text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-blue-600 transition-colors">Edit</button>
                  <button onClick={() => setDeleteUser(user)} className="bg-status-danger text-white px-4 py-1.5 rounded font-bold text-xs hover:bg-red-600 transition-colors">Delete</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="4" className="text-center text-gray-500 py-8">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODALS --- */}
      
      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease]" onClick={() => setEditUser(null)}>
          <div className="bg-dark-card p-8 rounded-2xl border-2 border-primary w-[90%] max-w-lg shadow-[0_0_30px_rgba(0,188,212,0.3)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-xl font-bold mb-2 text-center uppercase tracking-wider">Edit User Roles</h2>
            <p className="text-center text-white font-bold mb-6">{editUser.email}</p>
            
            <div className="mb-6">
              <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Page Access Role</label>
              <select 
                value={editUser.role} 
                onChange={e => setEditUser({...editUser, role: e.target.value})} 
                className="w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary"
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="text-xs text-gray-400 uppercase font-bold block mb-2">Approval Roles</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(approvalRoleLabels).map(([roleKey, label]) => (
                  <label key={roleKey} className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg cursor-pointer hover:bg-[#252525] border border-[#333] transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-primary" 
                      checked={editUser.approvalRoles.includes(roleKey)}
                      onChange={() => handleApprovalRoleToggle(roleKey, editUser.approvalRoles, (newRoles) => setEditUser({...editUser, approvalRoles: newRoles}))}
                    />
                    <span className="text-white text-sm font-bold">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditUser(null)} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors">Save Roles</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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