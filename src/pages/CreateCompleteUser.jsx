// src/pages/CreateCompleteUser.jsx
//
// Single-page flow: create employee record + Firebase Auth login + roles in one go.
// Accessible to hr_manager, hr_staff, and super_admin under Administration menu.
//
// WHY THIS EXISTS:
// Previously HR had to: (1) add employee in Employee Roster, (2) click "Create login",
// (3) go to User Management to assign roles. Three screens, three chances to forget
// a step. This page does it atomically — either the whole user exists or nothing does.

import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { db } from '../config/firebase';
import {
  collection, addDoc, setDoc, updateDoc, doc, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';
import { createLoginForEmployee, normaliseSapNumber, normaliseEmail, buildFullName } from '../services/employeeOperations';
import { subscribeToEmployees } from '../services/employeeOperations';

const inputCls = 'w-full bg-[#1a1a1a] text-white border border-[#444] p-3 rounded-lg outline-none focus:border-primary';
const labelCls = 'text-xs text-gray-400 uppercase font-bold block mb-1';

const EMPTY_EMPLOYEE_FORM = {
  firstName: '',
  lastName: '',
  sapNumber: '',
  cadreDesignation: '',
  department: '',
  departmentLabel: '',
  shift: 'DAY',
  phone: '',
  email: '',
  address: '',
  dateJoined: '',
  employmentStatus: 'active',
};

const EMPTY_ROLES_FORM = {
  systemRole: 'standard',
  departmentRoles: [],
  actionRoles: [],
};

export default function CreateCompleteUser() {
  const { systemRole, departmentRoles, currentUser } = useAuth();
  const { config, loadingConfig } = useConfig();

  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'review' | 'success'

  // Employee details
  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYEE_FORM);
  // Login credentials
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Roles
  const [rolesForm, setRolesForm] = useState(EMPTY_ROLES_FORM);
  // Validation errors
  const [errors, setErrors] = useState({});
  // For review step
  const [createdEmployeeId, setCreatedEmployeeId] = useState(null);

  const departments = config?.hrDepartments || [];
  const shifts = config?.hrShifts || [];
  const allDeptRoles = config?.departmentRoles || [];
  const allActionRoles = config?.actionRoles || [];

  const groupedDeptRoles = (allDeptRoles || []).reduce((acc, role) => {
    if (!acc[role.category]) acc[role.category] = [];
    acc[role.category].push(role);
    return acc;
  }, {});

  // Permission checks (same as UserManagement.jsx)
  const isSuperAdmin = systemRole === 'super_admin' || currentUser?.email === 'dammieoptimus@gmail.com';
  const mayManageAccounts = isSuperAdmin || departmentRoles.includes('hr_manager');
  const mayGrantSuperAdmin = isSuperAdmin;

  // HR staff can view employee roster but may NOT manage accounts (create logins/roles)
  // Only hr_manager and super_admin can create complete users with logins + roles
  const canCreateCompleteUser = mayManageAccounts;

  // Access guard
  if (!canCreateCompleteUser) {
    return (
      <Layout title="Create Complete User" subtitle="Employee + Login + Roles" maxWidth="max-w-4xl">
        <div className="text-center py-20 text-gray-500">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-lg font-bold">Access Restricted</p>
          <p className="text-sm">Creating complete users (employee + login + roles) requires HR Manager or Super Admin access.</p>
        </div>
      </Layout>
    );
  }

  if (loadingConfig) {
    return <Layout title="Loading..."><div className="text-center text-white mt-10">Loading configuration…</div></Layout>;
  }

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 6000);
  }, []);

  const handleDepartmentChange = useCallback((id) => {
    const dept = departments.find(d => d.id === id);
    setEmpForm(f => ({ ...f, department: id, departmentLabel: dept?.label || id }));
  }, [departments]);

  const handleToggleDeptRole = useCallback((roleId) => {
    setRolesForm(f => {
      const arr = f.departmentRoles.includes(roleId)
        ? f.departmentRoles.filter(id => id !== roleId)
        : [...f.departmentRoles, roleId];
      return { ...f, departmentRoles: arr };
    });
  }, []);

  const handleToggleActionRole = useCallback((roleId) => {
    setRolesForm(f => {
      const arr = f.actionRoles.includes(roleId)
        ? f.actionRoles.filter(id => id !== roleId)
        : [...f.actionRoles, roleId];
      return { ...f, actionRoles: arr };
    });
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Employee required fields
    if (!empForm.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!empForm.lastName?.trim()) newErrors.lastName = 'Last name is required';
    if (!empForm.sapNumber?.trim()) newErrors.sapNumber = 'SAP number is required';
    if (!empForm.department) newErrors.department = 'Department is required';
    if (!empForm.email?.trim()) newErrors.email = 'Email is required (needed for login)';
    if (!empForm.dateJoined) newErrors.dateJoined = 'Date joined is required';

    // Email format
    if (empForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empForm.email)) {
      newErrors.email = 'Invalid email format';
    }

    // SAP number format (basic)
    if (empForm.sapNumber && !/^ST-\d{4}$/i.test(empForm.sapNumber.trim())) {
      newErrors.sapNumber = 'SAP number must be in format ST-XXXX (e.g., ST-0001)';
    }

    // Login credentials
    if (!password) newErrors.password = 'Password is required';
    if (password && password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    // System role permission
    if (rolesForm.systemRole === 'super_admin' && !mayGrantSuperAdmin) {
      newErrors.systemRole = 'Only the system owner can create a Super Admin';
    }

    // If assigning department roles, must have at least one
    // (hr_staff can create users but only with leave-only access)
    // Actually, departmentRoles can be empty for leave-only users

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [empForm, password, confirmPassword, rolesForm.systemRole, mayGrantSuperAdmin]);

  const checkSapNumberExists = async (sapNumber) => {
    const normalised = normaliseSapNumber(sapNumber);
    if (!normalised) return false;
    try {
      const q = query(collection(db, 'employees'), where('sapNumber', '==', normalised));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch {
      return false;
    }
  };

  const checkEmailExistsInEmployees = async (email) => {
    const normalised = normaliseEmail(email);
    if (!normalised) return false;
    try {
      const q = query(collection(db, 'employees'), where('email', '==', normalised));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch {
      return false;
    }
  };

  const checkEmailExistsInAuth = async (email) => {
    const normalised = normaliseEmail(email);
    if (!normalised) return false;
    try {
      const q = query(collection(db, 'user_roles'), where('email', '==', normalised));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Pre-flight checks for duplicates
    const sapExists = await checkSapNumberExists(empForm.sapNumber);
    if (sapExists) {
      setErrors({ sapNumber: 'This SAP number already exists in the employee roster' });
      return;
    }

    const emailExistsEmp = await checkEmailExistsInEmployees(empForm.email);
    if (emailExistsEmp) {
      setErrors({ email: 'This email is already used by another employee record' });
      return;
    }

    const emailExistsAuth = await checkEmailExistsInAuth(empForm.email);
    if (emailExistsAuth) {
      setErrors({ email: 'This email already has an app login. Remove the existing login first.' });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // 1. Create employee record
      const firstName = empForm.firstName.trim().toLowerCase();
      const lastName = empForm.lastName.trim().toLowerCase();
      const sapNumber = normaliseSapNumber(empForm.sapNumber);
      const email = normaliseEmail(empForm.email);

      const employeePayload = {
        employeeId: null,
        sapNumber,
        firstName,
        lastName,
        fullName: buildFullName(firstName, lastName),
        cadreDesignation: String(empForm.cadreDesignation ?? '').trim(),
        department: empForm.department,
        departmentLabel: empForm.departmentLabel || empForm.department,
        shift: empForm.shift || 'DAY',
        phone: String(empForm.phone ?? '').trim(),
        email,
        address: String(empForm.address ?? '').trim(),
        dateJoined: empForm.dateJoined || null,
        employmentStatus: empForm.employmentStatus || 'active',
        linkedUserUid: null,
        linkedUserEmail: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.email || null,
        updatedBy: currentUser?.email || null,
      };

      const created = await addDoc(collection(db, 'employees'), employeePayload);
      await setDoc(doc(db, 'employees', created.id), { employeeId: created.id }, { merge: true });

      const employee = { id: created.id, ...employeePayload, fullName: buildFullName(firstName, lastName), email };

      // 2. Create Firebase Auth login + user_roles document
      const loginResult = await createLoginForEmployee(employee, {
        password,
        departmentRoles: rolesForm.departmentRoles || [],
        actionRoles: rolesForm.actionRoles || [],
        createdBy: currentUser?.email || null,
      });

      if (!loginResult.ok) {
        // Rollback employee record if login creation failed
        await updateDoc(doc(db, 'employees', created.id), {
          linkedUserUid: null,
          linkedUserEmail: null,
          updatedAt: serverTimestamp(),
        });
        throw new Error(loginResult.error);
      }

      // 3. If systemRole is super_admin (founder only), update the role document
      if (rolesForm.systemRole === 'super_admin' && mayGrantSuperAdmin) {
        await updateDoc(doc(db, 'user_roles', loginResult.uid), {
          systemRole: 'super_admin',
          departmentRoles: [], // super_admin has implicit full access
          actionRoles: [],
          restrictedToOwnLeave: false,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser?.email || null,
        });
      }

      setCreatedEmployeeId(created.id);
      setStep('success');
      showMessage(`Complete user created: ${buildFullName(firstName, lastName)} (${email})`, 'success');

    } catch (error) {
      setErrors({ submit: error.message || 'Failed to create complete user' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setEmpForm(EMPTY_EMPLOYEE_FORM);
    setPassword('');
    setConfirmPassword('');
    setRolesForm(EMPTY_ROLES_FORM);
    setErrors({});
    setStep('form');
    setCreatedEmployeeId(null);
  };

  // Review data for confirmation step
  const reviewData = {
    name: buildFullName(empForm.firstName, empForm.lastName),
    sapNumber: empForm.sapNumber?.toUpperCase(),
    cadre: empForm.cadreDesignation,
    department: departments.find(d => d.id === empForm.department)?.label || empForm.department,
    shift: shifts.find(s => s.id === empForm.shift)?.label || empForm.shift,
    email: empForm.email,
    dateJoined: empForm.dateJoined,
    status: empForm.employmentStatus,
    systemRole: rolesForm.systemRole,
    deptRoles: rolesForm.departmentRoles.map(id => allDeptRoles.find(r => r.id === id)?.label || id).join(', ') || 'None (leave-only access)',
    actionRoles: rolesForm.actionRoles.map(id => allActionRoles.find(r => r.id === id)?.label || id).join(', ') || 'None',
  };

  return (
    <Layout title="➕ Create Complete User" subtitle="Employee record + App login + Roles in one flow" maxWidth="max-w-4xl">
      {message.text && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white shadow-lg z-50 animate-[fadeIn_0.3s_ease-out] ${message.type === 'error' ? 'bg-status-danger' : 'bg-status-success'}`}>
          {message.text}
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step === 'form' || step === 'review' ? 'bg-primary text-black' : 'bg-status-success text-white'}`}>1</div>
        <div className={`w-16 h-1 ${step === 'form' || step === 'review' ? 'bg-primary' : 'bg-status-success'}`} />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step === 'success' ? 'bg-primary text-black' : 'bg-gray-700 text-gray-400'}`}>2</div>
        <div className={`w-16 h-1 ${step === 'success' ? 'bg-primary' : 'bg-gray-700'}`} />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step === 'success' ? 'bg-status-success text-white' : 'bg-gray-700 text-gray-400'}`}>3</div>
        <div className="hidden sm:block">
          <div className="text-xs text-gray-500 text-center w-24 -mt-2">Details</div>
          <div className="text-xs text-gray-500 text-center w-24 -mt-2">Review</div>
          <div className="text-xs text-gray-500 text-center w-24 -mt-2">Done</div>
        </div>
      </div>

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Employee Details */}
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
            <h2 className="text-primary text-xl font-bold mb-2 uppercase tracking-wider">👤 Employee Details</h2>
            <p className="text-sm text-gray-400 mb-6">These fields create the HR master record. SAP number and email must be unique.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>First name *</label>
                <input required value={empForm.firstName} onChange={e => setEmpForm({ ...empForm, firstName: e.target.value })} className={`${inputCls} ${errors.firstName ? 'border-status-danger' : ''}`} />
                {errors.firstName && <p className="text-status-danger text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className={labelCls}>Last name *</label>
                <input required value={empForm.lastName} onChange={e => setEmpForm({ ...empForm, lastName: e.target.value })} className={`${inputCls} ${errors.lastName ? 'border-status-danger' : ''}`} />
                {errors.lastName && <p className="text-status-danger text-xs mt-1">{errors.lastName}</p>}
              </div>
              <div>
                <label className={labelCls}>SAP number *</label>
                <input required value={empForm.sapNumber} onChange={e => setEmpForm({ ...empForm, sapNumber: e.target.value.toUpperCase() })} placeholder="ST-0001" className={`${inputCls} ${errors.sapNumber ? 'border-status-danger' : ''}`} />
                {errors.sapNumber && <p className="text-status-danger text-xs mt-1">{errors.sapNumber}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className={labelCls}>Cadre / Designation</label>
                <input value={empForm.cadreDesignation} onChange={e => setEmpForm({ ...empForm, cadreDesignation: e.target.value })} placeholder="Production Officer" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Department *</label>
                <select required value={empForm.department} onChange={e => handleDepartmentChange(e.target.value)} className={`${inputCls} ${errors.department ? 'border-status-danger' : ''}`}>
                  <option value="" disabled>Select department…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
                {errors.department && <p className="text-status-danger text-xs mt-1">{errors.department}</p>}
              </div>
              <div>
                <label className={labelCls}>Shift</label>
                <select value={empForm.shift} onChange={e => setEmpForm({ ...empForm, shift: e.target.value })} className={inputCls}>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className={labelCls}>Phone</label>
                <input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" required value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} className={`${inputCls} ${errors.email ? 'border-status-danger' : ''}`} />
                {errors.email && <p className="text-status-danger text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className={labelCls}>Date joined *</label>
                <input type="date" required value={empForm.dateJoined || ''} onChange={e => setEmpForm({ ...empForm, dateJoined: e.target.value })} className={`${inputCls} ${errors.dateJoined ? 'border-status-danger' : ''}`} />
                {errors.dateJoined && <p className="text-status-danger text-xs mt-1">{errors.dateJoined}</p>}
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Contact address</label>
              <input value={empForm.address} onChange={e => setEmpForm({ ...empForm, address: e.target.value })} className={inputCls} />
            </div>

            <div className="mt-4">
              <label className={labelCls}>Employment status</label>
              <select value={empForm.employmentStatus} onChange={e => setEmpForm({ ...empForm, employmentStatus: e.target.value })} className={inputCls}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Section 2: Login Credentials */}
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
            <h2 className="text-primary text-xl font-bold mb-2 uppercase tracking-wider">🔑 Login Credentials</h2>
            <p className="text-sm text-gray-400 mb-6">The email above becomes the username. Password must be at least 6 characters.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email (from above)</label>
                <input value={empForm.email} disabled className="w-full bg-[#121212] text-gray-500 border border-[#333] p-3 rounded-lg cursor-not-allowed" />
              </div>
              <div>
                <label className={labelCls}>Temporary password *</label>
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={`${inputCls} ${errors.password ? 'border-status-danger' : ''}`} />
                {errors.password && <p className="text-status-danger text-xs mt-1">{errors.password}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Confirm password *</label>
                <input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" className={`${inputCls} ${errors.confirmPassword ? 'border-status-danger' : ''}`} />
                {errors.confirmPassword && <p className="text-status-danger text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <p className="text-gray-500 text-xs mt-2">Write the password down and hand it over directly. The user can change it after first sign-in.</p>
          </div>

          {/* Section 3: Roles & Permissions */}
          <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
            <h2 className="text-primary text-xl font-bold mb-2 uppercase tracking-wider">🛡️ Roles & Permissions</h2>
            <p className="text-sm text-gray-400 mb-6">Choose what this person can access. Leave empty for factory-floor staff who only need leave.</p>

            {/* System Role */}
            <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-4 mb-6">
              <label className="text-gray-400 text-sm font-bold uppercase block mb-2">🔐 System Role</label>
              <select value={rolesForm.systemRole} onChange={e => setRolesForm({ ...rolesForm, systemRole: e.target.value })} className={`${inputCls} ${errors.systemRole ? 'border-status-danger' : ''}`} disabled={!mayGrantSuperAdmin}>
                <option value="standard">Standard User</option>
                {mayGrantSuperAdmin && <option value="super_admin">Super Admin (God Mode)</option>}
              </select>
              {errors.systemRole && <p className="text-status-danger text-xs mt-1">{errors.systemRole}</p>}
              {!mayGrantSuperAdmin && (
                <p className="text-gray-500 text-xs mt-2">Super Admin is reserved for the system owner and cannot be granted here.</p>
              )}
            </div>

            {/* Department Roles */}
            {rolesForm.systemRole !== 'super_admin' && (
              <div className="bg-[#1a1a1a] border border-[#333] p-5 rounded-lg mb-6">
                <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">🏢 Department Access</h3>
                <p className="text-gray-500 text-xs mb-4">Leave empty for staff who only need My Leave (restricted login).</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(groupedDeptRoles).map(([deptName, roles]) => (
                    <div key={deptName} className="bg-dark-card p-4 rounded-lg border border-[#333]">
                      <h4 className="text-white font-bold text-xs uppercase mb-3 pb-2 border-b border-[#333]">{deptName}</h4>
                      <div className="flex flex-col gap-2">
                        {roles.map(role => (
                          <label key={role.id} className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 accent-primary" checked={rolesForm.departmentRoles.includes(role.id)} onChange={() => handleToggleDeptRole(role.id)} />
                            <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{role.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Roles */}
            {rolesForm.systemRole !== 'super_admin' && (
              <div className="bg-[#1a1a1a] border border-[#333] p-5 rounded-lg">
                <h3 className="text-primary font-bold text-sm uppercase tracking-wider mb-4">⚡ Approval Powers</h3>
                <div className="flex flex-wrap gap-3">
                  {(allActionRoles || []).map(role => (
                    <label key={role.id} className="flex items-center gap-2 p-2 px-4 bg-dark-card rounded-full cursor-pointer hover:bg-[#252525] border border-[#333] transition-colors">
                      <input type="checkbox" className="w-4 h-4 accent-primary" checked={rolesForm.actionRoles.includes(role.id)} onChange={() => handleToggleActionRole(role.id)} />
                      <span className="text-white text-sm font-bold">{role.label}</span>
                    </label>
                  ))}
                </div>
                {(allActionRoles || []).length === 0 && <p className="text-gray-500 text-sm">No approval roles configured in System Config.</p>}
              </div>
            )}
          </div>

          {/* Submit / Errors */}
          {errors.submit && (
            <div className="bg-status-danger/15 border border-status-danger text-status-danger rounded-lg px-4 py-3 text-sm font-bold">
              ⚠️ {errors.submit}
            </div>
          )}

          <div className="flex gap-4">
            <button type="button" onClick={handleReset} className="flex-1 py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors">✖️ Reset Form</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(0,188,212,0.3)]">
              {submitting ? 'Creating…' : '👤 Create Complete User'}
            </button>
          </div>
        </form>
      )}

      {/* Review step removed - single submit is atomic */}

      {/* Success step */}
      {step === 'success' && (
        <div className="bg-dark-card p-8 rounded-xl border-2 border-status-success shadow-[0_0_30px_rgba(76,175,80,0.3)] text-center animate-[fadeIn_0.3s_ease-out]">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-status-success text-2xl font-bold mb-2">Complete User Created</h2>
          <p className="text-gray-400 mb-6">The employee record, app login, and roles have been created atomically.</p>

          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 text-left mb-6 max-w-md mx-auto">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-500">Name</div>
              <div className="text-white font-bold capitalize">{reviewData.name}</div>
              <div className="text-gray-500">SAP Number</div>
              <div className="text-cyan-300 font-bold mono">{reviewData.sapNumber}</div>
              <div className="text-gray-500">Email / Username</div>
              <div className="text-white font-bold">{reviewData.email}</div>
              <div className="text-gray-500">Department</div>
              <div className="text-white">{reviewData.department}</div>
              <div className="text-gray-500">System Role</div>
              <div className={`text-white font-bold ${reviewData.systemRole === 'super_admin' ? 'text-status-success' : ''}`}>{reviewData.systemRole.replace('_', ' ')}</div>
              <div className="text-gray-500">Department Roles</div>
              <div className="text-white text-sm">{reviewData.deptRoles}</div>
              <div className="text-gray-500">Approval Roles</div>
              <div className="text-white text-sm">{reviewData.actionRoles}</div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button onClick={handleReset} className="flex-1 max-w-xs py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-[0_0_15px_rgba(0,188,212,0.3)]">
              ➕ Create Another
            </button>
            <a href="/employees" className="flex-1 max-w-xs py-3 bg-[#333] text-white rounded-lg font-bold hover:bg-[#444] transition-colors text-center">
              📋 View Employee Roster
            </a>
          </div>
        </div>
      )}
    </Layout>
  );
}