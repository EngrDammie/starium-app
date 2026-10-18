// src/config/navigation.js

/**
 * ENTERPRISE MENU CONFIGURATION
 * 
 * How to add a new page:
 * 1. Add it to the correct category's `children` array.
 * 2. Define which `departmentRoles` are allowed to see it.
 * 3. If a user is a `super_admin`, they bypass these checks and see everything.
 */

export const MENU_CONFIG = [
  {
    title: 'Factory Overview',
    icon: '🏢',
    children: [
      { path: '/', label: 'Command Center', icon: '📊', allowedRoles: ['qc_staff', 'qc_manager', 'prod_staff', 'prod_manager', 'hr_staff', 'hr_manager'] }
    ]
  },
  {
    title: 'Quality Control',
    icon: '🔬',
    children: [
      // 🎯 FIX: Changed path to /powder-density
      { path: '/powder-density', label: 'Powder Density Tests', icon: '📝', allowedRoles: ['qc_staff', 'qc_manager', 'prod_staff', 'prod_manager'] },
      { path: '/level9-exec', label: 'Level 9 Dashboard', icon: '🏭', allowedRoles: ['qc_manager', 'prod_manager'] },
      { path: '/bot-exec', label: 'BOT Dashboard', icon: '🤖', allowedRoles: ['qc_manager', 'prod_manager'] },
      { path: '/empty-silos', label: 'Report Empty Silos', icon: '🛢️', allowedRoles: ['qc_staff', 'qc_manager'] },
      { path: '/stop-machine', label: 'Report Stopped Machine', icon: '🛑', allowedRoles: ['qc_staff', 'qc_manager'] },
      { path: '/qc-sachet-production-checks', label: 'QC Sachet Production Checks', icon: '⚖️', allowedRoles: ['qc_staff', 'qc_manager'] }
    ]
  },
  {
    title: 'Production',
    icon: '⚙️',
    children: [
      { path: '/carton-waste', label: 'Carton Waste Tracking', icon: '📦', allowedRoles: ['prod_staff', 'prod_manager', 'qc_manager'] },
      { path: '/laminate-waste', label: 'Laminate Waste', icon: '🗑️', allowedRoles: ['prod_staff', 'prod_manager', 'qc_manager'] },
      { path: '/pallet-transfer', label: 'Pallet Transfer', icon: '📦', allowedRoles: ['prod_staff', 'packaging_staff', 'prod_manager', 'packaging_manager'] },
      { path: '/machine-downtime-log', label: 'Machine Downtime Log', icon: '⏱️', allowedRoles: ['qc_manager', 'prod_manager', 'packaging_manager'] }
    ]
  },
  {
    title: 'Reports',
    icon: '📑',
    children: [
      { path: '/qc-density-report', label: 'QC Density Report', icon: '📈', allowedRoles: ['qc_manager', 'prod_manager', 'hr_manager'] },
      { path: '/carton-waste-report', label: 'Carton Waste Report', icon: '📦', allowedRoles: ['prod_manager', 'qc_manager', 'packaging_manager'] },
      { path: '/pallet-transfer-report', label: 'Pallet Transfer Report', icon: '📋', allowedRoles: ['prod_manager', 'packaging_manager', 'qc_manager'] },
      { path: '/laminate-waste-report', label: 'Laminate Waste Report', icon: '🗑️', allowedRoles: ['prod_manager', 'qc_manager', 'packaging_manager'] },
      { path: '/empty-silos-report', label: 'Empty Silos Report', icon: '📋', allowedRoles: ['qc_manager', 'prod_manager', 'packaging_manager'] },
      { path: '/stopped-machines-report', label: 'Stopped Machines Report', icon: '📊', allowedRoles: ['qc_manager', 'prod_manager', 'packaging_manager'] },
      { path: '/qc-sachet-report', label: 'QC Sachet Report', icon: '⚖️', allowedRoles: ['qc_manager'] }
    ]
  },
  {
    title: 'Human Resources',
    icon: '👥',
    children: [
      // openToAll: visible to EVERY signed-in user, whatever their department roles.
      // Needed for My Leave — a restricted employee has an EMPTY
      // departmentRoles array (task 1.5), so without this flag they can see no
      // page in the entire app and land on /no-access forever.
      // Deliberately NOT achieved by listing all eight department roles: that
      // would silently break the day HR adds a ninth, because the new role
      // would be missing from the list and nobody could see My Leave.
      { path: '/my-leave', label: 'My Leave', icon: '🗓️', openToAll: true, allowedRoles: [] },

      // /employees now has a real route and page behind it (EmployeeRoster.jsx).
      // The former /payroll entry was removed on purpose: it advertised a page
      // that has never existed, so HR could click it and get nothing. A menu
      // that lies is worse than a menu that is incomplete. Payroll remains out
      // of scope until it is actually built.
      { path: '/employees', label: 'Employee Roster', icon: '📋', allowedRoles: ['hr_staff', 'hr_manager'] },
      // Placeholder routes for tasks 5.2 and 6.3. Listed now so the menu is
      // complete once those pages land; both resolve to /no-access until then
      // rather than 404ing.
      { path: '/leave-approvals', label: 'Leave Approvals', icon: '✅', allowedRoles: ['hr_staff', 'hr_manager'] },
      { path: '/leave-report', label: 'Leave Report', icon: '📊', allowedRoles: ['hr_staff', 'hr_manager'] }
    ]
  },
  {
    title: 'Administration',
    icon: '🛡️',
    children: [
      { path: '/system-config', label: 'System Config', icon: '🔧', allowedRoles: [] }, 
      // hr_manager may manage accounts (decision 16 Oct 2026). The page itself
      // gates Super Admin to the founder — see UserManagement.jsx
      // `mayGrantSuperAdmin`.
      { path: '/user-management', label: 'User Roles', icon: '👤', allowedRoles: ['hr_manager'] },
      { path: '/active-users', label: 'Active Users', icon: '🟢', allowedRoles: [] }
    ]
  }
];

export const getAllowedRolesForPath = (path) => {
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (route.path === path) return route.allowedRoles;
    }
  }
  return null; 
};

// ─── Single source of truth for "can this user see this page?" ─────────────
//
// WHY THIS LIVES HERE AND NOT IN Sidebar.jsx:
// the visibility check existed in Sidebar AND was duplicated (differently) in
// ProtectedRoute, and the two copies drifted. The redirect fallback used a
// different rule than the sidebar filter, so a page could be offered in the
// menu and then refused. Any future change had to be made twice, and one copy
// would be missed.
//
// `openToAll` marks a route every signed-in user may see, whatever their
// department roles are. Needed for My Leave (task 4.6): a restricted employee
// has an EMPTY departmentRoles array, so without this they can see no page at
// all. An empty `allowedRoles` array means SUPER ADMIN ONLY — do not confuse
// the two.
export function canAccessRoute(route, systemRole, departmentRoles) {
  if (systemRole === 'super_admin') return true;
  if (route?.openToAll) return true;
  if (!route?.allowedRoles || route.allowedRoles.length === 0) return false;
  return route.allowedRoles.some(role => (departmentRoles || []).includes(role));
}

// The first page this user may see, or null if there is none.
//
// Used as the redirect target when someone lands on a page they cannot open,
// so the app never has to guess. A null return is meaningful: the account
// exists but has no access yet, which deserves a different message from
// "you tried to open something you cannot".
export function getFirstAccessiblePath(systemRole, departmentRoles) {
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (canAccessRoute(route, systemRole, departmentRoles)) return route.path;
    }
  }
  return null;
}

// Everything this user can see — lets the no-access screen list what they DO
// have, so it never claims they have nothing while showing them a sidebar.
export function getAccessiblePaths(systemRole, departmentRoles) {
  const paths = [];
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (canAccessRoute(route, systemRole, departmentRoles)) paths.push(route);
    }
  }
  return paths;
}