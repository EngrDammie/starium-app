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
    title: 'Quality Control',
    icon: '🔬',
    children: [
      { path: '/', label: 'Data Entry', icon: '📝', allowedRoles: ['qc_staff', 'qc_manager', 'prod_staff', 'prod_manager'] },
      { path: '/level9-exec', label: 'Level 9 Dashboard', icon: '🏭', allowedRoles: ['qc_manager', 'prod_manager'] },
      { path: '/bot-exec', label: 'BOT Dashboard', icon: '🤖', allowedRoles: ['qc_manager', 'prod_manager'] },
      { path: '/reports', label: 'QC Reports', icon: '📊', allowedRoles: ['qc_manager', 'prod_manager', 'hr_manager'] }
    ]
  },
  {
    title: 'Administration',
    icon: '🛡️',
    children: [
      { path: '/machine-management', label: 'Machine Config', icon: '🔧', allowedRoles: [] }, // Empty array = ONLY Super Admin
      { path: '/user-management', label: 'User Roles', icon: '👤', allowedRoles: [] }
    ]
  }
];

// Helper function for the Bouncer to look up required roles
export const getAllowedRolesForPath = (path) => {
  for (const category of MENU_CONFIG) {
    for (const route of category.children) {
      if (route.path === path) return route.allowedRoles;
    }
  }
  return null; // Route not found in config
};