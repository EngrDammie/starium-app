// src/pages/SystemConfig/factoryDefaults.js
//
// Standard 30-machine factory default configuration used by the
// "Reset to Defaults" action. Extracted here so the default is importable
// and testable without rendering the admin panel.

export const DEFAULT_FACTORY_CONFIG = {
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
    { id: 1, displayNumber: 1, gram: 125, min: 0.200, max: 0.270, line: "1A", fillHeads: 2, name: "Machine 1" },
    { id: 2, displayNumber: 2, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 2" },
    { id: 3, displayNumber: 3, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 3" },
    { id: 4, displayNumber: 4, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 4" },
    { id: 5, displayNumber: 5, gram: 85, min: 0.240, max: 0.300, line: "1A", fillHeads: 2, name: "Machine 5" },
    { id: 6, displayNumber: 6, gram: 125, min: 0.200, max: 0.270, line: "1B", fillHeads: 2, name: "Machine 6" },
    { id: 7, displayNumber: 7, gram: 85, min: 0.240, max: 0.300, line: "1B", fillHeads: 2, name: "Machine 7" },
    { id: 8, displayNumber: 8, gram: 850, min: 0.200, max: 0.270, line: "1B", fillHeads: 2, name: "Machine 8" },
    { id: 9, displayNumber: 9, gram: 85, min: 0.240, max: 0.300, line: "1B", fillHeads: 2, name: "Machine 9" },
    { id: 10, displayNumber: 10, gram: 22, min: 0.200, max: 0.310, line: "1B", fillHeads: 2, name: "Machine 10" },
    { id: 11, displayNumber: 11, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 11" },
    { id: 12, displayNumber: 12, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 12" },
    { id: 13, displayNumber: 13, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 13" },
    { id: 14, displayNumber: 14, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 14" },
    { id: 15, displayNumber: 15, gram: 85, min: 0.240, max: 0.300, line: "2A", fillHeads: 2, name: "Machine 15" },
    { id: 16, displayNumber: 16, gram: 850, min: 0.200, max: 0.270, line: "2B", fillHeads: 2, name: "Machine 16" },
    { id: 17, displayNumber: 17, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 17" },
    { id: 18, displayNumber: 18, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 18" },
    { id: 19, displayNumber: 19, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 19" },
    { id: 20, displayNumber: 20, gram: 85, min: 0.240, max: 0.300, line: "2B", fillHeads: 2, name: "Machine 20" },
    { id: 21, displayNumber: 21, gram: 850, min: 0.200, max: 0.270, line: "3A", fillHeads: 2, name: "Machine 21" },
    { id: 22, displayNumber: 22, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 22" },
    { id: 23, displayNumber: 23, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 23" },
    { id: 24, displayNumber: 24, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 24" },
    { id: 25, displayNumber: 25, gram: 45, min: 0.210, max: 0.310, line: "3A", fillHeads: 2, name: "Machine 25" },
    { id: 26, displayNumber: 26, gram: 850, min: 0.200, max: 0.270, line: "3B", fillHeads: 2, name: "Machine 26" },
    { id: 27, displayNumber: 27, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 27" },
    { id: 28, displayNumber: 28, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 28" },
    { id: 29, displayNumber: 29, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 29" },
    { id: 30, displayNumber: 30, gram: 45, min: 0.210, max: 0.310, line: "3B", fillHeads: 2, name: "Machine 30" }
  ],
  gramSpecs: {
    "22": { min: 0.200, max: 0.310, piecesPerCarton: 162, piecesBreakdown: "150 pcs + 12 freebies", bagCount: 150, freebieCount: 12 },
    "45": { min: 0.210, max: 0.310, piecesPerCarton: 84, piecesBreakdown: "78 pcs + 6 freebies", bagCount: 78, freebieCount: 6 },
    "85": { min: 0.240, max: 0.300, piecesPerCarton: 52, piecesBreakdown: "48 pcs + 4 freebies", bagCount: 48, freebieCount: 4 },
    "125": { min: 0.200, max: 0.270, piecesPerCarton: 31, piecesBreakdown: "28 pcs + 3 freebies", bagCount: 28, freebieCount: 3 },
    "850": { min: 0.200, max: 0.270, piecesPerCarton: 7, piecesBreakdown: "6 pouches + 1 freebie", bagCount: 6, freebieCount: 1 }
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
  cartonWaste: {
    targetWastePercent: 5,
    wasteAlertThreshold: 10
  },
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
  }
};
