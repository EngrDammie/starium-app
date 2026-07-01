// src/components/AuthBar.jsx
import { useAuth } from '../context/AuthContext';

export default function AuthBar() {
  const { currentUser, logout } = useAuth();

  if (!currentUser) return null;

  return (
    // 🎯 FIX: Added print:hidden
    <div className="print:hidden fixed top-0 right-0 flex items-center gap-4 py-2 px-5 bg-black/70 z-50 rounded-bl-lg backdrop-blur-sm border-b border-l border-[#333]">
      <span className="text-primary text-sm font-medium">{currentUser.email}</span>
      <button 
        onClick={logout} 
        className="bg-status-danger text-white border-none py-1.5 px-4 rounded-md cursor-pointer text-xs uppercase font-bold tracking-wider transition-all hover:bg-red-600 hover:shadow-[0_0_10px_rgba(244,67,54,0.5)]"
      >
        🚪 Logout
      </button>
    </div>
  );
}