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
  productionLines: [
    { id: "1A", name: "Line 1A", order: 1 }, { id: "1B", name: "Line 1B", order: 2 },
    { id: "2A", name: "Line 2A", order: 3 }, { id: "2B", name: "Line 2B", order: 4 },
    { id: "3A", name: "Line 3A", order: 5 }, { id: "3B", name: "Line 3B", order: 6 }
  ],
  machines: [
    { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", name: "Machine 1" },
    { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 2" },
    { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", name: "Machine 6" }
  ],
  gramSpecs: {
    "22": { min: 0.200, max: 0.310, piecesPerCarton: 162 },
    "45": { min: 0.210, max: 0.310, piecesPerCarton: 84 },
    "85": { min: 0.240, max: 0.300, piecesPerCarton: 52 },
    "125": { min: 0.200, max: 0.270, piecesPerCarton: 31 },
    "850": { min: 0.200, max: 0.270, piecesPerCarton: 7 }
  },
  // 🎯 NEW: Dynamic roles lists pushed to database
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
    { id: 'qc_supervisor', label: '🔍 QC Supervisor' }
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
          machines: data.machines || DEFAULT_CONFIG.machines,
          productionLines: data.productionLines || DEFAULT_CONFIG.productionLines,
          gramSpecs: data.gramSpecs || DEFAULT_CONFIG.gramSpecs,
          departmentRoles: data.departmentRoles || DEFAULT_CONFIG.departmentRoles,
          actionRoles: data.actionRoles || DEFAULT_CONFIG.actionRoles
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