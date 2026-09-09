// src/pages/SystemConfig/tabs.js
//
// Tab registry for the System Config admin panel. Adding a tab = add one
// entry here + one branch in SystemConfig.jsx + one component file.

export const SYSTEM_TABS = [
  { id: 'machines', label: '🏭 Machines' },
  { id: 'lines', label: '📋 Lines' },
  { id: 'gramspecs', label: '⚖️ Gram Specs' },
  { id: 'roles', label: '🏢 Role Definitions' },
  { id: 'settings', label: '⚙️ Global Settings' },
  { id: 'qc', label: '🔬 QC Settings' },
  { id: 'cartonwaste', label: '📦 Carton Waste' },
  { id: 'laminatewaste', label: '🗑️ Laminate Waste' },
  { id: 'palletransfer', label: '📦 Pallet Transfer' },
  { id: 'importexport', label: '💾 Import / Export' },
];
