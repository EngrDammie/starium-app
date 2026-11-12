# Plant Manager Demo — Complete Testing Guide

**Live App:** https://starium-rafa-app.web.app  
**All Tests:** 225/225 passing | Build: ✅ | Deployed: ✅

---

## 1. Login Credentials (Pre-seeded)

| Role | Email | Password |
|------|-------|----------|
| Procurement Officer | `procurement.officer@starium.com` | `success123` |
| Procurement Head | `proc.head@starium.com` | `success123` |
| Finance Manager | `finance.mgr@starium.com` | `success123` |
| Plant Manager | `plant.mgr@starium.com` | `success123` |
| Warehouse Clerk | `warehouse.clerk@starium.com` | `success123` |
| Production Supervisor | `prod.supervisor@starium.com` | `success123` |
| Recipe Manager | `recipe.mgr@starium.com` | `success123` |

---

## 2. Demo Flow — End-to-End Procure-to-Produce

### Step 1: Create Purchase Order (Procurement Officer)
1. Login as `procurement.officer@starium.com`
2. Navigate: **Procurement → Purchase Orders**
3. Click **➕ New PO**
   - Vendor: **ChemSol Nigeria Ltd**
   - Destination Warehouse: **Raw Material Warehouse (RM-WH)**
   - Add line: **LABSA** — 5,000 kg @ ₦850/kg
   - Bin: **RM-WH-A-03-2-1** (dropdown shows available bins)
   - Expected Delivery: Today
4. Click **💾 Create & Submit**
5. Verify: PO shows **"PENDING APPROVAL (Step 1 of 3)"**
6. Click **📄 PDF** — downloads professional PO document

### Step 2: 3-Step Approval Chain
1. **Login as Procurement Head** → **Procurement → PO Approvals**
   - See PO → Click **✅ Approve** → Status: "Step 2 of 3"
2. **Login as Finance Manager** → **Procurement → PO Approvals**
   - Click **✅ Approve** → Status: "Step 3 of 3"
3. **Login as Plant Manager** → **Procurement → PO Approvals**
   - Click **✅ Approve** → Status: **"APPROVED"**
   - Email notification sent at each step

### Step 3: Goods Receipt (GRN) + Credit Note (Warehouse Clerk)
1. **Login as Warehouse Clerk** → **Procurement → Goods Receipt**
2. See approved PO → Click **📥 Receive**
3. Fill: Received 4,980 kg (20 kg short), Lot: `L-2026-11-12-001`, Bin: `RM-WH-A-03-2-1`, Condition: GOOD
4. Click **📥 Post GRN**
5. **Shortfall detected** → Click **🧾 Create Credit Note**
6. Verify: Credit Note auto-created with PO prices (₦850/kg × 20 kg = ₦17,000)
6. **Login as Finance Manager** → **Procurement → Credit Notes**
   - See CN in **DRAFT** → Click **📤 Send** → **ACCEPTED** → **💰 Apply**
7. **Login as Warehouse Clerk** → **Warehouse → Bin View**
   - Select RM-WH → Bin `RM-WH-A-03-2-1` shows **LABSA, Lot L-2026-11-12-001, 4,980 kg**

### Step 4: Stock Transfer (Production Supervisor → Warehouse Clerk)
1. **Login as Production Supervisor** → **Procurement → Stock Transfers**
   - Create: Move 200 kg LABSA from **RM-WH** → **PF-L9 (Level 9)**
   - From Bin: `RM-WH-A-03-2-1` (shows current stock)
   - To Bin: `PF-L9-BIN-01`
   - Submit for approval (1-step: Warehouse Manager)
2. **Login as Warehouse Manager** → **Stock Transfers** → Approve
3. **Login as Warehouse Clerk** → Click **📤 Issue** → Stock deducted from RM-WH
4. **Login as Production Operator** → Click **📥 Receive** → Enter received qty → Stock added to PF-L9
5. **Bin View** → Verify: RM-WH bin = 4,780 kg | PF-L9 bin = 200 kg

### Step 5: BOM / Recipe (Recipe Manager)
1. **Login as Recipe Manager** → **Production → BOMs / Recipes**
2. Click **➕ New Recipe** → "Premium Detergent v1"
   - Yield: 86.9%, Ingredients: LABSA 120, SLES 80, Soda Ash 300, etc.
3. **📤 Submit** → Approval chain: Recipe Manager → Plant Manager
4. **Activate** → Shows in "Active BOMs (Ready for Production)"

### Step 6: Production Order + Variance (Production Supervisor)
1. **Production → Production Orders** → Create from "Premium v1", 10 batches
   - Auto-calculates: LABSA 1,200 kg, SLES 800 kg, Powder OUT: 10,000 kg
2. **Release → Start**
3. **Record Actuals**: LABSA 1,250 kg (+4.2%), Powder OUT 9,950 kg (-0.5%)
4. **Packing Actuals**: Enter actual cartons per shift per SKU
5. **Production → Production Variance** → See full variance report
   - Raw material variance table (Green/Amber/Red)
   - Packing variance per SKU
   - Export **📄 PDF** for Monday meeting

---

## 3. Key Features to Highlight

| Feature | Demo Point |
|---------|------------|
| **Configurable Approvals** | Show System Config → Approval Chains (toggle ON/OFF, change steps/roles) |
| **Credit Note Auto-Draft** | GRN shortfall → CN created with PO prices automatically |
| **Bin-Level Tracking** | Bin View shows exact item/lot/qty per shelf |
| **Any Warehouse → Any Warehouse** | Transfer RM-WH → PF-L9, PF-L8, FG-WH, OFF-ST |
| **PDF Generation** | Every document has professional PDF download |
| **Email Notifications** | Sent at each approval step (check Cloudflare Worker logs) |

---

## 4. Test Data to Pre-Load (Run in Browser Console)

```javascript
// Seed master data (items, warehouses, bins, vendors)
import { seedMasterData } from './src/services/inventoryOperations.js';
await seedMasterData();
// Returns: { items: 15, warehouses: 5, vendors: 3 }
```

---

## 5. Monitoring & Logs

| Component | URL |
|-----------|-----|
| Firebase Console | https://console.firebase.google.com/project/starium-rafa-app |
| Cloudflare Worker | https://dash.cloudflare.com/.../workers/starium-leave-mail |
| Firestore Rules | Console → Firestore → Rules |

---

## 6. Technical Verification

| Check | Status |
|-------|--------|
| Unit Tests | 225/225 passing |
| Build | ✅ Success |
| Firebase Hosting | ✅ Deployed |
| GitHub Pages | ✅ Auto-deploy on push |
| Cloudflare Worker (Email) | ✅ Deployed |
| Firestore Rules | ✅ Deployed |

---

**Live App:** https://starium-rafa-app.web.app  
**GitHub Repo:** https://github.com/EngrDammie/starium-app

---

**Ready for Plant Manager demo!** 🚀