# Starium Rafa ERP — Complete Replacement Plan for Microsoft Dynamics 365 Business Central

**Date:** November 10, 2026  
**Author:** Engr. Damilare Paul Ayodele (Dammie Optimus Solutions)  
**Status:** Strategic Planning Document  
**Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Honest Assessment: Can Starium Replace Dynamics 365 BC?](#honest-assessment)
3. [Three Strategic Options](#three-strategic-options)
4. [Detailed "Bit by Bit" 9-Phase Implementation Plan](#detailed-bit-by-bit-plan)
5. [MVP Approach — What You Actually Need](#mvp-approach)
6. [Resource Requirements](#resource-requirements)
7. [My Commitment & What I Need From You](#my-commitment)
8. [First Step: Week 1 Discovery & Spec](#first-step)
9. [Bottom Line](#bottom-line)
10. [Appendix: Core Concepts Reference](#appendix-core-concepts)

---

## 1. Executive Summary {#executive-summary}

**The short answer: Yes, we can build a complete ERP replacement for Microsoft Dynamics 365 Business Central, incrementally, tested thoroughly, together. But it is a 12-18 month commitment requiring 3-4 senior engineers.**

The current Starium Rafa ERP excels at **shop-floor execution** (QC checks, production tracking, leave management, dashboards). It does **not** have financials, procurement, warehouse management, BOM management, production orders, or cost accounting — the core of what Dynamics 365 BC does.

This document outlines a complete, phased plan to build the missing modules incrementally, with rigorous testing at each step, so the Plant Manager and CEO can decide whether to proceed.

---

## 2. Honest Assessment: Can Starium Replace Dynamics 365 BC? {#honest-assessment}

### The Gap: What Dynamics Does That Starium Doesn't

| Domain | Dynamics 365 BC | Starium Rafa (Current) |
|--------|-----------------|------------------------|
| **Procurement** | Purchase Orders, Vendor Catalogs, RFQ, Approval Workflows, Blanket Orders | ❌ None |
| **Raw Materials Warehouse** | Bin-level tracking, Lot/Serial/Expiry, Put-away/Pick, Cycle Counts, Reservations | ❌ None |
| **Stock Transfers** | Warehouse→Warehouse, Inter-company, Transfer Orders, In-Transit | ❌ None |
| **Production** | BOM Versions, Routings, Work Centers, Capacity Planning, Subcontracting | Partial (QC checks only) |
| **Finished Goods** | Warehouse mgmt, Lot tracking, Expiry, Quality holds, Recall mgmt | ❌ None |
| **Cost Accounting** | Standard/Actual/FIFO/Average, Variance Analysis, WIP, Overhead absorption | ❌ None |
| **General Ledger** | Chart of Accounts, Dimensions, Multi-currency, Intercompany, Consolidation | ❌ None |
| **AP/AR** | Vendor/Customer ledgers, Payment terms, Dunning, Intrastat, VAT | ❌ None |
| **Financial Reporting** | P&L, Balance Sheet, Cash Flow, Trial Balance, Budget vs Actual | ❌ None |
| **Compliance** | Audit trails, Change logs, SOX, GDPR, Local GAAP/IFRS | Partial (audit trails only) |

**Dynamics 365 BC = ~30 years of ERP development. Starium = ~1 year of specialized QC/Production tracking.**

---

### The Plant Manager's Actual Flow

He described a specific flow:
1. **Procurement buys** → Raw Materials Warehouse receives
2. **Raw Materials Warehouse** → Production Inventory (issue to production)
3. **Production makes batches** → Finished Goods

This is **core manufacturing ERP**. Three architectural paths exist.

---

## 3. Three Strategic Options {#three-strategic-options}

### Option A: Integrate With Dynamics (Recommended)

**Keep Dynamics as the "System of Record" for Finance/Inventory. Starium stays the "Shop Floor Execution System."**

| System | Owns |
|--------|------|
| **Dynamics 365 BC** | Vendors, POs, GRNs, Raw Material Stock, GL, AP/AR, Costing, Financial Reports |
| **Starium Rafa** | Machine-level QC, String weights, Bag/Carton inspection, Pallet transfers, Waste tracking, Shift approvals, Leave |

**Integration Points:**

| Event | Direction | Method |
|-------|-----------|--------|
| PO Created / GRN Posted | Dynamics → Starium | API/Webhook: Update "Available Raw Materials" for QC reference |
| Raw Material Issued to Production | Dynamics → Starium | API: Reduce RM stock, create Production Order in Starium |
| QC Check Completed | Starium → Dynamics | API: Post QC results to Lot/Item record |
| Pallet Transfer Completed | Starium → Dynamics | API: Update Finished Goods stock, create Warehouse Entry |
| Waste Recorded | Starium → Dynamics | API: Post Scrap/Waste to Production Order |

**Pros:**
- Dynamics stays the compliant financial backbone
- Starium stays focused on shop-floor excellence
- Lower risk, faster to deliver (3-4 weeks integration)
- Plant Manager keeps Dynamics for accounting

**Cons:**
- Two systems to maintain
- Integration middleware needed

---

### Option B: Build Full ERP In-House (12-18 months)

**If they want to *replace* Dynamics eventually.**

| Phase | Duration | Scope |
|-------|----------|-------|
| 1. Foundation | 4 weeks | COA, Dimensions, Vendors, Items, UoM |
| 2. Procurement | 6 weeks | RFQ, PO, GRN, 3-Way Match, Vendor Portal |
| 3. RM Warehouse | 8 weeks | Bins, Lots, Expiry, Put-away/Pick, Cycle Count, Reservations |
| 4. BOM & Routings | 6 weeks | Versions, phantoms, co-products, routings, cost rollup |
| 5. Production Orders | 10 weeks | Lifecycle, consumption, output, capacity, subcontracting |
| 6. FG Warehouse | 6 weeks | Bins, lots, expiry, ship, returns, recalls |
| 7. Cost Accounting | 8 weeks | Standard/Actual, variances, WIP, overhead, period close |
| 8. Financial Core | 12 weeks | GL, AP/AR, Bank Rec, VAT, Fixed Assets, Budgeting |
| 9. Reporting & Compliance | 12 weeks | Reports, audit trail, role segregation, DR |

**Total: 12-18 months. 3-4 senior engineers.**

---

### Option C: Hybrid — "Dynamics Lite" (5-6 months)

**Build only what the Plant Manager described. Defer full GL/AP/AR.**

| Module | Scope | Effort |
|--------|-------|--------|
| Vendor/PO/GRN | Create PO → Receive → Auto-create RM Stock | 3 weeks |
| RM Warehouse | Bins, Lots, Expiry, Pick/Put-away, Cycle Count | 4 weeks |
| Stock Transfer (RM→Prod) | Transfer Order, In-Transit, Auto-issue to Prod Order | 3 weeks |
| Production Orders | BOM, Routing, Start/Finish, Consumption/Output | 4 weeks |
| FG Warehouse | Bins, Lots, Expiry, Ship, Returns | 3 weeks |
| Basic Costing | Standard Cost, Material/Labor Variance, WIP | 3 weeks |
| Dynamics Sync | Push Stock/PO/Prod data to Dynamics via API | 2 weeks |

**Total: ~22 weeks (5-6 months). 2 senior engineers.**

---

## 4. Detailed "Bit by Bit" 9-Phase Implementation Plan {#detailed-bit-by-bit-plan}

### Phase 1: Foundation (Weeks 1-4)

| Deliverable | Test Criteria |
|-------------|---------------|
| Chart of Accounts + Dimensions | Can post journal, trial balance balances |
| Vendor/Customer Master | CRUD, search, vendor categories |
| Item Master (Raw/FG/Service) | Units, UoM conversion, item categories |
| Unit of Measure + Conversion | kg↔g, pc↔box, pallet↔carton |

**Test:** Post 100 journals, verify TB zeros out.

---

### Phase 2: Procurement (Weeks 5-10)

| Deliverable | Test Criteria |
|-------------|---------------|
| Purchase Quotes/RFQ | Compare 3 vendors, award PO |
| Purchase Orders | Approval workflow, email to vendor |
| GRN + 3-Way Match | PO✓ GRN✓ Invoice✓ = Pay; variance → Credit Note |
| Vendor Portal (optional) | Vendor sees PO, submits ASN |

**Test:** Process 50 POs end-to-end, 3-way match on all, zero manual corrections.

---

### Phase 3: Raw Material Warehouse (Weeks 11-18)

| Deliverable | Test Criteria |
|-------------|---------------|
| Bin Management | Zone/Aisle/Rack/Shelf, capacity, put-away rules |
| Lot/Serial/Expiry | Lot creation, FEFO picking, expiry alerts |
| Put-away / Pick / Transfer | Directed, confirmed, qty tracked per bin |
| Cycle Count | Schedule, count sheets, variance adjustment |
| Reservations | Link RM lot → Production Order |

**Test:** 1,000 put-aways/picks, zero lost inventory, 99.9% bin accuracy.

---

### Phase 4: BOM & Routings (Weeks 19-24)

| Deliverable | Test Criteria |
|-------------|---------------|
| BOM Versions | Phantom, co-product, by-product, substitute |
| Routings | Work centers, setup/run time, overlap, queue time |
| Cost Rollup | BOM + Routing → Standard Cost per unit |

**Test:** Roll 50 BOMs, compare to manual calc, zero variance.

---

### Phase 5: Production Orders (Weeks 25-34) — **Hardest Part**

| Deliverable | Test Criteria |
|-------------|---------------|
| Prod Order Lifecycle | Create→Release→Start→Finish→Close |
| Material Consumption | Backflush + Manual, lot tracking |
| Output Posting | Good qty, scrap, rework, co-products |
| Capacity Planning | Load per work center, finite scheduling |
| Subcontracting | Send out, receive back, cost |

**Test:** Run 100 production orders end-to-end, trace every lot from RM→FG.

---

### Phase 6: Finished Goods Warehouse (Weeks 35-40)

| Deliverable | Test Criteria |
|-------------|---------------|
| FG Bins/Lots/Expiry | FEFO, quality holds, recall ready |
| Ship/Delivery | Pick→Pack→Ship, ASN, proof of delivery |
| Returns/RMA | Credit, restock, scrap, repair |

**Test:** Ship 500 orders, zero wrong items, 100% lot traceability.

---

### Phase 7: Cost Accounting (Weeks 41-48)

| Deliverable | Test Criteria |
|-------------|---------------|
| Standard Cost | BOM + Routing rollup |
| Actual Cost | Material/Labor/Overhead actuals |
| Variance Analysis | Price/Usage/Labor/Overhead variances |
| WIP Valuation | Period-end WIP, completion % |
| Period Close | COGS, inventory reval, GL integration |

**Test:** Month-end close in <4 hours, variances explainable to CFO.

---

### Phase 8: Financial Core (Weeks 49-60)

| Deliverable | Test Criteria |
|-------------|---------------|
| GL + Dimensions | Multi-dimension posting, drill-down |
| AP/AR | Aging, payments, dunning, statements |
| Bank Reconciliation | Auto-match, manual adjust |
| VAT/Intrastat | NG compliance, e-invoicing ready |
| Fixed Assets | Depreciation, transfer, disposal |
| Budget vs Actual | Versioned, multi-year |

**Test:** Full audit trial balance, external auditor sign-off.

---

### Phase 9: Reporting & Compliance (Weeks 61-72)

| Deliverable | Test Criteria |
|-------------|---------------|
| Financial Reports | P&L, BS, CF, TB, GL Detail |
| Operational Reports | Stock aging, production efficiency, waste |
| Audit Trail | Immutable, tamper-evident, searchable |
| Role Segregation | Maker/checker, approval matrices |
| Backup/DR | RPO < 1hr, RTO < 4hr |

**Test:** External auditor review, zero findings.

---

## 5. MVP Approach — What You Actually Need {#mvp-approach}

**You don't need 100% of Dynamics to replace it for *your* factory.**

| What You Actually Need (MVP) | What You Can Defer |
|------------------------|-------------------|
| ✅ PO/GRN/3-Way Match | ⏳ Multi-currency |
| ✅ RM Warehouse (bins, lots, expiry) | ⏳ Intercompany |
| ✅ Stock Transfer RM→Prod | ⏳ Consolidation |
| ✅ BOM + Production Orders | ⏳ Fixed Assets |
| ✅ FG Warehouse + Ship | ⏳ Budgeting |
| ✅ Basic Costing (std/actual) | ⏳ Advanced Analytics |
| ✅ GL + AP/AR + VAT | ⏳ Multi-entity |
| ✅ Basic Reporting | ⏳ SOX Compliance |

**MVP = Phases 1-6 only. ~34 weeks. Covers 80% of daily operations.**

---

## 6. Resource Requirements {#resource-requirements}

| Resource | Minimum |
|-----------|---------|
| **Time** | 12-18 months full focus (MVP: 34 weeks) |
| **Team** | 3-4 senior engineers (you + 2-3) |
| **Domain Expert** | 1 finance/controller (50% time) |
| **Test Users** | 2-3 warehouse/production staff (part-time) |
| **Infrastructure** | Firebase/Cloudflare (already have) |
| **Patience** | Immense |

---

## 7. My Commitment & What I Need From You {#my-commitment}

### My Commitment

**If you want to do this, I will:**

1. **Architect every phase** with you before coding
2. **Write the spec** for each module before we start
3. **Build incrementally** — one testable piece at a time
4. **Write tests first** (TDD) — every feature has tests before code
5. **Review every PR** — no code merges without review
6. **Deploy to staging weekly** — real users test before production
7. **Document everything** — you own the knowledge, not me

### What I Need From You

- Be the **product owner** — decide priorities, approve specs
- Provide **domain expertise** — finance rules, warehouse flows, Nigerian compliance
- Allocate **real test users** — not "we'll test later"
- Commit **budget for 2 more engineers** — this is too big for 1 person

---

## 8. First Step: Week 1 Discovery & Spec {#first-step}

### Week 1: Discovery & Spec

| Day | Activity |
|-----|----------|
| Mon | Map current Dynamics data: COA, Vendors, Items, Warehouses, BOMs |
| Tue | Define COA + Dimensions for Starium (simpler than Dynamics) |
| Wed | Design Vendor/Item/PO/GRN data model (Firebase collections) |
| Thu | Write acceptance tests for PO→GRN→3-Way Match |
| Fri | Sprint plan: Phase 1 sprint backlog |

**Decision point Friday:** Do we proceed to Phase 2?

---

## 9. Bottom Line {#bottom-line}

**Yes, we can build it. Bit by bit. Tested thoroughly. Together.**

But it's **not a side project**. It's a **company-building effort**.

| If they want... | Reality |
|----------------|---------|
| "Dynamics but cheaper" in 3 months | **Impossible. Walk away.** |
| "A system that actually works for our factory" in 12 months | **Let's start Monday.** |

**If the Plant Manager and CEO are ready to invest 12-18 months and 3-4 engineers, we can build something better than Dynamics *for your specific factory* — simpler, faster, offline-first, yours.**

---

## 10. Appendix: Core Concepts Reference {#appendix-core-concepts}

### A. Batch & BOM

| Term | Definition |
|------|------------|
| **BOM (Bill of Materials)** | The recipe — what goes in, how much, what version |
| **Batch** | One execution of that recipe — unique, traceable, auditable |

**Connection:**
```
BOM (Recipe)          BATCH (One Cooking Session)
─────────────         ───────────────────────
│ Item: 85g Detergent  │ Batch ID: B-2026-11-10-003
│ Version: v3.2       │ BOM Version: v3.2
│ Lines: 8 components │ Machine: Line 4, Filler 2
│ Total: 100%         │ Shift: Day, Team A
└─────────────         │ Start: 06:15 → End: 14:30
                       │ Input: LABSA 125kg, Soda 300kg...
                       │ Output: 11,764 sachets (1,000 kg)
                       │ Yield: 98.2%
                       │ QC: PASS
                       └──────────────────────────
```

---

### B. GRN (Goods Received Note)

**The "We Got It" receipt.**

| Document | Created By | When | Purpose |
|----------|------------|------|---------|
| **PO** | Procurement | Before ordering | "Vendor, please send 5,000 kg LABSA @ ₦850/kg" |
| **GRN** | Your Warehouse | When truck arrives | "We received 4,980 kg LABSA (20 kg short), Lot #L-2026-11-09" |

**3-Way Match (Accounts Payable Gold Standard):**

| | PO | GRN | Invoice | Result |
|---|----|-----|---------|--------|
| **Qty** | 5,000 kg | 4,980 kg | 5,000 kg | **Mismatch!** |
| **Price** | ₦850/kg | — | ₦850/kg | Match |
| **Total** | ₦4,250,000 | — | ₦4,250,000 | — |

**Action:** Pay for **4,980 kg × ₦850 = ₦4,233,000**. Request credit note for 20 kg.

---

### C. Lots, Lot Numbers & Lot Tracking

| Term | Definition |
|------|------------|
| **Lot** | A family of identical material made/bought together |
| **Lot Number** | The lot's unique ID (like a fingerprint) |
| **Lot Tracking** | Recording every move of every lot from purchase to customer |

**Why it matters:** Customer complains → Trace to **Batch #003** → **Raw Material Lot #L-2026-11-09** → Recall **only 2,300 sachets** (not 6 months of production).

---

### D. Invoice

**The vendor's formal request for payment.**

| Document | From | To | Purpose |
|----------|------|----|---------|
| **PO** | You → Vendor | "Please send this" |
| **GRN** | You (internal) | "We got this" |
| **Invoice** | Vendor → You | **"Pay me for what I shipped"** |

**3-Way Match = PO + GRN + Invoice must agree before paying.**

---

### E. Bin & Credit Note

| Term | Definition |
|------|------------|
| **Bin** | The exact shelf address where a specific lot sits (like a parking spot) |
| **Credit Note** | Vendor's "we owe you" — reduces what you pay (negative invoice) |

**Bin Example:** `RM-WH-A-03-2-1` = Raw Material Warehouse, Zone A, Aisle 3, Rack 2, Shelf 1

**Credit Note Flow:**
```
Invoice: 5,000 kg × ₦850 = ₦4,250,000
GRN: 4,980 kg (20 kg short)
3-Way Match FAILS
→ Credit Note: 20 kg × ₦850 = ₦17,000
Adjusted Payable: ₦4,250,000 - ₦17,000 = ₦4,233,000
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-10 | Dammie Optimus Solutions | Initial release |

---

**End of Document**