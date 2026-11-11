// src/services/approvalEngine.js
//
// Generic Approval Engine — powers PO, GRN, Stock Transfer, BOM,
// Production Order, Packing Plan, and any future flow needing approval.
//
// Config lives in config/settings.approvalChains:
// {
//   purchaseOrder: { enabled: true, required: true, steps: [ {step:1, role:'procurement_head'}, ... ] },
//   stockTransfer: { enabled: false, required: false, steps: [] },
//   ...
// }
//
// Status flow per step:
//   PENDING → APPROVED (moves to next step) or REJECTED (flow ends)
//   When all steps APPROVED → overall status = APPROVED
//   When any step REJECTED → overall status = REJECTED

import {
  doc, getDoc, setDoc, updateDoc, collection, query, where,
  onSnapshot, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from '../config/firebase';

const CONFIG_DOC = doc(db, 'config', 'settings');

// Cache for approval chains config (loads once, hot-reloads via ConfigContext)
let APPROVAL_CHAINS_CACHE = null;

export function setApprovalChainsCache(chains) {
  APPROVAL_CHAINS_CACHE = chains;
}

export function getApprovalChainsCache() {
  return APPROVAL_CHAINS_CACHE;
}

// ─── LOAD APPROVAL CHAINS FROM CONFIG ────────────────────────────────

export async function loadApprovalChains() {
  try {
    const snap = await getDoc(CONFIG_DOC);
    if (!snap.exists()) return {};
    const data = snap.data();
    const chains = data.approvalChains || {};
    APPROVAL_CHAINS_CACHE = chains;
    return chains;
  } catch (err) {
    if (err.code !== 'permission-denied') console.error('loadApprovalChains error:', err);
    return {};
  }
}

// ─── GET CONFIG FOR A FLOW TYPE ──────────────────────────────────────

export function getApprovalConfig(flowType) {
  if (!APPROVAL_CHAINS_CACHE) return { enabled: false, required: false, steps: [] };
  return APPROVAL_CHAINS_CACHE[flowType] || { enabled: false, required: false, steps: [] };
}

// Is approval enabled for this flow type?
export function isApprovalEnabled(flowType) {
  return !!getApprovalConfig(flowType).enabled;
}

// Is approval required (vs optional) for this flow type?
export function isApprovalRequired(flowType) {
  return !!getApprovalConfig(flowType).required;
}

// Get the steps for a flow type
export function getApprovalSteps(flowType) {
  return getApprovalConfig(flowType).steps || [];
}

// ─── INITIALIZE APPROVAL STATE FOR A NEW DOCUMENT ────────────────────

export function initializeApprovalState(flowType, requestedBy) {
  const config = getApprovalConfig(flowType);
  const steps = config.steps || [];

  if (!config.enabled || steps.length === 0) {
    // No approval needed — document is auto-approved
    return {
      approvalRequired: false,
      approvalEnabled: false,
      currentStep: 0,
      totalSteps: 0,
      status: 'APPROVED', // auto-approved
      steps: [],
      approvedAt: null,
      rejectedAt: null
    };
  }

  return {
    approvalRequired: config.required,
    approvalEnabled: true,
    currentStep: 1,
    totalSteps: steps.length,
    status: config.required ? 'PENDING_APPROVAL' : 'DRAFT',
    steps: steps.map((s, idx) => ({
      step: s.step,
      role: s.role,
      label: s.label || s.role,
      status: idx === 0 ? 'PENDING' : 'WAITING', // first step pending, rest waiting
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null
    })),
    approvedAt: null,
    rejectedAt: null
  };
}

// ─── PROCESS AN APPROVAL ACTION ──────────────────────────────────────

// Returns { success, newStatus, message, nextStepRole }
export function processApproval(currentState, action, actorRole, actorName, actorUid) {
  const { status, steps, currentStep, totalSteps, approvalEnabled } = currentState;

  if (!approvalEnabled) {
    return { success: false, message: 'Approval not enabled for this flow' };
  }

  if (status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED') {
    return { success: false, message: `Already ${status.toLowerCase()}` };
  }

  // Find the current pending step
  const pendingStepIndex = steps.findIndex(s => s.status === 'PENDING');
  if (pendingStepIndex === -1) {
    return { success: false, message: 'No pending approval step found' };
  }

  const currentStepData = steps[pendingStepIndex];

  // Verify actor has the right role for this step
  if (currentStepData.role !== actorRole) {
    return { success: false, message: `Only ${currentStepData.label} can approve step ${currentStepData.step}` };
  }

  const newSteps = [...steps];

  if (action === 'APPROVE') {
    newSteps[pendingStepIndex] = {
      ...currentStepData,
      status: 'APPROVED',
      approvedBy: actorUid,
      approvedAt: serverTimestamp(),
      approvedByName: actorName
    };

    // Check if there's a next step
    const nextStepIndex = pendingStepIndex + 1;
    if (nextStepIndex < totalSteps) {
      newSteps[nextStepIndex] = {
        ...newSteps[nextStepIndex],
        status: 'PENDING'
      };
      return {
        success: true,
        status: 'PENDING_APPROVAL',
        newStatus: 'PENDING_APPROVAL',
        message: `Step ${currentStepData.step} approved. Awaiting ${newSteps[nextStepIndex].label}.`,
        nextStepRole: newSteps[nextStepIndex].role,
        steps: newSteps,
        currentStep: nextStepIndex + 1,
        totalSteps,
        approvalEnabled: true,
        approvalRequired: currentState.approvalRequired
      };
    } else {
      // All steps approved
      return {
        success: true,
        status: 'APPROVED',
        newStatus: 'APPROVED',
        message: 'All approval steps completed. Document APPROVED.',
        nextStepRole: null,
        steps: newSteps,
        currentStep: totalSteps,
        totalSteps,
        approvedAt: serverTimestamp(),
        approvalEnabled: true,
        approvalRequired: currentState.approvalRequired
      };
    }
  }

  if (action === 'REJECT') {
    newSteps[pendingStepIndex] = {
      ...currentStepData,
      status: 'REJECTED',
      rejectedBy: actorUid,
      rejectedAt: serverTimestamp(),
      rejectedByName: actorName
    };
    return {
      success: true,
      status: 'REJECTED',
      newStatus: 'REJECTED',
      message: `Rejected by ${currentStepData.label}.`,
      nextStepRole: null,
      steps: newSteps,
      currentStep: currentStepData.step,
      totalSteps,
      rejectedAt: serverTimestamp(),
      approvalEnabled: true,
      approvalRequired: currentState.approvalRequired
    };
  }

  return { success: false, message: 'Invalid action' };
}

// ─── CHECK IF USER CAN APPROVE A STEP ────────────────────────────────

export function canUserApprove(approvalState, userRole) {
  if (!approvalState.approvalEnabled) return false;
  if (approvalState.status !== 'PENDING_APPROVAL') return false;
  const pendingStep = approvalState.steps?.find(s => s.status === 'PENDING');
  return pendingStep ? pendingStep.role === userRole : false;
}

// ─── GET PENDING APPROVALS FOR A USER'S ROLE ─────────────────────────

export function getPendingApprovalsForRole(documents, userRole) {
  return documents.filter(doc => {
    if (!doc.approvalState || !doc.approvalState.approvalEnabled) return false;
    if (doc.approvalState.status !== 'PENDING_APPROVAL') return false;
    const pendingStep = doc.approvalState.steps?.find(s => s.status === 'PENDING');
    return pendingStep ? pendingStep.role === userRole : false;
  });
}
