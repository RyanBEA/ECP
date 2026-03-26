// ECP Calculator — Data Layer
//
// Imports pre-computed wall data from the build pipeline (scripts/generate.js)
// and provides lookup functions for the React app.
//
// The compute module is imported for runtime calculations when boundary layers
// differ from defaults (variable cladding/sheathing) or continuous insulation
// is added (which affects steel K-values per NBC Table B).

import wallData from './generated/wall-data.json'
import continuousInsData from './generated/continuous-ins.json'
import icfData from './generated/icf-data.json'
import boundaryOptions from './generated/boundary-options.json'
import thresholdsData from './generated/thresholds.json'
import doubleStudData from './generated/double-stud-data.json'
import { woodWallRsi, steelWallRsi, icfWallRsi, doubleStudWallRsi, parallelPath, boundarySum } from '@scripts/compute.js'

// --- Exports matching existing API (backward compatible) ---

export const wallTypes = [
  { id: 'wood', label: 'Wood Frame' },
  { id: 'steel', label: 'Steel Frame' },
  { id: 'icf', label: 'ICF' },
]

export const studSpacingOptions = [
  { label: '16"' },
  { label: '19"' },
  { label: '24"' },
]

// Derive cavity materials from wall-data.json
export const cavityMaterials = (() => {
  const mats = new Set()
  for (const wt of Object.values(wallData)) {
    if (!wt.spacings) continue
    for (const sp of Object.values(wt.spacings)) {
      for (const label of Object.keys(sp.materials)) {
        mats.add(label)
      }
    }
  }
  return [...mats]
})()

// Derive available cavity types per material from wall-data.json
// Uses wood spacings as the canonical set (widest variety including deep cavities)
export const cavityTypesByMaterial = (() => {
  const result = {}
  const woodSpacings = wallData.wood?.spacings || {}
  // Merge all spacings to get the full set of cavity types
  for (const sp of Object.values(woodSpacings)) {
    for (const [label, entries] of Object.entries(sp.materials)) {
      if (!result[label]) result[label] = new Set()
      for (const key of Object.keys(entries)) {
        result[label].add(key)
      }
    }
  }
  // Also add steel-specific stud names (2x3-5/8) for steel cavity types
  const steelSpacings = wallData.steel?.spacings || {}
  for (const sp of Object.values(steelSpacings)) {
    for (const [label, entries] of Object.entries(sp.materials)) {
      if (!result[label]) result[label] = new Set()
      for (const key of Object.keys(entries)) {
        result[label].add(key)
      }
    }
  }
  // Convert Sets to arrays
  const out = {}
  for (const [label, set] of Object.entries(result)) {
    out[label] = [...set]
  }
  return out
})()

// Backward-compatible: PIC → Polyiso
export const continuousInsTypes = Object.keys(continuousInsData)

export const continuousInsThicknesses = ['None', '1"', '1-1/2"', '2"', '2-1/2"', '3"']

export const icfFormOptions = icfData.forms.map(f => f.label)

// Continuous insulation RSI lookup: type -> thickness -> RSI
// Handles PIC → Polyiso rename for backward compat
export const continuousInsRsi = (() => {
  const result = {}
  for (const [label, data] of Object.entries(continuousInsData)) {
    result[label] = { None: 0, ...data.thicknesses }
  }
  // Backward compat: 'PIC' maps to 'Polyiso'
  if (result['Polyiso'] && !result['PIC']) {
    result['PIC'] = result['Polyiso']
  }
  return result
})()

// ICF total RSI lookup: formThickness -> total RSI (with default boundary)
export const icfRsi = (() => {
  const result = {}
  const defaultCladding = boundaryOptions.cladding.options.find(
    o => o.id === boundaryOptions.cladding.defaults.icf
  )
  for (const f of icfData.forms) {
    result[f.label] = icfWallRsi({
      formThicknessMm: f.thickness_mm,
      epsRsiPerMm: icfData.eps_rsi_per_mm,
      concreteCoreMm: icfData.concrete_core_mm,
      concreteRsiPerMm: icfData.concrete_rsi_per_mm,
      boundary: {
        outside_air: boundaryOptions.air_films.outside,
        cladding: defaultCladding?.rsi || 0.017,
        drywall: boundaryOptions.drywall.default,
        inside_air: boundaryOptions.air_films.inside,
      },
    })
  }
  return result
})()

// Framed wall RSI lookup — backward compat for WallBuilder's getAvailableCavityTypes.
// Structure: wallType -> spacing -> material -> cavityType -> RSI
// Values are computed with DEFAULT boundary layers.
export const framedWallRsi = (() => {
  const result = {}
  for (const [wallType, wtData] of Object.entries(wallData)) {
    if (!wtData.spacings) continue
    result[wallType] = {}
    for (const [spacing, spData] of Object.entries(wtData.spacings)) {
      const spacingLabel = `${spacing}"`
      result[wallType][spacingLabel] = {}
      for (const [matLabel, entries] of Object.entries(spData.materials)) {
        result[wallType][spacingLabel][matLabel] = {}
        for (const [cavType, e] of Object.entries(entries)) {
          // Compute total RSI with default boundary
          const boundary = getDefaultBoundary(wallType)
          let rsi
          if (wallType === 'wood') {
            rsi = woodWallRsi({
              studDepthMm: wtData.studs[e.stud].depth_mm,
              cavityRsi: e.cavityRsi,
              cavityPct: spData.cavity_pct,
              boundary,
            })
          } else if (wallType === 'steel') {
            rsi = steelWallRsi({
              studDepthMm: wtData.studs[e.stud].depth_mm,
              cavityRsi: e.cavityRsi,
              spacingInches: parseInt(spacing),
              boundary,
              airSpace: boundary.air_space,
            })
          }
          result[wallType][spacingLabel][matLabel][cavType] = rsi ? Math.round(rsi * 100) / 100 : null
        }
      }
    }
  }
  return result
})()

export const wallPointsThresholds = thresholdsData.walls
export const MIN_WALL_RSI = thresholdsData.minWallRsi

// --- Boundary layer API ---

export function getBoundaryOptions() {
  return boundaryOptions
}

export function getDefaultBoundary(wallType) {
  const b = {
    outside_air: boundaryOptions.air_films.outside,
    inside_air: boundaryOptions.air_films.inside,
    drywall: boundaryOptions.drywall.default,
    cladding: 0,
    sheathing: 0,
    air_space: 0,
  }

  const claddingId = boundaryOptions.cladding.defaults[wallType]
  const cladding = boundaryOptions.cladding.options.find(o => o.id === claddingId)
  b.cladding = cladding?.rsi || 0

  if (boundaryOptions.sheathing.applies_to.includes(wallType)) {
    const sheathingId = boundaryOptions.sheathing.defaults?.[wallType] || boundaryOptions.sheathing.default
    const sheathing = boundaryOptions.sheathing.options.find(o => o.id === sheathingId)
    b.sheathing = sheathing?.rsi || 0
  }

  if (wallType === 'steel') {
    b.air_space = boundaryOptions.steel_air_space.rsi
  }

  return b
}

export function getContinuousInsRsi(type, thickness) {
  if (!type || thickness === 'None') return 0
  // Handle PIC → Polyiso
  const lookupType = type === 'PIC' ? 'Polyiso' : type
  return continuousInsData[lookupType]?.thicknesses[thickness] ?? 0
}

// Interior layer RSI: resolves either a sheathing ID or a cont ins type+thickness
// Sheathing IDs match boundary-options.json (e.g., 'osb_11', 'plywood_sw_12_5')
// Cont ins types match continuous-ins.json (e.g., 'XPS', 'Polyiso')
export function getInteriorLayerRsi(material, thickness) {
  if (!material) return 0
  // Try sheathing lookup first
  const sheathing = boundaryOptions.sheathing.options.find(o => o.id === material)
  if (sheathing) return sheathing.rsi
  // Try continuous insulation lookup
  return getContinuousInsRsi(material, thickness)
}

// --- Main calculation function (backward compatible + extended) ---

export function calculateWallRsi({
  wallType, studSpacing, cavityMaterial, cavityType,
  contInsType, contInsThickness, icfFormThickness,
  sheathingId, claddingId,
  assemblyType = 'single',
  outerStud, innerStud, plate, doubleStudMaterial,
  hasServiceWall = false,
  serviceSpacing, serviceCavityMaterial, serviceCavityType,
  interiorLayerMaterial, interiorLayerThickness,
} = {}) {
  // Build boundary layers (with optional custom cladding/sheathing)
  const boundary = getDefaultBoundary(wallType || 'wood')
  if (sheathingId) {
    const sh = boundaryOptions.sheathing.options.find(o => o.id === sheathingId)
    if (sh) boundary.sheathing = sh.rsi
  }
  if (claddingId) {
    const cl = boundaryOptions.cladding.options.find(o => o.id === claddingId)
    if (cl) boundary.cladding = cl.rsi
  }

  const contInsRsi = getContinuousInsRsi(contInsType, contInsThickness)

  // Service wall path (wood only, works with single or double stud primary)
  if (hasServiceWall && wallType === 'wood') {
    const spacing = studSpacing?.replace('"', '') || ''
    const wt = wallData.wood

    // Compute primary wall parallel-path
    let primaryPP
    if (assemblyType === 'doubleStud') {
      const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
      const dsEntry = doubleStudData[spacing]?.[key]
      if (!dsEntry) return null
      primaryPP = dsEntry.totalPpRsi
    } else {
      // Single wall primary
      if (!wt?.spacings?.[spacing]) return null
      const sp = wt.spacings[spacing]
      const entry = sp.materials[cavityMaterial]?.[cavityType]
      if (!entry) return null
      const studRsi = wt.studs[entry.stud].depth_mm * 0.0085
      primaryPP = parallelPath(studRsi, entry.cavityRsi, sp.cavity_pct)
    }

    // Compute service wall parallel-path
    const svcSpacing = serviceSpacing?.replace('"', '') || ''
    if (!wt?.spacings?.[svcSpacing]) return null
    const svcSp = wt.spacings[svcSpacing]
    const svcEntry = svcSp.materials[serviceCavityMaterial]?.[serviceCavityType]
    if (!svcEntry) return null
    const svcStudRsi = wt.studs[svcEntry.stud].depth_mm * 0.0085
    const servicePP = parallelPath(svcStudRsi, svcEntry.cavityRsi, svcSp.cavity_pct)

    // Interior layer RSI
    const intLayerRsi = getInteriorLayerRsi(interiorLayerMaterial, interiorLayerThickness)

    // Total: boundary (no cont ins) + primary + interior layer + service
    return boundarySum(boundary) + primaryPP + intLayerRsi + servicePP
  }

  // ICF path
  if (wallType === 'icf') {
    const form = icfData.forms.find(f => f.label === icfFormThickness)
    if (!form) return null
    return icfWallRsi({
      formThicknessMm: form.thickness_mm,
      epsRsiPerMm: icfData.eps_rsi_per_mm,
      concreteCoreMm: icfData.concrete_core_mm,
      concreteRsiPerMm: icfData.concrete_rsi_per_mm,
      boundary,
    })
  }

  // Single wall path (wood or steel)
  if (assemblyType === 'single') {
    const spacing = studSpacing?.replace('"', '') || ''
    const wt = wallData[wallType]
    if (!wt?.spacings?.[spacing]) return null
    const sp = wt.spacings[spacing]
    const entry = sp.materials[cavityMaterial]?.[cavityType]
    if (!entry) return null

    if (wallType === 'wood') {
      return woodWallRsi({
        studDepthMm: wt.studs[entry.stud].depth_mm,
        cavityRsi: entry.cavityRsi,
        cavityPct: sp.cavity_pct,
        boundary,
        contInsRsi,
      })
    }

    if (wallType === 'steel') {
      return steelWallRsi({
        studDepthMm: wt.studs[entry.stud].depth_mm,
        cavityRsi: entry.cavityRsi,
        spacingInches: parseInt(spacing),
        boundary,
        airSpace: boundary.air_space,
        contInsRsi,
      })
    }
  }

  // Double stud path (wood only)
  if (assemblyType === 'doubleStud') {
    const spacing = studSpacing?.replace('"', '') || ''
    const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
    const entry = doubleStudData[spacing]?.[key]
    if (!entry) return null

    return doubleStudWallRsi({
      outerStudDepthMm: wallData.wood.studs[entry.outerStud]?.depth_mm,
      innerStudDepthMm: wallData.wood.studs[entry.innerStud]?.depth_mm,
      plateDepthMm: wallData.wood.studs[entry.plate]?.depth_mm,
      cavityRsiPerMm: entry.rsiPerMm,
      cavityPct: wallData.wood.spacings[spacing]?.cavity_pct || 77,
      boundary,
      contInsRsi,
    })
  }

  return null
}

// Get points for a given RSI value (finds highest threshold met)
export function getWallPoints(rsi) {
  if (!rsi) return 0
  const sorted = [...wallPointsThresholds].sort((a, b) => b.minRsi - a.minRsi)
  const threshold = sorted.find(t => rsi >= t.minRsi)
  return threshold ? threshold.points : 0
}

// Categories and tiers
export const categories = [
  {
    id: 'aboveGroundWalls',
    name: 'Above Ground Walls',
    metric: 'RSI',
    unit: 'm²·K/W',
    imperial: { unit: 'R-value', factor: 5.678, decimals: 1, prefix: 'R-', replaceUnit: true },
    description: 'Thermal resistance of above-grade wall assemblies',
    direction: 'higher',
    type: 'wallBuilder',
    options: thresholdsData.walls.map(t => ({ value: t.minRsi, points: t.points })),
  },
  {
    id: 'airTightness',
    name: 'Air Tightness',
    metric: '',
    unit: 'ACH @ 50Pa',
    description: 'Air changes per hour at 50 pascals pressure',
    direction: 'lower',
    options: [
      { value: 2.5, points: 0 },
      { value: 2.0, points: 3.5 },
      { value: 1.5, points: 6.9 },
      { value: 1.0, points: 10.4 },
      { value: 0.6, points: 13.3 },
    ],
  },
  {
    id: 'belowGradeWalls',
    name: 'Below Grade Walls',
    metric: 'RSI',
    unit: 'm²·K/W',
    imperial: { unit: 'R-value', factor: 5.678, decimals: 1, prefix: 'R-', replaceUnit: true },
    description: 'Thermal resistance of below-grade wall assemblies',
    direction: 'higher',
    options: [
      { value: 3.09, points: 0.2 },
      { value: 3.46, points: 0.8 },
      { value: 3.9, points: 1.4 },
    ],
  },
  {
    id: 'dhwElectric',
    name: 'DHW (Electric)',
    metric: 'EF',
    unit: 'Energy Factor',
    description: 'Electric water heater efficiency. This energy factor can only be achieved with a heat pump water heater (HPWH)',
    direction: 'higher',
    exclusiveGroup: 'dhw',
    options: [{ value: 2.35, points: 3.8 }],
  },
  {
    id: 'dhwGas',
    name: 'DHW (Gas- or oil-fired)',
    metric: 'UEF',
    unit: 'Uniform Energy Factor',
    description: 'Gas- or oil-fired water heater efficiency',
    direction: 'higher',
    exclusiveGroup: 'dhw',
    options: [
      { value: 0.79, points: 2.4, label: 'Commercial Storage-type' },
      { value: 0.83, points: 4.9, label: 'Residential Storage-type' },
      { value: 0.85, points: 3.2, label: 'Commercial Storage-type' },
      { value: 0.92, points: 4.9, label: 'Tankless Condensing' },
    ],
  },
  {
    id: 'hrv',
    name: 'Ventilation',
    metric: 'SRE',
    unit: '%',
    description: 'Sensible heat recovery efficiency for heat recovery ventilator (HRV) or energy recovery ventilator (ERV)',
    direction: 'higher',
    options: [
      { value: 60, points: 0.7 },
      { value: 65, points: 2.2 },
      { value: 75, points: 3.5 },
    ],
  },
  {
    id: 'volume',
    name: 'Heated Volume',
    metric: '',
    unit: 'm³',
    imperial: { unit: 'ft³', factor: 35.315, decimals: 0, round: 10 },
    description: 'Total heated volume of the building',
    direction: 'lower',
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
      { value: 300, points: 10 },
    ],
  },
  {
    id: 'windowsDoors',
    name: 'Windows & Doors',
    metric: 'U-value',
    unit: 'W/m²·K',
    description: 'Maximum thermal transmittance',
    direction: 'lower',
    options: [
      { value: 1.44, points: 1.6 },
      { value: 1.22, points: 4.6 },
    ],
  },
]

export const tiers = [
  { id: 2, label: 'Tier 2', points: 10 },
  { id: 3, label: 'Tier 3', points: 20 },
]
