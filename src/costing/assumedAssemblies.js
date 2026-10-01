// BEA's assumed typical assembly per Select RSI level (spec 4.5, 6.3). Each must compute within its level (tested).
// Computed RSI (calculateWallRsi, 2 decimals) is noted per level. Levels changed from the drafted table because
// they computed outside their step: 2.97, 3.08, 4.4, 4.57, 4.73, 4.84, 5.01, 5.45.
import { getBoundaryOptions } from '../data/ecpData'
const b = getBoundaryOptions()
const wood = (cavityType, contInsType, contInsThickness, studSpacing = '16"') => ({
  wallType: 'wood', assemblyType: 'single', studSpacing, cavityMaterial: 'Fiberglass Batt', cavityType,
  contInsType: contInsThickness === 'None' ? undefined : contInsType, contInsThickness,
  sheathingId: b.sheathing.defaults.wood, claddingId: b.cladding.defaults.wood,
})
export const ASSUMED_WALLS = {
  2.97: wood('2x6 R22', undefined, 'None'),     // 3.00
  3.08: wood('2x6 R24', undefined, 'None'),     // 3.11
  3.69: wood('2x6 R20', 'XPS', '1"'),           // 3.69 (3.6875 before rounding)
  3.85: wood('2x6 R22', 'XPS', '1"'),           // 3.88
  3.96: wood('2x6 R24', 'XPS', '1"'),           // 3.99, the Typical Tier 2 wall (spec 6.1)
  4.29: wood('2x6 R24', 'XPS', '1-1/2"'),       // 4.39
  4.4: wood('2x6 R20', 'XPS', '2"'),            // 4.49
  4.57: wood('2x6 R22', 'XPS', '2"'),           // 4.68
  4.73: wood('2x6 R24', 'XPS', '2"'),           // 4.79
  4.84: wood('2x6 R24', 'Polyiso', '2"'),       // 4.91
  5.01: wood('2x6 R24', 'XPS', '2-1/2"'),       // 5.25
  5.45: wood('2x6 R24', 'XPS', '3"'),           // 5.67
}
export const assumedWallSelection = level => ASSUMED_WALLS[level] ?? null

const CAVITY_WORD = { 'Fiberglass Batt': 'batt', 'Mineral Wool Batt': 'batt', 'Loose Fill Cellulose': 'loose-fill cellulose', 'Dense Pack Cellulose': 'dense-pack cellulose', 'Loose Fill Fiberglass': 'loose-fill fiberglass' }
const CLAD_WORD = { vinyl_siding: 'vinyl', vinyl_insulated: 'insulated vinyl', wood_bevel_200: 'wood siding', wood_bevel_250: 'wood siding', fiber_cement: 'fibre cement', metal_siding: 'metal', brick_veneer: 'brick', stucco_19: 'stucco' }
const SHEATH_WORD = { osb_11: 'OSB', osb_9_5: 'OSB', plywood_sw_12_5: 'plywood', plywood_sw_9_5: 'plywood', gypsum_12_7: 'gypsum sheathing' }
export function describeWall(s) {
  if (!s || !s.cavityType) return 'wall'
  const ci = s.contInsType && s.contInsThickness && s.contInsThickness !== 'None' ? ` + ${s.contInsThickness.replace('"', ' in')} ${s.contInsType}` : ''
  const cavity = CAVITY_WORD[s.cavityMaterial] || 'batt'
  return `${s.cavityType} ${cavity}${ci}, ${SHEATH_WORD[s.sheathingId || b.sheathing.defaults.wood]}, ${CLAD_WORD[s.claddingId || b.cladding.defaults.wood]}`
}

// Below-grade: no builder on main; every level is an assumed assembly priced as one item (spec 4.5)
export const ASSUMED_FOUNDATIONS = {
  2.98: { label: '200 mm concrete, 2x4 R12 interior, gypsum', layers: [{ component: 'foundation_assembly', option: 'rsi_2_98', label: 'foundation wall assembly, RSI 2.98' }] },
  3.09: { label: '200 mm concrete, 2x6 R20 @ 24 in interior, gypsum', layers: [{ component: 'foundation_assembly', option: 'rsi_3_09', label: 'foundation wall assembly, RSI 3.09' }] },
  3.46: { label: '200 mm concrete, 2x6 R24 @ 24 in interior, gypsum', layers: [{ component: 'foundation_assembly', option: 'rsi_3_46', label: 'foundation wall assembly, RSI 3.46' }] },
  3.9: { label: '200 mm concrete, 2 in XPS exterior, 2x4 R14 interior, gypsum', layers: [{ component: 'foundation_assembly', option: 'rsi_3_9', label: 'foundation wall assembly, RSI 3.9' }] },
}
