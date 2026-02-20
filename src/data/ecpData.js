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

// Cavity insulation types per material (stud size + nominal R-value where applicable)
// Wood uses 2x4 studs (3.5"), steel uses 2x3-5/8 studs (3.625").
// Both share 2x6 cavity types. The getAvailableCavityTypes filter
// in WallBuilder ensures only matching types appear per wall type.
export const cavityTypesByMaterial = {
  'Fiberglass Batt': ['2x4 R12', '2x3-5/8 R12', '2x4 R14', '2x3-5/8 R14', '2x6 R20', '2x6 R22', '2x6 R24'],
  'Mineral Wool Batt': ['2x4 R14', '2x3-5/8 R14', '2x6 R22', '2x6 R24'],
  'Loose Fill Cellulose': ['2x4', '2x3-5/8', '2x6'],
  'Dense Pack Cellulose': ['2x4', '2x3-5/8', '2x6'],
  'Loose Fill Fiberglass': ['2x4', '2x3-5/8', '2x6']
}

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
export const framedWallRsi = {
  wood: {
    '16"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.94, '2x4 R14': 2.07, '2x6 R20': 2.81,
        '2x6 R22': 3.00, '2x6 R24': 3.11
      },
      'Mineral Wool Batt': {
        '2x4 R14': 2.07, '2x6 R22': 3.00, '2x6 R24': 3.11
      },
      'Loose Fill Cellulose': {
        '2x4': 1.99, '2x6': 2.86
      },
      'Dense Pack Cellulose': {
        '2x4': 1.95, '2x6': 2.81
      },
      'Loose Fill Fiberglass': {
        '2x4': 2.10, '2x6': 3.06
      }
    },
    '19"': {
      'Fiberglass Batt': {
        '2x4 R12': 1.97, '2x4 R14': 2.11, '2x6 R20': 2.85,
        '2x6 R22': 3.06, '2x6 R24': 3.18
      },
      'Mineral Wool Batt': {
        '2x4 R14': 2.11, '2x6 R22': 3.06, '2x6 R24': 3.18
      },
      'Loose Fill Cellulose': {
        '2x4': 2.02, '2x6': 2.91
      },
      'Dense Pack Cellulose': {
        '2x4': 1.98, '2x6': 2.86
      },
      'Loose Fill Fiberglass': {
        '2x4': 2.14, '2x6': 3.12
      }
    },
    '24"': {
      'Fiberglass Batt': {
        '2x4 R12': 2.00, '2x4 R14': 2.14, '2x6 R20': 2.90,
        '2x6 R22': 3.12, '2x6 R24': 3.25
      },
      'Mineral Wool Batt': {
        '2x4 R14': 2.14, '2x6 R22': 3.12, '2x6 R24': 3.25
      },
      'Loose Fill Cellulose': {
        '2x4': 2.05, '2x6': 2.97
      },
      'Dense Pack Cellulose': {
        '2x4': 2.01, '2x6': 2.91
      },
      'Loose Fill Fiberglass': {
        '2x4': 2.18, '2x6': 3.18
      }
    }
  },
  steel: {
    '16"': {
      'Fiberglass Batt': {
        '2x3-5/8 R12': 1.39, '2x3-5/8 R14': 1.52, '2x6 R20': 1.97,
        '2x6 R22': 2.10, '2x6 R24': 2.23
      },
      'Mineral Wool Batt': {
        '2x3-5/8 R14': 1.52, '2x6 R22': 2.10, '2x6 R24': 2.23
      },
      'Loose Fill Cellulose': {
        '2x3-5/8': 1.44, '2x6': 1.96
      },
      'Dense Pack Cellulose': {
        '2x3-5/8': 1.40, '2x6': 1.91
      },
      'Loose Fill Fiberglass': {
        '2x3-5/8': 1.56, '2x6': 2.16
      }
    },
    '19"': {
      'Fiberglass Batt': {
        '2x3-5/8 R12': 1.42, '2x3-5/8 R14': 1.55, '2x6 R20': 2.02,
        '2x6 R22': 2.14, '2x6 R24': 2.27
      },
      'Mineral Wool Batt': {
        '2x3-5/8 R14': 1.55, '2x6 R22': 2.14, '2x6 R24': 2.27
      },
      'Loose Fill Cellulose': {
        '2x3-5/8': 1.46, '2x6': 2.01
      },
      'Dense Pack Cellulose': {
        '2x3-5/8': 1.43, '2x6': 1.95
      },
      'Loose Fill Fiberglass': {
        '2x3-5/8': 1.58, '2x6': 2.21
      }
    },
    '24"': {
      'Fiberglass Batt': {
        '2x3-5/8 R12': 1.63, '2x3-5/8 R14': 1.80, '2x6 R20': 2.37,
        '2x6 R22': 2.54, '2x6 R24': 2.70
      },
      'Mineral Wool Batt': {
        '2x3-5/8 R14': 1.80, '2x6 R22': 2.54, '2x6 R24': 2.70
      },
      'Loose Fill Cellulose': {
        '2x3-5/8': 1.69, '2x6': 2.36
      },
      'Dense Pack Cellulose': {
        '2x3-5/8': 1.64, '2x6': 2.30
      },
      'Loose Fill Fiberglass': {
        '2x3-5/8': 1.84, '2x6': 2.62
      }
    }
  }
}

// Continuous insulation RSI lookup: type -> thickness -> RSI
export const continuousInsRsi = {
  'EPS': {
    'None': 0, '1"': 0.65, '1-1/2"': 0.9906, '2"': 1.3, '2-1/2"': 1.651, '3"': 1.9812
  },
  'XPS': {
    'None': 0, '1"': 0.88, '1-1/2"': 1.28, '2"': 1.68, '2-1/2"': 2.1336, '3"': 2.56032
  },
  'PIC': {
    'None': 0, '1"': 0.97, '1-1/2"': 1.385, '2"': 1.8, '2-1/2"': 2.286, '3"': 2.7432
  },
  'Mineral Wool': {
    'None': 0, '1"': 0.704, '1-1/2"': 1.05537, '2"': 1.40716, '2-1/2"': 1.75895, '3"': 2.11074
  }
}

// ICF total RSI lookup: formThickness -> total RSI (fully pre-computed)
export const icfRsi = {
  '2.5"': 3.602,
  '3-1/8"': 4.4275,
  '4-1/4"': 5.9134
}

// Calculate wall RSI from selections (lookup-based)
// framedWallRsi values already include drywall, sheathing, and air films.
// Only continuous insulation RSI is added at runtime.
export function calculateWallRsi({ wallType, studSpacing, cavityMaterial, cavityType, contInsType, contInsThickness, icfFormThickness } = {}) {
  // ICF path — single lookup, fully pre-computed
  if (wallType === 'icf') {
    return icfRsi[icfFormThickness] ?? null
  }

  // Wood/Steel path — framed wall lookup + optional continuous insulation
  const framed = framedWallRsi[wallType]?.[studSpacing]?.[cavityMaterial]?.[cavityType]
  if (framed == null) return null

  // If no continuous insulation selected, framed RSI is the total
  if (!contInsType || contInsThickness === 'None') {
    return framed
  }

  const contIns = continuousInsRsi[contInsType]?.[contInsThickness]
  if (contIns == null) return null

  return framed + contIns
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
