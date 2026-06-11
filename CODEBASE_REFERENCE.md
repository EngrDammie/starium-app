# Starium App - Complete Codebase Reference

## Project Identity

**Name:** Starium Rafa Enterprise Resource Planner (ERP)  
**Purpose:** Enterprise-grade, offline-capable web application for monitoring, recording, and analyzing factory powder density metrics in real-time. Initially built for Powder Density tracking; structured to scale into a full factory ERP (Production, HR, Quality Control).  
**Repository Base:** `/home/dammieoptimus/Documents/starium-app`

---

## Tech Stack & Tooling

| Layer | Technology | Version |
|---|---|---|
| Framework | React + ReactDOM | 19.2.6 |
| Bundler | Vite | 8.0.12 |
| Router | React Router DOM | 7.15.1 (HashRouter) |
| Styling | Tailwind CSS | 3.4.19 |
| Database/Auth | Firebase (Firestore V9 Modular SDK) | 12.13.0 |
| Charts | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| Linting | ESLint + react-hooks + react-refresh | 10.x |
| Deploy | GitHub Pages + GitHub Actions | — |

### Key Config Files
- **`vite.config.js`**: `base: '/starium-app/'` — must match GitHub repo name for Pages deploy
- **`tailwind.config.js`**: Custom theme:
  - `primary`: `#00BCD4` / `dark: #0097A7`
  - `dark.bg`: `#121212`, `dark.card`: `#1E1E1E`, `dark.hover`: `#252525`
  - `status.success`: `#00E676`, `status.danger`: `#F44336`, `status.warning`: `#FF9800`
- **`postcss.config.js`**: Standard Tailwind + Autoprefixer
- **`.github/workflows/deploy.yml`**: Triggers on `push` to `main`, injects Firebase secrets from GitHub repo settings, runs `npm run build`, uploads `dist/` to GitHub Pages

### Environment Variables (`.env`)
All prefixed with `VITE_`:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID     → starium-rafa-app
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### NPM Scripts
```json
"dev": "vite",
"build": "vite build",
"lint": "eslint .",
"preview": "vite preview"
```

---

## Application Architecture

### Provider Tree (`src/main.jsx`)
Providers are nested in this exact order:
```
HashRouter → AuthProvider → NetworkProvider → ConfigProvider → AlertProvider → App
```
Each provider wraps all children, meaning all components have access to all contexts.

### Routing (`src/App.jsx`)
All routes use `ProtectedRoute` wrapper (except `/login`):

| Route | Component | Access |
|---|---|---|
| `/login` | Login | Public |
| `/change-password` | ChangePassword | Authenticated |
| `/` | Dashboard | All authenticated users |
| `/powder-density` | PowderDensity | QC/Prod staff & managers |
| `/level9-exec` | Level9Exec | QC/Prod managers |
| `/bot-exec` | BotExec | QC/Prod managers |
| `/system-config` | SystemConfig | Super admin only (empty allowedRoles) |
| `/user-management` | UserManagement | Super admin only |
| `/active-users` | ActiveUsers | Super admin only |
| `/empty-silos` | EmptySilos | QC staff, QC managers |
| `/empty-silos-report` | EmptySilosReport | QC managers, Prod managers, Packaging managers |
| `/reports` | Reports | QC/Prod managers, HR managers |

Future routes exist in `MENU_CONFIG` but have no components yet: `/laminate-waste`, `/downtime-log`, `/employees`, `/payroll`.

---

## Security Model — "Keycard System" (Modular RBAC)

Three independent security layers per user, stored in `user_roles/{uid}` Firestore document:

### 1. `systemRole` — The Master Key
| Value | Effect |
|---|---|
| `super_admin` | Bypasses ALL security checks. Sees every page, every button. |
| `standard` | Must rely on departmentRoles and actionRoles. |

### 2. `departmentRoles` — Page Access
Controls which pages a user can navigate to and which sidebar items appear. Defined dynamically in `config/settings`:

| Role ID | Label | Category |
|---|---|---|
| `qc_staff` | QC Staff | Quality Control |
| `qc_manager` | QC Manager | Quality Control |
| `prod_staff` | Production Staff | Production |
| `prod_manager` | Production Manager | Production |
| `hr_staff` | HR Staff | Human Resources |
| `hr_manager` | HR Manager | Human Resources |

### 3. `actionRoles` — Button Powers
Controls which specific approval buttons a user can click on executive dashboards. Defined dynamically in `config/settings`:

| Role ID | Label |
|---|---|
| `buggy_supervisor` | Buggy Supervisor |
| `plc_operator` | PLC Operator |
| `production_manager` | Production Manager |
| `qc_manager` | QC Manager |
| `qc_supervisor` | QC Supervisor |

### Enforcement Mechanisms

**`ProtectedRoute` (`src/components/ProtectedRoute.jsx`)**:
1. Waits for auth loading to finish
2. Redirects to `/login` if no user
3. If `systemRole === 'super_admin'` → grants access
4. Looks up `allowedRoles` for the current path via `getAllowedRolesForPath()`
5. If `allowedRoles` is empty array → only super_admin allowed, deny + redirect
6. Checks if user has at least one matching `departmentRoles` → deny + redirect if not

**`Sidebar` (`src/components/Sidebar.jsx`)**:
- Pre-filters `MENU_CONFIG` to only show categories/links the user can access
- Uses same `canViewRoute()` logic: super_admin sees everything, standard users need matching departmentRoles

**Hardcoded Owner Fallback** (`AuthContext.jsx:74-79`):
User with email `dammieoptimus@gmail.com` is automatically granted `super_admin` + all department manager roles regardless of database settings.

**Ghost Admin Mode** (`AuthContext.jsx:37-47`):
When `config/auth_settings.authEnabled` is `false`, the app bypasses Firebase login entirely and grants temporary super_admin access with all department and action roles. Used for emergency/kiosk scenarios.

---

## Navigation Configuration (`src/config/navigation.js`)

```javascript
MENU_CONFIG = [
  { title: 'Factory Overview', icon: '🏢', children: [...] },
  { title: 'Quality Control', icon: '🔬', children: [...] },
  { title: 'Production', icon: '⚙️', children: [...] },
  { title: 'Human Resources', icon: '👥', children: [...] },
  { title: 'Administration', icon: '🛡️', children: [...] },
]
```

Each child route has `{ path, label, icon, allowedRoles }`. The `getAllowedRolesForPath(path)` function iterates all categories to find the matching route and returns its `allowedRoles` array.

**Important**: Admin routes (`/system-config`, `/user-management`, `/active-users`) have `allowedRoles: []` — meaning ONLY super_admin can access them. Standard users are always denied. Other routes use explicit role arrays.

---

## Context Providers — Deep Dive

### AuthContext (`src/context/AuthContext.jsx`)

**State exposed**: `currentUser`, `systemRole`, `departmentRoles`, `actionRoles`, `firstName`, `lastName`, `userFullName`, `loading`, `authEnabled`

**Initialization flow**:
1. Subscribes to `config/auth_settings` via `onSnapshot`
2. If auth disabled → sets ghost admin state immediately
3. If auth enabled → uses `onAuthStateChanged` to listen for Firebase auth changes
4. On login → fetches `user_roles/{uid}` document, extracts roles, handles backward compatibility (old `role` field maps to `systemRole`/`departmentRoles`)
5. Applies title case to names; falls back to email username if no name set

**Presence Heartbeat** (second `useEffect`):
1. Calls `setOnlineStatus(uid, email, currentHash)` immediately on login
2. Sets `setInterval` every 3 minutes to refresh the heartbeat
3. Listens to `beforeunload` to call `setOfflineStatus(uid)` on tab close
4. Cleanup on logout: clears interval, removes listener, sends offline signal

### ConfigContext (`src/context/ConfigContext.jsx`)

**State exposed**: `config`, `loadingConfig`

**DEFAULT_CONFIG** (used as fallback if Firestore doc doesn't exist yet):
```javascript
{
  level9MinDensity: 0.200, level9MaxDensity: 0.310, level9Divisor: 1580,
  botMinDensity: 0.200, botMaxDensity: 0.240, botDivisor: 1680,
  dayShiftStart: 7, nightShiftStart: 19,
  machineGridColumns: 6,
  productionLines: [{id: "1A", ...}, {id: "1B", ...}, ... 6 lines total],
  machines: [3 default machines],
  gramSpecs: { "22": {...}, "45": {...}, "85": {...}, "125": {...}, "850": {...} },
  departmentRoles: [6 predefined roles],
  actionRoles: [5 predefined roles]
}
```

**Live listener**: `onSnapshot` on `config/settings`. Merges live data with defaults, preserving arrays (machines, productionLines, gramSpecs, roles). If doc doesn't exist, creates it with defaults + timestamps.

### NetworkContext (`src/context/NetworkContext.jsx`)

**State exposed**: `isOnline`, `queueCount`, `setQueueCount`, `isSyncing`, `setIsSyncing`

**Offline Engine**:
1. Initializes `isOnline` from `navigator.onLine`
2. Listens to `online`/`offline` browser events
3. Reads `localStorage.getItem('starium_offline_queue')` to get queue count
4. When `isOnline` becomes `true` AND `queueCount > 0` → triggers `syncLocalQueue()`

**Sync Logic**:
- Iterates queued items, adds each to `qc_tests` collection
- Converts `localCreatedAt` back to Firestore `Timestamp`
- Adds `syncedAt: serverTimestamp()`, `wasOfflineQueued: true`, `offlineSyncId`
- Removes `localCreatedAt` and `syncId` fields before saving
- On success → removes item from queue; on failure → keeps it for retry
- If all succeed → clears entire queue from localStorage

### AlertContext (`src/context/AlertContext.jsx`)

**State exposed**: `alerts`, `broadcastAlert`, `setAlerts`

**How it works**:
1. Records `sessionStartTime` on mount
2. Subscribes to `alerts` collection where `localTimestamp >= sessionStartTime` (only new alerts since page load)
3. On `added` change → appends to state, auto-removes after 15 seconds
4. `broadcastAlert(title, message, level, targetPages)` → writes to Firestore `alerts` collection

**Alert levels**: `info` (blue), `warning` (orange), `danger` (red + shake animation)  
**Target pages**: Array of route paths, defaults to `['all']`

---

## Services Layer

### qcOperations (`src/services/qcOperations.js`)

**`getShiftDateInfo(config)`**:
- Returns `{ shift: 'DAY'|'NIGHT', date: 'YYYY-MM-DD' }`
- If hour >= `dayShiftStart` and < `nightShiftStart` → DAY shift, today's date
- If hour >= `nightShiftStart` → NIGHT shift, today's date
- If hour < `dayShiftStart` (early morning) → NIGHT shift, yesterday's date

**`getOrCreateShiftApproval(mode, config, isOnline)`**:
- Doc ID format: `${mode}_${shift}_${date}` (e.g., `level9_DAY_2026-06-09`)
- If offline → returns docId without Firestore call
- If online → checks if doc exists in `shift_approvals`, creates with `status: 'pending'` if not

**`saveQCTest(testData, isOnline, setQueueCount)`**:
- If online → tries `addDoc` to `qc_tests`; on error, falls back to offline queue
- If offline → queues to localStorage

**`queueOffline(testData, setQueueCount)`**:
- Generates `syncId` = timestamp + random string
- Stores `localCreatedAt` for timestamp preservation
- Pushes to `starium_offline_queue` in localStorage

**`subscribeToShiftTests(mode, config, callback)`**:
- Queries `qc_tests` where `approvalDocId == ${mode}_${shift}_${date}`
- Sorts oldest-to-newest (handles both Firestore timestamps and `localCreatedAt`)
- Returns unsubscribe function

**`subscribeToShiftApproval(approvalId, callback)`**:
- Listens to `shift_approvals/{approvalId}` via `onSnapshot`
- Returns unsubscribe function

**`addApprover(approvalId, approverName, approverRole)`**:
- Updates `shift_approvals` doc with `{[approverRole]: {name, role, timestamp}}`
- Note: `approverRole` key is camelCase (e.g., `buggySupervisor`, `plcOperator`)

### emptySiloOperations (`src/services/emptySiloOperations.js`)
- **`getEmptySilosDocId(config)`**: Returns `empty_silos_{shift}_{date}` as the shift approval document ID for empty silos records.
- **`subscribeToActiveEmptySilos(callback)`**: Cross-shift query: `where('noLongerEmptyAt', '==', null)`. Returns every machine across all shifts/days that is still empty and not yet refilled. Powers the live grid in Dashboard count, EmptySilos page, EmptySilosReport grid, and PowderDensity auto-refill detection.
- **`subscribeToShiftEmptySilos(config, callback)`**: Shift-scoped query: filters by current shift's `shiftApprovalDocId`. Used only for the "Refilled This Shift" counter in EmptySilosReport (and potential historical reporting).
- **`markMachineEmpty(machine, userFullName, config, broadcastAlert)`**: Creates an `empty_silos` document with machine details, marker identity, and timestamp. Fires a `warning`-level broadcast to `/`, `/powder-density`, `/level9-exec`, `/bot-exec`.
- **`markMachineNoLongerEmpty(recordId, buggyNumber, userFullName, config, broadcastAlert, machine)`**: Updates an existing empty_silos record with buggy number and refill timestamp. Fires an `info`-level broadcast.

### presenceOperations (`src/services/presenceOperations.js`)

**`setOnlineStatus(uid, email, path)`**:
- Writes to `presence/{uid}`: `{uid, email, status: 'online', lastSeen: serverTimestamp(), currentPath}`, with merge

**`setOfflineStatus(uid)`**:
- Updates `presence/{uid}`: `{status: 'offline', lastSeen: serverTimestamp()}`, with merge

**`subscribeToActiveUsers(callback)`**:
- Queries `presence` where `status == 'online'`
- Filters: only includes users whose `lastSeen` is within 300,000ms (5 minutes) of now
- Safety net for users who died without sending goodbye signal
- Called by Dashboard (for live count badge) and ActiveUsers page (for full table)

---

## Pages — Detailed Breakdown

### Login (`src/pages/Login.jsx`)
- Firebase email/password sign-in via `signInWithEmailAndPassword`
- Does NOT navigate after sign-in — relies on `useEffect` watching `currentUser` from AuthContext to redirect to `/`
- Password reset modal using `sendPasswordResetEmail`
- Links to `/change-password`

### ChangePassword (`src/pages/ChangePassword.jsx`)
- Requires re-authentication via `reauthenticateWithCredential` before allowing password change
- Validates: min 6 chars, must match confirmation, must differ from current
- Redirects to `/login` after 2s success

### Dashboard (`src/pages/Dashboard.jsx`) — "Factory Command Center"
- Displays 5 metric cards:
   1. **Live Users** — count from `subscribeToActiveUsers` (green pulse indicator); super-admins see this as a clickable `<Link to="/active-users">`
   2. **Level 9 Tests** — count from `subscribeToShiftTests('level9')`
   3. **BOT Tests** — count from `subscribeToShiftTests('bot')`
   4. **Empty Silos** — live count from `subscribeToActiveEmptySilos` (cross-shift, red pulse if > 0); clickable `<Link to="/empty-silos">` for QC staff/managers; shows "All Filled" or "⚠️ Needs Attention"
   5. **Stopped Issues** — placeholder (coming soon)
- Welcome banner showing user's name, email, systemRole, and department categories
- Quick action links filtered by user roles
- Categories dynamically derived from `config.departmentRoles` (not hardcoded)

### EmptySilos (`src/pages/EmptySilos.jsx`) — Mark Machines Empty
- Guarded: QC staff/managers only (also checks internally)
- Subscribes to `subscribeToActiveEmptySilos()` for cross-shift real-time empty record list
- Renders a machine grid (same layout as Level 9 PowderDensity) colored **green** (filled) / **red** (empty)
- Clicking a machine opens a modal with machine details and a "Mark as Empty" button
- Button uses `window.confirm()` for safety; on confirm, calls `markMachineEmpty()` which creates the Firestore record + fires a warning broadcast
- Once marked, the machine's button shows red and the modal shows "Already Marked Empty" with the marker's name
- Quick action: "Report Empty Silos" link in Dashboard for same roles

### EmptySilosReport (`src/pages/EmptySilosReport.jsx`) — Real-Time Empty Status Report
- Guarded: QC managers, Production managers, Packaging managers
- No date selection — always loads real-time data from current state
- Uses **dual subscription**: `subscribeToActiveEmptySilos()` for the live grid (cross-shift), `subscribeToShiftEmptySilos()` for the "Refilled This Shift" counter (shift-scoped)
- Three summary cards: Empty/Total count (cross-shift), Empty Percentage (color-coded by severity), Refilled count (current shift only)
- Machine grid: **green** = filled (no active empty record), **red** = empty (clickable for details)
- Clicking a red machine opens a modal showing: machine details, who marked it empty, **human-readable empty duration** (e.g. "2h 15m ago"), and buggy number if refilled
- Quick action: "Empty Silos Report" link in Dashboard for same roles

### PowderDensity (`src/pages/PowderDensity.jsx`) — Data Entry Form
- **Mode selector**: Level 9 Silo Densities vs BOT Densities
- **Shift**: auto-detected (disabled field)
- **Team**: A/B/C dropdown (persisted to localStorage)
- **Name**: read-only, auto-filled from `userFullName` in AuthContext

**Level 9 mode fields**:
- Powder weight input → calculates density = weight / `config.level9Divisor` (1580)
- MachineGrid shows which machines match the density
- Buggy Number input
- Silo/Machine Numbers (comma-separated or click grid)
- Appearance (A/U), Fragrance (A/U)
- Remarks textarea

**BOT mode fields**:
- Powder weight input → calculates density = weight / `config.botDivisor` (1680)
- Appearance (A/U), Free Flowing (A/U)
- Remarks textarea

**Auto-remarks generation** (useEffect watching form state):
- Automatically appends: density too low/high warnings, machine override notes, buggy assignments, appearance/fragrance/flow flags
- Preserves any manually typed remarks by filtering out auto-generated lines and re-prepending

**Save flow**:
1. Validates team, weight, calculated density
2. Gets/creates shift approval doc (online or offline-safe)
3. Builds `testData` object with `qcName: userFullName`
4. Calls `saveQCTest()` → online or offline
5. If density is out of range → triggers `broadcastAlert()` with danger level, targeted to relevant pages
6. **Level 9 only**: If selected machines have active empty records, calls `markMachineNoLongerEmpty()` for each, setting buggy number and refill timestamp, firing an info broadcast
7. Shows success/queued message, resets form after 2s

**Shift History Modal** (bottom-right floating button):
- Shows all tests for current shift in a table
- Time, weight, density, status badge, buggy, machines, appearance, fragrance/flow

### Level9Exec (`src/pages/Level9Exec.jsx`) — Executive Dashboard
- Header badges: Mode, Shift, Date, Tests count, QC Staff, Team, Last Test time
- Large current density display with status indicator (normal/low/high)
- **MachineGrid** showing machine status for latest test's density
- **Remarks display** from latest test
- **Shift Approvals** section with 5 approval buttons:
  - Buggy Supervisor, PLC Operator, Production Manager, QC Manager, QC Supervisor
  - Each checks user's `actionRoles` before allowing click
  - Approved buttons show approver name + green styling
- **Density Trend Chart** (Line chart, last 10 tests via Chart.js)
- **Recent Tests Table** (last 10, all columns)
- Approval confirmation modal shows `userFullName` (no manual input)
- On approval success → broadcasts "SHIFT APPROVED!" alert
- Floating "Switch to BOT Mode" button → navigates to `/bot-exec`

### BotExec (`src/pages/BotExec.jsx`) — Executive Dashboard (BOT)
- Nearly identical to Level9Exec but:
  - No MachineGrid (BOT doesn't use machines)
  - 4 approval buttons (no Buggy Supervisor)
  - Table shows Flow instead of Fragrance
  - Floating "Switch to Level 9" button → navigates to `/level9-exec`

### SystemConfig (`src/pages/SystemConfig.jsx`) — Admin Panel
6 tabs:

**1. Machines Tab**:
- CRUD for machines: ID, Display Number, Name, Line, Gram, Min/Max (auto-filled from gram specs)
- Search by name/ID, filter by line
- Stats: total machines, production lines count

**2. Lines Tab**:
- CRUD for production lines: ID, Name, Order (1 = rightmost in grid)
- Shows machine count per line

**3. Gram Specs Tab**:
- CRUD for gram specifications: Gram, Min Density, Max Density, Pieces/Carton, Breakdown
- Min/Max density ranges are auto-filled for machines based on gram setting

**4. Role Definitions Tab** (two-column layout):
- **Department Roles**: Add roles with Category, ID (auto-lowercase+underscore), Label. Groups by category.
- **Action Roles**: Add roles with ID, Label. Simple list.

**5. Global Settings Tab**:
- Level 9: Min/Max density, Divisor
- BOT: Min/Max density, Divisor
- Shift times: Day start, Night start (24h)
- UI: Machine Grid Columns
- Master Auth Toggle: enable/disable Firebase login (Ghost Admin mode)

**6. Import/Export Tab**:
- Export: downloads JSON backup of all config (machines, lines, gramSpecs, roles, settings)
- Import: uploads JSON, overwrites current config (with confirmation)
- Reset to Defaults: double-confirmation, restores 30-machine factory default config

### ActiveUsers (`src/pages/ActiveUsers.jsx`)
- Guarded: non-super_admin users see a restricted message (dual layer with `ProtectedRoute`)
- Subscribes to `subscribeToActiveUsers()` from `presenceOperations` for real-time online user list
- Resolves display names from `user_roles/{uid}` Firestore documents with in-memory caching (`useRef`) to avoid redundant reads on snapshot updates
- Renders a table with columns: **Name** (title-cased), **Email**, **Current Page** (human-readable label mapped from hash path), **Last Heartbeat** (relative time: "3m ago")
- Page labels mapped via `PAGE_LABELS` constant; unknown paths fall back to a cleaned-up format
- Super_admin-only: dashboard card links to this page; sidebar entry in Administration menu

### UserManagement (`src/pages/UserManagement.jsx`)
- Guarded: redirects non-super_admin users away
- **Add User form**:
  - First Name, Last Name, Email, Temp Password
  - System Role: standard or super_admin
  - Department Access: checkbox grid grouped by category (hidden for super_admin)
  - Approval Powers: checkbox chips for action roles (hidden for super_admin)
  - Creates Firebase auth user via REST API (`identitytoolkit.googleapis.com/v1/accounts:signUp`)
  - Writes `user_roles/{uid}` document with names, email, roles, timestamps
- **Users table**: Name, Email, System Role badge, Department badges (color-coded), Edit/Delete buttons
- **Edit modal**: Modify names, system role, department roles, action roles
- **Delete modal**: Confirms removal of `user_roles/{uid}` document (does NOT delete Firebase auth user)

### Reports (`src/pages/Reports.jsx`)
- **Filter panel**: Date picker, Mode (level9/bot), Shift (DAY/NIGHT), Generate button
- **Report display** (white background for print):
  - Title, metadata grid (Mode, Shift, Date, Total Tests, QC Staff, Team)
  - Shift Approvers section
  - **Charts**: Density Trend (Line), High/Low Distribution (Doughnut)
  - **Full data table** with all columns
- **Actions**: Print (opens browser print, landscape A4), Export CSV
- CSV headers differ by mode (Level 9 includes Buggy + Machines; BOT includes Flow Property)
- Print styles: hides UI chrome, white background, border adjustments, color-adjust exact

---

## Components — Deep Dive

### Layout (`src/components/Layout.jsx`)
- Wraps every page (except Login/ChangePassword)
- Hamburger menu button (top-left) → opens Sidebar
- Contains: AuthBar (top-right), SyncBadge (top-left), AlertBanner (top-right below auth bar)
- Page header with title + subtitle (slide-down animation)
- Footer at bottom
- `print:hidden` on all chrome elements

### Sidebar (`src/components/Sidebar.jsx`)
- Full-screen backdrop + sliding left panel (w-80)
- Accordion-style categories (default: Quality Control open)
- Each category expands to show child links
- Active link highlighted with primary color + glow
- Pinned "Send Broadcast" button at bottom → opens BroadcastModal

### MachineGrid (`src/components/MachineGrid.jsx`)
- Renders production lines as vertical columns (sorted right-to-left by `order` descending)
- Each machine is a button colored by status:
  - **Green** (success gradient): density matches machine's gram spec AND within global level9 range
  - **Gold** (warning gradient): manually selected or overridden
  - **Gray** (dark, low opacity): no match
- Override machines show a ⚠️ badge
- Empty lines are skipped
- Clicking a machine calls `onMachineClick(machine, isMatch, isSelected)`

### MachineModal (`src/components/MachineModal.jsx`)
- Popup showing: Machine ID, Line, Gram Setting, Density Range, Carton Content (with breakdown)
- Checkbox: "Select for powder collection"
- "Override & Select" button (only shown if machine doesn't naturally match and isn't selected)
- Close button

### AuthBar (`src/components/AuthBar.jsx`)
- Fixed top-right: user email + Logout button
- Hidden on print

### SyncBadge (`src/components/SyncBadge.jsx`)
- Fixed top-left (left of hamburger): Online/Offline/ Syncing indicator
- Shows queue count badge when items pending
- Color-coded: green (online), red (offline), orange pulse (syncing)
- Hidden on print

### AlertBanner (`src/components/AlertBanner.jsx`)
- Fixed top-right stack of alert toasts
- Filters alerts by `targetPages` — only shows if includes `'all'` or current `location.pathname`
- Color-coded by level, danger alerts have shake animation
- Dismissible with × button
- Hidden on print

### BroadcastModal (`src/components/BroadcastModal.jsx`)
- Target screens checkboxes: All Screens, Data Entry (/), L9 Exec, BOT Exec
- Message textarea
- Alert level dropdown: Info (blue), Warning (orange), Critical (red shaking)
- Sends via `broadcastAlert()` with `targetPages` array

### Footer (`src/components/Footer.jsx`)
- Default text: "Starium Rafa ERP"
- On hover: "WhatsApp Dammie Optimus Solutions on 07053331253"

---

## Firestore Data Model

### Collections

**`qc_tests`** (Quality Control test records):
```
{
  mode: 'level9' | 'bot',
  approvalDocId: 'level9_DAY_2026-06-09',
  weight: number,
  density: string (3 decimal places),
  shift: 'DAY' | 'NIGHT',
  team: 'A' | 'B' | 'C',
  appearance: 'A' | 'U',
  remarks: string,
  qcName: string (userFullName),
  // Level 9 only:
  buggyNumber: string,
  fragrance: 'A' | 'U',
  machines: number[],
  // BOT only:
  flowProperty: 'A' | 'U' | 'NFF',
  // Always:
  createdAt: Timestamp (or localCreatedAt if offline),
  syncedAt: Timestamp (if synced),
  wasOfflineQueued: boolean,
  offlineSyncId: string
}
```

**`shift_approvals`** (Shift approval tracking):
```
{
  mode: 'level9' | 'bot',
  shift: 'DAY' | 'NIGHT',
  date: 'YYYY-MM-DD',
  status: 'pending',
  createdAt: Timestamp,
  buggySupervisor: { name, role, timestamp },
  plcOperator: { name, role, timestamp },
  productionManager: { name, role, timestamp },
  qcManager: { name, role, timestamp },
  qcSupervisor: { name, role, timestamp }
}
```
Doc ID: `${mode}_${shift}_${date}`

**`config/settings`** (Factory configuration):
```
{
  level9MinDensity, level9MaxDensity, level9Divisor,
  botMinDensity, botMaxDensity, botDivisor,
  dayShiftStart, nightShiftStart,
  machineGridColumns,
  productionLines: [{ id, name, order }],
  machines: [{ id, displayNumber, name, line, gram, min, max }],
  gramSpecs: { "22": { min, max, piecesPerCarton, piecesBreakdown }, ... },
  departmentRoles: [{ id, label, category }],
  actionRoles: [{ id, label }],
  createdAt, updatedAt: Timestamp
}
```

**`config/auth_settings`** (Auth toggle):
```
{
  authEnabled: boolean,
  updatedAt: Timestamp
}
```

**`user_roles`** (User profiles, keyed by Firebase Auth UID):
```
{
  firstName: string (lowercase),
  lastName: string (lowercase),
  email: string,
  systemRole: 'standard' | 'super_admin',
  departmentRoles: string[],
  actionRoles: string[],
  createdAt, updatedAt, createdBy, updatedBy: Timestamp/string
}
```

**`presence`** (Online status, keyed by UID):
```
{
  uid: string,
  email: string,
  status: 'online' | 'offline',
  lastSeen: Timestamp,
  currentPath: string (hash route)
}
```

**`empty_silos`** (Empty silo/machine records):
```
{
  shiftApprovalDocId: 'empty_silos_DAY_2026-06-11',
  machineId: number,
  machineDisplayNumber: string,      // "M1"
  machineName: string,
  line: string,                      // "1A"
  gram: number,
  markedEmptyBy: string,             // userFullName
  markedEmptyAt: Timestamp,
  shift: 'DAY' | 'NIGHT',
  date: 'YYYY-MM-DD',
  buggyNumber: string | null,        // filled when refilled
  noLongerEmptyAt: Timestamp | null,
  noLongerEmptyBy: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```
Doc ID: auto-generated via `addDoc`

**`alerts`** (Broadcast messages):
```
{
  title: string,
  message: string,
  level: 'info' | 'warning' | 'danger',
  targetPages: string[] (route paths, 'all' for global),
  localTimestamp: string (ISO),
  createdAt: Timestamp
}
```

---

## Business Rules & Math

### Density Calculation
- **Level 9**: `density = weight / 1580` (configurable via `level9Divisor`)
- **BOT**: `density = weight / 1680` (configurable via `botDivisor`)

### Machine Matching (Level 9 only)
A machine matches if:
1. `density >= machine_min` AND `density <= machine_max` (from gramSpecs or machine-level override)
2. `density >= config.level9MinDensity` AND `density <= config.level9MaxDensity`

### Gram Specs
Each gram setting (22g, 45g, 85g, 125g, 850g) has its own density range and pieces-per-carton count:

| Gram | Min | Max | Pieces/Carton | Breakdown |
|---|---|---|---|---|
| 22 | 0.200 | 0.310 | 162 | — |
| 45 | 0.210 | 0.310 | 84 | — |
| 85 | 0.240 | 0.300 | 52 | — |
| 125 | 0.200 | 0.270 | 31 | — |
| 850 | 0.200 | 0.270 | 7 | — |

### Shift Boundaries
- **Day shift**: 07:00 → 18:59 (configurable `dayShiftStart`)
- **Night shift**: 19:00 → 06:59 (configurable `nightShiftStart`)
- Tests at 02:00 AM belong to the previous calendar day's NIGHT shift

### Default Factory Layout (30 machines across 6 lines)
Lines are ordered 1A, 1B, 2A, 2B, 3A, 3B (displayed right-to-left):
- **1A**: M1(125g), M2(85g), M3(85g), M4(85g), M5(85g)
- **1B**: M6(125g), M7(85g), M8(850g), M9(85g), M10(22g)
- **2A**: M11-M15 (all 85g)
- **2B**: M16(850g), M17-M20 (all 85g)
- **3A**: M21(850g), M22-M25 (all 45g)
- **3B**: M26(850g), M27-M30 (all 45g)

---

## Key Patterns & Conventions

### Code Style
- No comments unless critical (codebase has some explanatory comments)
- Inline styles for animations via `<style>` tags in components
- Tailwind utility classes exclusively (no CSS modules)
- Dark theme throughout (dark-bg, dark-card, dark-hover)
- Animations: `fadeIn`, `slideDown`, `slideInRight`, `shake`, `pulse`, `alertBlink`

### Offline-First Pattern
All data writes go through `saveQCTest()` which:
1. Checks `isOnline` from NetworkContext
2. If online → direct Firestore write; on failure → queue
3. If offline → queue to localStorage
4. NetworkContext auto-flushes queue on reconnect

### Real-Time Subscriptions
All data fetching uses `onSnapshot` for live updates. Components return unsubscribe functions in cleanup.

### Name Security
User names are stored lowercase in Firestore, converted to Title Case on read. `userFullName` is auto-populated from AuthContext — never manually entered on forms.

### Backward Compatibility
- Old `role` field in user_roles maps to new `systemRole`/`departmentRoles`
- Old `approvalRoles` field maps to new `actionRoles`
- `localCreatedAt` fallback when `createdAt` is missing (offline tests)

### Print Support
- Reports page switches to white background for print
- `@media print` rules: landscape, margins, color-adjust exact
- All chrome elements (sidebar, auth bar, badges, alerts, footer) hidden with `print:hidden`

---

## Known Gaps & Future Work (from README)

- [ ] **Laminate Waste System** — Track packaging film waste per machine
- [ ] **Audit Trail** — Log who modified settings, deleted users, overrode machines
- [ ] **Mobile Layout Enhancements** — Further optimization for smaller devices
- [ ] Routes defined in MENU_CONFIG without components: `/laminate-waste`, `/downtime-log`, `/employees`, `/payroll`
- ✅ **Empty Silos System** — Cross-shift live tracking of empty/filled machines with broadcasts, auto-refill on powder density save, and real-time manager report with dual subscription (active state + shift refilled counter)

---

## Quick Reference: File Locations

| Need | File |
|---|---|
| Add a new page | `src/pages/`, then add route in `src/App.jsx`, add to `MENU_CONFIG` in `src/config/navigation.js`; also add to `PAGE_LABELS` in `src/pages/ActiveUsers.jsx` if it should show a friendly name in the Active Users table |
| Change permissions | `src/config/navigation.js` (allowedRoles), `src/context/AuthContext.jsx` (role logic) |
| Add a new config field | `src/context/ConfigContext.jsx` (DEFAULT_CONFIG), `src/pages/SystemConfig.jsx` (UI) |
| Change density math | `src/context/ConfigContext.jsx` (divisors), `src/pages/PowderDensity.jsx` (calculation) |
| Modify offline behavior | `src/context/NetworkContext.jsx`, `src/services/qcOperations.js` |
| Add a new alert type | `src/context/AlertContext.jsx`, `src/components/AlertBanner.jsx` |
| Change machine grid layout | `src/components/MachineGrid.jsx`, config `machineGridColumns` |
| Add a new approval role | `src/pages/SystemConfig.jsx` (roles tab), update approvalButtons in Level9Exec/BotExec |
| Change Firebase config | `src/config/firebase.js`, `.env` |
| Deploy settings | `.github/workflows/deploy.yml`, `vite.config.js` (base path) |
