import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static guard for firestore.rules: every writable app collection must have
// an explicit match block granting create/update to signed-in users.
// This is the regression test for the real outage where pallet_transfers,
// empty_silos, carton_records, laminate_records and the QC check collections
// fell through to the admin-only catch-all and silently queued offline.

const EXPECTED_COLLECTIONS = [
  'alerts',
  'qc_string_weight_checks',
  'qc_bag_inspection_checks',
  'qc_carton_inspection_checks',
  'qc_tests',
  'carton_records',
  'laminate_records',
  'empty_silos',
  'pallet_transfers',
  'stopped_machines',
  'machine_issues',
  'shift_approvals',
];

function loadRules() {
  const p = path.resolve(__dirname, '../../firestore.rules');
  return fs.readFileSync(p, 'utf8');
}

describe('firestore.rules collection coverage', () => {
  it('has an explicit match block for every writable app collection', () => {
    const rules = loadRules();
    for (const collection of EXPECTED_COLLECTIONS) {
      expect(
        rules.includes(`match /${collection}/`),
        `missing explicit rules block for /${collection}/`,
      ).toBe(true);
    }
  });

  it('grants create/update to authenticated non-admin users via canWriteRecord()', () => {
    const rules = loadRules();
    for (const collection of EXPECTED_COLLECTIONS) {
      const blockStart = rules.indexOf(`match /${collection}/`);
      expect(blockStart).toBeGreaterThan(-1);
      const block = rules.slice(blockStart, blockStart + 800);
      expect(block.includes('allow create: if canWriteRecord()')).toBe(true);
      expect(block.includes('allow update: if canWriteRecord()')).toBe(true);
    }
  });

  it('restricts deletes to admins (or auth-disabled mode)', () => {
    const rules = loadRules();
    for (const collection of EXPECTED_COLLECTIONS) {
      const blockStart = rules.indexOf(`match /${collection}/`);
      const block = rules.slice(blockStart, blockStart + 800);
      expect(block.includes('allow delete: if !isAuthEnabled() || isAdmin()')).toBe(true);
    }
  });
});
