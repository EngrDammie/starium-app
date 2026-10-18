// src/context/ConfigContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const ConfigContext = createContext();

const DEFAULT_CONFIG = {
  level9MinDensity: 0.200, level9MaxDensity: 0.310, level9Divisor: 1580,
  botMinDensity: 0.200, botMaxDensity: 0.240, botDivisor: 1680,
  dayShiftStart: 7, nightShiftStart: 19,
  machineGridColumns: 6,
  packagingTeams: {
    labels: ['A', 'B', 'C'],
    defaultTeam: 'A'
  },
  productionLines: [
    { id: "1A", name: "Line 1A", order: 1 }, { id: "1B", name: "Line 1B", order: 2 },
    { id: "2A", name: "Line 2A", order: 3 }, { id: "2B", name: "Line 2B", order: 4 },
    { id: "3A", name: "Line 3A", order: 5 }, { id: "3B", name: "Line 3B", order: 6 }
  ],
  machines: [
    { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", name: "Machine 1", fillHeads: 2 },
    { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", name: "Machine 2", fillHeads: 2 },
    { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", name: "Machine 6", fillHeads: 2 }
  ],
  gramSpecs: {
    "22": { min: 0.200, max: 0.310, piecesPerCarton: 162, piecesBreakdown: "150 pcs + 12 freebies", bagCount: 150, freebieCount: 12 },
    "45": { min: 0.210, max: 0.310, piecesPerCarton: 84, piecesBreakdown: "78 pcs + 6 freebies", bagCount: 78, freebieCount: 6 },
    "85": { min: 0.240, max: 0.300, piecesPerCarton: 52, piecesBreakdown: "48 pcs + 4 freebies", bagCount: 48, freebieCount: 4 },
    "125": { min: 0.200, max: 0.270, piecesPerCarton: 31, piecesBreakdown: "28 pcs + 3 freebies", bagCount: 28, freebieCount: 3 },
    "850": { min: 0.200, max: 0.270, piecesPerCarton: 7, piecesBreakdown: "6 pouches + 1 freebie", bagCount: 6, freebieCount: 1 }
  },
  // 🎯 Carton Waste Tracking Config
  cartonWaste: {
    targetWastePercent: 5,
    wasteAlertThreshold: 10
  },
  // 🎯 Pallet Transfer Tracking Config
  palletTransfer: {
    palletSizes: {
      "22": 100,
      "45": 90,
      "85": 80,
      "125": 60,
      "850": 40
    }
  },
  // 🎯 Laminate Waste Tracking Config
  laminateWaste: {
    targetWastePercent: 5,
    wasteAlertThreshold: 10,
    rollsPerShift: 3,
    rollWeights: {
      "22": 51.32,
      "45": 54.40,
      "85": 51.60,
      "125": 53.70,
      "850": 49.90
    },
    sacTypes: [
      { id: 'small', label: 'Small Sac', weight: 0.080 },
      { id: 'large', label: 'Large Sac', weight: 0.160 }
    ],
    defaultSacType: 'small'
  },
  qcCheckIntervals: {
    stringWeight: 15,
    bagInspection: 15,
    cartonInspection: 60
  },
  fillHeadWeightRanges: {
    "22":  { tooLow: { max: 128 }, low: { min: 129, max: 136 }, target: { min: 137, max: 141 }, high: { min: 142, max: 149 }, tooHigh: { min: 150 } },
    "45":  { tooLow: { max: 259 }, low: { min: 260, max: 272 }, target: { min: 273, max: 282 }, high: { min: 283, max: 290 }, tooHigh: { min: 291 } },
    "85":  { tooLow: { max: 487 }, low: { min: 488, max: 516 }, target: { min: 517, max: 536 }, high: { min: 537, max: 564 }, tooHigh: { min: 565 } },
    "125": { tooLow: { max: 487 }, low: { min: 488, max: 506 }, target: { min: 507, max: 517 }, high: { min: 518, max: 538 }, tooHigh: { min: 539 } },
    "850": { tooLow: { max: 861 }, low: { min: 862, max: 870 }, target: { min: 871, max: 900 }, high: { min: 901, max: 980 }, tooHigh: { min: 981 } }
  },
  departmentRoles: [
    { id: 'qc_staff', label: 'QC Staff', category: 'Quality Control' },
    { id: 'qc_manager', label: 'QC Manager', category: 'Quality Control' },
    { id: 'prod_staff', label: 'Production Staff', category: 'Production' },
    { id: 'prod_manager', label: 'Production Manager', category: 'Production' },
    { id: 'packaging_staff', label: 'Packaging Staff', category: 'Production' },
    { id: 'packaging_manager', label: 'Packaging Manager', category: 'Production' },
    { id: 'hr_staff', label: 'HR Staff', category: 'Human Resources' },
    { id: 'hr_manager', label: 'HR Manager', category: 'Human Resources' }
  ],
  // HR master data. `hrDepartments` is the list an employee record can be
  // filed under. It is deliberately separate from `departmentRoles`, which
  // are APP PERMISSIONS grouped by category — not the same list, and HR must
  // be able to add or rename a department without touching permissions.
  // Note: the packaging roles sit under the 'Production' category above, so
  // 'Packaging' would not appear if this list were derived from that one.
  hrDepartments: [
    { id: 'quality_control', label: 'Quality Control' },
    { id: 'production', label: 'Production' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'human_resources', label: 'Human Resources' },
    { id: 'administration', label: 'Administration' }
  ],
  hrShifts: [
    { id: 'DAY', label: 'Day Shift' },
    { id: 'NIGHT', label: 'Night Shift' }
  ],
  actionRoles: [
    { id: 'buggy_supervisor', label: '🔧 Buggy Supervisor' },
    { id: 'plc_operator', label: '⚡ PLC Operator' },
    { id: 'production_manager', label: '🏭 Production Manager' },
    { id: 'qc_manager', label: '✅ QC Manager' },
    { id: 'qc_supervisor', label: '🔍 QC Supervisor' },
    { id: 'line_leader', label: '👷 Line Leader' },
    // Leave approval powers (task 2.2). Kept separate from department roles
    // because approving someone's PAID LEAVE is a distinct authority from
    // being able to record a QC check. Someone can hold one without the other.
    { id: 'leave_supervisor', label: '👤 Leave Supervisor' },
    { id: 'leave_hod', label: '🏢 HOD / Subsidiary' },
    { id: 'leave_hr_head', label: '👑 Head of HR' }
  ],

  // ─── LEAVE POLICY ───────────────────────────────────────────────────────
  // Every value here is an ASSUMPTION, not a confirmed company rule. HR has
  // not answered the policy questions yet; these are defensible defaults taken
  // from the paper Leave Request Form, the Nigerian Labour Act, and standard
  // practice. All 24 are documented with reasoning, confidence rating and
  // change instructions in the blueprint document (section 04), and are
  // editable at runtime from System Config → Leave Policy.
  // Nothing here is hardcoded into logic — Phase 3 reads it.
  leavePolicy: {
    // The paper form lists exactly these five. Inventing types would be
    // presumptuous; HR can enable or disable each from the settings tab.
    leaveTypes: [
      { id: 'annual',        label: 'Annual Leave',        requiresPurpose: false, balanceTracked: true  },
      { id: 'maternity',     label: 'Maternity Leave',     requiresPurpose: true,  balanceTracked: false },
      { id: 'casual',        label: 'Casual Leave',        requiresPurpose: true,  balanceTracked: true  },
      { id: 'compassionate', label: 'Compassionate Leave', requiresPurpose: true,  balanceTracked: false },
      { id: 'examination',   label: 'Examination Leave',   requiresPurpose: true,  balanceTracked: false }
    ],

    // 21 matches the paper form's own figure. The Labour Act floor is only 6
    // working days after 12 months, so the company is already well above the
    // legal minimum.
    annualEntitlementDays: 21,
    casualEntitlementDays: 12,
    maternityDurationWeeks: 12,

    // The form says "NOTICE OF ONE WEEK". Annual leave only — a bereavement
    // cannot reasonably be booked a week ahead.
    noticeRequiredDays: 7,
    noticeAppliesTo: ['annual'],

    // Carry-over with a cap, so a large unused balance cannot snowball and
    // block future requests.
    allowCarryOver: true,
    maxCarryOverDays: 5,
    // Warn HR when someone is carrying a high balance near year end, before
    // days lapse silently. Losing leave nobody knew about is a trust problem.
    warnOnHighBalance: true,
    highBalanceWarningDays: 5,

    // New joiners get a share of the year's allowance based on joining date,
    // rather than either zero or a full year. Current best practice.
    proRateNewJoiners: true,

    // Calendar year. Changeable, because a July–June company cycle is common.
    leaveYearStartMonth: 1,

    // Sunday only. THE SINGLE MOST IMPORTANT SETTING IN THIS BLOCK: every day
    // count in the whole system depends on it. If the factory runs Saturdays,
    // tick Saturday here. Assumption A7 in the blueprint.
    nonWorkingDays: [0],

    // Public holidays declared by the Federal Government for 2026. These move
    // every year, so HR updates this list each January.
    publicHolidays: [
      { date: '2026-01-01', label: "New Year's Day" },
      { date: '2026-03-20', label: 'Eid-ul-Fitr' },
      { date: '2026-04-03', label: 'Good Friday' },
      { date: '2026-04-06', label: 'Easter Monday' },
      { date: '2026-05-01', label: "Workers' Day" },
      { date: '2026-05-27', label: 'Eid-ul-Adha' },
      { date: '2026-05-28', label: 'Eid-ul-Adha (Day 2)' },
      { date: '2026-06-12', label: 'Democracy Day' },
      { date: '2026-08-26', label: 'Maulud (Prophet Birthday)' },
      { date: '2026-10-01', label: 'Independence Day' },
      { date: '2026-12-25', label: 'Christmas Day' },
      { date: '2026-12-26', label: 'Boxing Day' }
    ],

    // A single day off needs no handover; a week does. Proportional.
    requireHandoverNote: true,
    handoverNoteRequiredDays: 3,

    // Never let a request drive a balance negative. An approver can still
    // override and sign one, which is a deliberate HR decision rather than a
    // silent debt.
    allowNegativeBalance: false,
    allowApproverOverride: true,

    // Two colleagues off together is usually fine, so this warns rather than
    // blocks. An "overlap" is informational; a "conflict" is coverage at risk.
    overlapBehaviour: 'warn',
    conflictThreshold: 2,

    // Off by default. In a factory an absent operator can stop a line, so a
    // human should always see every request.
    autoApproveShortLeave: false,
    autoApproveMaxDays: 1,

    // The paper form's footer note requires staff to confirm on their return.
    requireResumptionConfirmation: true,

    // Rejection always needs a reason: the employee deserves to know why.
    requireRejectionReason: true,

    // The three signatures in the paper form's Section 3, IN ORDER. Strictly
    // sequential — the HOD signing means the supervisor already has.
    // Deputies stop the chain deadlocking when an approver is on leave.
    stages: [
      { id: 'supervisor', label: 'Supervisor',        actionRole: 'leave_supervisor', deputyUserUid: null, deputyName: null },
      { id: 'hod',        label: 'HOD / Subsidiary', actionRole: 'leave_hod',        deputyUserUid: null, deputyName: null },
      { id: 'hr',         label: 'Head of HR',        actionRole: 'leave_hr_head',    deputyUserUid: null, deputyName: null }
    ]
  }
};

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const configRef = doc(db, 'config', 'settings');
    let unsubscribe = () => {};

    const loadConfig = async () => {
      try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({ 
            ...DEFAULT_CONFIG, 
            ...data,
            packagingTeams: { ...DEFAULT_CONFIG.packagingTeams, ...(data.packagingTeams || {}) },
            cartonWaste: { ...DEFAULT_CONFIG.cartonWaste, ...(data.cartonWaste || {}), teams: undefined, defaultTeam: undefined },
            palletTransfer: { ...DEFAULT_CONFIG.palletTransfer, ...(data.palletTransfer || {}) },
            laminateWaste: { ...DEFAULT_CONFIG.laminateWaste, ...(data.laminateWaste || {}), teams: undefined, defaultTeam: undefined },
            machines: (data.machines || DEFAULT_CONFIG.machines).map(m => ({ fillHeads: 2, ...m })),
            productionLines: data.productionLines || DEFAULT_CONFIG.productionLines,
            gramSpecs: Object.fromEntries(
              Object.entries(data.gramSpecs || DEFAULT_CONFIG.gramSpecs).map(([gram, spec]) => [
                gram, { ...(DEFAULT_CONFIG.gramSpecs[gram] || {}), ...spec }
              ])
            ),
            fillHeadWeightRanges: { ...DEFAULT_CONFIG.fillHeadWeightRanges, ...(data.fillHeadWeightRanges || {}) },
            departmentRoles: data.departmentRoles || DEFAULT_CONFIG.departmentRoles,
            hrDepartments: data.hrDepartments || DEFAULT_CONFIG.hrDepartments,
            hrShifts: data.hrShifts || DEFAULT_CONFIG.hrShifts,
            // Merge is per-key and hand-written, and this exact logic exists
            // TWICE in this file: once in loadConfig and again in the
            // onSnapshot handler. BOTH must carry this line. Update only one
            // and the policy loads correctly on first paint and then silently
            // never hot-reloads again — the admin screen looks frozen with no
            // error anywhere. That is the whole reason this comment is here.
            leavePolicy: { ...DEFAULT_CONFIG.leavePolicy, ...(data.leavePolicy || {}) },
            actionRoles: data.actionRoles
              ? (() => {
                  const existingIds = new Set((data.actionRoles || []).map(r => r.id));
                  const missing = DEFAULT_CONFIG.actionRoles.filter(r => !existingIds.has(r.id));
                  return [...data.actionRoles, ...missing];
                })()
              : DEFAULT_CONFIG.actionRoles
          });
        } else {
          try {
            await setDoc(configRef, { ...DEFAULT_CONFIG, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          } catch (err) { console.error(err); }
        }
      } catch (err) {
        if (err.code !== 'permission-denied') {
          console.error("Error reading config:", err);
        }
      }
      setLoadingConfig(false);
    };

    loadConfig().then(() => {
      unsubscribe = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setConfig({
            ...DEFAULT_CONFIG,
            ...data,
            packagingTeams: { ...DEFAULT_CONFIG.packagingTeams, ...(data.packagingTeams || {}) },
            cartonWaste: { ...DEFAULT_CONFIG.cartonWaste, ...(data.cartonWaste || {}), teams: undefined, defaultTeam: undefined },
            palletTransfer: { ...DEFAULT_CONFIG.palletTransfer, ...(data.palletTransfer || {}) },
            laminateWaste: { ...DEFAULT_CONFIG.laminateWaste, ...(data.laminateWaste || {}), teams: undefined, defaultTeam: undefined },
            machines: (data.machines || DEFAULT_CONFIG.machines).map(m => ({ fillHeads: 2, ...m })),
            productionLines: data.productionLines || DEFAULT_CONFIG.productionLines,
            gramSpecs: Object.fromEntries(
              Object.entries(data.gramSpecs || DEFAULT_CONFIG.gramSpecs).map(([gram, spec]) => [
                gram, { ...(DEFAULT_CONFIG.gramSpecs[gram] || {}), ...spec }
              ])
            ),
            fillHeadWeightRanges: { ...DEFAULT_CONFIG.fillHeadWeightRanges, ...(data.fillHeadWeightRanges || {}) },
            departmentRoles: data.departmentRoles || DEFAULT_CONFIG.departmentRoles,
            hrDepartments: data.hrDepartments || DEFAULT_CONFIG.hrDepartments,
            hrShifts: data.hrShifts || DEFAULT_CONFIG.hrShifts,
            // Merge is per-key and hand-written, and this exact logic exists
            // TWICE in this file: once in loadConfig and again in the
            // onSnapshot handler. BOTH must carry this line. Update only one
            // and the policy loads correctly on first paint and then silently
            // never hot-reloads again — the admin screen looks frozen with no
            // error anywhere. That is the whole reason this comment is here.
            leavePolicy: { ...DEFAULT_CONFIG.leavePolicy, ...(data.leavePolicy || {}) },
            actionRoles: data.actionRoles
              ? (() => {
                  const existingIds = new Set((data.actionRoles || []).map(r => r.id));
                  const missing = DEFAULT_CONFIG.actionRoles.filter(r => !existingIds.has(r.id));
                  return [...data.actionRoles, ...missing];
                })()
              : DEFAULT_CONFIG.actionRoles
          });
        }
      }, (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Error listening to config:", error);
        }
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loadingConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export const useConfig = () => useContext(ConfigContext);