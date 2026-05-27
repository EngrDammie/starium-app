# 🏭 Starium Rafa Quality Control Tool

Welcome to the **Starium Rafa Quality Control App**! This is an enterprise-grade, offline-capable web application built to monitor, record, and analyze powder density data on the factory floor in real-time.

---

## 📖 Table of Contents
1. [About the Project (For Non-Techies)](#-about-the-project)
2. [Key Features](#-key-features)
3. [User Roles & Permissions](#-user-roles--permissions)
4. [Factory Modes](#-the-two-factory-modes)
5. [Tech Stack](#-tech-stack)
6. [For Developers: How It Works](#-for-developers-how-it-works)
7. [Folder Structure](#-folder-structure)
8. [Local Setup & Installation](#-local-setup--installation)
9. [Deployment (GitHub Pages)](#-deployment)
10. [Future Roadmap](#-future-roadmap)

---

## 💡 About the Project

Factory floors often suffer from spotty internet connections. Standard web apps break when the Wi-Fi drops, causing lost data and frustrated workers. 

This application solves that problem. It is built as an **Offline-First Application**. QC Staff can continuously enter density test results, assign buggy numbers to machines, and write remarks even if the internet goes completely down. The app stores everything safely in the browser's memory and instantly uploads it to the cloud the millisecond the internet returns.

Meanwhile, Factory Managers and Executives can watch this data stream into their dashboards in real-time, view automated charts, and digitally sign off on shift approvals.

---

## ✨ Key Features

- **📶 Offline-First Engine**: Never lose a test. Tests are queued locally and auto-synced with perfect timestamp preservation.
- **⚡ Real-Time Executive Dashboards**: Live view of current factory density, visual machine grids, and moving trend charts.
- **🛡️ Dynamic Role-Based Security**: Complete access control. Features and approval buttons are hidden or locked based on the user's specific job title.
- **⚙️ Dynamic Admin Panel**: Administrators can add machines, define production lines, and change density threshold rules without ever touching the code.
- **📊 Automated Reporting**: Generates clean, printer-friendly (A4 Landscape) reports with Chart.js analytics and full CSV export capabilities.
- **🔐 Master Auth Toggle**: Authentication can be turned on for strict security, or turned off for an open "kiosk" mode during emergencies.

---

## 👥 User Roles & Permissions

The app uses a dual-layer security system:

### 1. Page Access Roles
Determines what screens a user can see:
- **Staff**: Can only access the main Data Entry dashboard.
- **Manager**: Can access Data Entry, Executive Dashboards, and Reports.
- **Admin**: Can access everything, including Machine Configuration and User Management.

### 2. Shift Approval Roles
Determines which buttons a user can click on the Executive Dashboard to approve a shift:
- 🔧 Buggy Supervisor
- ⚡ PLC Operator
- 🏭 Production Manager
- ✅ QC Manager
- 🔍 QC Supervisor

---

## 🏭 The Two Factory Modes

The app adapts its UI and math based on what part of the factory is being tested:

1. **Level 9 Silos**: 
   - Divides weight by `1580`.
   - Requires assigning specific Buggy Numbers to specific Machines (1 through 30+).
   - Tracks Appearance and Fragrance.
2. **B.O.T. (Base Powder)**:
   - Divides weight by `1680`.
   - Focuses strictly on base powder metrics.
   - Tracks Appearance and Flow Property (Free Flowing).

---

## 🛠️ Tech Stack

This project was completely rewritten from Vanilla HTML/JS into a modern SPA (Single Page Application).

- **Frontend Framework**: React 18 (via Vite)
- **Styling**: Tailwind CSS v3
- **Routing**: React Router v6
- **Database & Auth**: Firebase (Firestore V9 Modular SDK)
- **Charts**: Chart.js & React-Chartjs-2

---

## 🧠 For Developers: How It Works

If you are a future developer (or the original creator looking back), here is how the "Brain" of the app operates:

### The "Context" Intercom System
Instead of passing data down manually, the app uses React Context to broadcast critical state globally:
1. **`AuthContext.jsx`**: Listens to Firebase Auth and the `user_roles` database. It provides every page with `currentUser`, `userRole`, and the array of `approvalRoles`. It also handles the "Master Auth Toggle" bypass.
2. **`ConfigContext.jsx`**: Listens live to the `config/settings` document in Firestore. If an admin adds a machine, this context instantly updates the UI across all connected screens. It includes a `DEFAULT_CONFIG` safety net.
3. **`NetworkContext.jsx`**: The heartbeat of the offline engine. It listens to `navigator.onLine`. When it detects a reconnection, it reads `localStorage('starium_offline_queue')` and safely flushes the queue to Firebase.

### The Engine Room (`qcOperations.js`)
All heavy lifting for Firestore writes happens in `src/services/qcOperations.js`. This prevents UI files like `Dashboard.jsx` from becoming bloated. It handles:
- Midnight boundary math for Night Shifts.
- Fetching and sorting tests from oldest to newest.
- Processing the offline sync queue.

---

## 📂 Folder Structure

```text
starium-app/
├── public/                 # Static assets (Favicons, etc)
├── src/
│   ├── components/         # Reusable Lego blocks (MachineGrid, Modals, Layout)
│   ├── config/             # Firebase initialization & Env Variables
│   ├── context/            # React Context (Auth, Config, Network)
│   ├── pages/              # The main screens (Dashboard, Exec Views, Admin)
│   ├── services/           # Backend logic (qcOperations.js)
│   ├── App.jsx             # The Router (Traffic Cop)
│   └── main.jsx            # The root wrapper
├── .env                    # Secret keys (IGNORED BY GIT)
├── tailwind.config.js      # Tailwind theme and brand colors
└── package.json            # Project dependencies
```
---

## 💻 Local Setup & Installation

To run this app on your local machine:

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

- [ ] **Laminate Waste System**: A new module to track packaging film waste per machine to improve efficiency.
- [ ] **Audit Trail**: A background logging system to record exactly *who* modified a setting, deleted a user, or overrode a machine, providing full factory accountability.
- [ ] **Mobile Layout Enhancements**: Further optimization for smaller mobile devices for roaming QC staff.

---
*Built with ❤️ and extreme attention to detail for the Starium Rafa Factory.*
