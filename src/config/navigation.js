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
      { path: '/empty-silos-report', label: 'Empty Silos Report', icon: '📋', allowedRoles: ['qc_manager', 'prod_manager', 'packaging_manager'] },
      { path: '/stop-machine', label: 'Report Stopped Machine', icon: '🛑', allowedRoles: ['qc_staff', 'qc_manager'] },
      { path: '/stopped-machines-report', label: 'Stopped Machines Report', icon: '📊', allowedRoles: ['qc_manager', 'prod_manager', 'packaging_manager'] },
      { path: '/qc-density-report', label: 'QC Density Report', icon: '📈', allowedRoles: ['qc_manager', 'prod_manager', 'hr_manager'] }
    ]
  },
  {
    title: 'Production',
    icon: '⚙️',
    children: [
      { path: '/carton-waste', label: 'Carton Waste Tracking', icon: '📦', allowedRoles: ['prod_staff', 'prod_manager', 'qc_manager'] },
      { path: '/carton-waste-report', label: 'Carton Waste Report', icon: '📊', allowedRoles: ['prod_manager', 'qc_manager', 'packaging_manager'] },
      { path: '/laminate-waste', label: 'Laminate Waste', icon: '🗑️', allowedRoles: ['prod_staff', 'prod_manager', 'qc_manager'] },
      { path: '/downtime-log', label: 'Machine Downtime Log', icon: '⏱️', allowedRoles: ['qc_manager', 'prod_manager', 'packaging_manager'] }
    ]
  },
  {
    title: 'Human Resources',
    icon: '👥',
    children: [
      { path: '/employees', label: 'Employee Roster', icon: '📋', allowedRoles: ['hr_staff', 'hr_manager'] },
      { path: '/payroll', label: 'Payroll', icon: '💰', allowedRoles: ['hr_manager'] }
    ]
  },
  {
    title: 'Administration',
    icon: '🛡️',
    children: [
      { path: '/system-config', label: 'System Config', icon: '🔧', allowedRoles: [] }, 
      { path: '/user-management', label: 'User Roles', icon: '👤', allowedRoles: [] },
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