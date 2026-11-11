// src/services/__tests__/approvalEngine.test.js
//
// Unit tests for the Generic Approval Engine.
// Pure functions — no Firebase needed.

import {
  initializeApprovalState,
  processApproval,
  canUserApprove,
  getApprovalConfig,
  setApprovalChainsCache,
  isApprovalEnabled,
  isApprovalRequired,
  getApprovalSteps
} from '../approvalEngine';

// ─── SETUP: Approval chains cache ─────────────────────────────────

beforeEach(() => {
  setApprovalChainsCache({
    purchaseOrder: {
      enabled: true,
      required: true,
      steps: [
        { step: 1, role: 'procurement_head', label: 'Procurement Head' },
        { step: 2, role: 'finance_manager', label: 'Finance Manager' },
        { step: 3, role: 'plant_manager', label: 'Plant Manager' }
      ]
    },
    stockTransfer: {
      enabled: true,
      required: true,
      steps: [
        { step: 1, role: 'warehouse_manager', label: 'Warehouse Manager' }
      ]
    },
    bom: {
      enabled: true,
      required: true,
      steps: [
        { step: 1, role: 'recipe_manager', label: 'Recipe Manager' },
        { step: 2, role: 'plant_manager', label: 'Plant Manager' }
      ]
    },
    goodsReceipt: {
      enabled: false,
      required: false,
      steps: []
    }
  });
});

// ─── initializeApprovalState ──────────────────────────────────────

test('purchaseOrder: creates PENDING_APPROVAL state with 3 steps', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');

  expect(state.approvalEnabled).toBe(true);
  expect(state.approvalRequired).toBe(true);
  expect(state.status).toBe('PENDING_APPROVAL');
  expect(state.currentStep).toBe(1);
  expect(state.totalSteps).toBe(3);
  expect(state.steps).toHaveLength(3);
  expect(state.steps[0].status).toBe('PENDING');
  expect(state.steps[0].role).toBe('procurement_head');
  expect(state.steps[1].status).toBe('WAITING');
  expect(state.steps[2].status).toBe('WAITING');
});

test('goodsReceipt: disabled → auto-approved', () => {
  const state = initializeApprovalState('goodsReceipt', 'user_1');

  expect(state.approvalEnabled).toBe(false);
  expect(state.status).toBe('APPROVED');
  expect(state.totalSteps).toBe(0);
});

test('unknown flow: no approval → auto-approved', () => {
  const state = initializeApprovalState('unknown_flow', 'user_1');

  expect(state.approvalEnabled).toBe(false);
  expect(state.status).toBe('APPROVED');
});

// ─── processApproval: APPROVE flow ────────────────────────────────

test('approve step 1 → moves to step 2, status stays PENDING_APPROVAL', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');

  const result = processApproval(state, 'APPROVE', 'procurement_head', 'Procurement Head', 'uid_1');

  expect(result.success).toBe(true);
  expect(result.newStatus).toBe('PENDING_APPROVAL');
  expect(result.nextStepRole).toBe('finance_manager');
  expect(result.currentStep).toBe(2);
  expect(result.steps[0].status).toBe('APPROVED');
  expect(result.steps[1].status).toBe('PENDING');
  expect(result.steps[2].status).toBe('WAITING');
});

test('approve final step → status APPROVED, no next step', () => {
  let state = initializeApprovalState('purchaseOrder', 'user_1');

  // Step 1 → step 2 becomes pending
  const r1 = processApproval(state, 'APPROVE', 'procurement_head', 'PH', 'u1');
  state = { ...state, ...r1, steps: r1.steps, currentStep: r1.currentStep };

  // Step 2 → step 3 becomes pending
  const r2 = processApproval(state, 'APPROVE', 'finance_manager', 'FM', 'u2');
  state = { ...state, ...r2, steps: r2.steps, currentStep: r2.currentStep };

  // Step 3 (final) → APPROVED
  const r3 = processApproval(state, 'APPROVE', 'plant_manager', 'PM', 'u3');

  expect(r3.success).toBe(true);
  expect(r3.newStatus).toBe('APPROVED');
  expect(r3.nextStepRole).toBe(null);
  expect(r3.currentStep).toBe(3);
  expect(r3.steps.every(s => s.status === 'APPROVED')).toBe(true);
  expect(r3.approvedAt).toBeDefined();
});

test('wrong role cannot approve', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');

  const result = processApproval(state, 'APPROVE', 'finance_manager', 'FM', 'u2');

  expect(result.success).toBe(false);
  expect(result.message).toContain('Only Procurement Head can approve');
});

test('cannot approve already-approved document', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');
  const approved = processApproval(state, 'APPROVE', 'procurement_head', 'PH', 'u1');
  const approved2 = processApproval(approved, 'APPROVE', 'finance_manager', 'FM', 'u2');
  const final = processApproval(approved2, 'APPROVE', 'plant_manager', 'PM', 'u3');

  const result = processApproval(final, 'APPROVE', 'plant_manager', 'PM', 'u3');

  expect(result.success).toBe(false);
  expect(result.message).toBe('Already approved');
});

// ─── processApproval: REJECT flow ─────────────────────────────────

test('reject step 1 → status REJECTED, step marked REJECTED', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');

  const result = processApproval(state, 'REJECT', 'procurement_head', 'PH', 'u1');

  expect(result.success).toBe(true);
  expect(result.newStatus).toBe('REJECTED');
  expect(result.nextStepRole).toBe(null);
  expect(result.steps[0].status).toBe('REJECTED');
  expect(result.rejectedAt).toBeDefined();
});

// ─── canUserApprove ───────────────────────────────────────────────

test('canUserApprove: correct role pending step → true', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');

  expect(canUserApprove(state, 'procurement_head')).toBe(true);
});

test('canUserApprove: wrong role → false', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');

  expect(canUserApprove(state, 'finance_manager')).toBe(false);
});

test('canUserApprove: disabled approval → false', () => {
  const state = initializeApprovalState('goodsReceipt', 'user_1');

  expect(canUserApprove(state, 'warehouse_clerk')).toBe(false);
});

test('canUserApprove: already approved → false', () => {
  const state = initializeApprovalState('purchaseOrder', 'user_1');
  const r1 = processApproval(state, 'APPROVE', 'procurement_head', 'PH', 'u1');
  const r2 = processApproval(r1, 'APPROVE', 'finance_manager', 'FM', 'u2');
  const final = processApproval(r2, 'APPROVE', 'plant_manager', 'PM', 'u3');

  expect(canUserApprove(final, 'plant_manager')).toBe(false);
});

// ─── Stock Transfer approval ──────────────────────────────────────

test('stockTransfer: 1-step approval works', () => {
  const state = initializeApprovalState('stockTransfer', 'user_1');

  expect(state.totalSteps).toBe(1);
  expect(state.steps[0].role).toBe('warehouse_manager');

  const result = processApproval(state, 'APPROVE', 'warehouse_manager', 'WM', 'u1');

  expect(result.success).toBe(true);
  expect(result.newStatus).toBe('APPROVED');
  expect(result.steps[0].status).toBe('APPROVED');
});

// ─── Config getters ───────────────────────────────────────────────

test('isApprovalEnabled: purchaseOrder → true', () => {
  expect(isApprovalEnabled('purchaseOrder')).toBe(true);
});

test('isApprovalEnabled: goodsReceipt → false', () => {
  expect(isApprovalEnabled('goodsReceipt')).toBe(false);
});

test('isApprovalRequired: purchaseOrder → true', () => {
  expect(isApprovalRequired('purchaseOrder')).toBe(true);
});

test('getApprovalSteps: purchaseOrder returns 3 steps', () => {
  expect(getApprovalSteps('purchaseOrder')).toHaveLength(3);
});
