// src/components/Layout.jsx
import AuthBar from './AuthBar';
import SyncBadge from './SyncBadge';
import Footer from './Footer';
import SettingsModal from './SettingsModal';
import AlertBanner from './AlertBanner'; // 🎯 NEW IMPORT

export default function Layout({ children, title, subtitle, maxWidth = "max-w-4xl" }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#121212] print:bg-white">
      <AuthBar />
      <SyncBadge />
      
      {/* 🎯 Drop the Banner right here! */}
      <AlertBanner />
      
      {title && (
        <header className="print:hidden bg-gradient-to-br from-[#1E1E1E] to-[#2d2d2d] p-6 text-center border-b-[3px] border-primary rounded-b-xl mb-6 mt-16 md:mt-4 mx-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-[slideDown_0.5s_ease-out]">
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