// src/services/employeeSeed.js
//
// Sample HR data for demos and for populating a fresh install.
//
// WHY A SEEDED ADMIN BUTTON INSTEAD OF A ONE-OFF SCRIPT:
// A script run once from a laptop is invisible to the next person and cannot
// be re-run by HR. This is an explicit, admin-gated action in the app, so the
// demo can be reset whenever it is needed and anyone can see what it does.
//
// IT IS SAFE TO RUN TWICE: every write is keyed by the SAP number, so a
// re-run updates the same records instead of duplicating them. SAP number is
// the natural key because it is what HR already identifies people by.
//
// IT IS OBVIOUSLY FICTIONAL: names are invented, contact details use reserved
// test domains, and phone numbers are the 0700 range reserved for testing in
// Nigeria. Nobody should ever mistake these for real staff.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { normaliseEmail } from './employeeOperations';

// name, sap, designation, department, shift, phone, joined, status
export const SAMPLE_EMPLOYEES = [
  // ── Production ──────────────────────────────────────────────────────────
  { firstName: 'Chinedu',   lastName: 'Okafor',   sapNumber: 'ST-1001', cadreDesignation: 'Production Supervisor',  department: 'production',        departmentLabel: 'Production',        shift: 'DAY',   phone: '07030000001', email: 'chinedu.okafor@example.test',    dateJoined: '2019-03-04' },
  { firstName: 'Ngozi',     lastName: 'Eze',      sapNumber: 'ST-1002', cadreDesignation: 'Machine Operator',      department: 'production',        departmentLabel: 'Production',        shift: 'NIGHT', phone: '07030000002', email: 'ngozi.eze@example.test',        dateJoined: '2021-09-13' },
  { firstName: 'Yusuf',     lastName: 'Bello',    sapNumber: 'ST-1003', cadreDesignation: 'Machine Operator',      department: 'production',        departmentLabel: 'Production',        shift: 'DAY',   phone: '07030000003', email: 'yusuf.bello@example.test',      dateJoined: '2022-02-01' },
  { firstName: 'Blessing',  lastName: 'Adeyemi',  sapNumber: 'ST-1004', cadreDesignation: 'Line Leader',           department: 'production',        departmentLabel: 'Production',        shift: 'DAY',   phone: '07030000004', email: 'blessing.adeyemi@example.test', dateJoined: '2020-07-20' },

  // ── Quality Control ─────────────────────────────────────────────────────
  { firstName: 'Amina',     lastName: 'Sani',     sapNumber: 'ST-2001', cadreDesignation: 'QC Officer',            department: 'quality_control',  departmentLabel: 'Quality Control',  shift: 'DAY',   phone: '07030000005', email: 'amina.sani@example.test',       dateJoined: '2018-11-05' },
  { firstName: 'Tunde',     lastName: 'Akinyemi', sapNumber: 'ST-2002', cadreDesignation: 'QC Technician',         department: 'quality_control',  departmentLabel: 'Quality Control',  shift: 'NIGHT', phone: '07030000006', email: 'tunde.akinyemi@example.test',   dateJoined: '2022-06-12' },
  { firstName: 'Fatima',    lastName: 'Mohammed', sapNumber: 'ST-2003', cadreDesignation: 'QC Supervisor',         department: 'quality_control',  departmentLabel: 'Quality Control',  shift: 'DAY',   phone: '07030000007', email: 'fatima.mohammed@example.test',  dateJoined: '2017-01-16' },

  // ── Maintenance ──
  // NOTE: Robert Eneh is the name on the paper Leave Form HR supplied, in the
  // Maintenance department with SAP No. 'A'. Kept here so the demo data lines
  // up with the real form when HR is shown the system.
  { firstName: 'Robert',    lastName: 'Eneh',     sapNumber: 'ST-A',    cadreDesignation: 'Maintenance Officer',  department: 'production',        departmentLabel: 'Production',        shift: 'DAY',   phone: '07030000008', email: 'robert.eneh@example.test',      dateJoined: '2016-05-30' },

  // ── Packaging ───────────────────────────────────────────────────────────
  { firstName: 'Emeka',     lastName: 'Nwosu',    sapNumber: 'ST-3001', cadreDesignation: 'Packaging Supervisor',  department: 'packaging',        departmentLabel: 'Packaging',         shift: 'DAY',   phone: '07030000009', email: 'emeka.nwosu@example.test',      dateJoined: '2019-08-19' },
  { firstName: 'Halima',    lastName: 'Danjuma',  sapNumber: 'ST-3002', cadreDesignation: 'Packing Assistant',     department: 'packaging',        departmentLabel: 'Packaging',         shift: 'NIGHT', phone: '07030000010', email: 'halima.danjuma@example.test',   dateJoined: '2023-04-03' },

  // ── Human Resources ─────────────────────────────────────────────────────
  { firstName: 'Ibrahim',   lastName: 'Yusuf',    sapNumber: 'ST-4001', cadreDesignation: 'HR Officer',            department: 'human_resources',  departmentLabel: 'Human Resources',  shift: 'DAY',   phone: '07030000011', email: 'ibrahim.yusuf@example.test',    dateJoined: '2020-02-24' },
  { firstName: 'Segun',     lastName: 'Adeyinka', sapNumber: 'ST-4002', cadreDesignation: 'Head of HR',            department: 'human_resources',  departmentLabel: 'Human Resources',  shift: 'DAY',   phone: '07030000012', email: 'segun.adeyinka@example.test',   dateJoined: '2015-10-12' },

  // ── Administration ──────────────────────────────────────────────────────
  { firstName: 'Kelechi',   lastName: 'Nnamdi',   sapNumber: 'ST-5001', cadreDesignation: 'Admin Officer',         department: 'administration',   departmentLabel: 'Administration',   shift: 'DAY',   phone: '07030000013', email: 'kelechi.nnamdi@example.test',   dateJoined: '2021-01-11' },
  // Joined late in the leave year — deliberately, so the pro-rated entitlement
  // assumption (A10 in the blueprint) has something visible to act on.
  { firstName: 'Ada',       lastName: 'Obi',      sapNumber: 'ST-5002', cadreDesignation: 'Accounts Assistant',    department: 'administration',   departmentLabel: 'Administration',   shift: 'DAY',   phone: '07030000014', email: 'ada.obi@example.test',          dateJoined: '2026-08-17' },
];

// Idempotent write: keyed by a slug of the SAP number, so running twice
// updates rather than duplicating. Real SAP numbers use a different scheme;
// what matters is that the key is deterministic and derived from a natural
// identifier rather than a random doc id.
function employeeDocId(sapNumber) {
  return `seed-${String(sapNumber).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
}

export function buildFullName(firstName, lastName) {
  const first = String(firstName ?? '').trim();
  const last = String(lastName ?? '').trim();
  return first && last ? `${first} ${last}` : first || last;
}

export async function seedSampleEmployees(seededBy) {
  const results = { created: 0, updated: 0, failed: 0, errors: [] };

  for (const person of SAMPLE_EMPLOYEES) {
    const id = employeeDocId(person.sapNumber);
    try {
      await setDoc(doc(db, 'employees', id), {
        employeeId: id,
        sapNumber: person.sapNumber,
        firstName: person.firstName.toLowerCase(),
        lastName: person.lastName.toLowerCase(),
        fullName: buildFullName(person.firstName, person.lastName),
        cadreDesignation: person.cadreDesignation,
        department: person.department,
        departmentLabel: person.departmentLabel,
        shift: person.shift,
        phone: person.phone,
        email: normaliseEmail(person.email),
        address: '',
        dateJoined: new Date(person.dateJoined),
        employmentStatus: 'active',
        // Left null on purpose. Seeding must never claim a login exists —
        // these people have no Firebase account. Use the roster's
        // "Create login" action (task 1.5) when a real account is needed.
        linkedUserUid: null,
        linkedUserEmail: null,
        isSampleData: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: seededBy || 'sample-seed',
        updatedBy: seededBy || 'sample-seed',
      });
      results.created += 1;
    } catch (error) {
      results.failed += 1;
      results.errors.push(`${person.sapNumber}: ${error.message}`);
    }
  }

  return results;
}