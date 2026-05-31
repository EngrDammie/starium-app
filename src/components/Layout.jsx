// src/components/Layout.jsx
import { useState } from 'react';
import AuthBar from './AuthBar';
import SyncBadge from './SyncBadge';
import Footer from './Footer';
import SettingsModal from './SettingsModal';
import AlertBanner from './AlertBanner';
import Sidebar from './Sidebar'; // 🎯 NEW
import BroadcastModal from './BroadcastModal'; // 🎯 NEW

export default function Layout({ children, title, subtitle, maxWidth = "max-w-4xl" }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#121212] print:bg-white">
      
      {/* 🎯 NEW: The Hamburger Menu Button */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="print:hidden fixed top-14 md:top-5 left-4 z-40 w-11 h-11 bg-dark-card border-2 border-primary text-primary rounded-xl flex items-center justify-center cursor-pointer hover:bg-primary hover:text-black hover:shadow-[0_0_15px_rgba(0,188,212,0.5)] transition-all shadow-lg backdrop-blur-sm"
      >
        <span className="text-2xl">☰</span>
      </button>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        onOpenBroadcast={() => setIsBroadcastOpen(true)} 
      />
      
      <BroadcastModal 
        isOpen={isBroadcastOpen} 
        onClose={() => setIsBroadcastOpen(false)} 
      />

      <AuthBar />
      <SyncBadge />
      <AlertBanner />
      
      {title && (
        <header className="print:hidden bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-6 text-center border-b-[3px] border-primary rounded-b-xl mb-6 mt-28 md:mt-4 mx-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-[slideDown_0.5s_ease-out]">
          <h1 className="text-primary text-2xl uppercase tracking-[2px] font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
        </header>
      )}

      <main className={`flex-1 w-full ${maxWidth} mx-auto p-4 print:p-0 print:max-w-none flex flex-col`}>
        {children}
      </main>

      <SettingsModal />
      <Footer />
    </div>
  );
}