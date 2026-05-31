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
      { path: '/', label: 'Data Entry', icon: '📝', allowedRoles: ['qc_staff', 'qc_manager'] },
      { path: '/level9-exec', label: 'Level 9 Dashboard', icon: '🏭', allowedRoles: ['qc_manager'] },
      { path: '/bot-exec', label: 'BOT Dashboard', icon: '🤖', allowedRoles: ['qc_manager'] },
      { path: '/reports', label: 'QC Reports', icon: '📊', allowedRoles: ['qc_manager'] }
    ]
  },
  {
    title: 'Production',
    icon: '⚙️',
    children: [
      // These are placeholders for the future modules you planned!
      { path: '/laminate-waste', label: 'Laminate Waste', icon: '🗑️', allowedRoles: ['prod_staff', 'prod_manager', 'qc_manager'] },
      { path: '/downtime-log', label: 'Downtime Logs', icon: '⏱️', allowedRoles: ['prod_manager'] }
    ]
  },
  {
    title: 'Human Resources',
    icon: '👥',
    children: [
      // Placeholders for future HR modules
      { path: '/employees', label: 'Employee Roster', icon: '📋', allowedRoles: ['hr_staff', 'hr_manager'] },
      { path: '/payroll', label: 'Payroll', icon: '💰', allowedRoles: ['hr_manager'] }
    ]
  },
  {
    title: 'Administration',
    icon: '🛡️',
    children: [
      { path: '/machine-management', label: 'Machine Config', icon: '🔧', allowedRoles: [] }, // Empty means ONLY super_admin can see it
      { path: '/user-management', label: 'User Roles', icon: '👤', allowedRoles: [] },
      { path: '/audit-trail', label: 'Audit Trail', icon: '📜', allowedRoles: [] }
    ]
  }
];