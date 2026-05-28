// src/components/AlertBanner.jsx
import { useAlerts } from '../context/AlertContext';
import { useLocation } from 'react-router-dom';

export default function AlertBanner() {
  const { alerts, setAlerts } = useAlerts();
  const location = useLocation(); // Gets the current page URL (e.g., '/', '/level9-exec')

  // 🎯 FIX: Filter alerts to only show ones meant for 'all' or this specific page!
  const visibleAlerts = alerts.filter(alert => {
    const targets = alert.targetPages || ['all'];
    return targets.includes('all') || targets.includes(location.pathname);
  });

  if (visibleAlerts.length === 0) return null;

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed top-20 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none print:hidden">
      {visibleAlerts.map((alert) => {
        let colors = "bg-[#1E1E1E] border-primary text-white";
        let icon = "💬";
        
        if (alert.level === 'danger') {
          colors = "bg-status-danger text-white border-red-400 shadow-[0_0_20px_rgba(244,67,54,0.6)]";
          icon = "🚨";
        } else if (alert.level === 'warning') {
          colors = "bg-status-warning text-black border-yellow-400 shadow-[0_0_20px_rgba(255,152,0,0.6)]";
          icon = "⚠️";
        }

        return (
          <div key={alert.id} className={`pointer-events-auto flex items-start gap-4 p-4 rounded-xl border-2 animate-[slideInRight_0.4s_ease-out] ${colors} ${alert.level === 'danger' ? 'animate-shake' : ''}`}>
            <div className="text-2xl">{icon}</div>
            <div className="flex-1">
              <h4 className="font-bold uppercase tracking-wider text-sm mb-1">{alert.title}</h4>
              <p className="text-sm font-medium opacity-90">{alert.message}</p>
            </div>
            <button onClick={() => dismissAlert(alert.id)} className="text-xl font-bold opacity-60 hover:opacity-100 transition-opacity">&times;</button>
          </div>
        );
      })}
    </div>
  );
}