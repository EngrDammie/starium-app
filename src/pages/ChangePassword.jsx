// src/pages/ChangePassword.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer';

export default function ChangePassword() {
  const { currentUser } = useAuth(); // We need the user so we can re-authenticate them
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword.length < 6) return setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
    if (newPassword !== confirmPassword) return setMessage({ type: 'error', text: 'New passwords do not match.' });
    if (currentPassword === newPassword) return setMessage({ type: 'error', text: 'New password must differ from current.' });

    setLoading(true);

    try {
      // 1. Prove they know their current password
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // 2. Change to the new password
      await updatePassword(currentUser, newPassword);
      
      setMessage({ type: 'success', text: 'Password changed successfully! Redirecting to login...' });
      
      // 3. Send them to login so they can test their new password
      setTimeout(() => navigate('/login'), 2000);
      
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setMessage({ type: 'error', text: 'Current password is incorrect.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to change password. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-[#0a0a0a]">
      <div className="flex flex-col items-center justify-center flex-1 w-full p-4">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-10 rounded-2xl border-2 border-primary shadow-[0_0_30px_rgba(255,107,0,0.3)] max-w-md w-full animate-[fadeIn_0.5s_ease-out]">
          
          <h1 className="text-primary text-2xl font-bold mb-1 uppercase tracking-widest text-center">🔐 Change Password</h1>
          <p className="text-gray-400 text-center mb-6 text-sm">Update your account password</p>

          <div className="bg-primary/10 border border-primary p-3 rounded-lg mb-6 text-center text-primary text-sm">
            👤 Changing password for: <br/><span className="font-bold">{currentUser?.email}</span>
          </div>

          {message.text && (
            <div className={`p-3 rounded-lg mb-5 text-center text-sm font-medium ${message.type === 'error' ? 'text-status-danger bg-status-danger/10 border border-status-danger' : 'text-status-success bg-status-success/10 border border-status-success'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-primary font-bold mb-2 text-sm">🔒 Current Password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-3 bg-[#1a1a1a] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary" required />
            </div>
            <div>
              <label className="block text-primary font-bold mb-2 text-sm">🆕 New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-[#1a1a1a] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary" required />
            </div>
            <div>
              <label className="block text-primary font-bold mb-2 text-sm">✅ Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-3 bg-[#1a1a1a] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary" required />
            </div>

            <div className="bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg mt-2 mb-2">
              <h4 className="text-primary text-xs font-bold mb-1">📋 Requirements:</h4>
              <ul className="text-gray-400 text-xs list-disc list-inside pl-4">
                <li>Minimum 6 characters</li>
                <li>Must differ from current</li>
              </ul>
            </div>

            <button type="submit" disabled={loading} className="w-full p-4 bg-gradient-to-br from-primary to-[#e55a00] text-white rounded-lg font-bold uppercase tracking-wide hover:from-[#ff7a1a] hover:to-primary disabled:opacity-50">
              {loading ? '⏳ Processing...' : '🔑 Change Password'}
            </button>
          </form>

          <div className="text-center mt-6 text-sm">
            <Link to="/" className="text-gray-400 hover:text-primary transition-colors">⬅️ Back to App</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}