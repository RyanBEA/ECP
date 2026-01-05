// Stud spacing options - determines framing fraction
export const studSpacingOptions = [
  { label: '16"', fraction: 0.23 },
  { label: '19"', fraction: 0.215 },
  { label: '24"', fraction: 0.2 }
];

// Cavity insulation options - provides Cavity and Framing R-values
export const cavityInsulationOptions = [
  { label: '2x4 R12', cavity: 2.11, framing: 0.75565 },
  { label: '2x4 R14', cavity: 2.46, framing: 0.75565 },
  { label: '2x6 R20', cavity: 3.34, framing: 1.18745 },
  { label: '2x6 R22', cavity: 3.87, framing: 1.18745 },
  { label: '2x6 R24', cavity: 4.23, framing: 1.18745 }
];

// Continuous insulation options - adds to total RSI
export const continuousInsulationOptions = [
  { label: 'None', rsi: 0 },
  { label: '1" XPS', rsi: 0.88 },
  { label: '1.5" XPS', rsi: 1.28 },
  { label: '2" XPS', rsi: 1.68 },
  { label: '1" EPS', rsi: 0.65 },
  { label: '1.5" EPS', rsi: 0.98 },
  { label: '2" EPS', rsi: 1.3 },
  { label: '1" PIC', rsi: 0.97 },
  { label: '1.5" PIC', rsi: 1.39 },
  { label: '2" PIC', rsi: 1.8 }
];

// Base RSI constant (interior + exterior air films, sheathing, etc.)
const BASE_RSI = 0.44547;

// Calculate wall RSI from selections
// Formula: RSI = 1/(Fraction/Framing + (1-Fraction)/Cavity) + RSI + 0.44547
export function calculateWallRsi(studSpacing, cavityIns, continuousIns) {
  const spacing = studSpacingOptions.find(s => s.label === studSpacing);
  const cavity = cavityInsulationOptions.find(c => c.label === cavityIns);
  const continuous = continuousInsulationOptions.find(c => c.label === continuousIns);

  if (!spacing || !cavity || !continuous) return null;

  const { fraction } = spacing;
  const { cavity: cavityR, framing: framingR } = cavity;
  const { rsi: continuousR } = continuous;

  // Parallel path calculation for framed wall
  const framedWallRsi = 1 / (fraction / framingR + (1 - fraction) / cavityR);

  return framedWallRsi + continuousR + BASE_RSI;
}

// RSI thresholds for above-grade walls and their point values
export const wallPointsThresholds = [
  { minRsi: 3.08, points: 1.6 },
  { minRsi: 3.69, points: 6.2 },
  { minRsi: 3.85, points: 6.9 },
  { minRsi: 3.96, points: 7.7 },
  { minRsi: 4.29, points: 9.2 },
  { minRsi: 4.4, points: 9.9 },
  { minRsi: 4.57, points: 10.6 },
  { minRsi: 4.73, points: 11.1 },
  { minRsi: 4.84, points: 11.6 },
  { minRsi: 5.01, points: 12.2 },
  { minRsi: 5.45, points: 13.6 }
];

// Get points for a given RSI value (finds highest threshold met)
export function getWallPoints(rsi) {
  if (!rsi) return 0;

  // Sort thresholds by minRsi descending, find first one that RSI meets or exceeds
  const sorted = [...wallPointsThresholds].sort((a, b) => b.minRsi - a.minRsi);
  const threshold = sorted.find(t => rsi >= t.minRsi);
  return threshold ? threshold.points : 0;
}

export const categories = [
  {
    id: 'aboveGroundWalls',
    name: 'Above Ground Walls',
    metric: 'RSI',
    unit: 'm²·K/W',
    description: 'Thermal resistance of above-grade wall assemblies',
    direction: 'higher',
    type: 'wallBuilder', // Special type - uses WallBuilder component
    options: [
      { value: 3.08, points: 1.6 },
      { value: 3.69, points: 6.2 },
      { value: 3.85, points: 6.9 },
      { value: 3.96, points: 7.7 },
      { value: 4.29, points: 9.2 },
      { value: 4.4, points: 9.9 },
      { value: 4.57, points: 10.6 },
      { value: 4.73, points: 11.1 },
      { value: 4.84, points: 11.6 },
      { value: 5.01, points: 12.2 },
      { value: 5.45, points: 13.6 }
    ]
  },
  {
    id: 'airTightness',
    name: 'Air Tightness',
    metric: 'ACH',
    unit: 'ACH @ 50Pa',
    description: 'Air changes per hour at 50 pascals pressure',
    direction: 'lower', // lower ACH = more points
    options: [
      { value: 2.5, points: 0 },
      { value: 2.0, points: 3.5 },
      { value: 1.5, points: 6.9 },
      { value: 1.0, points: 10.4 },
      { value: 0.6, points: 13.3 }
    ]
  },
  {
    id: 'belowGradeWalls',
    name: 'Below Grade Walls',
    metric: 'RSI',
    unit: 'm²·K/W',
    description: 'Thermal resistance of below-grade wall assemblies',
    direction: 'higher',
    options: [
      { value: 3.09, points: 0.2 },
      { value: 3.46, points: 0.8 },
      { value: 3.9, points: 1.4 }
    ]
  },
  {
    id: 'dhwElectric',
    name: 'DHW (Electric)',
    metric: 'EF',
    unit: 'Energy Factor',
    description: 'Electric water heater efficiency',
    direction: 'higher',
    exclusiveGroup: 'dhw',
    options: [
      { value: 2.35, points: 3.8 }
    ]
  },
  {
    id: 'dhwGas',
    name: 'DHW (Non-Electric)',
    metric: 'UEF',
    unit: 'Uniform Energy Factor',
    description: 'Gas/propane water heater efficiency',
    direction: 'higher',
    exclusiveGroup: 'dhw',
    options: [
      { value: 0.79, points: 2.4, label: 'Commercial Storage-type' },
      { value: 0.83, points: 4.9, label: 'Residential Storage-type' },
      { value: 0.85, points: 3.2, label: 'Commercial Storage-type' },
      { value: 0.92, points: 4.9, label: 'Tankless Condensing' }
    ]
  },
  {
    id: 'hrv',
    name: 'Heat Recovery Ventilation',
    metric: 'SRE',
    unit: '%',
    description: 'Sensible heat recovery efficiency',
    direction: 'higher',
    options: [
      { value: 65, points: 0.7 },
      { value: 75, points: 2.2 },
      { value: 84, points: 3.5 }
    ]
  },
  {
    id: 'volume',
    name: 'Heated Volume',
    metric: 'Volume',
    unit: 'm³',
    description: 'Total heated volume of the building',
    direction: 'lower', // smaller volume = more points
    options: [
      { value: 390, points: 1 },
      { value: 380, points: 2 },
      { value: 370, points: 3 },
      { value: 360, points: 4 },
      { value: 350, points: 5 },
      { value: 340, points: 6 },
      { value: 330, points: 7 },
      { value: 320, points: 8 },
      { value: 310, points: 9 },
      { value: 300, points: 10 }
    ]
  },
  {
    id: 'windowsDoors',
    name: 'Windows & Doors',
    metric: 'U-value',
    unit: 'W/m²·K',
    description: 'Maximum thermal transmittance',
    direction: 'lower', // lower U = more points
    options: [
      { value: 1.44, points: 1.6 },
      { value: 1.22, points: 6.2 }
    ]
  }
];

// Tier options
export const tiers = [
  { id: 2, label: 'Tier 2', points: 10 },
  { id: 3, label: 'Tier 3', points: 20 }
];
