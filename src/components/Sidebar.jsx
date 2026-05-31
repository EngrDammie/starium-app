// src/components/Sidebar.jsx
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MENU_CONFIG } from '../config/navigation';

export default function Sidebar({ isOpen, onClose, onOpenBroadcast }) {
  const { systemRole, departmentRoles } = useAuth();
  const location = useLocation();
  const [openCategory, setOpenCategory] = useState('Quality Control'); // Default open tab

  if (!isOpen) return null;

  // 🧠 The Smart Visibility Engine
  const canViewRoute = (route) => {
    // 1. Super Admins see everything
    if (systemRole === 'super_admin') return true;
    
    // 2. If it requires no specific role, but you aren't a super admin, hide it.
    if (!route.allowedRoles || route.allowedRoles.length === 0) return false;
    
    // 3. Do you have at least ONE of the required department roles?
    return route.allowedRoles.some(role => departmentRoles.includes(role));
  };

  // Pre-filter the menu to remove empty categories
  const visibleMenu = MENU_CONFIG.map(category => {
    const visibleChildren = category.children.filter(canViewRoute);
    return { ...category, children: visibleChildren };
  }).filter(category => category.children.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-[fadeIn_0.3s_ease]" 
        onClick={onClose}
      />

      {/* Sliding Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-[#121212] border-r border-[#333] shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-[100] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-[#333] flex justify-between items-center bg-gradient-to-br from-[#1E1E1E] to-[#252525]">
          <h2 className="text-primary font-black text-xl uppercase tracking-widest">Navigation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>

        {/* Scrollable Accordion Links */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-2">
          {visibleMenu.map((category) => (
            <div key={category.title} className="mb-2">
              <button 
                onClick={() => setOpenCategory(openCategory === category.title ? null : category.title)}
                className={`w-full flex items-center justify-between p-4 rounded-xl font-bold transition-all ${openCategory === category.title ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#222]'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.icon}</span>
                  <span>{category.title}</span>
                </div>
                <span className={`transform transition-transform ${openCategory === category.title ? 'rotate-180 text-primary' : 'text-gray-500'}`}>▼</span>
              </button>

              {/* Collapsible Children */}
              <div className={`overflow-hidden transition-all duration-300 ${openCategory === category.title ? 'max-h-96 mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col gap-1 pl-4 border-l-2 border-[#333] ml-6">
                  {category.children.map((route) => {
                    const isActive = location.pathname === route.path;
                    return (
                      <Link 
                        key={route.path}
                        to={route.path}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${isActive ? 'bg-primary text-black font-bold shadow-[0_0_15px_rgba(0,188,212,0.3)]' : 'text-gray-400 hover:text-white hover:bg-[#252525]'}`}
                      >
                        <span>{route.icon}</span>
                        <span>{route.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pinned Broadcast Button */}
        <div className="p-6 border-t border-[#333] bg-[#1a1a1a]">
          <button 
            onClick={() => { onClose(); onOpenBroadcast(); }}
            className="w-full flex items-center justify-center gap-2 bg-status-warning/10 border-2 border-status-warning text-status-warning py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-status-warning hover:text-black hover:shadow-[0_0_15px_rgba(255,152,0,0.4)] transition-all"
          >
            <span>📢</span> Send Broadcast
          </button>
        </div>

      </div>
    </>
  );
}