// src/context/ConfigContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const ConfigContext = createContext();

const DEFAULT_CONFIG = {
  level9MinDensity: 0.200, level9MaxDensity: 0.310, level9Divisor: 1580,
  botMinDensity: 0.200, botMaxDensity: 0.240, botDivisor: 1680,
  dayShiftStart: 7, nightShiftStart: 19,
  machineGridColumns: 6,
  packagingTeams: {
    labels: ['A', 'B', 'C'],
    defaultTeam: 'A'
  },
  productionLines: [
    { id: "1A", name: "Line 1A", order: 1 }, { id: "1B", name: "Line 1B", order: 2 },
    { id: "2A", name: "Line 2A", order: 3 }, { id: "2B", name: "Line 2B", order: 4 },
    { id: "3A", name: "Line 3A", order: 5 }, { id: "3B", name: "Line 3B", order: 6 }
  ],
  machines: [
    { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", name: "Machine 1", fillHeads: 2 },
    { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 2", fillHeads: 2 },
    { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", name: "Machine 6", fillHeads: 2 }
  ],
  gramSpecs: {
    "22": { min: 0.200, max: 0.310, piecesPerCarton: 162, piecesBreakdown: "150 pcs + 12 freebies", bagCount: 150, freebieCount: 12 },
    "45": { min: 0.210, max: 0.310, piecesPerCarton: 84, piecesBreakdown: "78 pcs + 6 freebies", bagCount: 78, freebieCount: 6 },
    "85": { min: 0.240, max: 0.300, piecesPerCarton: 52, piecesBreakdown: "48 pcs + 4 freebies", bagCount: 48, freebieCount: 4 },
    "125": { min: 0.200, max: 0.270, piecesPerCarton: 31, piecesBreakdown: "28 pcs + 3 freebies", bagCount: 28, freebieCount: 3 },
    "850": { min: 0.200, max: 0.270, piecesPerCarton: 7, piecesBreakdown: "6 pouches + 1 freebie", bagCount: 6, freebieCount: 1 }
  },
  // 🎯 Carton Waste Tracking Config
  cartonWaste: {
    targetWastePercent: 5,
    wasteAlertThreshold: 10
  },
  // 🎯 Laminate Waste Tracking Config
  laminateWaste: {
    targetWastePercent: 5,
    wasteAlertThreshold: 10,
    rollsPerShift: 3,
    rollWeights: {
      "22": 51.32,
      "45": 54.40,
      "85": 51.60,
      "125": 53.70,
      "850": 49.90
    },
    sacTypes: [
      { id: 'small', label: 'Small Sac', weight: 0.080 },
      { id: 'large', label: 'Large Sac', weight: 0.160 }
    ],
    defaultSacType: 'small'
  },
  qcCheckIntervals: {
    stringWeight: 15,
    bagInspection: 15,
    cartonInspection: 60
  },
  fillHeadWeightRanges: {
    "22":  { tooLow: { max: 128 }, low: { min: 129, max: 136 }, target: { min: 137, max: 141 }, high: { min: 142, max: 149 }, tooHigh: { min: 150 } },
    "45":  { tooLow: { max: 259 }, low: { min: 260, max: 272 }, target: { min: 273, max: 282 }, high: { min: 283, max: 290 }, tooHigh: { min: 291 } },
    "85":  { tooLow: { max: 487 }, low: { min: 488, max: 516 }, target: { min: 517, max: 536 }, high: { min: 537, max: 564 }, tooHigh: { min: 565 } },
    "125": { tooLow: { max: 487 }, low: { min: 488, max: 506 }, target: { min: 507, max: 517 }, high: { min: 518, max: 538 }, tooHigh: { min: 539 } },
    "850": { tooLow: { max: 861 }, low: { min: 862, max: 870 }, target: { min: 871, max: 900 }, high: { min: 901, max: 980 }, tooHigh: { min: 981 } }
  },
  departmentRoles: [
    { id: 'qc_staff', label: 'QC Staff', category: 'Quality Control' },
    { id: 'qc_manager', label: 'QC Manager', category: 'Quality Control' },
    { id: 'prod_staff', label: 'Production Staff', category: 'Production' },
    { id: 'prod_manager', label: 'Production Manager', category: 'Production' },
    { id: 'hr_staff', label: 'HR Staff', category: 'Human Resources' },
    { id: 'hr_manager', label: 'HR Manager', category: 'Human Resources' }
  ],
  actionRoles: [
    { id: 'buggy_supervisor', label: '🔧 Buggy Supervisor' },
    { id: 'plc_operator', label: '⚡ PLC Operator' },
    { id: 'production_manager', label: '🏭 Production Manager' },
    { id: 'qc_manager', label: '✅ QC Manager' },
    { id: 'qc_supervisor', label: '🔍 QC Supervisor' },
    { id: 'line_leader', label: '👷 Line Leader' }
  ]
};

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const configRef = doc(db, 'config', 'settings');
    const unsubscribe = onSnapshot(configRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setConfig({ 
          ...DEFAULT_CONFIG, 
          ...data,
          packagingTeams: { ...DEFAULT_CONFIG.packagingTeams, ...(data.packagingTeams || {}) },
          cartonWaste: { ...DEFAULT_CONFIG.cartonWaste, ...(data.cartonWaste || {}), teams: undefined, defaultTeam: undefined },
          laminateWaste: { ...DEFAULT_CONFIG.laminateWaste, ...(data.laminateWaste || {}), teams: undefined, defaultTeam: undefined },
          machines: (data.machines || DEFAULT_CONFIG.machines).map(m => ({ fillHeads: 2, ...m })),
          productionLines: data.productionLines || DEFAULT_CONFIG.productionLines,
          gramSpecs: Object.fromEntries(
            Object.entries(data.gramSpecs || DEFAULT_CONFIG.gramSpecs).map(([gram, spec]) => [
              gram, { ...(DEFAULT_CONFIG.gramSpecs[gram] || {}), ...spec }
            ])
          ),
          fillHeadWeightRanges: { ...DEFAULT_CONFIG.fillHeadWeightRanges, ...(data.fillHeadWeightRanges || {}) },
          departmentRoles: data.departmentRoles || DEFAULT_CONFIG.departmentRoles,
          actionRoles: data.actionRoles
            ? (() => {
                const existingIds = new Set((data.actionRoles || []).map(r => r.id));
                const missing = DEFAULT_CONFIG.actionRoles.filter(r => !existingIds.has(r.id));
                return [...data.actionRoles, ...missing];
              })()
            : DEFAULT_CONFIG.actionRoles
        });
      } else {
        try {
          await setDoc(configRef, { ...DEFAULT_CONFIG, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        } catch (err) { console.error(err); }
      }
      setLoadingConfig(false);
    }, (error) => {
      console.error("Error listening to config:", error);
      setLoadingConfig(false);
    });
    return unsubscribe;
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loadingConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);