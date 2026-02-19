// Wall type options
export const wallTypes = [
  { id: 'wood', label: 'Wood Frame' },
  { id: 'steel', label: 'Steel Frame' },
  { id: 'icf', label: 'ICF' }
]

// Stud spacing options
export const studSpacingOptions = [
  { label: '16"' },
  { label: '19"' },
  { label: '24"' }
]

// Cavity insulation materials
export const cavityMaterials = [
  'Fiberglass Batt',
  'Mineral Wool Batt',
  'Loose Fill Cellulose',
  'Dense Pack Cellulose',
  'Loose Fill Fiberglass'
]

// Cavity insulation types (stud size + nominal R-value)
export const cavityTypes = [
  '2x4 R12', '2x4 R14', '2x6 R20', '2x6 R22', '2x6 R24'
]

// Continuous insulation types
export const continuousInsTypes = ['EPS', 'XPS', 'PIC', 'Mineral Wool']

// Continuous insulation thicknesses
export const continuousInsThicknesses = [
  'None', '1"', '1-1/2"', '2"', '2-1/2"', '3"'
]

// ICF form thickness options (per side)
export const icfFormOptions = ['2.5"', '3-1/8"', '4-1/4"']

// Parallel path pre-computed RSI lookup
// wallType -> spacing -> cavityMaterial -> cavityType -> RSI
// Values for wood + Fiberglass Batt computed from existing parallel path formula.
// All other combinations are null (pending data from Ryan).
export const framedWallRsi = {
  wood: {
    '16"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.56, '2x4 R14': 1.75, '2x6 R20': 2.36,
        '2x6 R22': 2.63, '2x6 R24': 2.81
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '19"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.59, '2x4 R14': 1.79, '2x6 R20': 2.42,
        '2x6 R22': 2.70, '2x6 R24': 2.89
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '24"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.64, '2x4 R14': 1.85, '2x6 R20': 2.51,
        '2x6 R22': 2.81, '2x6 R24': 3.01
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    }
  },
  steel: {
    '16"': {
      'Fiberglass Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '19"': {
      'Fiberglass Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    },
    '24"': {
      'Fiberglass Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Mineral Wool Batt': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Dense Pack Cellulose': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      },
      'Loose Fill Fiberglass': {
        '2x4 R12': null, '2x4 R14': null, '2x6 R20': null,
        '2x6 R22': null, '2x6 R24': null
      }
    }
  }
}

// Continuous insulation RSI lookup: type -> thickness -> RSI
export const continuousInsRsi = {
  'EPS': {
    'None': 0, '1"': 0.65, '1-1/2"': 0.98, '2"': 1.30, '2-1/2"': 1.63, '3"': 1.95
  },
  'XPS': {
    'None': 0, '1"': 0.88, '1-1/2"': 1.28, '2"': 1.68, '2-1/2"': 2.10, '3"': 2.52
  },
  'PIC': {
    'None': 0, '1"': 0.97, '1-1/2"': 1.39, '2"': 1.80, '2-1/2"': 2.22, '3"': 2.64
  },
  'Mineral Wool': {
    'None': 0, '1"': null, '1-1/2"': null, '2"': null, '2-1/2"': null, '3"': null
  }
}

// ICF total RSI lookup: formThickness -> total RSI (fully pre-computed)
export const icfRsi = {
  '2.5"': null,
  '3-1/8"': null,
  '4-1/4"': null
}

// Base RSI constant (interior + exterior air films, drywall, sheathing)
const BASE_RSI = 0.44547

// Calculate wall RSI from selections (lookup-based)
export function calculateWallRsi({ wallType, studSpacing, cavityMaterial, cavityType, contInsType, contInsThickness, icfFormThickness } = {}) {
  // ICF path — single lookup, fully pre-computed
  if (wallType === 'icf') {
    return icfRsi[icfFormThickness] ?? null
  }

  // Wood/Steel path — parallel path lookup + isothermal planes sum
  const framed = framedWallRsi[wallType]?.[studSpacing]?.[cavityMaterial]?.[cavityType]
  if (framed == null) return null

  // If no continuous insulation selected, just framed + base
  if (!contInsType || contInsThickness === 'None') {
    return framed + BASE_RSI
  }

  const contIns = continuousInsRsi[contInsType]?.[contInsThickness]
  if (contIns == null) return null

  return framed + contIns + BASE_RSI
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
