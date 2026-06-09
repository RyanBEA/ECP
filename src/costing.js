// Costing — pure module. Computes the incremental $ of the envelope/mechanical
// upgrades selected on the Prescriptive tab, relative to the base.h2k baseline,
// scaling envelope costs by geometry-derived areas. No React; fully testable.
import costs from './data/generated/costs.json'
import { categories } from './data/ecpData'
import { BASELINE_DEFAULTS } from './ecpStateMapper'

// Geometry constants are mirrored from server/src/perf_server/mutations.py.
// SOURCE OF TRUTH: mutations.py / server/GEOMETRY_XPATHS.md. If base.h2k is
// regenerated, re-verify these three constants against that file.
const WALL_HEIGHT_SUM_M = 5.05          // main 2.6 + second 2.45
const DOOR_AREA_M2 = 3.528              // 2 doors, fixed (not scaled)
const BELOW_GRADE_WALL_HEIGHT_M = 2.3   // basement wall height

// Derive the areas the cost table needs, replicating mutations.geometry_mutations.
// windowArea may be <= 0 when FDWR is too low to fit the door; callers guard.
export function deriveAreas({ length_m, width_m, fdwr }) {
  const L = Number(length_m) || 0
  const W = Number(width_m) || 0
  const f = Number(fdwr) || 0
  const perimeter = 2 * (L + W)
  const grossAboveWall = perimeter * WALL_HEIGHT_SUM_M
  const fda = f * grossAboveWall              // fenestration + door area
  const windowArea = fda - DOOR_AREA_M2
  const netAboveWall = grossAboveWall - fda   // opaque above-grade wall
  const belowGradeWall = perimeter * BELOW_GRADE_WALL_HEIGHT_M
  return { perimeter, grossAboveWall, fda, windowArea, netAboveWall, belowGradeWall }
}

function optionValue(categoryId, index) {
  const cat = categories.find(c => c.id === categoryId)
  if (!cat || index == null) return undefined
  return cat.options[index]?.value
}

// Build the per-category cost breakdown. Lists only categories actually
// upgraded (cost > 0); a category at baseline or unselected contributes nothing.
export function costDesign({ selections, wallSelection, wallRsi, geometry }) {
  const areas = deriveAreas(geometry)
  const lineItems = []

  // Above-grade walls: resolve wallRsi to the highest cost tier (min_rsi <= wallRsi),
  // mirroring getWallPoints. Area = opaque above-grade wall.
  if (wallRsi && wallRsi > 0) {
    const rounded = Math.round(wallRsi * 100) / 100
    const row = [...costs.aboveGroundWalls.rates]
      .sort((a, b) => b.min_rsi - a.min_rsi)
      .find(r => rounded >= r.min_rsi)
    if (row && row.rate_per_m2 > 0) {
      const area = Math.max(0, areas.netAboveWall)
      lineItems.push({
        categoryId: 'aboveGroundWalls',
        label: 'Above-grade walls',
        detail: `RSI ${BASELINE_DEFAULTS.above_grade_wall_rsi.toFixed(2)} → ${rounded.toFixed(2)}`,
        area, rate: row.rate_per_m2, cost: area * row.rate_per_m2,
        basis: row.basis, notes: row.notes,
      })
    }
  }

  // Area-scaled option categories.
  const envelopeSpecs = [
    { id: 'belowGradeWalls', label: 'Below-grade walls', key: 'rsi', area: areas.belowGradeWall,
      detail: v => `RSI ${BASELINE_DEFAULTS.below_grade_wall_rsi.toFixed(2)} → ${v.toFixed(2)}` },
    { id: 'windowsDoors', label: 'Windows & doors', key: 'u', area: areas.windowArea,
      detail: v => `U ${BASELINE_DEFAULTS.window_u.toFixed(2)} → ${v.toFixed(2)}` },
  ]
  for (const s of envelopeSpecs) {
    const val = optionValue(s.id, selections[s.id])
    if (val == null) continue
    const row = costs[s.id].rates.find(r => r[s.key] === val)
    if (row && row.rate_per_m2 > 0) {
      const area = Math.max(0, s.area)
      lineItems.push({
        categoryId: s.id, label: s.label, detail: s.detail(val),
        area, rate: row.rate_per_m2, cost: area * row.rate_per_m2,
        basis: row.basis, notes: row.notes,
      })
    }
  }

  // Flat per-house categories.
  const flatSpecs = [
    { id: 'airTightness', label: 'Airtightness', key: 'ach50',
      detail: v => `${BASELINE_DEFAULTS.airtightness_ach50} → ${v} ACH₅₀` },
    { id: 'hrv', label: 'HRV / ventilation', key: 'sre',
      detail: v => `${BASELINE_DEFAULTS.hrv_sre_pct}% → ${v}% SRE` },
    { id: 'dhwElectric', label: 'DHW (electric)', key: 'ef',
      detail: v => `EF ${BASELINE_DEFAULTS.dhw_ef.toFixed(2)} → ${v.toFixed(2)}` },
    { id: 'dhwGas', label: 'DHW (gas/oil)', key: 'uef',
      detail: v => `UEF → ${v.toFixed(2)}` },
  ]
  for (const s of flatSpecs) {
    const val = optionValue(s.id, selections[s.id])
    if (val == null) continue
    const row = costs[s.id].flat.find(r => r[s.key] === val)
    if (row && row.flat_cad > 0) {
      lineItems.push({
        categoryId: s.id, label: s.label, detail: s.detail(val),
        area: null, rate: null, cost: row.flat_cad,
        basis: row.basis, notes: row.notes,
      })
    }
  }

  const total = lineItems.reduce((sum, li) => sum + li.cost, 0)
  return { lineItems, total, areas }
}
