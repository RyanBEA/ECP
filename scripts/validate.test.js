/**
 * CSV Validation — verifies compute.js reproduces all 84 framed wall RSI values
 * from data/lookup-framed-wall-rsi.csv.
 *
 * The CSV was generated from RSI-calc.xlsx which used K1=0.40/K2=0.60 for ALL
 * steel entries at <500mm spacing (assuming insulating sheathing). Per NBC 2020
 * Table A-9.36.2.4.(1)-B, without insulating sheathing the correct values are
 * K1=0.33/K2=0.67. Our formula uses the NBC-correct K values.
 *
 * Expectations:
 *   - Wood: exact match (all spacings)
 *   - Steel 24" (≥500mm): exact match (K=0.50 same as xlsx)
 *   - Steel 16"/19" (<500mm): our values are LOWER than CSV (K=0.33 vs 0.40)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadMaterials } from './loadMaterials.js'
import { woodWallRsi, steelWallRsi } from './compute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ecpToolDir = join(__dirname, '..', '..')  // ECPTool/

// Read existing CSV
const csvPath = join(ecpToolDir, 'data', 'lookup-framed-wall-rsi.csv')
const csvLines = readFileSync(csvPath, 'utf8').trim().split('\n').slice(1) // skip header

const m = loadMaterials()

// Default boundary layers matching RSI-calc.xlsx
const woodBoundary = { outside_air: 0.03, cladding: 0.11, sheathing: 0.108, drywall: 0.08, inside_air: 0.12 }
const steelBoundary = { outside_air: 0.03, cladding: 0.07, sheathing: 0, drywall: 0.08, inside_air: 0.12 }

// Map CSV material names to YAML keys
const materialKeyMap = {
  'Fiberglass Batt': 'fiberglass_batt',
  'Mineral Wool Batt': 'mineral_wool_batt',
  'Loose Fill Cellulose': 'loose_fill_cellulose',
  'Dense Pack Cellulose': 'dense_pack_cellulose',
  'Loose Fill Fiberglass': 'loose_fill_fiberglass',
}

function getCavityRsi(wallType, materialKey, cavityType) {
  const mat = m.cavity[materialKey]
  if (!mat) throw new Error(`Unknown material: ${materialKey}`)

  if (mat.type === 'batt') {
    // CSV uses steel stud names (e.g. "2x3-5/8 R12") but YAML uses wood names
    // (e.g. "2x4 R12") with steel_studs arrays. Try direct match first, then
    // search by steel_studs membership.
    let cav = mat.cavities.find(c => c.id === cavityType)
    if (!cav && wallType === 'steel') {
      // e.g. "2x3-5/8 R14" → find cavity where steel_studs includes "2x3-5/8"
      // and R-value matches
      const rVal = cavityType.split(' ').pop()  // "R14"
      cav = mat.cavities.find(c =>
        c.steel_studs?.includes(cavityType.split(' ')[0]) &&
        c.id.endsWith(rVal)
      )
    }
    if (!cav) throw new Error(`Unknown cavity: ${cavityType} for ${materialKey}`)
    if (wallType === 'steel' && cav.steel_rsi) return cav.steel_rsi
    if (wallType === 'wood' && cav.wood_rsi) return cav.wood_rsi
    return cav.rsi
  }

  // Blown-in: RSI = depth * rsi_per_mm
  const studSize = cavityType  // e.g. "2x4", "2x6", "2x3-5/8"
  const studs = m.framing[wallType].studs[studSize]
  if (!studs) throw new Error(`Unknown stud: ${studSize} for ${wallType}`)

  // Loose fill fiberglass uses depth-specific values
  if (materialKey === 'loose_fill_fiberglass' && mat.depth_specific) {
    const depthEntry = mat.depth_specific[studs.depth_mm]
    if (depthEntry) return depthEntry.rsi
    // Deep cavity fallback
    return studs.depth_mm * mat.rsi_per_mm_deep
  }

  return studs.depth_mm * mat.rsi_per_mm
}

function parseRow(line) {
  const parts = line.split(',')
  return {
    wallType: parts[0],
    spacing: parseInt(parts[1].replace(/"/g, '')),
    material: parts[2],
    cavityType: parts[3],
    expectedRsi: parseFloat(parts[4]),
  }
}

// --- Wood validation: should match exactly ---
const woodRows = csvLines.map(parseRow).filter(r => r.wallType === 'wood')

describe('CSV validation: wood wall RSI values', () => {
  woodRows.forEach(row => {
    const materialKey = materialKeyMap[row.material]
    const mat = m.cavity[materialKey]
    // Blown-in tolerance is wider due to RSI/mm approximation
    const tolerance = mat.type === 'blown' ? 1 : 4  // digits of precision

    it(`wood/${row.spacing}"/${row.material}/${row.cavityType} = ${row.expectedRsi.toFixed(4)}`, () => {
      const cavityRsi = getCavityRsi('wood', materialKey, row.cavityType)
      const studSize = row.cavityType.split(' ')[0]
      const studDepthMm = m.framing.wood.studs[studSize].depth_mm
      const cavityPct = m.framing.wood.cavity_pct[row.spacing]

      const computedRsi = woodWallRsi({
        studDepthMm,
        cavityRsi,
        cavityPct,
        boundary: woodBoundary,
      })

      expect(computedRsi).toBeCloseTo(row.expectedRsi, tolerance)
    })
  })
})

// --- Steel 24" validation: K=0.50, should match ---
const steel24Rows = csvLines.map(parseRow).filter(r => r.wallType === 'steel' && r.spacing === 24)

describe('CSV validation: steel 24" wall RSI values (K=0.50)', () => {
  steel24Rows.forEach(row => {
    const materialKey = materialKeyMap[row.material]

    it(`steel/24"/${row.material}/${row.cavityType} = ${row.expectedRsi.toFixed(4)}`, () => {
      const cavityRsi = getCavityRsi('steel', materialKey, row.cavityType)
      const studSize = row.cavityType.split(' ')[0]
      const studDepthMm = m.framing.steel.studs[studSize].depth_mm

      const computedRsi = steelWallRsi({
        studDepthMm,
        cavityRsi,
        spacingInches: 24,
        boundary: steelBoundary,
        airSpace: 0.18,
      })

      expect(computedRsi).toBeCloseTo(row.expectedRsi, 2)
    })
  })
})

// --- Steel 16"/19" validation: K=0.33 (our default) vs K=0.40 (xlsx) ---
// Our values will be systematically LOWER than CSV because NBC requires K=0.33
// without insulating sheathing. The CSV assumed K=0.40.
const steelNarrowRows = csvLines.map(parseRow).filter(r => r.wallType === 'steel' && r.spacing < 24)

describe('CSV validation: steel 16"/19" K-value correction', () => {
  steelNarrowRows.forEach(row => {
    const materialKey = materialKeyMap[row.material]

    it(`steel/${row.spacing}"/${row.material}/${row.cavityType}: NBC K=0.33 < xlsx K=0.40`, () => {
      const cavityRsi = getCavityRsi('steel', materialKey, row.cavityType)
      const studSize = row.cavityType.split(' ')[0]
      const studDepthMm = m.framing.steel.studs[studSize].depth_mm

      const computedRsi = steelWallRsi({
        studDepthMm,
        cavityRsi,
        spacingInches: row.spacing,
        boundary: steelBoundary,
        airSpace: 0.18,
      })

      // Our value should be LOWER (K=0.33 gives less weight to the isothermal
      // planes result, which is the higher component)
      expect(computedRsi).toBeLessThan(row.expectedRsi)
      // But not dramatically lower — within ~10%
      expect(computedRsi).toBeGreaterThan(row.expectedRsi * 0.88)
    })
  })
})
