# Starium Rafa ERP — Phase 1 Implementation Plan
## Purchase Orders, Goods Receipt, Stock Transfers, BOMs, Production Planning & Variance

**Date:** November 11, 2026  
**Author:** Engr. Damilare Paul Ayodele (Dammie Optimus Solutions)  
**Status:** Implementation Plan for Plant Manager Review  
**Version:** 2.0 (Updated with Plant Manager feedback)

---

## 📋 Table of Contents

1. [The Five-Year-Old Summary](#five-year-old)
2. [What We're Building — The Complete Journey](#journey)
3. [Key Terms Explained Simply](#terms)
4. [Data Model — What Lives in Firestore](#data-model)
5. [Implementation Phases — Step by Step](#phases)
6. [Roles & Permissions](#roles)
7. [Integration with Existing Code](#integration)
8. [Questions for the Plant Manager (3 Decisions)](#questions)
9. [What "Done" Looks Like](#done)

---

## 1. The Five-Year-Old Summary {#five-year-old}

> **Imagine a magic notebook that tracks everything coming in and going out of your factory.**

**What goes IN (from vendors):**
- You tell the notebook: "I ordered 5,000 kg LABSA from ChemSol"
- **Approval flow is configurable** — could be 2, 3, or 4 steps, or turned OFF
- Truck arrives → Warehouse clerk counts: "Actually got 4,980 kg"
- Notebook updates: **Raw Material Stock = 4,980 kg LABSA added**
- **If short: Credit Note auto-drafted** → Finance sends to vendor → Payment adjusted

**What moves INSIDE (to production):**
- You tell the notebook: "Move 200 kg LABSA to **any location** (Level 9, Level 8, FG Warehouse...)"
- Warehouse clerk scans, confirms → Production receives, confirms
- Notebook updates: **Source −200 kg, Destination +200 kg**

**Recipes (BOMs):**
- You write: "Premium Detergent = 120 kg LABSA + 80 kg SLES + 300 kg Soda Ash..."
- Notebook saves it with version number
- **Approval flow configurable** (Recipe Manager → Plant Manager, or just one, or none)
- Only Recipe Manager can change it

**Planning vs Actual:**
- You say: "I want to make 10 batches → need 1,200 kg LABSA planned"
- Production runs → Clerk enters: "Actually used 1,250 kg LABSA"
- Notebook shows: **Variance = +50 kg (2.5% over)**

**Finished Goods:**
- You say: "10 batches = 10,000 kg powder → 300,000 sachets → 2,000 cartons"
- **Packing Plan: Plant Manager sets % split across 7 SKU sizes**
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
    "Send 5,000 kg LABSA"   ──►   Configurable Approval (default 3 steps):
                                   • Procurement Head ✓
                                   • Finance Manager ✓
                                   • Plant Manager ✓
                                   = APPROVED PO
                                   (Flow can be toggled OFF, steps added/removed)

[2. GOODS RECEIPT (GRN)]        Warehouse receives
    Truck arrives with          Clerk counts, records:
    5,000 kg LABSA          ──►   "Received 4,980 kg (20 kg short)"
                                   Lot #: L-2026-11-10-001
                                   Bin: RM-WH-A-03-2-1
                                   → STOCK UPDATED: +4,980 kg
                                   → 3-Way Match: PO(5,000) ≠ GRN(4,980)
                                   → CREDIT NOTE AUTO-DRAFTED: 20 kg × ₦850

[3. STOCK TRANSFER]            Move to ANY location
    "Need 200 kg for           User picks destination:
    production floor"     ──►   To: PF-L9 / PF-L8 / FG-WH / OFF-ST...
                                   Warehouse clerk issues 200 kg (Lot L-001)
                                   Production operator receives at chosen bin
                                   → SOURCE: −200 kg | DESTINATION: +200 kg

[4. BOM / RECIPE]              Standard recipe saved
    "Premium Detergent:        Version 1.0:
    1 batch = 1,151 kg in   ──►   LABSA: 120 kg
    1,000 kg powder out"        SLES: 80 kg
                                   Soda Ash: 300 kg
                                   ... = 1,151 kg total
                                   Yield: 86.9% (1,000 kg out)
                                   Approval: Configurable (default 2 steps)

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
    "10,000 kg powder"     ──►   Packing Plan (Plant Manager sets %):
                                   25% 22g  → 113M sachets → 700K cartons
                                   40% 85g  → 47M sachets  → 900K cartons
                                   35% 850g → 4M sachets   → 570K cartons
                                   (Density validation: manual entry for now)

[9. ACTUAL PACKING]            Record reality
    "Made 2.1M cartons"   ──►   ACTUAL cartons per SKU per shift
                                   Variance per SKU
                                   Total variance

[10. PROFIT]                    The bottom line
    Revenue − Cost       ──►   Profit, Margin, Profit per ₦1 Raw Material
```

---

## 3. Key Terms Explained Simply {#terms}

| Term | Simple Meaning | In Our App |
|------|---------------|------------|
| **PO (Purchase Order)** | "Dear Vendor, please send us this" | Digital document with items, qty, prices, **configurable approval chain** |
| **GRN (Goods Received Note)** | "We got this, here's what actually arrived" | Warehouse clerk records actual qty, lot #, bin location |
| **3-Way Match** | PO + GRN + Invoice must agree before paying | System flags if PO says 5,000 but GRN says 4,980 |
| **Credit Note** | Vendor's "we owe you" for short/damaged goods | Auto-drafted when GRN < PO; Finance manages lifecycle |
| **Bin** | Exact shelf address (like a parking spot) | `RM-WH-A-03-2-1` = Raw Mat Warehouse, Zone A, Aisle 3, Rack 2, Shelf 1 |
| **Lot / Lot Number** | Family ID for material made/bought together | `L-2026-11-10-001` → trace from vendor to customer |
| **Lot Tracking** | Following every move of every lot | GRN → Bin → Transfer → Production → Finished Goods |
| **BOM (Bill of Materials)** | The recipe — what goes in, how much | `Premium v1: LABSA 120kg, SLES 80kg, Soda Ash 300kg...` |
| **Batch** | One cooking session of that recipe | `Batch B-2026-11-10-003` used Lot #L-2026-11-10-001 |
| **Yield %** | Output ÷ Input (accounts for loss) | 1,000 kg powder ÷ 1,151 kg input = 86.9% |
| **Stock Transfer** | Move material between any two warehouses | User picks source & destination; two-step confirm (issue + receive) |
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
  code: "LABSA",
  name: "Linear Alkylbenzene Sulfonic Acid",
  category: "RAW_MATERIAL",         // RAW_MATERIAL | OFFICE_SUPPLY | CONSUMABLE | PACKAGING | FINISHED_GOOD
  unitOfMeasure: "kg",
  defaultWarehouse: "RM-WH",
  minStockLevel: 5000,
  maxStockLevel: 50000,
  standardCost: 850,
  isTrackedByLot: true,             // true for raw materials, false for office supplies/consumables
  expiryTracking: true,
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
  zones: ["A", "B", "C"],
  isActive: true,
  managerId: "warehouse.mgr@starium.com"
}
```

**Pre-seeded (user can add more):**
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
  currentItemId: "LABSA",
  currentLotId: "L-2026-11-10-001",
  currentQty: 4980,
  status: "AVAILABLE",
  updatedAt: timestamp
}
```

### 4.5 `stock_ledger` (collection — IMMUTABLE record of every stock movement)
```javascript
stock_ledger/{entryId}: {
  itemId: "LABSA",
  lotId: "L-2026-11-10-001",
  fromWarehouseId: null,
  toWarehouseId: "RM-WH",
  fromBinId: null,
  toBinId: "RM-WH-A-03-2-1",
  movementType: "GRN",              // GRN | TRANSFER_OUT | TRANSFER_IN | ISSUE | RETURN | ADJUSTMENT | CONSUMPTION | PRODUCTION_OUTPUT | CREDIT_NOTE
  qty: 4980,
  unitOfMeasure: "kg",
  referenceType: "GRN",
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
| TRANSFER_OUT | Warehouse A | (in transit) | Move 200 kg to PF-L9 |
| TRANSFER_IN | (in transit) | Warehouse B | Arrive 200 kg at PF-L9 |
| ISSUE | Warehouse | Production Floor | Issue 200 kg for Batch #003 |
| CONSUMPTION | Production Floor | (consumed) | Actually used 210 kg in batch |
| PRODUCTION_OUTPUT | (produced) | FG Warehouse | Output 1,000 kg powder |
| CREDIT_NOTE | (vendor) | Warehouse | Credit 20 kg LABSA (reduces payable) |

**Current Stock = Sum of all ledger entries for (item, lot, warehouse, bin)**

### 4.6 `purchase_orders` (collection)
```javascript
purchase_orders/{poId}: {
  poNumber: "PO-2026-11-10-0042",
  vendorId: "vendor_chemsol_001",
  vendorName: "ChemSol Nigeria Ltd",
  status: "APPROVED",
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
      destinationBinId: "RM-WH-A-03-2-1",
      receivedQty: 4980,
      status: "PARTIAL"
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
  notes: "Urgent - production running low",
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
      condition: "GOOD",
      notes: "20 kg short, packaging intact"
    }
  ],
  status: "POSTED",
  postedAt: timestamp,
  postedBy: "warehouse.clerk@starium.com",
  invoiceNumber: "INV-2026-11-10-0087",
  invoiceStatus: "PENDING",
  creditNoteId: "CN-2026-11-10-0012",  // Link to credit note if created
  createdAt: timestamp
}
```

### 4.8 `credit_notes` (collection — vendor credit notes for short/damaged receipts)
```javascript
credit_notes/{cnId}: {
  cnNumber: "CN-2026-11-10-0012",
  grnId: "GRN-2026-11-10-0042",
  grnNumber: "GRN-2026-11-10-0042",
  poId: "PO-2026-11-10-0042",
  poNumber: "PO-2026-11-10-0042",
  vendorId: "vendor_chemsol_001",
  vendorName: "ChemSol Nigeria Ltd",
  status: "SENT",                    // DRAFT | SENT | ACCEPTED | REJECTED | APPLIED
  lines: [
    {
      lineNumber: 1,
      itemId: "LABSA",
      itemName: "LABSA",
      shortQty: 20,
      unitOfMeasure: "kg",
      unitPrice: 850,
      currency: "NGN",
      taxRate: 7.5,
      lineTotal: 17000,
      taxTotal: 1275,
      total: 18275,
      reason: "SHORT_DELIVERY"        // SHORT_DELIVERY | DAMAGED | WRONG_ITEM | PRICE_DISPUTE
    }
  ],
  subTotal: 17000,
  taxTotal: 1275,
  grandTotal: 18275,
  createdBy: "finance.officer@starium.com",
  createdAt: timestamp,
  sentAt: timestamp,
  sentBy: "finance.mgr@starium.com",
  acceptedAt: null,
  acceptedBy: null,
  appliedAt: null,
  notes: "Auto-drafted from GRN shortfall"
}
```

### 4.9 `stock_transfers` (collection — move stock between any warehouses)
```javascript
stock_transfers/{transferId}: {
  transferNumber: "ST-2026-11-10-0015",
  fromWarehouseId: "RM-WH",
  fromWarehouseName: "Raw Material Warehouse",
  toWarehouseId: "PF-L9",             // User chooses ANY warehouse
  toWarehouseName: "Production Floor - Level 9",
  status: "COMPLETED",
  requestedBy: "prod.supervisor@starium.com",
  requestedAt: timestamp,
  issuedBy: "warehouse.clerk@starium.com",
  issuedAt: timestamp,
  receivedBy: "prod.operator@starium.com",
  receivedAt: timestamp,
  approvalChain: [],                  // Configurable (default: empty = no approval)
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

### 4.10 `approval_chains` (collection — configurable per flow type)
```javascript
// Stored in config/settings.approvalChains (map)
approvalChains: {
  purchaseOrder: {
    enabled: true,
    required: true,
    steps: [
      { step: 1, role: "procurement_head", label: "Procurement Head" },
      { step: 2, role: "finance_manager", label: "Finance Manager" },
      { step: 3, role: "plant_manager", label: "Plant Manager" }
    ]
  },
  goodsReceipt: {
    enabled: false,
    required: false,
    steps: []
  },
  stockTransfer: {
    enabled: false,
    required: false,
    steps: []
  },
  bom: {
    enabled: true,
    required: true,
    steps: [
      { step: 1, role: "recipe_manager", label: "Recipe Manager" },
      { step: 2, role: "plant_manager", label: "Plant Manager" }
    ]
  },
  productionOrder: {
    enabled: false,
    required: false,
    steps: []
  },
  packingPlan: {
    enabled: false,
    required: false,
    steps: []
  }
}
```

### 4.11 `boms` (collection — Bill of Materials / Recipes)
```javascript
boms/{bomId}: {
  bomId: "premium_v1",
  name: "Premium Detergent",
  version: 1,
  status: "ACTIVE",
  category: "DETERGENT_POWDER",
  yieldPercent: 86.9,
  batchInputKg: 1151,
  batchOutputKg: 1000,
  ingredients: [
    { lineNumber: 1, itemId: "LABSA", itemName: "LABSA", itemCode: "LABSA", kgPerBatch: 120, unitOfMeasure: "kg", isCritical: true, notes: "Surfactant - primary" },
    { lineNumber: 2, itemId: "SLES", itemName: "SLES", itemCode: "SLES", kgPerBatch: 80, unitOfMeasure: "kg", isCritical: true, notes: "Surfactant - secondary" },
    { lineNumber: 3, itemId: "SODA_ASH", itemName: "Soda Ash", itemCode: "SODA_ASH", kgPerBatch: 300, unitOfMeasure: "kg", isCritical: true, notes: "Builder" }
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

### 4.12 `production_orders` (collection)
```javascript
production_orders/{prodOrderId}: {
  orderNumber: "PO-2026-11-10-003",
  bomId: "premium_v1",
  bomName: "Premium Detergent",
  bomVersion: 1,
  status: "COMPLETED",
  plannedBatches: 10,
  plannedStartDate: "2026-11-10",
  plannedEndDate: "2026-11-10",
  actualStartDate: "2026-11-10 06:15",
  actualEndDate: "2026-11-10 14:30",
  plannedConsumption: [
    { itemId: "LABSA", itemName: "LABSA", plannedQty: 1200, unitOfMeasure: "kg" },
    { itemId: "SLES", itemName: "SLES", plannedQty: 800, unitOfMeasure: "kg" },
    { itemId: "SODA_ASH", itemName: "Soda Ash", plannedQty: 3000, unitOfMeasure: "kg" }
  ],
  actualConsumption: [
    { itemId: "LABSA", itemName: "LABSA", actualQty: 1250, unitOfMeasure: "kg", lotId: "L-2026-11-10-001", variance: 50, variancePercent: 4.17 },
    { itemId: "SLES", itemName: "SLES", actualQty: 820, unitOfMeasure: "kg", lotId: "L-2026-11-10-002", variance: 20, variancePercent: 2.50 },
    { itemId: "SODA_ASH", itemName: "Soda Ash", actualQty: 3050, unitOfMeasure: "kg", lotId: "L-2026-11-10-003", variance: 50, variancePercent: 1.67 }
  ],
  plannedPowderKg: 10000,
  actualPowderKg: 9950,
  powderVariance: -50,
  powderVariancePercent: -0.5,
  actualYieldPercent: 86.4,
  inputLots: [
    { itemId: "LABSA", lotId: "L-2026-11-10-001", qtyUsed: 1250 },
    { itemId: "SLES", lotId: "L-2026-11-10-002", qtyUsed: 820 },
    { itemId: "SODA_ASH", lotId: "L-2026-11-10-003", qtyUsed: 3050 }
  ],
  outputLotId: "L-FG-2026-11-10-003",
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

### 4.13 `packing_actuals` (collection)
```javascript
packing_actuals/{recordId}: {
  productionOrderId: "PO-2026-11-10-003",
  shift: "DAY",
  team: "A",
  date: "2026-11-10",
  sku: "85",
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
**Goal:** Master data + Configurable Approval Engine

| Task | Description | Test |
|------|-------------|------|
| 0.1 | Create `items` collection with 20+ items (RAW_MATERIAL, PACKAGING, CONSUMABLE, OFFICE_SUPPLY, FINISHED_GOOD) | Can CRUD items, categories work, `isTrackedByLot` respected |
| 0.2 | Create `warehouses` collection (RM-WH, PF-L9, PF-L8, FG-WH, OFF-ST) | Can list by type, user can add more |
| 0.3 | Create `bins` — auto-generate grid (Zone A-C, Aisle 01-10, Rack 1-5, Shelf 1-4) per warehouse | Bin address format works, capacity tracked |
| 0.4 | Create `vendors` collection (3-5 vendors) | Can create vendor, link to PO |
| 0.5 | **System Config Tabs:** Item Master, Warehouse Master, Vendor Master, **Approval Chains** (toggle flows, configure steps) | Admin manages all master data + approval flows |
| 0.6 | **Generic Approval Engine** — reads `config/settings.approvalChains`, powers PO, GRN, Transfer, BOM, Production Order, Packing Plan | Engine works for any flow; steps configurable |
| 0.7 | Firestore rules for all new collections | Only authorized roles can read/write |
| 0.8 | Unit tests for master data validators + approval engine | 100% pass |

**Deliverable:** Master data foundation + **configurable approval engine**. No transactions yet.

---

### Phase 1: Purchase Order + Approval + GRN + Credit Note (Weeks 2-3)
**Goal:** Complete procure-to-receive with configurable approval + credit note for shortfalls.

| Task | Description | Test |
|------|-------------|------|
| 1.1 | PO creation page (`/purchase-orders`) — multi-line, vendor, destination warehouse/bin | Can create PO, lines calculate totals |
| 1.2 | **Approval Engine Integration** — PO uses `approvalChains.purchaseOrder` (default 3 steps, toggleable) | PO moves DRAFT → PENDING → APPROVED per config |
| 1.3 | Approval notifications (email + in-app) per step | Email sent at each configured step |
| 1.4 | PO list page — filter by status, vendor, date | Can find any PO |
| 1.5 | **GRN Page** (`/goods-receipt`) — scan PO, enter actual qty, lot #, expiry, bin, condition | GRN posts, stock_ledger updated |
| 1.6 | **3-Way Match Logic** — PO qty vs GRN qty vs Invoice qty | Flags variance automatically |
| 1.7 | **Credit Note Auto-Draft** — if any line `receivedQty < orderedQty`, "Create Credit Note" button appears | Credit note pre-filled with shortfall, Finance manages lifecycle |
| 1.8 | Credit Note page (`/credit-notes`) — Draft → Sent → Accepted → Applied | Full lifecycle tracked |
| 1.9 | Stock Ledger auto-post: GRN (+qty), Credit Note (−qty for payable) | Immutable audit trail |
| 1.10 | Bin put-away — suggest bin, clerk confirms, bin qty updated | Bin shows correct item/lot/qty |
| 1.11 | Printable PO, GRN, Credit Note forms | PDFs match paper forms |
| 1.12 | Unit tests for PO/GRN/CN logic, approval engine, 3-way match | 90%+ coverage |

**Default PO Approval Chain (configurable in System Config):**
```
Step 1: Procurement Head (role: procurement_head)
Step 2: Finance Manager (role: finance_manager)  
Step 3: Plant Manager (role: plant_manager)
```
*Each step must approve before next step sees it. Rejection at any step = PO REJECTED. Flow can be toggled OFF or steps added/removed.*

**Deliverable:** Full procure-to-receive. Vendor → PO → Configurable Approvals → GRN → Stock Updated → Bin Filled → Credit Note if short.

---

### Phase 2: Stock Transfers / Issue to Production (Week 4)
**Goal:** Move material between **any two warehouses** with full traceability.

| Task | Description | Test |
|------|-------------|------|
| 2.1 | Stock Transfer page (`/stock-transfers`) — create transfer from **any warehouse → any warehouse** | Can create transfer, lines show available lots |
| 2.2 | **Two-step confirmation**: Source ISSUES → Destination RECEIVES | Both sides must confirm |
| 2.3 | Lot selection — FEFO suggested (oldest expiry first), clerk can override with reason | Oldest lot suggested first |
| 2.4 | Bin management — from-bin qty decreases, to-bin qty increases | Bin ledger matches |
| 2.5 | Stock ledger entries: TRANSFER_OUT + TRANSFER_IN | Immutable audit trail |
| 2.6 | Transfer uses `approvalChains.stockTransfer` (default: disabled) | Approval works if enabled |
| 2.7 | Transfer list page — filter by status, warehouse, date | Can track in-transit items |
| 2.8 | Return transfer (production → warehouse) for unused material | Reverse flow works |
| 2.9 | Printable transfer note | PDF for warehouse clerk |
| 2.10 | Unit tests for transfer logic, lot selection, bin updates | 90%+ coverage |

**Flow:**
```
1. Production Supervisor creates transfer: "Need 200 kg LABSA for Batch #003"
   → Picks FROM: RM-WH, TO: PF-L9 (or PF-L8, FG-WH, etc.)
2. Warehouse Clerk sees transfer → Picks Lot L-2026-11-10-001 (FEFO suggested) → Issues 200 kg
   → Stock Ledger: TRANSFER_OUT (RM-WH -200 kg)
3. Production Operator receives → Confirms 200 kg at PF-L9-BIN-01
   → Stock Ledger: TRANSFER_IN (PF-L9 +200 kg)
```

**Deliverable:** Material moves between **any warehouses** with full lot traceability.

---

### Phase 3: BOM / Recipe Management (Week 5)
**Goal:** Flexible, versioned recipes with configurable approval.

| Task | Description | Test |
|------|-------------|------|
| 3.1 | BOM page (`/boms`) — CRUD recipes with ingredients, kg/batch, yield % | Can create Premium, Standard, Economy recipes |
| 3.2 | **Versioning** — v1, v2, v3... only one ACTIVE at a time | Can clone v1 → v2, edit, activate |
| 3.3 | **Approval Workflow** — uses `approvalChains.bom` (default 2 steps: Recipe Manager → Plant Manager) | BOM moves DRAFT → PENDING → ACTIVE per config |
| 3.4 | Ingredient validation — all items must exist in Item Master | Cannot add unknown item |
| 3.5 | Yield calculation — batchOutputKg = sum(ingredients) × yield%/100 | Auto-calculates |
| 3.6 | BOM list with version history | Can see all versions |
| 3.7 | **Role-based CRUD** — only `recipe_manager` can create/edit; approvers per config | Permissions enforced |
| 3.8 | Printable BOM sheet for production | PDF with all ingredients |
| 3.9 | Unit tests for BOM math, versioning, approval | 90%+ coverage |

**Deliverable:** Versioned, approved recipes. Production selects active BOM for a run.

---

### Phase 4: Production Planning + Actuals + Variance (Weeks 6-7)
**Goal:** Plan batches, record actual consumption/output, show variance (raw + packing).

| Task | Description | Test |
|------|-------------|------|
| 4.1 | Production Order page (`/production-orders`) — create from active BOM | Select BOM, enter planned batches, auto-calculates planned consumption |
| 4.2 | **Release** → **Start** → **Complete** workflow (uses `approvalChains.productionOrder`) | Status transitions work |
| 4.3 | **Actual Consumption Entry** — enter actual kg per ingredient per lot (lot required) | Clerk enters actuals, lot selection enforced |
| 4.4 | **Variance Calculation** — Actual − Planned per ingredient, auto % | Green/amber/red: <2% ✓, 2-5% ⚠, >5% ✗ |
| 4.5 | **Powder Output** — planned vs actual kg, yield % | Shows actual yield vs standard |
| 4.6 | Lot traceability — input lots linked to output lot | Can trace FG lot → raw material lots |
| 4.7 | Stock ledger: CONSUMPTION entries on actual entry | Stock decreases automatically |
| 4.8 | Production Order list — filter by status, BOM, date | Can find any order |
| 4.9 | **Packing Plan** — Plant Manager sets % split across 7 SKUs (sums to 100%) | Sliders, live validation |
| 4.10 | **Planned Sachets/Cartons** — from powder kg × packing plan × gramSpecs | Auto-calculates using existing gramSpecs |
| 4.11 | **Actual Packing Entry** — per shift, per team, per SKU | Packing operator enters actuals |
| 4.12 | **Packing Variance** — planned vs actual per SKU | Variance table with conditional formatting |
| 4.13 | **Density validation** — manual entry (Plant Manager types powder density) | Density checked against gramSpecs min/max |
| 4.14 | Unit tests for all calculations, variance logic, lot tracing | 95%+ coverage |

**Variance Display:**
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
| 5.2 | Add menu items: **Procurement** (PO, GRN, Credit Notes), **Warehouse** (Stock Transfers, Bin View), **Production** (BOMs, Production Orders, Packing Actuals) |
| 5.3 | Add action roles: `procurement_head`, `finance_manager`, `plant_manager`, `warehouse_clerk`, `production_supervisor`, `recipe_manager`, `packing_operator` |
| 5.4 | Integrate with **ConfigContext** — read `gramSpecs`, `items` for calculations |
| 5.5 | **NO QC Density integration** — manual density entry for packing plan |
| 5.6 | Firestore rules audit for all new collections |
| 5.7 | End-to-end Cypress test: PO → Approval → GRN → Credit Note → Transfer → Production Order → Actuals → Variance |
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
| `finance_manager` | Finance Manager | Finance | Approve PO (step 2), manage Credit Notes, view costs |
| `warehouse_clerk` | Warehouse Clerk | Warehouse | GRN, Stock Transfers, Bin management |
| `warehouse_manager` | Warehouse Manager | Warehouse | View all stock, approve transfers (if enabled) |
| `production_supervisor` | Production Supervisor | Production | Create transfers, production orders, enter actuals |
| `production_operator` | Production Operator | Production | Receive transfers, enter consumption actuals |
| `packing_operator` | Packing Operator | Production | Enter packing actuals |
| `recipe_manager` | Recipe Manager | Production | Create/edit BOMs (step 1 approval) |

### New Action Roles (add to ConfigContext)
| Role ID | Label | Granted To |
|---------|-------|------------|
| `procurement_head` | Procurement Head (PO Approval) | Procurement Manager |
| `finance_manager` | Finance Manager (PO/CN Approval) | Finance Manager |
| `plant_manager` | Plant Manager (PO/BOM Approval) | Plant Manager |
| `recipe_manager` | Recipe Manager (BOM Approval) | Recipe Manager |

### Page Access Matrix
| Page | Path | Department Roles | Action Roles |
|------|------|------------------|--------------|
| Purchase Orders | `/purchase-orders` | procurement_staff, procurement_manager | — |
| PO Approvals | `/po-approvals` | — | procurement_head, finance_manager, plant_manager |
| Goods Receipt | `/goods-receipt` | warehouse_clerk, warehouse_manager | — |
| Credit Notes | `/credit-notes` | finance_manager | — |
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
| **Gram Specs Tab** | Single source of truth for piecesPerCarton, packerBreakdown — planning reads directly |
| **User Roles** | New department/action roles added to ConfigContext → navigation.js → ProtectedRoute |
| **System Config** | New tabs: Item Master, Warehouse Master, Vendor Master, **Approval Chains** |
| **Reports Menu** | Add: "Production Variance Report", "Stock Position Report", "GRN History", "Credit Note Register" |
| **Email Worker** | New templates: PO submitted for approval, GRN posted, Credit Note created, Transfer completed, Variance alert |
| **Dashboard** | Add cards: "Open POs", "Stock Below Min", "Production Orders In Progress", "Top Variances", "Pending Credit Notes" |

---

## 8. Questions for the Plant Manager (3 Decisions) {#questions}

**Answer these 3 and we start Monday:**

| # | Decision | Options | My Recommendation |
|---|----------|---------|-------------------|
| 1 | **Default PO approval steps** | 2 / 3 / 4 | **3** (Procurement → Finance → Plant Manager) |
| 2 | **Stock transfer approval** | ON (1-step: Warehouse Mgr) / OFF | **OFF** (simple two-step: issue + receive is enough control) |
| 3 | **Variance alert threshold** | 2% / 5% / 10% / Configurable | **5% default**, configurable in Approval Chains tab |

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
   → SYSTEM: "Shortfall detected — Create Credit Note?" → Click YES
   → Credit Note CN-0012 auto-drafted: 20 kg × ₦850 = ₦17,000
   → CHECK /bin-view → Bin RM-WH-A-03-2-1 shows: LABSA, Lot L-001, 4,980 kg

6. LOGIN as Finance Manager
   → OPEN /credit-notes → See CN-0012 (DRAFT) → Click "SEND TO VENDOR"
   → Vendor accepts → Click "APPLY" → Payable adjusted

7. OPEN /stock-transfers
   → Create: Move 200 kg LABSA from RM-WH → PF-L9 (user picks destination)
   → Warehouse Clerk: ISSUE 200 kg from Bin RM-WH-A-03-2-1 (Lot L-001 suggested FEFO)
   → Production Operator: RECEIVE 200 kg at PF-L9-BIN-01
   → CHECK /bin-view → RM-WH bin: 4,780 kg | PF-L9 bin: 200 kg

8. OPEN /boms
   → Create "Premium Detergent v1" with 8 ingredients, yield 86.9%
   → Submit for approval → Recipe Manager approves → Plant Manager approves → ACTIVE

9. OPEN /production-orders
   → Create from "Premium v1", 10 batches
   → Planned consumption auto-filled: LABSA 1,200 kg, SLES 800 kg...
   → RELEASE → START

10. LOGIN as Production Operator
    → Enter ACTUAL consumption: LABSA 1,250 kg (Lot L-001), SLES 820 kg...
    → Enter ACTUAL powder output: 9,950 kg
    → Variance table shows: LABSA +50 kg (+4.2%) ⚠️

11. Packing Plan: 25% 22g, 40% 85g, 35% 850g
    → Plant Manager enters powder density: 0.285
    → Planned cartons calculated from powder kg + gramSpecs
    → Packing operator enters actuals per shift
    → Variance per SKU shown

12. OPEN /production-variance
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

1. **Plant Manager answers 3 questions above**
2. **We agree on Phase 0 scope** (exact item list, warehouse layout, vendor list)
3. **Start Phase 0 Monday** — Master data foundation + Approval Engine
4. **Weekly check-ins** — Each phase demoed Friday, next phase planned Monday

---

**This plan is deliberately incremental. Each phase ships working software. No "big bang" at the end.**

**Questions? Changes? Let's discuss Monday.**