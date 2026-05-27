// src/context/ConfigContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const ConfigContext = createContext();

// The safety net, exactly as it appears in your vanilla firebase-storage.js
const DEFAULT_CONFIG = {
  level9MinDensity: 0.200,
  level9MaxDensity: 0.310,
  botMinDensity: 0.200,
  botMaxDensity: 0.240,
  level9Divisor: 1580,
  botDivisor: 1680,
  dayShiftStart: 7,
  nightShiftStart: 19,
  machineGridColumns: 6,
  productionLines: [
    { id: "1A", name: "Line 1A", order: 1 },
    { id: "1B", name: "Line 1B", order: 2 },
    { id: "2A", name: "Line 2A", order: 3 },
    { id: "2B", name: "Line 2B", order: 4 },
    { id: "3A", name: "Line 3A", order: 5 },
    { id: "3B", name: "Line 3B", order: 6 }
  ],
  machines: [
    { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", name: "Machine 1" },
    { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 2" },
    { id: 3, displayNumber: 3, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 3" },
    { id: 4, displayNumber: 4, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 4" },
    { id: 5, displayNumber: 5, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 5" },
    { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", name: "Machine 6" },
    { id: 7, displayNumber: 7, gram: 85, min: 0.240, max: 0.300, line: "1B", name: "Machine 7" },
    { id: 8, displayNumber: 8, gram: 850, min: 0.200, max: 0.270, line: "1B", name: "Machine 8" },
    { id: 9, displayNumber: 9, gram: 85, min: 0.240, max: 0.300, line: "1B", name: "Machine 9" },
    { id: 10, displayNumber: 10, gram: 22, min: 0.200, max: 0.310, line: "1B", name: "Machine 10" },
    { id: 11, displayNumber: 11, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 11" },
    { id: 12, displayNumber: 12, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 12" },
    { id: 13, displayNumber: 13, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 13" },
    { id: 14, displayNumber: 14, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 14" },
    { id: 15, displayNumber: 15, gram: 85, min: 0.240, max: 0.300, line: "2A", name: "Machine 15" },
    { id: 16, displayNumber: 16, gram: 850, min: 0.200, max: 0.270, line: "2B", name: "Machine 16" },
    { id: 17, displayNumber: 17, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 17" },
    { id: 18, displayNumber: 18, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 18" },
    { id: 19, displayNumber: 19, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 19" },
    { id: 20, displayNumber: 20, gram: 85, min: 0.240, max: 0.300, line: "2B", name: "Machine 20" },
    { id: 21, displayNumber: 21, gram: 850, min: 0.200, max: 0.270, line: "3A", name: "Machine 21" },
    { id: 22, displayNumber: 22, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 22" },
    { id: 23, displayNumber: 23, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 23" },
    { id: 24, displayNumber: 24, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 24" },
    { id: 25, displayNumber: 25, gram: 45, min: 0.210, max: 0.310, line: "3A", name: "Machine 25" },
    { id: 26, displayNumber: 26, gram: 850, min: 0.200, max: 0.270, line: "3B", name: "Machine 26" },
    { id: 27, displayNumber: 27, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 27" },
    { id: 28, displayNumber: 28, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 28" },
    { id: 29, displayNumber: 29, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 29" },
    { id: 30, displayNumber: 30, gram: 45, min: 0.210, max: 0.310, line: "3B", name: "Machine 30" }
  ],
  gramSpecs: {
    "22": { min: 0.200, max: 0.310, piecesPerCarton: 162 },
    "45": { min: 0.210, max: 0.310, piecesPerCarton: 84 },
    "85": { min: 0.240, max: 0.300, piecesPerCarton: 52 },
    "125": { min: 0.200, max: 0.270, piecesPerCarton: 31 },
    "850": { min: 0.200, max: 0.270, piecesPerCarton: 7 }
  }
};

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const configRef = doc(db, 'config', 'settings');
    
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const dbData = docSnap.data();
        
        // This is exactly how your vanilla app merges data
        const mergedConfig = { ...DEFAULT_CONFIG, ...dbData };
        
        console.log("🔥 FIREBASE FETCHED CONFIG:", mergedConfig);
        console.log("🏭 Machines count:", mergedConfig.machines?.length);
        
        setConfig(mergedConfig);
      } else {
        console.warn("No config found in Firestore. Using Default.");
        setConfig(DEFAULT_CONFIG);
      }
      setLoadingConfig(false);
    }, (error) => {
      console.error("Error listening to config:", error);
      setConfig(DEFAULT_CONFIG);
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