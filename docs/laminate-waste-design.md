# Laminate Waste Tracking — Design Document

## 1. What We've Done So Far

### Completed Modules

| Module | Files | Status |
|---|---|---|
| **Carton Waste Tracking** | `CartonWaste.jsx`, `CartonWasteReport.jsx`, `cartonOperations.js` | Live |
| **Reports Centralization** | All 4 reports in 📑 Reports category, data entry stays in departments | Live |
| **Offline Sync** | Separate queue keys (`starium_carton_offline_queue`, `starium_offline_queue`), auto-sync via NetworkContext, SyncBadge shows combined pending count | Live |
| **BroadcastModal Dynamic Targets** | Route chips sourced from `MENU_CONFIG`, "All Screens" toggleable both ways | Live |
| **Save & Next Machine** | Numeric sorted advancement, closes on last machine | Live |
| **Machine Grid** | 3 states: green (checked), gray (unchecked), red (high waste) | Live |
| **Dashboard Command Centre** | 6-column grid, Carton Waste metric, quick actions for all pages | Live |
| **Route Renames** | `/downtime-log` → `/machine-downtime-log`, `/reports` → `/qc-density-report` | Live |
| **SystemConfig** | Carton Waste tab with target/alert/teams settings | Live |

### Key Architectural Patterns Established
- **Firestore**: `carton_records` collection, `shiftApprovalDocId` = `carton_waste_{SHIFT}_{DATE}`
- **Config**: `config.settings.cartonWaste` stores thresholds and teams
- **Service**: `cartonOperations.js` handles CRUD, validation, offline queue, sync, subscriptions
- **Context**: ConfigContext provides live config, NetworkContext manages isOnline + queue state
- **Alerts**: AlertContext broadcasts with target routes from MENU_CONFIG
- **Routing**: App.jsx lazy-imports pages, ProtectedRoute wraps all
- **UI Pattern**: MachineGrid modal form with previous check display, auto-calculated running totals

---

## 2. Current Request — Laminate Waste Tracking

### Business Context
Every machine uses rolls of **laminate** to wrap detergent sachets. During production:
- **Setup waste**: When aligning and setting up a new roll
- **Process waste**: Failed wrapping, QC-rejected powder quality (sachets emptied and discarded)
- **Malfunction waste**: Machine malfunctions produce malformed sachets

Packaging staff take **rounds** to collect laminate waste from each machine using pre-weighed sacs.

### Per-Shift Data
- Each machine has a **known total laminate used** (in kg) for the shift — this comes from production data (roll weight × rolls consumed)
- Staff weigh sacs: `sac weight` known, `gross weight` = sac + collected waste
- `waste collected = gross weight - sac weight`
- Running total accumulated across rounds
- `waste % = running waste collected / total laminate used × 100`

---

## 3. Data Model

### Firestore Collection: `laminate_records`

One document **per round per machine**.

```
{
  shiftApprovalDocId: 'laminate_waste_DAY_2026-06-23',
  machineId: 1,
  machineDisplayNumber: '1',
  machineName: 'Machine 1',
  line: '1A',
  gram: 125,
  
  // Round data:
  roundNumber: 1,           // per-machine: starts at 1, auto-increments
  sacWeight: 0.5,           // known weight of empty sac (kg)
  grossWeight: 8.2,         // weight of sac + collected waste (kg)
  wasteCollected: 7.7,      // grossWeight - sacWeight (auto-computed, kg)
  
  // Shift-level per-machine:
  totalLaminateUsed: 150,   // total kg of laminate used by this machine this shift
  
  // Running totals (cumulative across rounds):
  runningWasteCollected: 7.7,
  wastePercent: 5.13,       // runningWasteCollected / totalLaminateUsed × 100
  
  // Metadata:
  team: 'A',
  checkedBy: 'John Doe',
  shift: 'DAY',
  date: '2026-06-23',
  previousRecordId: null,    // link to previous round for this machine
  remarks: '',
  
  createdAt: Timestamp,
  updatedAt: Timestamp,
  source: 'manual',
  wasOfflineQueued: false,
  offlineSyncId: '...'
}
```

### Firestore Document: `config.settings.laminateWaste`

```
{
  targetWastePercent: 5,
  wasteAlertThreshold: 10,
  teams: ['A', 'B', 'C'],
  defaultTeam: 'A',
  defaultSacWeight: 0.5   // kg, pre-filled on form
}
```

---

## 4. Key Design Decisions

### Decision 1: Match Carton Waste Architecture
**Choice**: Follow the exact same architecture as `carton_records` / `cartonOperations.js`.
**Rationale**: The user said "similar to the Carton Waste Tracking page". Same MachineGrid, same modal pattern, same service layer, same offline sync, same report structure. This minimizes learning curve and maintenance burden.

### Decision 2: `totalLaminateUsed` Per-Machine Per-Shift (Denormalized)
**Choice**: Store `totalLaminateUsed` on every record, not in a separate document.
**Rationale**: This is a shift-level value for each machine but storing it denormalized means every record is self-contained for report queries. No joins needed. Pre-filled from the first round's entry on subsequent rounds.

### Decision 3: Round Number is Per-Machine
**Choice**: Same as carton — `previousCheck.roundNumber + 1`.
**Rationale**: Matches the existing pattern. No global round counter.

### Decision 4: 3-Status Grid (Green/Gray/Red)
**Choice**: Unchecked = no records; Checked = waste% ≤ target; High Waste = waste% > target.
**Rationale**: Identical to Carton Waste. Users already understand this pattern.

### Decision 5: Weights in kg, 2 Decimal Places
**Choice**: All weights in kilograms, displayed to 2 decimal places.
**Rationale**: The user specified kg. 2 decimal places gives 10g precision which is appropriate for sac-level weighing.

### Decision 6: Simpler Validation Than Carton
**Choice**: Only 3 validation rules (no "remaining vs maxAvailable" complexity).
**Rationale**: Laminate waste is simpler — there's no "allocated vs remaining" concept. Just "what did you collect" vs "how much total was used."

### Decision 7: Offline Queue Key = `starium_laminate_offline_queue`
**Choice**: Separate localStorage key (like `starium_carton_offline_queue`).
**Rationale**: Follows the established pattern of one queue per module.

### Decision 8: Broadcast Targets
**Choice**: `['/', '/laminate-waste', '/laminate-waste-report']`
**Rationale**: Following the Carton Waste broadcast pattern (command center + data entry + report).

### Decision 9: Report Under Reports Category
**Choice**: `/laminate-waste-report` goes under the 📑 Reports category.
**Rationale**: All reports are centralized there. `/laminate-waste` remains in Production.

---

## 5. Service Layer: `src/services/laminateOperations.js`

Mirrors `cartonOperations.js` function-for-function:

| Function | Purpose |
|---|---|
| `getLaminateWasteDocId(config)` | Returns `laminate_waste_{SHIFT}_{DATE}` |
| `getOrCreateLaminateWasteShift(config, isOnline)` | Creates/gets shift approval doc |
| `getPreviousLaminateCheck(machineId, shiftApprovalDocId)` | Gets latest round for a machine |
| `validateLaminateCheck(record)` | 3 rules: sacWeight ≤ 0, grossWeight < sacWeight, totalLaminateUsed ≤ 0 |
| `saveLaminateCheck(checkData, config, isOnline)` | Validate + compute + save (online or offline queue) |
| `queueLaminateCheckOffline(record)` | Push to `starium_laminate_offline_queue` |
| `syncLaminateOfflineQueue()` | writeBatch all queued records to `laminate_records` |
| `subscribeToShiftLaminateRecords(config, callback)` | onSnapshot for all records in current shift |
| `subscribeToMachineLaminateHistory(machineId, shiftApprovalDocId, callback)` | onSnapshot for one machine |
| `fetchLaminateRecordsByShift(config, targetShift, targetDate)` | One-time fetch for report |
| `getLaminateWasteSummary(config, targetShift, targetDate)` | Group by machine, compute totals |

### Validation Rules
```
sacWeight <= 0                     → "Sac weight must be greater than 0"
grossWeight < sacWeight            → "Gross weight cannot be less than sac weight"
totalLaminateUsed <= 0             → "Total laminate used must be greater than 0"
```

### Computed Fields
```
wasteCollected = grossWeight - sacWeight
runningWasteCollected = prevRunningWasteCollected + wasteCollected
wastePercent = (runningWasteCollected / totalLaminateUsed) × 100
```

---

## 6. Data Entry Page: `src/pages/LaminateWaste.jsx`

### Layout
- Same header strip: Shift, Date, User, Team selector (persisted in `starium_laminate_team`)
- "View Report →" button links to `/laminate-waste-report`
- Legend: green = checked, gray = unchecked, red = high waste
- Unchecked count badge
- Machine grid by production lines (identical layout to CartonWaste)

### Modal Fields (simpler than Carton)
1. **Total Laminate Used (kg)** — per-machine shift total, pre-filled from previous round's `totalLaminateUsed`
2. **Sac Weight (kg)** — pre-filled from `config.laminateWaste.defaultSacWeight` (default 0.5) or previous round
3. **Gross Weight (kg)** — sac + collected waste

### Auto-Calculated Display
- Waste Collected = Gross - Sac
- Running Waste Collected
- Waste % = Running Waste / Total Laminate Used × 100
- Color-coded (green if ≤ target, red if > target)

### Buttons
- Cancel
- Save & Next Machine (numeric sorted order)
- Save & Close

### Previous Round Banner
- Shows previous round's: Sac Wt, Gross Wt, Waste Collected, Running Waste Collected, Waste %

### Broadcast on Save
- Info broadcast on offline queue: "Laminate check saved offline for M..."
- Warning broadcast if waste% > alert threshold (default 10%)
- Targets: `['/', '/laminate-waste', '/laminate-waste-report']`

---

## 7. Report Page: `src/pages/LaminateWasteReport.jsx`

### Filter Bar
- Date, Shift, Team, Machine — same as CartonWasteReport
- "Generate Report" button
- Collapsible filter bar

### Summary Cards (4 metrics)
| Metric | Description |
|---|---|
| Total Laminate Used | Sum of `totalLaminateUsed` across all machines |
| Total Waste Collected | Sum of `runningWasteCollected` per machine (or sum of all `wasteCollected`) |
| Waste % | (Total Waste Collected / Total Laminate Used) × 100 |
| Machine Count | Number of machines with data |

**Note**: Total Laminate Used per machine is a shift-level constant. If a machine has 3 rounds with `totalLaminateUsed = 150`, the total across all machines = sum of each machine's `totalLaminateUsed` (not summed across rounds).

### Charts
1. **Waste % by Machine** — Horizontal bar chart (same as Carton)
2. **Waste Trend Over Rounds (Top 5)** — Line chart (same as Carton)
3. **Cross-Shift Comparison** — Bar chart (same as Carton)

### Tables
1. **Shift Comparison** — with vs-prev diff arrows (same as Carton)
2. **Per-Machine Breakdown** — Machine, Line, Checks, Laminate Used, Waste Collected, Waste % (similar to Carton)
3. **Round-by-Round Details** — Date/Shift, Team, Machine, Round, Sac Wt, Gross Wt, Waste Collected, Waste %, By (similar to Carton)

### Actions
- **Export CSV** — headers adapted for laminate data
- **Print** — with print styles

---

## 8. Navigation Changes

### `navigation.js`
**Production section**: `/laminate-waste` already exists with icon `🗑️` and roles `['prod_staff', 'prod_manager', 'qc_manager']` — no change.

**Reports section**: Add new entry:
```js
{ path: '/laminate-waste-report', label: 'Laminate Waste Report', icon: '🗑️', allowedRoles: ['prod_manager', 'qc_manager', 'packaging_manager'] }
```

### `App.jsx`
Add two imports and two routes:
```js
import LaminateWaste from './pages/LaminateWaste';
import LaminateWasteReport from './pages/LaminateWasteReport';

// Routes:
<Route path="/laminate-waste" element={<ProtectedRoute><LaminateWaste /></ProtectedRoute>} />
<Route path="/laminate-waste-report" element={<ProtectedRoute><LaminateWasteReport /></ProtectedRoute>} />
```

Note: `/laminate-waste` route already exists in `navigation.js` but may need to be confirmed/present in `App.jsx`.

---

## 9. Config & Context Changes

### `ConfigContext.jsx`
Add to `DEFAULT_CONFIG`:
```js
laminateWaste: {
  targetWastePercent: 5,
  wasteAlertThreshold: 10,
  teams: ['A', 'B', 'C'],
  defaultTeam: 'A',
  defaultSacWeight: 0.5
}
```

Add merge in `onSnapshot`:
```js
laminateWaste: { ...DEFAULT_CONFIG.laminateWaste, ...(data.laminateWaste || {}) },
```

### `NetworkContext.jsx`
Add laminate state + auto-sync:
```js
const [laminateQueueCount, setLaminateQueueCount] = useState(0);
const [isLaminateSyncing, setIsLaminateSyncing] = useState(false);

// Auto-sync effect (same pattern as carton)
// Expose in context value
```

### `SyncBadge.jsx`
Update to include laminate queue:
```js
const { isOnline, queueCount, cartonQueueCount, laminateQueueCount, isSyncing, isCartonSyncing, isLaminateSyncing } = useNetwork();
const syncing = isSyncing || isCartonSyncing || isLaminateSyncing;
const totalPending = queueCount + cartonQueueCount + laminateQueueCount;
```

### `SystemConfig.jsx`
Add new tab button in the tabs bar (next to cartonwaste):
```js
{tab === 'laminatewaste' && '🗑️ Laminate Waste'}
```

Add a `laminateWasteSettings` state (same pattern as `cartonWasteSettings`) with:
- Target Waste % (number input)
- Waste Alert Threshold % (number input)
- Default Sac Weight (kg) (number input, step 0.1)
- Teams (comma-separated text input)
- Default Team (text input)

Add a save button that writes to `config.settings.laminateWaste`.

### `ActiveUsers.jsx`
Add to `PAGE_LABELS`:
```js
'#/laminate-waste': 'Laminate Waste Tracking',
'#/laminate-waste-report': 'Laminate Waste Report',
```

### `Dashboard.jsx`
Add Laminate Waste metric card (like Carton Waste) in grid.
Add Laminate Waste quick actions under Quick Actions section.

---

## 10. Files to Create

| # | File | Action | Purpose |
|---|---|---|---|
| 1 | `src/services/laminateOperations.js` | **Create** | All CRUD + validation + offline queue + sync + subscriptions |
| 2 | `src/pages/LaminateWaste.jsx` | **Create** | Data entry page with MachineGrid + modal |
| 3 | `src/pages/LaminateWasteReport.jsx` | **Create** | Report page with charts, tables, CSV export |

## 11. Files to Modify

| # | File | Changes |
|---|---|---|
| 1 | `src/App.jsx` | Add 2 imports + 2 routes |
| 2 | `src/config/navigation.js` | Add `/laminate-waste-report` to Reports category |
| 3 | `src/context/ConfigContext.jsx` | Add `laminateWaste` defaults + merge |
| 4 | `src/context/NetworkContext.jsx` | Add `laminateQueueCount` + `isLaminateSyncing` + auto-sync |
| 5 | `src/components/SyncBadge.jsx` | Add laminate to pending count + syncing state |
| 6 | `src/pages/SystemConfig.jsx` | Add "Laminate Waste" tab with settings |
| 7 | `src/pages/ActiveUsers.jsx` | Add 2 PAGE_LABELS |
| 8 | `src/pages/Dashboard.jsx` | Add metric card + quick actions |

---

## 12. Clarifying Questions

### Question 1: Sac Weight — Same Sac All Shift or Fresh Each Round?
When staff collect waste, do they:
- **(A) Use the same sac all shift** — first round enters the sac weight, subsequent rounds auto-fill it (pre-filled default or from previous round's entry). The sac weight rarely changes.
- **(B) Use a fresh sac each round** — sac weight must be entered every round (could be different sacs of same nominal weight, e.g. 0.5 kg each).

**My recommendation**: Option (A) with ability to override. Pre-fill `sacWeight` from `config.laminateWaste.defaultSacWeight` (default 0.5 kg). The form field is editable so staff can change it if they swap to a different sac.

### Question 2: Total Laminate Used — When Is It Entered?
- **(A) Entered at start of shift** — the operator knows how many kg of laminate is loaded per machine. Enter it once, it's fixed.
- **(B) Entered at the first round** — alongside the first waste collection for that machine. Pre-filled on subsequent rounds.
- **(C) Entered at end of shift** — after all rounds, the total is known and entered as a final step.

**My recommendation**: Option (B). It's most practical — the operator enters it during the first collection round and it stays constant. Pre-fills automatically for subsequent rounds. A note on the form explains: "Total laminate used this shift for this machine."

### Question 3: What If totalLaminateUsed Changes Mid-Shift?
If a machine runs multiple rolls of laminate and the operator initially estimated 150 kg but later it becomes 160 kg — should we allow editing `totalLaminateUsed` on subsequent rounds?

**My recommendation**: Yes. Each round saves the current `totalLaminateUsed` value. If it changes, the running percent recalculates. The report uses the latest value for each machine (the `totalLaminateUsed` from the last round). This is consistent with how running totals work.

### Question 4: Weight Units Display
Should the machine grid buttons show the latest `wasteCollected` value or `wastePercent` (or both)?

**My recommendation**: Show both — like Carton Waste shows `Alloc:` and `Waste:%`. For laminate, show `Waste:{wasteCollected}kg` and `Waste:{wastePercent}%`.

---

## 13. Comparison: Carton Waste vs Laminate Waste

| Aspect | Carton Waste | Laminate Waste |
|---|---|---|
| Unit | Cartons (count) | Kilograms (weight) |
| Input fields | Allocated, Remaining, Wasted | Total Laminate Used, Sac Weight, Gross Weight |
| Computed fields | Used = PrevRemain + Alloc - Remain | WasteCollected = Gross - Sac |
| Key ratio | Wasted / (Used + Wasted) | WasteCollected / TotalLaminateUsed |
| Validation | 4 rules (remaining ≤ maxAvail, etc.) | 3 simple rules |
| Complexity | Higher (stock tracking logic) | Lower (direct weight measurement) |
| Number precision | Integers | 2 decimal places |
| Grid shows | Alloc, Waste% | WasteCollected(kg), Waste% |

---

## 14. Updated Design (User Decisions Incorporated)

### Sac Types
- **Two fixed types**: Small (default 80g) and Large (default 160g), configurable via System Config
- **UI**: Dropdown in modal, displays "Small Sac (8g)" / "Large Sac (16g)"
- **Pre-filled**: Default sac type from `config.laminateWaste.defaultSacType` (default `'small'`)
- **Previous round**: Automatically selects the same sac type as the previous round

### Total Laminate Used — Auto-Computed
No manual input needed. Computed as:
```
totalLaminateUsed = rollsPerShift × rollWeight[gram]
```
- `rollWeights`: per-gram mapping in config:
  - 22g → 51.32 kg, 45g → 54.40 kg, 85g → 51.60 kg, 125g → 53.70 kg, 850g → 49.90 kg
- `rollsPerShift`: default 3, configurable
- **Machine grid buttons**: Show waste in bold: "Waste: X.XXX kg" on one line, "Y.YY%" on the next

### Modal Fields (Simplified)
1. **Sac Type** dropdown (no sac weight field)
2. **Gross Weight (kg)** input

Auto-calculated display shows: Sac Weight (from lookup), Waste Collected (Gross - Sac), Total Laminate Used, Running Waste Collected, Waste %.

### System Config Tab
| Section | Fields |
|---|---|
| Waste Thresholds | Target Waste %, Alert Threshold % |
| Packaging Teams | Team Labels (comma-separated), Default Team |
| Roll Settings | Rolls per Shift, Roll Weight per Gram (table: 22g–850g) |
| Sac Types | Small Sac Weight (g), Large Sac Weight (g) |

---

## 15. Firestore Security Rules (For Reference)

```
match /laminate_records/{doc} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.resource.data.sacWeight > 0 && request.resource.data.grossWeight >= request.resource.data.sacWeight;
  allow update: if request.auth != null;
  allow delete: if false; // no deletion
}

match /shift_approvals/{doc} {
  // Already configured for carton_waste, add laminate_waste mode
  allow read: if request.auth != null;
  allow create: if request.auth != null;
}
```

---

## 15. Implementation Order

1. Create `laminateOperations.js` — the service foundation
2. Update `ConfigContext.jsx` with defaults + merge
3. Update `navigation.js` and `App.jsx` with routes
4. Create `LaminateWaste.jsx` — data entry page
5. Update `NetworkContext.jsx` + `SyncBadge.jsx` — offline support
6. Update `ActiveUsers.jsx` — PAGE_LABELS
7. Create `LaminateWasteReport.jsx` — report page
8. Update `SystemConfig.jsx` — settings tab
9. Update `Dashboard.jsx` — metric card + quick actions
10. Test flow: data entry → offline → sync → report
