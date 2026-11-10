# Starium Rafa ERP — Phase 1 Implementation Plan
## Purchase Orders, Goods Receipt, Stock Transfers, BOMs, Production Planning & Variance

**Date:** November 10, 2026  
**Author:** Engr. Damilare Paul Ayodele (Dammie Optimus Solutions)  
**Status:** Implementation Plan for Plant Manager Review  
**Version:** 1.0

---

## 📋 Table of Contents

1. [The Five-Year-Old Summary](#five-year-old)
2. [What We're Building — The Complete Journey](#journey)
3. [Key Terms Explained Simply](#terms)
4. [Data Model — What Lives in Firestore](#data-model)
5. [Implementation Phases — Step by Step](#phases)
6. [Roles & Permissions](#roles)
7. [Integration with Existing Code](#integration)
8. [Questions for the Plant Manager](#questions)
9. [What "Done" Looks Like](#done)

---

## 1. The Five-Year-Old Summary {#five-year-old}

> **Imagine a magic notebook that tracks everything coming in and going out of your factory.**

**What goes IN (from vendors):**
- You tell the notebook: "I ordered 5,000 kg LABSA from ChemSol"
- Three managers approve it (Procurement → Finance → Plant Manager)
- Truck arrives → Warehouse clerk counts: "Actually got 4,980 kg"
- Notebook updates: **Raw Material Stock = 4,980 kg LABSA added**

**What moves INSIDE (to production):**
- You tell the notebook: "Move 200 kg LABSA to Level 9"
- Warehouse clerk scans, confirms
- Notebook updates: **Warehouse −200 kg, Level 9 +200 kg**

**Recipes (BOMs):**
- You write: "Premium Detergent = 120 kg LABSA + 80 kg SLES + 300 kg Soda Ash..."
- Notebook saves it with version number
- Only Recipe Manager can change it

**Planning vs Actual:**
- You say: "I want to make 10 batches → need 1,200 kg LABSA planned"
- Production runs → Clerk enters: "Actually used 1,250 kg LABSA"
- Notebook shows: **Variance = +50 kg (2.5% over)**

**Finished Goods:**
- You say: "10 batches = 10,000 kg powder → 300,000 sachets → 2,000 cartons"
- Packing team enters: "Actually made 2,100 cartons"
- Notebook shows: **Variance = +100 cartons (5% over)**

**The magic: Every number is calculated, never guessed. No spreadsheets. No errors.**

---

## 2. What We're Building — The Complete Journey {#journey}

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        THE FACTORY FLOW (LEFT TO RIGHT)                         │
└─────────────────────────────────────────────────────────────────────────────────┘

VENDOR                          YOUR COMPANY
────────────────────────────────────────────────────────────────────────────────────

[1. PURCHASE ORDER]              Procurement creates PO
    "Send 5,000 kg LABSA"   ──►   3-Step Approval:
                                   • Procurement Head ✓
                                   • Finance Manager ✓
                                   • Plant Manager ✓
                                   = APPROVED PO

[2. GOODS RECEIPT (GRN)]        Warehouse receives
    Truck arrives with          Clerk counts, records:
    5,000 kg LABSA          ──►   "Received 4,980 kg (20 kg short)"
                                   Lot #: L-2026-11-10-001
                                   Bin: RM-WH-A-03-2-1
                                   → STOCK UPDATED: +4,980 kg

[3. STOCK TRANSFER]            Move to production
    "Need 200 kg for           Warehouse clerk:
    Level 9"              ──►   Issues 200 kg LABSA
                                   Lot: L-2026-11-10-001
                                   To: Level 9 (Production Floor)
                                   → WAREHOUSE: −200 kg
                                   → LEVEL 9: +200 kg

[4. BOM / RECIPE]              Standard recipe saved
    "Premium Detergent:        Version 1.0:
    1 batch = 1,151 kg in   ──►   LABSA: 120 kg
    1,000 kg powder out"        SLES: 80 kg
                                   Soda Ash: 300 kg
                                   ... = 1,151 kg total
                                   Yield: 86.9% (1,000 kg out)

[5. PRODUCTION PLANNING]       Plan a run
    "Make 10 batches"      ──►   PLANNED:
                                   LABSA: 1,200 kg
                                   SLES: 800 kg
                                   Soda Ash: 3,000 kg
                                   Powder OUT: 10,000 kg

[6. ACTUAL PRODUCTION]         Record reality
    "Used 1,250 kg LABSA"  ──►   ACTUAL:
                                   LABSA: 1,250 kg
                                   SLES: 820 kg
                                   Soda Ash: 3,050 kg
                                   Powder OUT: 9,950 kg

[7. VARIANCE]                  Compare
    PLAN vs ACTUAL        ──►   LABSA: +50 kg (+4.2%) ⚠️
                                   SLES: +20 kg (+2.5%)
                                   Soda Ash: +50 kg (+1.7%)
                                   Powder: −50 kg (−0.5%)

[8. PACKING PLAN]              Powder → Sachets → Cartons
    "10,000 kg powder"     ──►   Packing Plan (Plant Manager sets):
                                   25% 22g  → 113M sachets → 700K cartons
                                   40% 85g  → 47M sachets  → 900K cartons
                                   35% 850g → 4M sachets   → 570K cartons

[9. ACTUAL PACKING]            Record reality
    "Made 2.1M cartons"   ──►   ACTUAL cartons per SKU
                                   Variance per SKU
                                   Total variance

[10. PROFIT]                    The bottom line
    Revenue − Cost       ──►   Profit, Margin, Profit per ₦1 Raw Material
```

---

## 3. Key Terms Explained Simply {#terms}

| Term | Simple Meaning | In Our App |
|------|---------------|------------|
| **PO (Purchase Order)** | "Dear Vendor, please send us this" | Digital document with items, qty, prices, approval chain |
| **GRN (Goods Received Note)** | "We got this, here's what actually arrived" | Warehouse clerk records actual qty, lot #, bin location |
| **3-Way Match** | PO + GRN + Invoice must agree before paying | System flags if PO says 5,000 but GRN says 4,980 |
| **Bin** | Exact shelf address (like a parking spot) | `RM-WH-A-03-2-1` = Raw Mat Warehouse, Zone A, Aisle 3, Rack 2, Shelf 1 |
| **Lot / Lot Number** | Family ID for material made/bought together | `L-2026-11-10-001` → trace from vendor to customer |
| **Lot Tracking** | Following every move of every lot | GRN → Bin → Transfer → Production → Finished Goods |
| **BOM (Bill of Materials)** | The recipe — what goes in, how much | `Premium v1: LABSA 120kg, SLES 80kg, Soda Ash 300kg...` |
| **Batch** | One cooking session of that recipe | `Batch B-2026-11-10-003` used Lot #L-2026-11-10-001 |
| **Yield %** | Output ÷ Input (accounts for loss) | 1,000 kg powder ÷ 1,151 kg input = 86.9% |
| **Stock Transfer / Issue** | Move material from warehouse to production | Decreases warehouse stock, increases production floor stock |
| **Planned Qty** | What the recipe says you'll need | 10 batches × 120 kg LABSA = 1,200 kg planned |
| **Actual Qty** | What you really used | Clerk enters: "We used 1,250 kg" |
| **Variance** | Actual − Planned (can be + or −) | +50 kg = used more than planned |
| **Packing Plan** | % split of powder across 7 SKU sizes | 25% 22g, 40% 85g, 35% 850g = 100% |
| **SKU** | Stock Keeping Unit = one sachet size | 22g, 40g, 45g, 85g, 125g, 170g, 850g |

---

## 4. Data Model — What Lives in Firestore {#data-model}

All new collections. **Zero changes to existing data.**

### 4.1 `vendors` (collection — one doc per vendor)
```javascript
vendors/{vendorId}: {
  name: "ChemSol Nigeria Ltd",
  contactPerson: "Mr. Adebayo",
  email: "sales@chemsol.ng",
  phone: "+234-800-123-4567",
  address: "Plot 45, Industrial Estate, Ota",
  paymentTerms: "Net 30",
  taxId: "NG-12345678-0001",
  isActive: true,
  createdAt: timestamp,
  createdBy: "procurement@starium.com"
}
```

### 4.2 `items` (collection — one doc per item type)
```javascript
items/{itemId}: {
  code: "LABSA",                    // Short code for forms
  name: "Linear Alkylbenzene Sulfonic Acid",
  category: "RAW_MATERIAL",         // RAW_MATERIAL | OFFICE_SUPPLY | CONSUMABLE | PACKAGING | FINISHED_GOOD
  unitOfMeasure: "kg",              // kg, litre, pc, m, roll
  defaultWarehouse: "RM-WH",        // Where it's stored by default
  minStockLevel: 5000,              // Reorder point (kg)
  maxStockLevel: 50000,             // Max capacity (kg)
  standardCost: 850,                // ₦/kg for planning
  isTrackedByLot: true,             // true for raw materials, false for office supplies
  expiryTracking: true,             // Does it expire?
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**Categories:**
| Category | Examples | Lot Tracking | Expiry |
|----------|----------|--------------|--------|
| RAW_MATERIAL | LABSA, SLES, Soda Ash, Zeolite | ✅ Yes | ✅ Yes |
| PACKAGING | Sachet film, cartons, tape | ✅ Yes | ❌ No |
| CONSUMABLE | Gloves, hairnets, cleaning chemicals | ❌ No | ❌ No |
| OFFICE_SUPPLY | Paper, pens, toner | ❌ No | ❌ No |
| FINISHED_GOOD | 22g sachets, 85g sachets | ✅ Yes | ✅ Yes |

### 4.3 `warehouses` (collection — locations where stock lives)
```javascript
warehouses/{warehouseId}: {
  code: "RM-WH",
  name: "Raw Material Warehouse",
  type: "RAW_MATERIAL",              // RAW_MATERIAL | PRODUCTION_FLOOR | FINISHED_GOODS | OFFICE_STORE
  zones: ["A", "B", "C"],            // For bin addressing
  isActive: true,
  managerId: "warehouse.mgr@starium.com"
}
```

**Pre-seeded warehouses:**
| Code | Name | Type |
|------|------|------|
| RM-WH | Raw Material Warehouse | RAW_MATERIAL |
| PF-L9 | Production Floor - Level 9 | PRODUCTION_FLOOR |
| PF-L8 | Production Floor - Level 8 | PRODUCTION_FLOOR |
| FG-WH | Finished Goods Warehouse | FINISHED_GOODS |
| OFF-ST | Office Store | OFFICE_STORE |

### 4.4 `bins` (collection — exact shelf addresses)
```javascript
bins/{binId}: {
  warehouseId: "RM-WH",
  zone: "A",
  aisle: "03",
  rack: "2",
  shelf: "1",
  fullAddress: "RM-WH-A-03-2-1",
  capacityKg: 5000,
  currentItemId: "LABSA",           // null if empty
  currentLotId: "L-2026-11-10-001", // null if empty
  currentQty: 4980,                 // kg
  status: "AVAILABLE",              // AVAILABLE | RESERVED | QUARANTINE | DAMAGED
  updatedAt: timestamp
}
```

### 4.5 `stock_ledger` (collection — IMMUTABLE record of every stock movement)
```javascript
stock_ledger/{entryId}: {
  // The single source of truth for ALL stock changes
  itemId: "LABSA",
  lotId: "L-2026-11-10-001",
  fromWarehouseId: null,            // null = from vendor
  toWarehouseId: "RM-WH",
  fromBinId: null,
  toBinId: "RM-WH-A-03-2-1",
  movementType: "GRN",              // GRN | TRANSFER_OUT | TRANSFER_IN | ISSUE | RETURN | ADJUSTMENT | CONSUMPTION | PRODUCTION_OUTPUT
  qty: 4980,                        // Always positive
  unitOfMeasure: "kg",
  referenceType: "GRN",             // GRN | PO | TRANSFER_ORDER | PRODUCTION_ORDER | MANUAL
  referenceId: "GRN-2026-11-10-0042",
  performedBy: "warehouse.clerk@starium.com",
  performedAt: timestamp,
  notes: "20 kg short vs PO"
}
```

**Movement Types:**
| Type | From | To | Example |
|------|------|-----|---------|
| GRN | (vendor) | Warehouse | Receive 4,980 kg LABSA |
| TRANSFER_OUT | Warehouse A | (in transit) | Move 200 kg to Level 9 |
| TRANSFER_IN | (in transit) | Warehouse B | Arrive 200 kg at Level 9 |
| ISSUE | Warehouse | Production Floor | Issue 200 kg for Batch #003 |
| CONSUMPTION | Production Floor | (consumed) | Actually used 210 kg in batch |
| PRODUCTION_OUTPUT | (produced) | FG Warehouse | Output 1,000 kg powder |

**Current Stock = Sum of all ledger entries for (item, lot, warehouse, bin)**

### 4.6 `purchase_orders` (collection)
```javascript
purchase_orders/{poId}: {
  poNumber: "PO-2026-11-10-0042",
  vendorId: "vendor_chemsol_001",
  vendorName: "ChemSol Nigeria Ltd",  // Denormalized for display
  status: "APPROVED",                 // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED | COMPLETED
  lines: [
    {
      lineNumber: 1,
      itemId: "LABSA",
      itemName: "LABSA",
      itemCode: "LABSA",
      orderedQty: 5000,
      unitOfMeasure: "kg",
      unitPrice: 850,
      currency: "NGN",
      taxRate: 7.5,
      destinationWarehouseId: "RM-WH",
      destinationBinId: "RM-WH-A-03-2-1",  // Suggested put-away
      receivedQty: 4980,                   // Updated as GRNs come in
      status: "PARTIAL"                    // PENDING | PARTIAL | COMPLETE | CANCELLED
    }
  ],
  approvalChain: [
    { step: 1, role: "procurement_head", name: "Procurement Head", status: "APPROVED", approvedBy: "proc.head@starium.com", approvedAt: timestamp },
    { step: 2, role: "finance_manager", name: "Finance Manager", status: "APPROVED", approvedBy: "finance.mgr@starium.com", approvedAt: timestamp },
    { step: 3, role: "plant_manager", name: "Plant Manager", status: "APPROVED", approvedBy: "plant.mgr@starium.com", approvedAt: timestamp }
  ],
  currentApprovalStep: 3,
  requestedBy: "procurement.officer@starium.com",
  requestedAt: timestamp,
  approvedAt: timestamp,
  expectedDeliveryDate: "2026-11-12",
  notes: "Urgent - Level 9 running low",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 4.7 `goods_receipts` (collection — GRNs)
```javascript
goods_receipts/{grnId}: {
  grnNumber: "GRN-2026-11-10-0042",
  poId: "PO-2026-11-10-0042",
  poNumber: "PO-2026-11-10-0042",
  vendorId: "vendor_chemsol_001",
  vendorName: "ChemSol Nigeria Ltd",
  warehouseId: "RM-WH",
  receivedBy: "warehouse.clerk@starium.com",
  receivedAt: timestamp,
  lines: [
    {
      lineNumber: 1,
      poLineNumber: 1,
      itemId: "LABSA",
      itemName: "LABSA",
      orderedQty: 5000,
      receivedQty: 4980,
      unitOfMeasure: "kg",
      lotNumber: "L-2026-11-10-001",
      expiryDate: "2027-11-09",
      binId: "RM-WH-A-03-2-1",
      condition: "GOOD",              // GOOD | DAMAGED | SHORT | WRONG_ITEM
      notes: "20 kg short, packaging intact"
    }
  ],
  status: "POSTED",                   // DRAFT | POSTED | CANCELLED
  postedAt: timestamp,
  postedBy: "warehouse.clerk@starium.com",
  invoiceNumber: "INV-2026-11-10-0087",  // For 3-way match
  invoiceStatus: "PENDING",           // PENDING | MATCHED | DISPUTED
  createdAt: timestamp
}
```

### 4.8 `stock_transfers` (collection — move stock between warehouses)
```javascript
stock_transfers/{transferId}: {
  transferNumber: "ST-2026-11-10-0015",
  fromWarehouseId: "RM-WH",
  fromWarehouseName: "Raw Material Warehouse",
  toWarehouseId: "PF-L9",
  toWarehouseName: "Production Floor - Level 9",
  status: "COMPLETED",                // DRAFT | IN_TRANSIT | COMPLETED | CANCELLED
  requestedBy: "prod.supervisor@starium.com",
  requestedAt: timestamp,
  issuedBy: "warehouse.clerk@starium.com",
  issuedAt: timestamp,
  receivedBy: "prod.operator@starium.com",
  receivedAt: timestamp,
  lines: [
    {
      lineNumber: 1,
      itemId: "LABSA",
      itemName: "LABSA",
      lotId: "L-2026-11-10-001",
      requestedQty: 200,
      issuedQty: 200,
      receivedQty: 200,
      unitOfMeasure: "kg",
      fromBinId: "RM-WH-A-03-2-1",
      toBinId: "PF-L9-BIN-01",
      notes: "For Batch B-2026-11-10-003"
    }
  ],
  notes: "",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 4.9 `boms` (collection — Bill of Materials / Recipes)
```javascript
boms/{bomId}: {
  bomId: "premium_v1",                // Human-readable ID
  name: "Premium Detergent",
  version: 1,
  status: "ACTIVE",                   // DRAFT | PENDING_APPROVAL | ACTIVE | ARCHIVED
  category: "DETERGENT_POWDER",       // For grouping
  yieldPercent: 86.9,
  batchInputKg: 1151,                 // Sum of all ingredient kg
  batchOutputKg: 1000,                // Powder out per batch
  ingredients: [
    {
      lineNumber: 1,
      itemId: "LABSA",
      itemName: "LABSA",
      itemCode: "LABSA",
      kgPerBatch: 120,
      unitOfMeasure: "kg",
      isCritical: true,               // Must have this to run
      notes: "Surfactant - primary"
    },
    {
      lineNumber: 2,
      itemId: "SLES",
      itemName: "SLES",
      itemCode: "SLES",
      kgPerBatch: 80,
      unitOfMeasure: "kg",
      isCritical: true,
      notes: "Surfactant - secondary"
    },
    {
      lineNumber: 3,
      itemId: "SODA_ASH",
      itemName: "Soda Ash",
      itemCode: "SODA_ASH",
      kgPerBatch: 300,
      unitOfMeasure: "kg",
      isCritical: true,
      notes: "Builder"
    },
    // ... more ingredients
  ],
  approvalChain: [
    { step: 1, role: "recipe_manager", name: "Recipe Manager", status: "APPROVED", approvedBy: "recipe.mgr@starium.com", approvedAt: timestamp },
    { step: 2, role: "plant_manager", name: "Plant Manager", status: "APPROVED", approvedBy: "plant.mgr@starium.com", approvedAt: timestamp }
  ],
  createdBy: "recipe.mgr@starium.com",
  createdAt: timestamp,
  updatedAt: timestamp,
  approvedAt: timestamp
}
```

### 4.10 `production_orders` (collection — planned & actual production runs)
```javascript
production_orders/{prodOrderId}: {
  orderNumber: "PO-2026-11-10-003",
  bomId: "premium_v1",
  bomName: "Premium Detergent",
  bomVersion: 1,
  status: "COMPLETED",                // PLANNED | RELEASED | IN_PROGRESS | COMPLETED | CANCELLED
  plannedBatches: 10,
  plannedStartDate: "2026-11-10",
  plannedEndDate: "2026-11-10",
  actualStartDate: "2026-11-10 06:15",
  actualEndDate: "2026-11-10 14:30",
  
  // PLANNED quantities (from BOM × plannedBatches)
  plannedConsumption: [
    { itemId: "LABSA", itemName: "LABSA", plannedQty: 1200, unitOfMeasure: "kg" },
    { itemId: "SLES", itemName: "SLES", plannedQty: 800, unitOfMeasure: "kg" },
    { itemId: "SODA_ASH", itemName: "Soda Ash", plannedQty: 3000, unitOfMeasure: "kg" }
  ],
  
  // ACTUAL quantities (entered during/after production)
  actualConsumption: [
    { itemId: "LABSA", itemName: "LABSA", actualQty: 1250, unitOfMeasure: "kg", lotId: "L-2026-11-10-001", variance: 50, variancePercent: 4.17 },
    { itemId: "SLES", itemName: "SLES", actualQty: 820, unitOfMeasure: "kg", lotId: "L-2026-11-10-002", variance: 20, variancePercent: 2.50 },
    { itemId: "SODA_ASH", itemName: "Soda Ash", actualQty: 3050, unitOfMeasure: "kg", lotId: "L-2026-11-10-003", variance: 50, variancePercent: 1.67 }
  ],
  
  // POWDER OUTPUT
  plannedPowderKg: 10000,
  actualPowderKg: 9950,
  powderVariance: -50,
  powderVariancePercent: -0.5,
  actualYieldPercent: 86.4,
  
  // LOT TRACEABILITY
  inputLots: [
    { itemId: "LABSA", lotId: "L-2026-11-10-001", qtyUsed: 1250 },
    { itemId: "SLES", lotId: "L-2026-11-10-002", qtyUsed: 820 },
    { itemId: "SODA_ASH", lotId: "L-2026-11-10-003", qtyUsed: 3050 }
  ],
  outputLotId: "L-FG-2026-11-10-003",  // Finished goods lot created
  
  // PACKING PLAN & ACTUALS
  packingPlan: { "22": 25, "40": 0, "45": 0, "85": 40, "125": 0, "170": 0, "850": 35 },
  plannedSachets: { "22": 113636363, "85": 47058823, "850": 4117647 },
  plannedCartons: { "22": 701459, "85": 904977, "850": 588235 },
  actualSachets: { "22": 112000000, "85": 46500000, "850": 4000000 },
  actualCartons: { "22": 691358, "85": 894230, "850": 571428 },
  
  producedBy: "prod.supervisor@starium.com",
  recordedBy: "qc.operator@starium.com",
  recordedAt: timestamp,
  notes: "LABSA slightly over due to humidity",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 4.11 `packing_actuals` (collection — separate for granular packing records)
```javascript
packing_actuals/{recordId}: {
  productionOrderId: "PO-2026-11-10-003",
  shift: "DAY",
  team: "A",
  date: "2026-11-10",
  sku: "85",                          // One record per SKU per shift
  plannedSachets: 47058823,
  actualSachets: 46500000,
  plannedCartons: 904977,
  actualCartons: 894230,
  varianceSachets: -558823,
  variancePercent: -1.19,
  recordedBy: "packing.operator@starium.com",
  recordedAt: timestamp
}
```

---

## 5. Implementation Phases — Step by Step {#phases}

### Phase 0: Foundation (Week 1) — **Do This First**
**Goal:** Set up the master data that everything else depends on.

| Task | Description | Test |
|------|-------------|------|
| 0.1 | Create `items` collection with 20+ items (LABSA, SLES, Soda Ash, Zeolite, Enzyme, Fragrance, Colour, Filler, Sachet Film, Cartons, Tape, Gloves, Paper...) | Can CRUD items, categories work |
| 0.2 | Create `warehouses` collection (RM-WH, PF-L9, PF-L8, FG-WH, OFF-ST) | Can list warehouses by type |
| 0.3 | Create `bins` for RM-WH (at least 20 bins across zones A-C) | Bin address format works, capacity tracked |
| 0.4 | Create `vendors` collection (3-5 vendors) | Can create vendor, link to PO |
| 0.5 | Add System Config tab: **Item Master** (CRUD items), **Warehouse Master** (CRUD warehouses/bins), **Vendor Master** (CRUD vendors) | Admin can manage all master data |
| 0.6 | Firestore rules for new collections | Only authorized roles can read/write |
| 0.7 | Unit tests for master data validators | 100% pass |

**Deliverable:** Master data foundation. No transactions yet — just the "nouns" (items, places, vendors).

---

### Phase 1: Purchase Order + Approval + GRN (Weeks 2-3)
**Goal:** Complete procure-to-receive flow with 3-step approval.

| Task | Description | Test |
|------|-------------|------|
| 1.1 | PO creation page (`/purchase-orders`) — create PO with multiple lines, select vendor, destination warehouse/bin | Can create PO, lines calculate totals |
| 1.2 | **Approval Workflow Engine** — generic 3-step chain (configurable roles) | PO moves DRAFT → PENDING → APPROVED step by step |
| 1.3 | Approval notifications (email + in-app) — each approver gets notified | Email sent at each step |
| 1.4 | PO list page — filter by status, vendor, date | Can find any PO |
| 1.5 | **GRN Page** (`/goods-receipt`) — scan PO, enter actual qty, lot #, expiry, bin, condition | GRN posts, stock_ledger updated |
| 1.6 | **3-Way Match Logic** — PO qty vs GRN qty vs Invoice qty | Flags variance automatically |
| 1.7 | Stock Ledger auto-posting on GRN — immutable record | Ledger entry created, stock = sum(ledger) |
| 1.8 | Bin put-away — suggest bin, clerk confirms, bin qty updated | Bin shows correct item/lot/qty |
| 1.9 | Printable GRN form | PDF matches paper form |
| 1.10 | Unit tests for PO/GRN logic, integration tests for approval flow | 90%+ coverage |

**Approval Chain (configurable in System Config):**
```
Step 1: Procurement Head (role: procurement_head)
Step 2: Finance Manager (role: finance_manager)  
Step 3: Plant Manager (role: plant_manager)
```
*Each step must approve before next step sees it. Rejection at any step = PO REJECTED.*

**Deliverable:** Full procure-to-receive. Vendor → PO → 3 Approvals → GRN → Stock Updated → Bin Filled.

---

### Phase 2: Stock Transfers / Issue to Production (Week 4)
**Goal:** Move material from warehouse to production floor with full traceability.

| Task | Description | Test |
|------|-------------|------|
| 2.1 | Stock Transfer page (`/stock-transfers`) — create transfer from RM-WH → PF-L9 (or any warehouse) | Can create transfer, lines show available lots |
| 2.2 | **Two-step confirmation**: Warehouse ISSUES → Production RECEIVES | Both sides must confirm |
| 2.3 | Lot selection — clerk picks which lot(s) to issue (FEFO: First Expired First Out) | Oldest lot suggested first |
| 2.4 | Bin management — from-bin qty decreases, to-bin qty increases | Bin ledger matches |
| 2.5 | Stock ledger entries: TRANSFER_OUT + TRANSFER_IN | Immutable audit trail |
| 2.6 | Transfer list page — filter by status, warehouse, date | Can track in-transit items |
| 2.7 | Return transfer (production → warehouse) for unused material | Reverse flow works |
| 2.8 | Printable transfer note | PDF for warehouse clerk |
| 2.9 | Unit tests for transfer logic, lot selection, bin updates | 90%+ coverage |

**Flow:**
```
1. Production Supervisor creates transfer: "Need 200 kg LABSA for Batch #003"
2. Warehouse Clerk sees transfer → Picks Lot L-2026-11-10-001 (oldest) → Issues 200 kg
   → Stock Ledger: TRANSFER_OUT (RM-WH -200 kg)
3. Production Operator receives → Confirms 200 kg at PF-L9-BIN-01
   → Stock Ledger: TRANSFER_IN (PF-L9 +200 kg)
```

**Deliverable:** Material moves with full lot traceability. Warehouse stock ↓, Production stock ↑.

---

### Phase 3: BOM / Recipe Management (Week 5)
**Goal:** Flexible, versioned recipes with approval workflow.

| Task | Description | Test |
|------|-------------|------|
| 3.1 | BOM page (`/boms`) — CRUD recipes with ingredients, kg/batch, yield % | Can create Premium, Standard, Economy recipes |
| 3.2 | **Versioning** — v1, v2, v3... only one ACTIVE at a time | Can clone v1 → v2, edit, activate |
| 3.3 | **Approval Workflow** (2-step: Recipe Manager → Plant Manager) | BOM moves DRAFT → PENDING → ACTIVE |
| 3.4 | Ingredient validation — all items must exist in Item Master | Cannot add unknown item |
| 3.5 | Yield calculation — batchOutputKg = sum(ingredients) × yield%/100 | Auto-calculates |
| 3.6 | BOM list with version history | Can see all versions |
| 3.7 | **Role-based CRUD** — only `recipe_manager` can create/edit; `plant_manager` approves | Permissions enforced |
| 3.8 | Printable BOM sheet for production | PDF with all ingredients |
| 3.9 | Unit tests for BOM math, versioning, approval | 90%+ coverage |

**Recipe Manager Role:** New action role `recipe_manager` (add to ConfigContext actionRoles)

**Deliverable:** Versioned, approved recipes. Production selects active BOM for a run.

---

### Phase 4: Production Planning + Actuals + Variance (Weeks 6-7)
**Goal:** Plan batches, record actual consumption/output, show variance.

| Task | Description | Test |
|------|-------------|------|
| 4.1 | Production Order page (`/production-orders`) — create order from active BOM | Select BOM, enter planned batches, auto-calculates planned consumption |
| 4.2 | **Release** → **Start** → **Complete** workflow | Status transitions work |
| 4.3 | **Actual Consumption Entry** — during/after production, enter actual kg per ingredient per lot | Clerk enters actuals, lot selection required |
| 4.4 | **Variance Calculation** — Actual − Planned per ingredient, auto % | Green/amber/red badges: <2% ✓, 2-5% ⚠, >5% ✗ |
| 4.5 | **Powder Output** — planned vs actual kg, yield % | Shows actual yield vs standard |
| 4.6 | Lot traceability — input lots linked to output lot | Can trace FG lot → raw material lots |
| 4.7 | Stock ledger: CONSUMPTION entries on actual entry | Stock decreases automatically |
| 4.8 | Production Order list — filter by status, BOM, date | Can find any order |
| 4.9 | **Packing Plan** — Plant Manager sets % split across 7 SKUs (sums to 100%) | Sliders, live validation |
| 4.10 | **Planned Sachets/Cartons** — from powder kg × packing plan × gram specs | Auto-calculates using existing gramSpecs |
| 4.11 | **Actual Packing Entry** — per shift, per team, per SKU | Packing operator enters actuals |
| 4.12 | **Packing Variance** — planned vs actual per SKU | Variance table with conditional formatting |
| 4.13 | Unit tests for all calculations, variance logic, lot tracing | 95%+ coverage |

**Variance Display (Simple for Plant Manager):**
| Ingredient | Planned (kg) | Actual (kg) | Variance (kg) | Variance % | Status |
|------------|--------------|-------------|---------------|------------|--------|
| LABSA | 1,200 | 1,250 | +50 | +4.2% | ⚠️ Amber |
| SLES | 800 | 820 | +20 | +2.5% | ⚠️ Amber |
| Soda Ash | 3,000 | 3,050 | +50 | +1.7% | ✅ Green |
| **Total Input** | **5,000** | **5,120** | **+120** | **+2.4%** | ⚠️ Amber |
| **Powder Out** | **10,000** | **9,950** | **−50** | **−0.5%** | ✅ Green |
| **Actual Yield** | **86.9%** | **86.4%** | **−0.5%** | | |

**Packing Variance:**
| SKU | Planned Cartons | Actual Cartons | Variance | Variance % | Status |
|-----|-----------------|----------------|----------|------------|--------|
| 22g | 701,459 | 691,358 | -10,101 | -1.4% | ✅ Green |
| 85g | 904,977 | 894,230 | -10,747 | -1.2% | ✅ Green |
| 850g | 588,235 | 571,428 | -16,807 | -2.9% | ⚠️ Amber |
| **Total** | **2,194,671** | **2,157,016** | **-37,655** | **-1.7%** | ✅ Green |

**Deliverable:** Complete plan → actual → variance for both raw materials AND packing.

---

### Phase 5: Integration & Polish (Week 8)
**Goal:** Connect to existing modules, add to menus, deploy.

| Task | Description |
|------|-------------|
| 5.1 | Add routes to `App.jsx` and `navigation.js` |
| 5.2 | Add menu items: **Procurement** (PO, GRN), **Warehouse** (Stock Transfers, Bin View), **Production** (BOMs, Production Orders) |
| 5.3 | Add action roles: `procurement_head`, `finance_manager`, `plant_manager`, `warehouse_clerk`, `production_supervisor`, `recipe_manager`, `packing_operator` |
| 5.4 | Integrate with **ConfigContext** — read gramSpecs, item master for calculations |
| 5.5 | Integrate with **QC Density** — auto-fill powder density from latest QC test for packing plan validation |
| 5.6 | Firestore rules audit for all new collections |
| 5.7 | End-to-end Cypress test: PO → GRN → Transfer → Production Order → Actuals → Variance |
| 5.8 | Document Hub updates — user guides for each module |
| 5.9 | Deploy to all 3 platforms (Firebase, GitHub Pages, Cloudflare) |
| 5.10 | Demo script for Plant Manager |

---

## 6. Roles & Permissions {#roles}

### New Department Roles (add to ConfigContext)
| Role ID | Label | Category | What They Do |
|---------|-------|----------|--------------|
| `procurement_staff` | Procurement Officer | Procurement | Create PO, view own |
| `procurement_manager` | Procurement Head | Procurement | Approve PO (step 1), view all |
| `finance_manager` | Finance Manager | Finance | Approve PO (step 2), view costs |
| `warehouse_clerk` | Warehouse Clerk | Warehouse | GRN, Stock Transfers, Bin management |
| `warehouse_manager` | Warehouse Manager | Warehouse | View all stock, approve transfers |
| `production_supervisor` | Production Supervisor | Production | Create transfers, production orders, enter actuals |
| `production_operator` | Production Operator | Production | Receive transfers, enter consumption actuals |
| `packing_operator` | Packing Operator | Production | Enter packing actuals |
| `recipe_manager` | Recipe Manager | Production | Create/edit BOMs (step 1 approval) |

### New Action Roles (add to ConfigContext)
| Role ID | Label | Granted To |
|---------|-------|------------|
| `procurement_head` | Procurement Head (PO Approval) | Procurement Manager |
| `finance_manager` | Finance Manager (PO Approval) | Finance Manager |
| `plant_manager` | Plant Manager (PO/BOM Approval) | Plant Manager |
| `recipe_manager` | Recipe Manager (BOM Approval) | Recipe Manager |

### Page Access Matrix
| Page | Path | Department Roles | Action Roles |
|------|------|------------------|--------------|
| Purchase Orders | `/purchase-orders` | procurement_staff, procurement_manager | — |
| PO Approvals | `/po-approvals` | — | procurement_head, finance_manager, plant_manager |
| Goods Receipt | `/goods-receipt` | warehouse_clerk, warehouse_manager | — |
| Stock Transfers | `/stock-transfers` | warehouse_clerk, warehouse_manager, production_supervisor | — |
| Bin View | `/bin-view` | warehouse_clerk, warehouse_manager | — |
| BOMs | `/boms` | recipe_manager | — |
| BOM Approvals | `/bom-approvals` | — | recipe_manager, plant_manager |
| Production Orders | `/production-orders` | production_supervisor, production_operator | — |
| Packing Actuals | `/packing-actuals` | packing_operator, production_supervisor | — |
| Production Variance | `/production-variance` | production_supervisor, plant_manager, qc_manager | — |

---

## 7. Integration with Existing Code {#integration}

| Existing Module | How We Connect |
|-----------------|----------------|
| **ConfigContext** | Read `gramSpecs` (piecesPerCarton, density ranges) for packing calculations. Read `items` for master data. |
| **QC Density Tests** | Latest powder density → auto-fill in Production Order packing plan → validate which SKUs are density-valid |
| **Gram Specs Tab** | Single source of truth for piecesPerCarton, packerBreakdown — planning reads directly |
| **User Roles** | New department/action roles added to ConfigContext → navigation.js → ProtectedRoute |
| **System Config** | New tabs: Item Master, Warehouse Master, Vendor Master, BOM Settings (approval chain) |
| **Reports Menu** | Add: "Production Variance Report", "Stock Position Report", "GRN History" |
| **Email Worker** | New templates: PO submitted for approval, GRN posted, Transfer completed, Variance alert |
| **Dashboard** | Add cards: "Open POs", "Stock Below Min", "Production Orders In Progress", "Top Variances" |

---

## 8. Questions for the Plant Manager {#questions}

**Please answer these before we start Phase 0:**

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **How many approval steps for PO?** | 2 / 3 / 4 / Configurable | 3 (Procurement → Finance → Plant Manager) |
| 2 | **Who approves BOMs?** | Recipe Manager only / Recipe Manager + Plant Manager | 2-step (Recipe Manager → Plant Manager) |
| 3 | **Stock transfer: one-step or two-step?** | One (issue = done) / Two (issue + receive) | Two-step (warehouse issues, production receives) |
| 4 | **Lot selection: FEFO enforced or manual?** | System enforces oldest lot / Clerk chooses any | FEFO suggested, clerk can override with reason |
| 5 | **Production Order: who creates?** | Production Supervisor only / Also Production Manager | Production Supervisor |
| 6 | **Actual consumption: when entered?** | During production (real-time) / After shift / End of day | After shift (shift supervisor enters) |
| 7 | **Variance thresholds for alerts?** | 2% / 5% / 10% / Configurable | 5% default, configurable in System Config |
| 8 | **Packing actuals: per shift or per day?** | Per shift (DAY/NIGHT) / Per day aggregate | Per shift (matches QC density) |
| 9 | **Office supplies / consumables in same flow?** | Yes, same PO/GRN but no lot tracking / Separate simple flow | Same PO/GRN, `isTrackedByLot: false` for non-raw items |
| 10 | **Do you need vendor portal?** | Yes (vendors see PO, submit ASN) / No (internal only) | No for Phase 1, add later if needed |

---

## 9. What "Done" Looks Like {#done}

### For the Plant Manager (Demo Script)
```
1. OPEN /purchase-orders
   → Create PO: 5,000 kg LABSA @ ₦850/kg from ChemSol
   → Submit → Shows "PENDING APPROVAL (Step 1 of 3)"

2. LOGIN as Procurement Head
   → OPEN /po-approvals → See PO → Click "APPROVE"
   → PO moves to "Step 2 of 3"

3. LOGIN as Finance Manager
   → Approve → PO moves to "Step 3 of 3"

4. LOGIN as Plant Manager
   → Approve → PO status = "APPROVED"

5. LOGIN as Warehouse Clerk
   → OPEN /goods-receipt → Select PO → Enter: "Received 4,980 kg, Lot L-2026-11-10-001, Bin RM-WH-A-03-2-1"
   → POST GRN
   → CHECK /bin-view → Bin RM-WH-A-03-2-1 shows: LABSA, Lot L-2026-11-10-001, 4,980 kg

6. OPEN /stock-transfers
   → Create: Move 200 kg LABSA from RM-WH → PF-L9 (for Batch #003)
   → Warehouse Clerk: ISSUE 200 kg from Bin RM-WH-A-03-2-1
   → Production Operator: RECEIVE 200 kg at PF-L9-BIN-01
   → CHECK /bin-view → RM-WH bin: 4,780 kg | PF-L9 bin: 200 kg

7. OPEN /boms
   → Create "Premium Detergent v1" with 8 ingredients, yield 86.9%
   → Submit for approval → Recipe Manager approves → Plant Manager approves → ACTIVE

8. OPEN /production-orders
   → Create from "Premium v1", 10 batches
   → Planned consumption auto-filled: LABSA 1,200 kg, SLES 800 kg...
   → RELEASE → START

9. LOGIN as Production Operator
   → Enter ACTUAL consumption: LABSA 1,250 kg (Lot L-2026-11-10-001), SLES 820 kg...
   → Enter ACTUAL powder output: 9,950 kg
   → Variance table shows: LABSA +50 kg (+4.2%) ⚠️

10. Packing Plan: 25% 22g, 40% 85g, 35% 850g
    → Planned cartons calculated from powder kg + gramSpecs
    → Packing operator enters actuals per shift
    → Variance per SKU shown

11. OPEN /production-variance
    → See complete variance report: Raw materials + Packing
    → Export PDF for Monday meeting
```

### Technical Definition of Done
- [ ] All 5 phases merged to `main`
- [ ] CI passes (281+ existing tests + new tests)
- [ ] Firestore rules deployed manually: `firebase deploy --only firestore:rules --project starium-rafa-app`
- [ ] Deployed to all 3 platforms
- [ ] Document Hub updated with 5 user guides (one per module)
- [ ] Demo video recorded (10 min)
- [ ] Plant Manager signs off on demo script above

---

## 📝 Next Steps

1. **Plant Manager answers 10 questions above**
2. **We agree on Phase 0 scope** (exact item list, warehouse layout, vendor list)
3. **Start Phase 0 Monday** — Master data foundation
4. **Weekly check-ins** — Each phase demoed Friday, next phase planned Monday

---

**This plan is deliberately incremental. Each phase ships working software. No "big bang" at the end.**

**Questions? Changes? Let's discuss Monday.**