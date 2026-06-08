// Translate prescriptive ECP selections into the perf simulation's ecp_state.
//
// Each envelope field resolves to the user's selected value when chosen, else a
// baseline default that matches base.h2k (see server/COMPLIANCE_NOTES.md / Task B0).
// SHGC is not a prescriptive input — it is a fixed assumed constant.
import { categories } from './data/ecpData'

export const ASSUMED_SHGC = 0.40

// Baseline envelope when a category is unselected. MUST match base.h2k; confirmed
// in Task B0. Values from sample_result.h2k Tsv (MainWallIns/FndWallIns/AIR50P/etc.).
export const BASELINE_DEFAULTS = {
  above_grade_wall_rsi: 2.90,
  below_grade_wall_rsi: 2.97,
  window_u: 1.80,          // → rsi 0.556
  airtightness_ach50: 2.5,
  hrv_sre_pct: 55,         // → 0.55
  dhw_ef: 0.82,
}

const round2 = n => Math.round(n * 100) / 100
const round4 = n => Math.round(n * 10000) / 10000

function optionValue(categoryId, index) {
  const cat = categories.find(c => c.id === categoryId)
  if (!cat || index == null) return undefined
  return cat.options[index]?.value
}

export function mapToEcpState({ selections, wallSelection, wallRsi }) {
  const sources = {}

  // Above-grade wall: wallRsi is computed by App (calculateWallRsi / simple option).
  const hasWall = wallRsi && wallRsi > 0
  sources.aboveGradeWall = hasWall ? 'selected' : 'default'
  const aboveGradeRsi = hasWall ? wallRsi : BASELINE_DEFAULTS.above_grade_wall_rsi

  const belowSel = optionValue('belowGradeWalls', selections.belowGradeWalls)
  sources.belowGradeWall = belowSel != null ? 'selected' : 'default'
  const belowGradeRsi = belowSel != null ? belowSel : BASELINE_DEFAULTS.below_grade_wall_rsi

  const winU = optionValue('windowsDoors', selections.windowsDoors)
  // The U-value comes from a selection or the baseline; SHGC is always assumed.
  sources.windows = 'assumed'
  const windowRsi = round4(1 / (winU != null ? winU : BASELINE_DEFAULTS.window_u))

  const airSel = optionValue('airTightness', selections.airTightness)
  sources.airtightness = airSel != null ? 'selected' : 'default'
  const airtightness = airSel != null ? airSel : BASELINE_DEFAULTS.airtightness_ach50

  const hrvSel = optionValue('hrv', selections.hrv)
  sources.ventilation = hrvSel != null ? 'selected' : 'default'
  const hrvSre = round4((hrvSel != null ? hrvSel : BASELINE_DEFAULTS.hrv_sre_pct) / 100)

  // DHW: electric (HPWH, EF 2.35) and gas/oil (UEF) are mutually exclusive.
  const dhwElec = optionValue('dhwElectric', selections.dhwElectric)
  const dhwGas = optionValue('dhwGas', selections.dhwGas)
  const dhwSel = dhwElec != null ? dhwElec : dhwGas
  sources.dhw = dhwSel != null ? 'selected' : 'default'
  const dhwEf = dhwSel != null ? dhwSel : BASELINE_DEFAULTS.dhw_ef

  return {
    ecp_state: {
      above_grade_wall: { rsi: round2(aboveGradeRsi) },
      below_grade_wall: { rsi: round2(belowGradeRsi) },
      windows: { rsi: windowRsi, shgc: ASSUMED_SHGC },
      airtightness_ach50: airtightness,
      hrv: { sre: hrvSre },
      dhw: { ef: dhwEf },
    },
    sources,
  }
}
