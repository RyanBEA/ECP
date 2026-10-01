// BEA's assumed typical assembly per Select RSI level (spec 4.5, 6.3). Each must compute within its level (tested).
// Computed RSI (calculateWallRsi, 2 decimals) is noted per level. Levels changed from the drafted table because
// they computed outside their step: 2.97, 3.08, 4.4, 4.57, 4.73, 4.84, 5.01, 5.45. 3.69 and 4.29 moved to polyiso
// so they sit clear of their step edges (ruling R20).
import { getBoundaryOptions, getContinuousInsRsi, categories, calculateWallRsi } from '../data/ecpData'
import wallData from '../data/generated/wall-data.json'
import { parallelPath } from '@scripts/compute.js'
const b = getBoundaryOptions()
const wood = (cavityType, contInsType, contInsThickness, studSpacing = '16"') => ({
  wallType: 'wood', assemblyType: 'single', studSpacing, cavityMaterial: 'Fiberglass Batt', cavityType,
  contInsType: contInsThickness === 'None' ? undefined : contInsType, contInsThickness,
  sheathingId: b.sheathing.defaults.wood, claddingId: b.cladding.defaults.wood,
})
export const ASSUMED_WALLS = {
  2.97: wood('2x6 R22', undefined, 'None'),     // 3.00
  3.08: wood('2x6 R24', undefined, 'None'),     // 3.11
  3.69: wood('2x6 R20', 'Polyiso', '1"'),       // 3.78
  3.85: wood('2x6 R22', 'XPS', '1"'),           // 3.88
  3.96: wood('2x6 R24', 'XPS', '1"'),           // 3.99, the Typical Tier 2 wall (spec 6.1)
  4.29: wood('2x6 R22', 'Polyiso', '1-1/2"'),   // 4.38
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
  const oc = s.studSpacing && s.studSpacing !== '16"' ? ` @ ${s.studSpacing.replace('"', ' in')}` : ''
  const shId = s.sheathingId || b.sheathing.defaults.wood
  const clId = s.claddingId || b.cladding.defaults.wood
  return `${s.cavityType} ${cavity}${oc}${ci}, ${SHEATH_WORD[shId] || shId}, ${CLAD_WORD[clId] || clId}`
}

// A wall in words (rulings R43, R45): a Select RSI pick is 'RSI <level>'; an assembly is its computed RSI to
// 2 decimals with its description, e.g. 'RSI 3.99 (2x6 R24 batt + 1 in XPS, OSB, vinyl)'. Shared by the baseline
// editor's change notes, priceHouse's assembly descriptions and the baseline small print.
export function wallText(ws) {
  if (ws?.simpleIndex !== undefined && ws?.simpleIndex !== null) return `RSI ${categories.find(c => c.id === 'aboveGroundWalls').options[ws.simpleIndex].value}`
  const rsi = calculateWallRsi(ws || {})
  if (rsi === null || rsi === undefined) return 'an incomplete wall'
  const d = describeWall(ws)
  return d === 'wall' ? `RSI ${rsi.toFixed(2)}` : `RSI ${rsi.toFixed(2)} (${d})`
}

// Below-grade: no builder on main; every level is an assumed assembly priced as one item (spec 4.5).
// Each one computes within its level (spec 6.3, ruling R19) by the cost-layer method: layers in series from the
// concrete inwards, the interior stud wall by parallel path (stud RSI 0.0085 per mm, as main uses for wood), the
// interior air film, and no exterior film or soil (NBC 2020 Note A-9.36.2.8.(1)).
const CONCRETE_200 = { id: 'concrete', label: '200 mm concrete', rsi: 0.08 }
const GYPSUM = { id: 'gypsum', label: '1/2 in gypsum', rsi: 0.0775 }
const INSIDE_AIR = { id: 'inside_air', label: 'interior air film', rsi: 0.12 }
const FOUNDATION_CAVITY_PCT = { '16"': 84, '19"': 85.5, '24"': 87 }
const foam = (type, thickness) => ({ id: 'foam', label: `${thickness.replace('"', ' in')} ${type}`, rsi: getContinuousInsRsi(type, thickness) })
const studWall = (cavityType, spacing) => {
  const stud = cavityType.split(' ')[0]
  return {
    id: 'stud_wall', label: `${cavityType} @ ${spacing.replace('"', ' in')} interior`,
    frame: {
      studDepthMm: wallData.wood.studs[stud].depth_mm,
      cavityRsi: wallData.wood.spacings[spacing.replace('"', '')].materials['Fiberglass Batt'][cavityType].cavityRsi,
      cavityPct: FOUNDATION_CAVITY_PCT[spacing],
    },
  }
}
const foundation = (rsiLevel, parts) => {
  const assembly = [CONCRETE_200, ...parts, GYPSUM, INSIDE_AIR]
  const optionSlug = String(rsiLevel).replace('.', '_')
  return {
    label: [CONCRETE_200.label, ...parts.map(p => p.label), 'gypsum'].join(', '),
    assembly,
    layers: [{ component: 'foundation_assembly', option: `rsi_${optionSlug}`, label: `foundation wall assembly, RSI ${rsiLevel}` }],
  }
}

// RSI of an assumed foundation's assembly (unrounded)
export function foundationAssemblyRsi(f) {
  return f.assembly.reduce((sum, l) => sum + (l.frame
    ? parallelPath(l.frame.studDepthMm * 0.0085, l.frame.cavityRsi, l.frame.cavityPct)
    : l.rsi), 0)
}

export const ASSUMED_FOUNDATIONS = {
  2.98: foundation(2.98, [foam('XPS', '1"'), studWall('2x4 R14', '24"')]),   // 3.06
  3.09: foundation(3.09, [studWall('2x6 R22', '16"')]),                      // 3.12
  3.46: foundation(3.46, [foam('XPS', '2"'), studWall('2x4 R12', '16"')]),   // 3.60
  3.9: foundation(3.9, [foam('XPS', '2"'), studWall('2x6 R20', '16"')]),     // 4.55
}
