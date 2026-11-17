import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_ITEMS = [
  { code: 'LABSA', name: 'Linear Alkylbenzene Sulfonic Acid', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 5000, maxStockLevel: 50000, standardCost: 850, isTrackedByLot: true, expiryTracking: true },
  { code: 'SLES', name: 'Sodium Laureth Sulfate', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 3000, maxStockLevel: 30000, standardCost: 920, isTrackedByLot: true, expiryTracking: true },
  { code: 'SODA_ASH', name: 'Soda Ash', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 10000, maxStockLevel: 100000, standardCost: 180, isTrackedByLot: true, expiryTracking: false },
  { code: 'ZEOLITE', name: 'Zeolite', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 5000, maxStockLevel: 50000, standardCost: 220, isTrackedByLot: true, expiryTracking: false },
  { code: 'ENZYME', name: 'Enzyme', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 100, maxStockLevel: 5000, standardCost: 12000, isTrackedByLot: true, expiryTracking: true },
  { code: 'FRAGRANCE', name: 'Fragrance', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 50, maxStockLevel: 2000, standardCost: 8500, isTrackedByLot: true, expiryTracking: true },
  { code: 'COLOUR', name: 'Colour', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 10, maxStockLevel: 500, standardCost: 15000, isTrackedByLot: true, expiryTracking: true },
  { code: 'FILLER', name: 'Filler (Sodium Sulphate)', category: 'RAW_MATERIAL', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 10000, maxStockLevel: 100000, standardCost: 45, isTrackedByLot: true, expiryTracking: false },
  { code: 'SACHET_FILM', name: 'Sachet Film', category: 'PACKAGING', unitOfMeasure: 'kg', defaultWarehouse: 'RM-WH', minStockLevel: 2000, maxStockLevel: 20000, standardCost: 1200, isTrackedByLot: true, expiryTracking: false },
  { code: 'CARTONS', name: 'Cartons', category: 'PACKAGING', unitOfMeasure: 'pc', defaultWarehouse: 'FG-WH', minStockLevel: 1000, maxStockLevel: 50000, standardCost: 480, isTrackedByLot: false, expiryTracking: false },
  { code: 'TAPE', name: 'Packing Tape', category: 'PACKAGING', unitOfMeasure: 'roll', defaultWarehouse: 'FG-WH', minStockLevel: 100, maxStockLevel: 5000, standardCost: 850, isTrackedByLot: false, expiryTracking: false },
  { code: 'GLOVES', name: 'Gloves', category: 'CONSUMABLE', unitOfMeasure: 'pc', defaultWarehouse: 'OFF-ST', minStockLevel: 500, maxStockLevel: 10000, standardCost: 50, isTrackedByLot: false, expiryTracking: false },
  { code: 'HAIRNETS', name: 'Hairnets', category: 'CONSUMABLE', unitOfMeasure: 'pc', defaultWarehouse: 'OFF-ST', minStockLevel: 500, maxStockLevel: 10000, standardCost: 25, isTrackedByLot: false, expiryTracking: false },
  { code: 'PAPER', name: 'Office Paper', category: 'OFFICE_SUPPLY', unitOfMeasure: 'ream', defaultWarehouse: 'OFF-ST', minStockLevel: 50, maxStockLevel: 2000, standardCost: 2500, isTrackedByLot: false, expiryTracking: false },
  { code: 'TONER', name: 'Toner Cartridge', category: 'OFFICE_SUPPLY', unitOfMeasure: 'pc', defaultWarehouse: 'OFF-ST', minStockLevel: 10, maxStockLevel: 100, standardCost: 15000, isTrackedByLot: false, expiryTracking: false },
];

const DEFAULT_WAREHOUSES = [
  { code: 'RM-WH', name: 'Raw Material Warehouse', type: 'RAW_MATERIAL', zones: ['A', 'B', 'C'], isActive: true },
  { code: 'PF-L9', name: 'Production Floor - Level 9', type: 'PRODUCTION_FLOOR', zones: ['A'], isActive: true },
  { code: 'PF-L8', name: 'Production Floor - Level 8', type: 'PRODUCTION_FLOOR', zones: ['A'], isActive: true },
  { code: 'FG-WH', name: 'Finished Goods Warehouse', type: 'FINISHED_GOODS', zones: ['A', 'B'], isActive: true },
  { code: 'OFF-ST', name: 'Office Store', type: 'OFFICE_STORE', zones: ['A'], isActive: true },
];

const DEFAULT_VENDORS = [
  { name: 'ChemSol Nigeria Ltd', contactPerson: 'Mr. Adebayo', email: 'sales@chemsol.ng', phone: '+234-800-123-4567', address: 'Plot 45, Industrial Estate, Ota', paymentTerms: 'Net 30', taxId: 'NG-12345678-0001', isActive: true },
  { name: 'InduChem Supplies', contactPerson: 'Mrs. Okafor', email: 'orders@induchem.ng', phone: '+234-800-234-5678', address: 'Plot 12, Agbara Industrial Estate', paymentTerms: 'Net 30', taxId: 'NG-23456789-0002', isActive: true },
  { name: 'West African Chemicals', contactPerson: 'Mr. Ibrahim', email: 'procurement@wac.ng', phone: '+234-800-345-6789', address: 'Plot 88, Ikeja Industrial Layout', paymentTerms: 'Net 45', taxId: 'NG-34567890-0003', isActive: true },
];

function generateBinGrid(warehouseId) {
  const bins = [];
  for (const zone of ['A', 'B', 'C']) {
    for (const aisle of ['01', '02', '03', '04', '05']) {
      for (const rack of [1, 2, 3, 4, 5]) {
        for (const shelf of [1, 2, 3, 4]) {
          const fullAddress = `${warehouseId}-${zone}-${aisle}-${rack}-${shelf}`;
          bins.push({ warehouseId, zone, aisle, rack, shelf, fullAddress, capacityKg: 5000, currentItemId: null, currentLotId: null, currentQty: 0, status: 'AVAILABLE' });
        }
      }
    }
  }
  return bins;
}

async function seed() {
  console.log('🌱 Seeding master data...');
  
  for (const item of DEFAULT_ITEMS) {
    await setDoc(doc(db, 'items', item.code), { ...item, id: item.code, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  console.log('✅ Items seeded');
  
  for (const wh of DEFAULT_WAREHOUSES) {
    await setDoc(doc(db, 'warehouses', wh.code), { ...wh, id: wh.code, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  console.log('✅ Warehouses seeded');
  
  for (const wh of DEFAULT_WAREHOUSES) {
    const bins = generateBinGrid(wh.code);
    const batch = writeBatch(db);
    for (const bin of bins) {
      batch.set(doc(db, 'bins', bin.fullAddress), { ...bin, id: bin.fullAddress, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
  console.log('✅ Bins seeded (300 per warehouse)');
  
  for (const v of DEFAULT_VENDORS) {
    const id = v.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    await setDoc(doc(db, 'vendors', id), { ...v, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  console.log('✅ Vendors seeded');
  
  console.log('🎉 All master data seeded successfully!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
