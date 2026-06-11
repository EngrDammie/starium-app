// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [modalMessage, setModalMessage] = useState({ type: '', text: '' });
  
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // 🎯 Connect to the Brain

  // 🎯 FIX: Wait here patiently until the Brain says the user has their keycards!
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // We don't navigate here anymore. We just sign in, and let the useEffect above handle the redirect safely!
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
      setLoading(false); // Only stop loading if there is an error.
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) return setModalMessage({ type: 'error', text: 'Please enter your email address.' });
    setModalMessage({ type: '', text: '' });
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setModalMessage({ type: 'success', text: 'Password reset link sent! Check your email.' });
      setTimeout(() => setShowModal(false), 3000); 
    } catch (err) {
      setModalMessage({ type: 'error', text: 'Failed to send reset email. Please try again.' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-[#0a0a0a]">
      <div className="flex flex-col items-center justify-center flex-1 w-full p-4">
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-10 md:p-12 rounded-2xl border-2 border-primary shadow-[0_0_30px_rgba(255,107,0,0.3)] max-w-md w-full animate-[fadeIn_0.5s_ease-out]">
          <h1 className="text-primary text-3xl font-bold mb-2 uppercase tracking-widest text-center">Starium Rafa</h1>
          <p className="text-gray-400 text-center mb-8 text-sm">Enterprise Resource Planner</p>

          {error && <div className="text-status-danger bg-status-danger/10 border border-status-danger p-3 rounded-lg mb-5 text-center text-sm font-medium">{error}</div>}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-primary font-bold mb-2 text-sm">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-[#1a1a1a] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(255,107,0,0.3)] transition-all" placeholder="Enter your email" required />
            </div>

            <div>
              <label className="block text-primary font-bold mb-2 text-sm">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-[#1a1a1a] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(255,107,0,0.3)] transition-all" placeholder="Enter your password" required />
            </div>

            <button type="submit" disabled={loading} className="w-full p-4 mt-2 bg-gradient-to-br from-primary to-[#e55a00] text-white rounded-lg font-bold uppercase tracking-wide hover:from-[#ff7a1a] hover:to-primary hover:shadow-[0_0_20px_rgba(255,107,0,0.5)] transition-all disabled:opacity-50">
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="flex justify-between mt-6 text-sm">
            <button onClick={() => {setShowModal(true); setModalMessage({type: '', text: ''})}} className="text-gray-400 hover:text-primary transition-colors">Forgot Password?</button>
            <Link to="/change-password" className="text-gray-400 hover:text-primary transition-colors">Change Password</Link>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-[fadeIn_0.3s_ease]">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-8 rounded-2xl border-2 border-primary shadow-[0_0_30px_rgba(255,107,0,0.3)] max-w-sm w-[90%]">
            <h2 className="text-primary text-xl font-bold mb-3 text-center">Reset Password</h2>
            <p className="text-gray-400 text-sm text-center mb-6">Enter your email and we'll send a reset link.</p>
            {modalMessage.text && <div className={`p-3 rounded-lg mb-4 text-center text-sm font-medium ${modalMessage.type === 'error' ? 'text-status-danger bg-status-danger/10 border border-status-danger' : 'text-status-success bg-status-success/10 border border-status-success'}`}>{modalMessage.text}</div>}
            <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full p-3 bg-[#1a1a1a] text-white border-2 border-gray-800 rounded-lg outline-none focus:border-primary mb-6" placeholder="Enter registered email" />
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-400 border-2 border-gray-700 rounded-lg font-bold hover:border-gray-500 hover:text-white transition-all">Cancel</button>
              <button onClick={handleResetPassword} className="flex-1 py-3 bg-primary text-white rounded-lg font-bold hover:bg-[#ff7a1a] transition-all">Send Link</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}