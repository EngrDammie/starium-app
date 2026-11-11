// src/services/inventoryOperations.js
//
// Master data operations: Items, Warehouses, Bins, Vendors
// All writes go through Firestore with serverTimestamp for auditability.

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection,
  query, where, onSnapshot, orderBy, limit as firestoreLimit, serverTimestamp,
  getDocs, writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── COLLECTION REFERENCES ───────────────────────────────────────────

const ITEMS_COLLECTION = collection(db, 'items');
const WAREHOUSES_COLLECTION = collection(db, 'warehouses');
const BINS_COLLECTION = collection(db, 'bins');
const VENDORS_COLLECTION = collection(db, 'vendors');

// ─── ITEMS ───────────────────────────────────────────────────────────

export async function createItem(itemData) {
  const id = itemData.code || itemData.name.toUpperCase().replace(/\s+/g, '_');
  const ref = doc(db, 'items', id);
  await setDoc(ref, {
    ...itemData,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

export async function updateItem(id, updates) {
  await updateDoc(doc(db, 'items', id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteItem(id) {
  await deleteDoc(doc(db, 'items', id));
}

export async function getItem(id) {
  const snap = await getDoc(doc(db, 'items', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToItems(callback) {
  const q = query(ITEMS_COLLECTION, orderBy('name'));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('items subscription error:', err);
    callback([]);
  });
}

export async function getAllItems() {
  const q = query(ITEMS_COLLECTION, orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── WAREHOUSES ──────────────────────────────────────────────────────

export async function createWarehouse(warehouseData) {
  const id = warehouseData.code || warehouseData.name.toUpperCase().replace(/\s+/g, '_');
  const ref = doc(db, 'warehouses', id);
  await setDoc(ref, {
    ...warehouseData,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

export async function updateWarehouse(id, updates) {
  await updateDoc(doc(db, 'warehouses', id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteWarehouse(id) {
  await deleteDoc(doc(db, 'warehouses', id));
}

export async function getWarehouse(id) {
  const snap = await getDoc(doc(db, 'warehouses', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToWarehouses(callback) {
  const q = query(WAREHOUSES_COLLECTION, orderBy('name'));
  return onSnapshot(q, (snap) => {
    const warehouses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(warehouses);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('warehouses subscription error:', err);
    callback([]);
  });
}

export async function getAllWarehouses() {
  const q = query(WAREHOUSES_COLLECTION, orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getWarehousesByType(type) {
  const q = query(
    WAREHOUSES_COLLECTION,
    where('type', '==', type),
    orderBy('name')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── BINS ────────────────────────────────────────────────────────────

export async function createBin(binData) {
  const id = binData.fullAddress || `${binData.warehouseId}-${binData.zone}-${binData.aisle}-${binData.rack}-${binData.shelf}`;
  const ref = doc(db, 'bins', id);
  await setDoc(ref, {
    ...binData,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

export async function updateBin(id, updates) {
  await updateDoc(doc(db, 'bins', id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteBin(id) {
  await deleteDoc(doc(db, 'bins', id));
}

export async function getBin(id) {
  const snap = await getDoc(doc(db, 'bins', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToBins(callback, warehouseId = null) {
  let q;
  if (warehouseId) {
    q = query(BINS_COLLECTION, where('warehouseId', '==', warehouseId), orderBy('fullAddress'));
  } else {
    q = query(BINS_COLLECTION, orderBy('warehouseId'), orderBy('fullAddress'));
  }
  return onSnapshot(q, (snap) => {
    const bins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(bins);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('bins subscription error:', err);
    callback([]);
  });
}

export async function getAllBins() {
  const q = query(BINS_COLLECTION, orderBy('warehouseId'), orderBy('fullAddress'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getBinsForWarehouse(warehouseId) {
  const q = query(
    BINS_COLLECTION,
    where('warehouseId', '==', warehouseId),
    orderBy('fullAddress')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Auto-generate bins for a warehouse (grid: zones × aisles × racks × shelves)
export function generateBinGrid(warehouseId, zones = ['A', 'B', 'C'], aisles = ['01', '02', '03', '04', '05'], racks = [1, 2, 3, 4, 5], shelves = [1, 2, 3, 4], capacityKg = 5000) {
  const bins = [];
  for (const zone of zones) {
    for (const aisle of aisles) {
      for (const rack of racks) {
        for (const shelf of shelves) {
          const fullAddress = `${warehouseId}-${zone}-${String(aisle).padStart(2, '0')}-${rack}-${shelf}`;
          bins.push({
            warehouseId,
            zone,
            aisle: String(aisle).padStart(2, '0'),
            rack,
            shelf,
            fullAddress,
            capacityKg,
            currentItemId: null,
            currentLotId: null,
            currentQty: 0,
            status: 'AVAILABLE'
          });
        }
      }
    }
  }
  return bins;
}

export async function createBinsForWarehouse(warehouseId, bins) {
  const batch = writeBatch(db);
  for (const bin of bins) {
    const ref = doc(db, 'bins', bin.fullAddress);
    batch.set(ref, { ...bin, id: bin.fullAddress, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  return bins.length;
}

// ─── VENDORS ─────────────────────────────────────────────────────────

export async function createVendor(vendorData) {
  const id = vendorData.code || vendorData.name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
  const ref = doc(db, 'vendors', id);
  await setDoc(ref, {
    ...vendorData,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

export async function updateVendor(id, updates) {
  await updateDoc(doc(db, 'vendors', id), {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteVendor(id) {
  await deleteDoc(doc(db, 'vendors', id));
}

export async function getVendor(id) {
  const snap = await getDoc(doc(db, 'vendors', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeToVendors(callback) {
  const q = query(VENDORS_COLLECTION, orderBy('name'));
  return onSnapshot(q, (snap) => {
    const vendors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(vendors);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('vendors subscription error:', err);
    callback([]);
  });
}

export async function getAllVendors() {
  const q = query(VENDORS_COLLECTION, orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── PRE-SEED MASTER DATA ────────────────────────────────────────────

export const DEFAULT_ITEMS = [
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

export const DEFAULT_WAREHOUSES = [
  { code: 'RM-WH', name: 'Raw Material Warehouse', type: 'RAW_MATERIAL', zones: ['A', 'B', 'C'], isActive: true },
  { code: 'PF-L9', name: 'Production Floor - Level 9', type: 'PRODUCTION_FLOOR', zones: ['A'], isActive: true },
  { code: 'PF-L8', name: 'Production Floor - Level 8', type: 'PRODUCTION_FLOOR', zones: ['A'], isActive: true },
  { code: 'FG-WH', name: 'Finished Goods Warehouse', type: 'FINISHED_GOODS', zones: ['A', 'B'], isActive: true },
  { code: 'OFF-ST', name: 'Office Store', type: 'OFFICE_STORE', zones: ['A'], isActive: true },
];

export const DEFAULT_VENDORS = [
  { name: 'ChemSol Nigeria Ltd', contactPerson: 'Mr. Adebayo', email: 'sales@chemsol.ng', phone: '+234-800-123-4567', address: 'Plot 45, Industrial Estate, Ota', paymentTerms: 'Net 30', taxId: 'NG-12345678-0001', isActive: true },
  { name: 'InduChem Supplies', contactPerson: 'Mrs. Okafor', email: 'orders@induchem.ng', phone: '+234-800-234-5678', address: 'Plot 12, Agbara Industrial Estate', paymentTerms: 'Net 30', taxId: 'NG-23456789-0002', isActive: true },
  { name: 'West African Chemicals', contactPerson: 'Mr. Ibrahim', email: 'procurement@wac.ng', phone: '+234-800-345-6789', address: 'Plot 88, Ikeja Industrial Layout', paymentTerms: 'Net 45', taxId: 'NG-34567890-0003', isActive: true },
];

export async function seedMasterData() {
  // Seed items
  for (const item of DEFAULT_ITEMS) {
    try {
      await createItem(item);
    } catch (e) {
      // Ignore if already exists
    }
  }
  // Seed warehouses
  for (const wh of DEFAULT_WAREHOUSES) {
    try {
      await createWarehouse(wh);
    } catch (e) {
      // Ignore if already exists
    }
  }
  // Seed bins for each warehouse
  for (const wh of DEFAULT_WAREHOUSES) {
    try {
      const bins = generateBinGrid(wh.code);
      await createBinsForWarehouse(wh.code, bins);
    } catch (e) {
      // Ignore if bins already exist
    }
  }
  // Seed vendors
  for (const vendor of DEFAULT_VENDORS) {
    try {
      await createVendor(vendor);
    } catch (e) {
      // Ignore if already exists
    }
  }
  return { items: DEFAULT_ITEMS.length, warehouses: DEFAULT_WAREHOUSES.length, vendors: DEFAULT_VENDORS.length };
}
