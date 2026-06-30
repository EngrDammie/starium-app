# Starium Rafa Enterprise Resource Planner (ERP)

Welcome to the **Starium Rafa ERP**! An enterprise-grade, offline-capable web application built to monitor, record, and analyze factory metrics in real-time.

Built for Powder Density tracking, Carton/Laminate Waste management, and QC Sachet Production Checks, the platform is structured to scale into a full factory ERP system encompassing Production, Human Resources, and Quality Control.

---

## Table of Contents

1. [About the Project](#about-the-project)
2. [Key Features](#key-features)
3. [Enterprise Security (The Keycard System)](#enterprise-security-the-keycard-system)
4. [Factory Modules](#factory-modules)
5. [Firebase Collections](#firebase-collections)
6. [localStorage Keys](#localstorage-keys)
7. [Tech Stack](#tech-stack)
8. [System Architecture](#system-architecture)
9. [Service Layer Reference](#service-layer-reference)
10. [Local Setup & Installation](#local-setup--installation)
11. [Deployment](#deployment-github-pages--actions)
12. [Future Roadmap](#future-roadmap)

---

## About the Project

Factory floors often suffer from spotty internet connections. Standard web apps break when the Wi-Fi drops, causing lost data and frustrated workers.

This application solves that problem. It is built as an **Offline-First Application**. QC and Production staff can continuously enter density test results, carton waste data, laminate waste data, and QC inspection checks even if the internet goes completely down. The app queues everything safely in the browser's memory and instantly uploads it to the cloud the millisecond the internet returns.

When users log in, they land on the **Command Center**, providing a high-level overview of active shifts and tests. Factory Managers can watch data stream into their executive dashboards in real-time, view automated charts, receive targeted alert broadcasts, and digitally sign off on shift approvals.

---

## Key Features

- **Factory Command Center**: Centralized dashboard with 8 live metric cards (Live Users, Level 9 Tests, BOT Tests, Empty Silos, Stopped Machines, Carton Waste, Laminate Waste, QC Sachet Checks). Clickable links navigate managers to their respective executive dashboards. Super admins get a clickable Live Users card linking to the Active Users page. Quick Actions section provides role-based shortcuts to all factory modules.
- **Offline-First Engine**: 6 independent offline queues with auto-sync on reconnect. Tests are queued locally with perfect timestamp preservation and synced via `writeBatch`.
- **Real-Time Executive Dashboards**: Level 9 and BOT live views with Chart.js line charts showing density trends, shift approval workflows, and machine grid density matching.
- **Targeted Broadcast Alerts**: Admins and system events can blast real-time, color-coded popup messages to specific screens (or all screens) across the factory. Three levels: Info (blue), Warning (orange), Critical (red with shake animation). Auto-dismisses after 15 seconds.
- **Shift History Modal**: Floor workers can review all tests submitted during their active shift with exact timestamps and buggy numbers.
- **Dynamic Admin Panel**: SystemConfig page with 9 tabs — add/edit/delete machines, define production lines, configure gram specs with pieces/bags/freebies breakdown, manage role definitions, toggle global settings (density rules, shift times, packaging teams), configure QC check intervals and string weight ranges, manage carton waste thresholds, laminate waste settings (sac types, roll weights), and import/export/reset configuration.
- **Automated Reporting**: Printer-friendly (A4 Landscape) reports with Chart.js analytics (line charts, doughnut charts, bar charts), CSV exports per machine, and cross-shift comparison tables with vs-prev diff arrows.
- **Empty Silos System**: Cross-shift live tracking of machines marked as empty with real-time broadcasts to Command Center and data entry pages. Auto-refill detection when density tests are saved triggers the refill modal. Dedicated manager report with color-coded machine grid and refill counters (buggy numbers).
- **Stopped Machines System**: Cross-shift tracking of stopped machines with reusable issue definitions (stored in `machine_issues` collection), click-once issue solving, START button (hidden when machine already running), sparkle animation, 4-color machine state grid (normal/stopped/issues-cleared/running/started-with-issues), and dedicated real-time manager report. Supports appending additional issues to already-stopped machines — the UI filters out pre-existing issues and warns when typing a duplicate label.
- **Carton Waste System**: Per-machine carton waste tracking with per-machine round numbering, 3-status machine grid (unchecked/checked/high-waste), smart validation (remaining <= available, wasted <= available, used + wasted <= allocated), running totals (allocated, used, wasted, waste%), and "Save & Next Machine" flow. Full report page with waste% by machine bar chart, waste trend over rounds (top 5) line chart, cross-shift comparison table with vs-prev diff arrows, per-machine breakdown table, round-by-round detail table, and CSV export. High waste alerts broadcast to Command Center and carton waste pages. Offline queue via `starium_carton_offline_queue`.
- **Laminate Waste System**: Per-machine laminate waste tracking using weights (kg) instead of quantities. Staff collect waste in pre-weighed sacs (configurable small 80g / large 160g) and record gross weight each round. Total laminate used auto-computed from machine gram: `rollsPerShift x rollWeight[gram]`. Sac type dropdown, auto-calculated waste collected (gross - sac weight), running waste totals, 3-status machine grid, and full report page. Offline queue via `starium_laminate_offline_queue`.
- **QC Sachet Production Checks**: Per-machine production quality monitoring with 3 action buttons per machine (String Weight Check, Bag Inspection, Carton Inspection). Each check type has a configurable cooldown interval and depends on String Weight Round 1 being completed first. All 3 share the same Batch Number (entered in String Weight Round 1, read-only thereafter). Each check type has independent round numbering, real-time subscriptions, history view, and offline queue. Shift-wide approval flow with dual approvers (QC Supervisor + Line Leader), broadcast on approval, and approval badges. Dedicated report page with Print/CSV export and color-coded string weight display.

### QC Check Types Detail

| Check Type | Cooldown Default | Criteria | Grading | Overall Result |
|---|---|---|---|---|
| **String Weight Check** | 15 min | Fill head weights (2-4 per machine) | 5-level validation (Too Low / Low / Target / High / Too High) per gram config | All-in-target + Meets Criteria Y/N |
| **Bag Inspection** | 15 min | 6 criteria (Leakage, Dirt & Print, Completeness of Sachets, Freebies Presence, Perforation, Perfume Odour) | A / M / U | Pass (all A), Conditional (any M), Fail (any U) |
| **Carton Inspection** | 60 min | 5 criteria (Detergent/Dust, Carton Print Quality, Seal Quality, Carton Damage, Carton Code Readability) | A / U | Pass (all A), Fail (any U) |

### Command Center & Quick Actions

- **Command Center Card**: Live shift summary card on the main page showing real-time record counts for all 3 check types (String Weight, Bag Inspection, Carton Inspection) plus total. Visible to all users. "View Reports" link shown only for super_admin and qc_manager.
- **Quick Actions Bar**: Machine selector dropdown + per-check-type shortcut buttons (String Weight, Bag Inspection, Carton Inspection) with live cooldown status. Manager-only buttons for "Approve Shift" and "View Reports" shown beside the check buttons. All visible on the main page without clicking into a machine.

Note: The "Approve Shift" and "View Reports" buttons were moved from the approval badges area into the Quick Actions bar (approval badges remain).

---

## Enterprise Security (The Keycard System)

Instead of rigid job titles, this app uses a **Modular Role-Based Access Control (RBAC)** system. Permissions are like "Keycards" on a worker's lanyard.

### Three Security Layers

1. **`systemRole` (The Master Key)**: `super_admin` bypasses all checks. `standard` must rely on department keycards.
2. **`departmentRoles` (Page Access)**: e.g. `qc_staff`, `qc_manager`, `prod_manager`, `hr_manager`. Controls sidebar visibility and page access via `ProtectedRoute`.
3. **`actionRoles` (Button Powers)**: e.g. `plc_operator`, `buggy_supervisor`, `qc_supervisor`, `line_leader`. Dictates which approval buttons appear on Executive Dashboards and QC Sachet approval modal.

### Ghost Admin Fallback

If the Master Auth Toggle is turned OFF in System Config, the app bypasses Firebase login and grants everyone temporary `super_admin` access for emergency/kiosk use. The user appears as "Developer Admin" with a local-dev-id UID.

### Presence System

Users' online status tracked via `presence` collection. 3-minute heartbeat interval. 5-minute stale-entry safety net in subscriptions. Tab close and logout both trigger offline status. Used by Dashboard Live Users card and Active Users page.

---

## Factory Modules

### 1. Level 9 Silos
- Density range: 0.200 - 0.310, Divisor: 1580
- Requires assigning Buggy Numbers to specific Machines
- Tracks Appearance and Fragrance

### 2. B.O.T. (Base Powder)
- Density range: 0.200 - 0.240, Divisor: 1680
- Tracks Appearance and Flow Property (Free Flowing)

### 3. Carton Waste
- Per-machine allocated/remaining/used/wasted tracking
- Per-machine round numbering, 3-status grid, smart validation
- "Save & Next Machine" flow, report with charts and CSV export

### 4. Laminate Waste
- Per-machine weight-based tracking using sac types (small/large)
- Auto-computed total laminate used from machine gram
- 3-status grid, "Save & Next Machine", report with charts

### 5. QC Sachet Production Checks
- 3 check types: String Weight, Bag Inspection, Carton Inspection
- Per-machine per-check-type round numbering
- Dependency: Bag & Carton locked until String Weight R1 complete
- Shared batch number, configurable cooldowns, offline queues

### 6. Empty Silos
- Mark machines as empty with real-time broadcasts
- Auto-detect refill when density test saved for previously-empty machine
- Cross-shift tracking with buggy number assignment

### 7. Stopped Machines
- Reusable issue definitions stored in `machine_issues`
- Report, solve issues, start machines, append more issues
- 4-color state grid, auto-filled Issue Selector dropdown

---

## Firebase Collections

| Collection | Document ID Pattern | Purpose |
|---|---|---|
| `config/settings` | single doc | All app configuration (machines, lines, gramSpecs, qcCheckIntervals, fillHeadWeightRanges, cartonWaste, laminateWaste, roles) |
| `config/auth_settings` | single doc | `{ authEnabled: boolean }` |
| `user_roles` | `{uid}` | User profiles with systemRole, departmentRoles, actionRoles, firstName, lastName |
| `shift_approvals` | `{mode}_{SHIFT}_{DATE}` | Shift boundary docs shared across check types. Modes: `level9`, `bot`, `carton_waste`, `laminate_waste`, `qc_string_weight` |
| `qc_tests` | auto-ID | Powder density test results. Fields: approvalDocId, mode, machineId, density, weight, team, checkedBy, etc. |
| `carton_records` | auto-ID | Carton waste check records. Fields: machineId, shiftApprovalDocId, allocated, remaining, wasted, used, wastePercent, running* |
| `laminate_records` | auto-ID | Laminate waste check records. Fields: machineId, shiftApprovalDocId, sacType, grossWeight, wasteCollected, totalLaminateUsed, runningWasteCollected |
| `presence` | `{uid}` | User online status. Fields: uid, email, status, lastSeen, currentPath |
| `alerts` | auto-ID | Broadcast alerts. Fields: title, message, level, targetPages, localTimestamp |
| `empty_silos` | auto-ID | Empty silo events. Fields: machineId, markedEmptyBy, markedEmptyAt, noLongerEmptyAt, buggyNumber, shiftApprovalDocId |
| `stopped_machines` | auto-ID | Stopped machine records. Fields: machineId, stoppedBy, stoppedAt, startedBy, startedAt, issues[], isActive |
| `machine_issues` | auto-ID | Reusable issue definitions. Fields: label, createdBy |
| `qc_string_weight_checks` | auto-ID | String weight check records. Fields: machineId, approvalDocId, roundNumber, weights[], weightStatuses[], batchNumber, meetsCriteria, allInTarget, outOfRangeCount |
| `qc_bag_inspection_checks` | auto-ID | Bag inspection check records. Fields: machineId, approvalDocId, roundNumber, leakage, dirtPrintQuality, completenessSachets, freebiesPresence, perforation, perfumeOdour, overallResult, batchNumber |
| `qc_carton_inspection_checks` | auto-ID | Carton inspection check records. Fields: machineId, approvalDocId, roundNumber, detergentDust, cartonPrintQuality, sealQuality, cartonDamage, cartonCodeReadability, overallResult, batchNumber |

---

## localStorage Keys

| Key | Module | Purpose |
|---|---|---|
| `starium_offline_queue` | QC Tests | Powder density test offline queue |
| `starium_carton_offline_queue` | Carton Waste | Carton waste check offline queue |
| `starium_laminate_offline_queue` | Laminate Waste | Laminate waste check offline queue |
| `starium_qc_string_weight_queue` | String Weight | String weight check offline queue |
| `starium_bag_inspection_queue` | Bag Inspection | Bag inspection check offline queue |
| `starium_carton_inspection_queue` | Carton Inspection | Carton inspection check offline queue |
| `starium_carton_team` | Carton Waste | Persisted team selection |
| `starium_laminate_team` | Laminate Waste | Persisted team selection |
| `starium_qc_sachet_team` | QC Sachet | Persisted team selection |
| `qcTeam` | Powder Density | Persisted team selection (legacy) |

---

## Tech Stack

- **Frontend Framework**: React 18 (via Vite)
- **Styling**: Tailwind CSS v3
- **Routing**: React Router v6 (HashRouter for static hosting)
- **Database & Auth**: Firebase (Firestore V9 Modular SDK)
- **Charts**: Chart.js & React-Chartjs-2
- **Build Tool**: Vite / Rolldown
- **CI/CD**: GitHub Actions (build & deploy to GitHub Pages)

---

## System Architecture

### Directory Structure

```
src/
├── main.jsx                         # Entry point, provider nesting
├── App.jsx                          # Route definitions (21 routes)
├── index.css                        # Tailwind directives + base styles
├── config/
│   ├── firebase.js                  # Firebase init (env vars)
│   └── navigation.js                # MENU_CONFIG sidebar structure + role-based route protection rules
├── context/
│   ├── AuthContext.jsx              # Firebase auth, role management, presence heartbeat
│   ├── ConfigContext.jsx            # Live Firestore config subscription, DEFAULT_CONFIG
│   ├── NetworkContext.jsx           # Online/offline detection, 5 queue auto-sync
│   └── AlertContext.jsx             # Real-time alert subscription, broadcastAlert()
├── components/
│   ├── Layout.jsx                   # Page shell: sidebar, authbar, syncbadge, alertbanner, footer
│   ├── Sidebar.jsx                  # Accordion navigation with role-based visibility
│   ├── ProtectedRoute.jsx           # Route guard: super_admin bypass, role check, redirect
│   ├── AuthBar.jsx                  # Top-right user email + logout button
│   ├── SyncBadge.jsx                # Online/offline indicator with pending queue count
│   ├── AlertBanner.jsx              # Real-time toast notifications with page targeting
│   ├── BroadcastModal.jsx           # Send alert form with level + page target selection
│   ├── Footer.jsx                   # Hover-to-reveal contact info footer
│   ├── MachineGrid.jsx              # Density-matching colored machine grid
│   ├── MachineModal.jsx             # Machine detail modal with carton content
│   ├── QCStringWeightDialog.jsx     # String weight check form dialog
│   ├── QCBagInspectionDialog.jsx    # Bag inspection check form dialog
│   └── QCCartonInspectionDialog.jsx # Carton inspection check form dialog
├── pages/
│   ├── Dashboard.jsx                # Command Center with 7 metric cards + quick actions
│   ├── PowderDensity.jsx            # Data entry: Level 9 & BOT tests with machine grid
│   ├── Level9Exec.jsx               # Level 9 executive dashboard with charts + approval
│   ├── BotExec.jsx                  # BOT executive dashboard with charts + approval
│   ├── Reports.jsx                  # QC Density Report with charts and filters
│   ├── SystemConfig.jsx             # 9-tab admin panel for all factory configuration
│   ├── UserManagement.jsx           # CRUD for user roles and profiles
│   ├── ActiveUsers.jsx              # Real-time active user table
│   ├── Login.jsx                    # Firebase email/password login + password reset
│   ├── ChangePassword.jsx           # Re-authenticate + change password
│   ├── EmptySilos.jsx               # Mark machines as empty
│   ├── EmptySilosReport.jsx         # Empty silos manager report
│   ├── StopMachine.jsx              # Report, solve, start, append issues
│   ├── StoppedMachinesReport.jsx    # Stopped machines manager report
│   ├── MachineDowntimeLog.jsx       # View machine downtime events by date/shift
│   ├── CartonWaste.jsx              # Carton waste data entry
│   ├── CartonWasteReport.jsx        # Carton waste report with charts
│   ├── LaminateWaste.jsx            # Laminate waste data entry
│   ├── LaminateWasteReport.jsx      # Laminate waste report with charts
│   ├── QCSachetProductionChecks.jsx # QC monitoring with 3 check types + approval flow
│   └── QCSachetReport.jsx           # QC Sachet printable report with Print/CSV export
└── services/
    ├── qcOperations.js              # QC Tests CRUD, shift approval, offline queue
    ├── cartonOperations.js          # Carton waste CRUD, validation, offline queue
    ├── laminateOperations.js        # Laminate waste CRUD, validation, offline queue
    ├── qcStringWeightOperations.js  # String weight CRUD, offline queue, weight status
    ├── qcBagInspectionOperations.js # Bag inspection CRUD, offline queue, overall result
    ├── qcCartonInspectionOperations.js # Carton inspection CRUD, offline queue, overall result
    ├── emptySiloOperations.js       # Empty silo CRUD, subscriptions, broadcasts
    ├── stoppedMachineOperations.js  # Stopped machine CRUD, issue management
    ├── machineDowntimeOperations.js # Machine downtime query by date/shift
    └── presenceOperations.js        # User online/offline status, heartbeat, subscriptions
```

### Context Providers (Nesting Order)

1. **HashRouter** - URL routing (hash-based for static hosting)
2. **AuthProvider** - Firebase auth state, role fetching, presence heartbeat
3. **NetworkProvider** - Online/offline detection, offline queue auto-sync
4. **ConfigProvider** - Live config subscription, DEFAULT_CONFIG fallback
5. **AlertProvider** - Real-time alert subscription, broadcastAlert function
6. **App** - Routes (21 protected + 1 public)

### Shift Boundary Logic

All time-based modules share the same shift detection:
- DAY shift: `dayShiftStart` (default 07:00) to `nightShiftStart` (default 19:00)
- NIGHT shift: `nightShiftStart` (19:00) to next day's `dayShiftStart` (07:00)
- Night shift dates roll back: tests submitted at 2AM belong to the previous day's shift
- Doc ID pattern: `{mode}_{SHIFT}_{YYYY-MM-DD}` stored in `shift_approvals` collection

---

## Service Layer Reference

Each service module follows consistent patterns:

### Offline Queue Pattern
- Online: write to Firestore with `serverTimestamp()`, return `'saved'`
- Offline/write fails: push to localStorage array, return `'queued'` or `'offline-queued'`
- Sync on reconnect: read queue, `writeBatch.set()` with `localCreatedAt` preserved, clear queue

### Subscription Pattern
- `subscribeTo{Resource}(params, callback)` returns `unsubscribe` function
- Callback receives sorted array of records
- Error handler logs error and calls callback with `[]`

### Validation Pattern
- `validate{Check}()` returns `{ valid: boolean, message?: string }`
- `save{Check}()` calls validation first, rejects with message if invalid

---

## Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_GITHUB_NAME/starium-rafa-qc-app.git
   cd starium-rafa-qc-app
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root folder:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

---

## Deployment (GitHub Pages + Actions)

This app is deployed via GitHub Actions. Push to `main` triggers build and deploy to GitHub Pages.

The workflow (.github/workflows/deploy.yml):
1. Checks out code
2. Injects Firebase env vars from GitHub Secrets
3. Runs `npm run build`
4. Publishes `dist/` to GitHub Pages

---

## Future Roadmap

- ✅ **Laminate Waste System**: Complete with reports, offline support, broadcasts
- ✅ **Carton Waste System**: Complete with reports, offline support, broadcasts
- ✅ **QC Sachet Production Checks**: String Weight, Bag Inspection, and Carton Inspection — all complete with cooldowns, dependencies, offline queues, round history, shift-wide approval flow (QC Supervisor + Line Leader), and dedicated report page
- ✅ **QC Sachet Report**: Print-friendly report with 3-section tables (String Weights, Bag Inspection, Carton Inspection), date/shift/team/machine filters, approver badges, and CSV export
- ✅ **Empty Silos System**: Complete with refill detection and broadcasts
- ✅ **Stopped Machines System**: Complete with issue management and broadcasts
- [ ] **Audit Trail**: Background logging system to record who modified settings, deleted users, or overrode machines
- [ ] **Mobile Layout Enhancements**: Further optimization for smaller mobile devices

---

*Built with extreme attention to detail for the Starium Rafa Factory. Formerly Starium Rafa Quality Control Tool.*
