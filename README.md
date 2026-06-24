# 🏭 Starium Rafa Enterprise Resource Planner (ERP)

Welcome to the **Starium Rafa ERP**! This is an enterprise-grade, offline-capable web application built to monitor, record, and analyze factory metrics in real-time. 

Built for Powder Density tracking and Carton Waste management, the platform is structured to scale into a full factory ERP system encompassing Production, Human Resources, and Quality Control.

---

## 📖 Table of Contents
1. [About the Project](#-about-the-project)
2. [Key Features](#-key-features)
3. [Enterprise Security (The Keycard System)](#-enterprise-security-the-keycard-system)
4. [Factory Modules](#-the-factory-modules)
5. [Tech Stack](#-tech-stack)
6. [For Developers: System Architecture](#-for-developers-system-architecture)
7. [Local Setup & Installation](#-local-setup--installation)
8. [Deployment (GitHub Pages)](#-deployment-github-pages)
9. [Future Roadmap](#-future-roadmap)

---

## 💡 About the Project

Factory floors often suffer from spotty internet connections. Standard web apps break when the Wi-Fi drops, causing lost data and frustrated workers. 

This application solves that problem. It is built as an **Offline-First Application**. QC and Production staff can continuously enter density test results, carton waste data, and laminate waste data even if the internet goes completely down. The app queues everything safely in the browser's memory and instantly uploads it to the cloud the millisecond the internet returns.

When users log in, they land on the **Command Center**, providing a high-level overview of active shifts and tests. Meanwhile, Factory Managers can watch data stream into their executive dashboards in real-time, view automated charts, receive targeted alert broadcasts, and digitally sign off on shift approvals.

---

## ✨ Key Features

- **🌐 Factory Command Center**: A centralized dashboard showing live metrics (e.g., active users, tests completed this shift) and quick-action navigation tailored to the user's role. Level 9 and BOT test cards are clickable for QC/Production managers, navigating to their respective executive dashboards. Super admins can click the Live Users card to view a detailed table of all active operators and their current page.
- **📶 Offline-First Engine**: Never lose a test. Tests are queued locally and auto-synced with perfect timestamp preservation.
- **⚡ Real-Time Executive Dashboards**: Live view of current factory density, visual machine grids, and moving trend charts.
- **📢 Targeted Broadcast Alerts**: Admins and system events can blast real-time, color-coded popup messages to specific screens across the factory.
- **📜 Shift History Modal**: Floor workers can instantly review all tests submitted during their active shift.
- **⚙️ Dynamic Admin Panel**: Administrators can add machines, define production lines, edit roles, and change density thresholds without touching the code.
- **📊 Automated Reporting**: Generates clean, printer-friendly (A4 Landscape) reports with Chart.js analytics and CSV exports.
- **🛢️ Empty Silos System**: Cross-shift live tracking of machines marked as empty with real-time broadcasts, auto-refill detection when powder density tests are saved, and a dedicated manager report with color-coded machine grid and refill counters.
- **🛑 Stopped Machines System**: Cross-shift tracking of stopped machines with reusable issue definitions, click-once issue solving, START button (hidden when machine already running), sparkle animation, 4-color machine state grid, and dedicated real-time manager report. Supports appending additional issues to already-stopped machines via "Report More Issues" (which re-stops the machine), with automatic deduplication of already-attached issues — the UI filters out pre-existing issues and warns when typing a duplicate label.
- **📦 Carton Waste System**: Per-machine carton waste tracking with per-machine round numbering, 3-status machine grid (unchecked/checked/high-waste), smart validation (remaining ≤ available, wasted ≤ available, used + wasted ≤ allocated), running totals, and "Save & Next Machine" flow. Includes a full report page with waste percentage by machine bar chart, waste trend over rounds (top 5) line chart, cross-shift comparison, shift comparison table with vs-prev diff arrows, per-machine breakdown table, round-by-round detail table, and CSV export. High waste alerts are broadcast to the command centre and carton waste pages in real-time. Full offline-queue support via dedicated localStorage key.
- **🗑️ Laminate Waste System**: Per-machine laminate waste tracking using weights (kg) instead of quantities. Staff collect waste in pre-weighed sacs (small 80g / large 160g) and record gross weight each round. Total laminate used is auto-computed from the machine's gram setting: `rollsPerShift × rollWeight[gram]` (e.g., a 125g machine uses 53.70 kg/roll × 3 rolls = 161.10 kg per shift). Sac type dropdown with configurable weights, auto-calculated waste collected (gross − sac), running waste totals, and 3-status machine grid (green/gray/red). Full report page with waste % by machine bar chart, waste trend over rounds (top 5), cross-shift comparison, per-machine breakdown, round-by-round detail table, CSV export, and print. High waste alerts broadcast to command centre, laminate waste page, and report page. Offline-first with dedicated localStorage queue.

---

## 🔑 Enterprise Security (The Keycard System)

Instead of rigid job titles (like "Manager" or "Staff"), this app uses a highly scalable **Modular Role-Based Access Control (RBAC)** system. We treat permissions like "Keycards" on a worker's lanyard.

A user's profile consists of three security layers:

1. **`systemRole` (The Master Key):** 
   - `super_admin`: Bypasses all security checks. Has full access to everything.
   - `standard`: Must rely on department keycards.
2. **`departmentRoles` (Page Access):** 
   - Example: `qc_staff`, `qc_manager`, `prod_manager`, `hr_manager`.
   - These control what pages a user can navigate to, and dynamically builds their Sidebar Accordion Menu.
3. **`actionRoles` (Button Powers):**
   - Example: `plc_operator`, `buggy_supervisor`, `qc_supervisor`.
   - These dictate which specific approval buttons a user is allowed to click on the Executive Dashboards.

*Note: The app includes a "Ghost Admin" fallback. If the Master Auth Toggle is turned OFF in the settings, the app bypasses Firebase login and grants everyone temporary Super Admin access for emergency/kiosk use.*

---

## 🏭 The Factory Modules

The application has three core data entry and monitoring modules:

1. **Level 9 Silos**: 
   - Divides weight by `1580`.
   - Requires assigning specific Buggy Numbers to specific Machines (1 through 30+).
   - Tracks Appearance and Fragrance.
2. **B.O.T. (Base Powder)**:
   - Divides weight by `1680`.
   - Focuses strictly on base powder metrics.
   - Tracks Appearance and Flow Property (Free Flowing).
3. **Carton Waste**:
   - Per-machine tracking of allocated, remaining, used, and wasted cartons.
   - Each independently tracks its own check rounds (no global round counter).
   - Machine grid with 3 statuses: unchecked (gray), checked (green), high-waste (red — waste% > target).
   - "Save & Next Machine" advances numerically, closes on last machine.
   - Report page with waste% charts, cross-shift comparison, CSV export.
4. **Laminate Waste**:
   - Per-machine tracking of laminate waste using weight (kg) instead of carton counts.
   - Two sac types: Small (80g) and Large (160g) — configurable via System Config.
   - Total laminate used auto-computed from machine gram: `rollsPerShift × rollWeight[gram]`.
   - Waste collected = gross weight − sac weight. Running totals and waste % displayed in real-time.
   - Same 3-status machine grid and "Save & Next Machine" flow as Carton Waste.
   - Report page with waste% charts, cross-shift comparison, per-machine breakdown, CSV export, print.

---

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 (via Vite)
- **Styling**: Tailwind CSS v3
- **Routing**: React Router v6 (using HashRouter for static hosting compatibility)
- **Database & Auth**: Firebase (Firestore V9 Modular SDK)
- **Charts**: Chart.js & React-Chartjs-2

---

## 🧠 For Developers: System Architecture

### 1. The Centralized Router (`src/config/navigation.js`)
All page routing and security requirements are defined here. The `ProtectedRoute` component (The Bouncer) cross-references the user's `departmentRoles` against this file before allowing a page to render.

### 2. The Context Intercoms
The app uses React Context to broadcast state globally:
- **`AuthContext.jsx`**: Manages Firebase logins, fetches user keycards, and provides the Owner Fallback security net.
- **`ConfigContext.jsx`**: Listens live to the `config/settings` document. If an admin edits a machine, this context updates the UI instantly across all connected screens.
- **`NetworkContext.jsx`**: The heartbeat of the offline engine. It listens to `navigator.onLine` and automatically flushes `localStorage` queues (qc_tests, carton_records, laminate_records) to Firebase upon reconnection.
- **`AlertContext.jsx`**: The global loudspeaker. Exposes the `broadcastAlert()` function which pushes real-time notifications to targeted factory screens.

### 3. The Presence System (`src/services/presenceOperations.js`)
Tracks who is online in real-time across the factory:
- **`setOnlineStatus()`**: Called by AuthContext on login and every 3 minutes (heartbeat). Records the user's UID, email, and current page.
- **`setOfflineStatus()`**: Called on logout or tab close to mark the user offline.
- **`subscribeToActiveUsers()`**: Returns a live stream of online users (with a 5-minute stale-entry safety net). Used by the Dashboard for the Live Users counter and by the Active Users page for the full table.

### 4. The Engine Room (`src/services/qcOperations.js`, `src/services/cartonOperations.js`, and `src/services/laminateOperations.js`)

**`qcOperations.js`** handles all Powder Density Firestore operations:
- Midnight boundary math for Night Shifts (e.g., tests submitted at 2 AM belong to yesterday's shift document).
- Fetching and sorting tests from oldest to newest.
- Processing the offline sync queue safely.

**`cartonOperations.js`** handles all Carton Waste operations:
- `subscribeToShiftCartonRecords()` — real-time subscription to `carton_records` for the current shift.
- `saveCartonRecord()` — online/offline-aware save with 4 validation rules (remaining ≤ maxAvailable, wasted ≤ maxAvailable, used ≥ 0, used + wasted ≤ maxAvailable).
- `queueCartonOffline()` — dedicated localStorage queue under `starium_carton_offline_queue`.
- `syncCartonOfflineQueue()` — bulk write-batch sync of queued records on reconnect.

**`laminateOperations.js`** handles all Laminate Waste operations:
- `subscribeToShiftLaminateRecords()` — real-time subscription to `laminate_records` for the current shift.
- `computeTotalLaminateUsed()` — auto-computes total laminate used from machine gram: `rollsPerShift × rollWeight`.
- `saveLaminateCheck()` — online/offline-aware save with 3 validation rules (sac type, gross ≥ sac weight, total > 0).
- `queueLaminateCheckOffline()` — dedicated localStorage queue under `starium_laminate_offline_queue`.
- `syncLaminateOfflineQueue()` — bulk write-batch sync of queued records on reconnect.

---


## 💻 Local Setup & Installation

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
   Create a `.env` file in the root folder and add your Firebase keys:
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

## 🚀 Deployment (GitHub Pages + Actions)

This app is deployed for **FREE** using GitHub Pages. Because it is a Vite React app, the code must be "baked" (built) before it can be hosted.

We use **GitHub Actions** to automate this. 

1. The workflow file (`.github/workflows/deploy.yml`) is triggered whenever code is pushed to the `main` branch.
2. It securely injects the Firebase Environment variables stored in **GitHub Secrets**.
3. It runs `npm run build` to compile the React code into optimized, static HTML/JS/CSS.
4. It publishes the `dist/` folder to GitHub Pages.

*Note: You never have to manually build or deploy. Just push to GitHub, and the robots do the rest!*

---

## 🔮 Future Roadmap

- ✅ **Laminate Waste System**: Live per-machine laminate waste tracking (kg) with configurable sac types, auto-computed roll usage, offline support, reports, and broadcasts.
- ✅ **Carton Waste System**: Live per-machine carton waste tracking with offline support, reports, and broadcasts.
- [ ] **Audit Trail**: A background logging system to record exactly *who* modified a setting, deleted a user, or overrode a machine, providing full factory accountability.
- [ ] **Mobile Layout Enhancements**: Further optimization for smaller mobile devices for roaming QC staff.

---
*Built with ❤️ and extreme attention to detail for the Starium Rafa Factory. Formerly Starium Rafa Quality Control Tool.*
