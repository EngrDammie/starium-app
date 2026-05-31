// src/components/SettingsModal.jsx
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useConfig } from '../context/ConfigContext';

export default function SettingsModal() {
  const { config } = useConfig();
  const location = useLocation(); 
  
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ text: '', type: '' });

  const [form, setForm] = useState({
    level9MinDensity: 0.200, level9MaxDensity: 0.310, level9Divisor: 1580,
    botMinDensity: 0.200, botMaxDensity: 0.240, botDivisor: 1680,
    dayShiftStart: 7, nightShiftStart: 19,
    showSettingsBtnIndex: true, showSettingsBtnLevel9Exec: true, showSettingsBtnBotExec: true,
  });

  useEffect(() => {
    if (config) {
      setForm({
        level9MinDensity: config.level9MinDensity ?? 0.200, level9MaxDensity: config.level9MaxDensity ?? 0.310, level9Divisor: config.level9Divisor ?? 1580,
        botMinDensity: config.botMinDensity ?? 0.200, botMaxDensity: config.botMaxDensity ?? 0.240, botDivisor: config.botDivisor ?? 1680,
        dayShiftStart: config.dayShiftStart ?? 7, nightShiftStart: config.nightShiftStart ?? 19,
        showSettingsBtnIndex: config.showSettingsBtnIndex !== false, 
        showSettingsBtnLevel9Exec: config.showSettingsBtnLevel9Exec !== false, showSettingsBtnBotExec: config.showSettingsBtnBotExec !== false,
      });
    }
  }, [config, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : Number(value) }));
  };

  const handleSave = async () => {
    if (form.level9MinDensity >= form.level9MaxDensity) return setSaveMessage({ text: 'Error: L9 Min must be less than Max', type: 'error' });
    if (form.botMinDensity >= form.botMaxDensity) return setSaveMessage({ text: 'Error: BOT Min must be less than Max', type: 'error' });

    setSaving(true); setSaveMessage({ text: 'Saving...', type: 'saving' });

    try {
      await setDoc(doc(db, 'config', 'settings'), { ...form, updatedAt: serverTimestamp() }, { merge: true });
      setSaveMessage({ text: 'Saved!', type: 'success' });
      setTimeout(() => { setIsOpen(false); setSaveMessage({ text: '', type: '' }); }, 1000);
    } catch (error) {
      console.error(error); setSaveMessage({ text: 'Error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  let shouldShowButton = true;
  if (location.pathname === '/') shouldShowButton = config?.showSettingsBtnIndex !== false;
  else if (location.pathname === '/level9-exec') shouldShowButton = config?.showSettingsBtnLevel9Exec !== false;
  else if (location.pathname === '/bot-exec') shouldShowButton = config?.showSettingsBtnBotExec !== false;

  if (!shouldShowButton) return null;

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="print:hidden fixed bottom-5 left-5 w-12 h-12 rounded-full bg-dark-card border-2 border-primary text-primary text-2xl flex items-center justify-center cursor-pointer z-40 transition-all hover:bg-primary hover:text-black hover:shadow-[0_0_15px_rgba(0,188,212,0.5)]" title="Factory Config">⚙️</button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[99999] animate-[fadeIn_0.2s_ease]" onClick={() => setIsOpen(false)}>
          <div className="bg-gradient-to-br from-dark-card to-[#2d2d2d] p-8 rounded-2xl border-2 border-primary max-w-lg w-[90%] max-h-[85vh] overflow-y-auto custom-scrollbar shadow-[0_0_40px_rgba(0,188,212,0.2)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-primary text-2xl font-bold mb-6 text-center">⚙️ Factory Config</h2>

            <div className="mb-5">
              <h3 className="text-primary text-sm font-bold uppercase tracking-wider mb-3">Level 9 Density</h3>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Min Density:</label><input type="number" name="level9MinDensity" step="0.001" value={form.level9MinDensity} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Max Density:</label><input type="number" name="level9MaxDensity" step="0.001" value={form.level9MaxDensity} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Divisor:</label><input type="number" name="level9Divisor" step="1" value={form.level9Divisor} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>

            <div className="mb-5">
              <h3 className="text-primary text-sm font-bold uppercase tracking-wider mb-3">BOT Density</h3>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Min Density:</label><input type="number" name="botMinDensity" step="0.001" value={form.botMinDensity} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Max Density:</label><input type="number" name="botMaxDensity" step="0.001" value={form.botMaxDensity} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Divisor:</label><input type="number" name="botDivisor" step="1" value={form.botDivisor} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>

            <div className="mb-5">
              <h3 className="text-primary text-sm font-bold uppercase tracking-wider mb-3">Shift Times</h3>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Day Shift Start (hour):</label><input type="number" name="dayShiftStart" min="0" max="23" value={form.dayShiftStart} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Night Shift Start (hour):</label><input type="number" name="nightShiftStart" min="0" max="23" value={form.nightShiftStart} onChange={handleChange} className="w-24 p-2 bg-[#121212] border border-[#444] rounded text-white text-right outline-none focus:border-primary" /></div>
            </div>

            <div className="mb-5">
              <h3 className="text-primary text-sm font-bold uppercase tracking-wider mb-3">UI Settings</h3>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Show on Data Entry:</label><input type="checkbox" name="showSettingsBtnIndex" checked={form.showSettingsBtnIndex} onChange={handleChange} className="w-5 h-5 accent-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Show on Level 9 Exec:</label><input type="checkbox" name="showSettingsBtnLevel9Exec" checked={form.showSettingsBtnLevel9Exec} onChange={handleChange} className="w-5 h-5 accent-primary" /></div>
              <div className="flex justify-between items-center border-b border-[#333] py-2"><label className="text-gray-300 text-sm">Show on BOT Exec:</label><input type="checkbox" name="showSettingsBtnBotExec" checked={form.showSettingsBtnBotExec} onChange={handleChange} className="w-5 h-5 accent-primary" /></div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setIsOpen(false)} className="flex-1 py-3 bg-[#444] text-white rounded-lg font-bold hover:bg-[#555] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-status-success transition-colors disabled:opacity-50">Save</button>
            </div>
            {saveMessage.text && <div className={`text-center mt-4 text-sm font-bold ${saveMessage.type === 'error' ? 'text-status-danger' : 'text-status-success'}`}>{saveMessage.text}</div>}
          </div>
        </div>
      )}
    </>
  );
}