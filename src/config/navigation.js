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
      // Order is load-bearing, not cosmetic: getFirstAccessiblePath lands a
      // user on the FIRST page in this list they can open. With the work
      // queue first, an approver who is also an employee lands on their
      // queue — their managerial duty — and reaches their own leave via the
      // menu. A restricted employee cannot open any of the three role-gated
      // pages, so they still land on My Leave wherever it sits.
      { path: '/leave-approvals', label: 'Leave Approvals', icon: '✅', allowedRoles: ['hr_staff', 'hr_manager'], allowedActionRoles: ['leave_supervisor', 'leave_hod', 'leave_hr_head'] },
      { path: '/employees', label: 'Employee Roster', icon: '📋', allowedRoles: ['hr_staff', 'hr_manager'] },
      { path: '/leave-report', label: 'Leave Report', icon: '📊', allowedRoles: ['hr_staff', 'hr_manager'] },

      // openToAll: visible to EVERY signed-in user, whatever their department
      // roles. Needed for My Leave (task 4.6): a restricted employee has an
      // EMPTY departmentRoles array, so without this flag they can see no
      // page in the entire app and land on /no-access forever.
      // Deliberately NOT achieved by listing all eight department roles: that
      // would silently break the day HR adds a ninth, because the new role
      // would be missing from the list and nobody could see My Leave.
      { path: '/my-leave', label: 'My Leave', icon: '🗓️', openToAll: true, allowedRoles: [] },
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

// The route object for a path, or null if the path is not in the menu config.
//
// PREFER THIS OVER getAllowedRolesForPath. Reading allowedRoles on its own
// loses the rest of the route's meaning — most importantly `openToAll`, which
// is spelled allowedRoles: [] because there are no roles to list. Any caller
// that infers permissions from allowedRoles alone will read that as
// "super-admin only" and lock out the very people the flag exists for.
// That is exactly how ProtectedRoute broke /my-leave.
export const findRoute = (path) => {
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (route.path === path) return route;
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
//
// `allowedActionRoles` is the third axis, added for Leave Approvals (5.2).
// The three approval powers (leave_supervisor, leave_hod, leave_hr_head) are
// ACTION roles, not department roles — a production manager who signs at the
// HOD stage is not in the HR department and should not be. Listing those
// powers under allowedRoles would have granted the whole HR department the
// approvals page, which is a different (and wrong) permission. Without this
// axis, an approver could hold the power to sign and still have no way to
// reach the screen where the signature happens.
export function canAccessRoute(route, systemRole, departmentRoles, actionRoles = []) {
  if (systemRole === 'super_admin') return true;
  if (route?.openToAll) return true;
  if (route?.allowedActionRoles?.length && route.allowedActionRoles.some(r => actionRoles.includes(r))) return true;
  if (!route?.allowedRoles || route.allowedRoles.length === 0) return false;
  return route.allowedRoles.some(role => (departmentRoles || []).includes(role));
}

// The first page this user may see, or null if there is none.
//
// Used as the redirect target when someone lands on a page they cannot open,
// so the app never has to guess. A null return is meaningful: the account
// exists but has no access yet, which deserves a different message from
// "you tried to open something you cannot".
export function getFirstAccessiblePath(systemRole, departmentRoles, actionRoles = []) {
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (canAccessRoute(route, systemRole, departmentRoles, actionRoles)) return route.path;
    }
  }
  return null;
}

// Everything this user can see — lets the no-access screen list what they DO
// have, so it never claims they have nothing while showing them a sidebar.
export function getAccessiblePaths(systemRole, departmentRoles, actionRoles = []) {
  const paths = [];
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (canAccessRoute(route, systemRole, departmentRoles, actionRoles)) paths.push(route);
    }
  }
  return paths;
}