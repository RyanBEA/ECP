// Card option values and wall layers -> price option ids used by stand-in-costs.json (spec 6.4).
// Wall layer ids follow the taxonomy tails used in 25_Working/made-up-numbers-db (e.g. stud_2x6_16oc).

const slug = v => String(v).replace('.', '_')

// --- cards ---
const CARD_MAP = {
  windowsDoors: v => `u_${slug(v)}`,                      // u_1_61, u_1_44, u_1_22
  airTightness: v => (v === 'untested' ? 'untested' : `ach_${slug(v)}`),
  hrv: v => ({ 60: 'sre_60_65', 65: 'sre_65_75', 75: 'sre_75_84' })[v] ?? null,
  belowGradeWalls: v => `rsi_${slug(v)}`,                 // rsi_2_98, rsi_3_09, rsi_3_46, rsi_3_9
  dhwElectric: v => (v === 'electricStorage' ? 'elec_storage' : v === 2.35 ? 'heat_pump' : null),
  dhwGas: v => ({ 0.79: 'rdc_079', 0.83: 'res_083', 0.85: 'rdc_085', 0.92: 'tankless_092' })[v] ?? null,
  volume: () => null,
  aboveGroundWalls: () => null, // walls go through wallLayers.js
}

export function cardOptionId(categoryId, value) {
  const f = CARD_MAP[categoryId]
  return f ? f(value) : null
}

// --- ventilation ---
export const HRV_SIZE_CLASSES = [30, 45, 75]  // L/s, the most the model runs at
export function hrvSizeClass(airflow) {
  if (!airflow) return null
  return HRV_SIZE_CLASSES.find(c => c >= airflow.max) ?? HRV_SIZE_CLASSES[HRV_SIZE_CLASSES.length - 1]
}

// --- water heating (Mark's DHW parts list, spec 4.4) ---
const WH_PARTS = {
  elec_storage: ['water_heater', 'circuit_240v'],
  heat_pump: ['water_heater', 'condensate_drain', 'circuit_240v'],
  rdc_079: ['water_heater', 'venting', 'condensate_drain', 'gas_branch', 'receptacle_120v'],
  rdc_085: ['water_heater', 'venting', 'condensate_drain', 'gas_branch', 'receptacle_120v'],
  res_083: ['water_heater', 'venting', 'condensate_drain', 'gas_branch', 'receptacle_120v'],
  tankless_092: ['water_heater', 'venting', 'condensate_drain', 'gas_branch', 'receptacle_120v'],
}
export const WATER_HEATER_FUEL = { elec_storage: 'electric', heat_pump: 'electric', rdc_079: 'gas', rdc_085: 'gas', res_083: 'gas', tankless_092: 'gas' }
export const WATER_HEATER_SIZES = [40, 50, 60, 80] // gal, tanks; tankless_092 is sized by Btu/h and takes size null
export function WATER_HEATER_PARTS(optionId, fuel) {
  return (WH_PARTS[optionId] || []).map(component => ({ component, option: optionId, fuel }))
}

// --- wall layers (wood single stud only, spec 4.5) ---
const studs = ['2x4', '2x6', '2x8']
const spacings = ['16', '24']
const cavity = ['r12_batt_2x4', 'r14_batt_2x4', 'r19_batt_2x6', 'r22_batt_2x6', 'r24_batt_2x6', 'r28_batt_2x8']
const ci = ['eps_i_1in', 'eps_i_1_5in', 'eps_i_2in', 'eps_i_2_5in', 'eps_i_3in', 'xps_iv_1in', 'xps_iv_1_5in', 'xps_iv_2in', 'xps_iv_2_5in', 'xps_iv_3in',
  'isocyanurate_1in', 'isocyanurate_1_5in', 'isocyanurate_2in', 'isocyanurate_2_5in', 'isocyanurate_3in']
const sheathing = ['waferboard_osb_7_16in', 'waferboard_osb_3_8in', 'plywood_particle_board_1_2in', 'plywood_particle_board_3_8in', 'gypsum_sheathing_1_2in']
const cladding = ['vinyl_siding', 'insulated_vinyl_siding', 'wood_bevel', 'fiber_cement', 'metal_siding', 'brick_veneer', 'stucco']

export const WALL_LAYER_OPTIONS = [
  ...studs.flatMap(s => spacings.map(sp => ({ component: 'framing', option: `stud_${s}_${sp}oc`, label: `${s} @ ${sp} in o.c.` }))),
  ...cavity.map(o => ({ component: 'cavity_insulation', option: o, label: o.replace(/_/g, ' ') })),
  ...ci.map(o => ({ component: 'continuous_insulation', option: o, label: o.replace(/_/g, ' ') })),
  ...sheathing.map(o => ({ component: 'sheathing', option: o, label: o.replace(/_/g, ' ') })),
  { component: 'air_vapour_barrier', option: 'poly_vapour_6mil', label: '6 mil poly' },
  { component: 'strapping', option: '1x3_16oc', label: '1x3 strapping @ 16 in' },
  ...cladding.map(o => ({ component: 'cladding', option: o, label: o.replace(/_/g, ' ') })),
  { component: 'interior_finish', option: 'gypsum_1_2in', label: '1/2 in gypsum' },
]

// Every non-wall request the tool can make (size omitted for HRV: all classes are tested separately)
export const CARD_OPTIONS = [
  ...['u_1_61', 'u_1_44', 'u_1_22'].map(o => ({ category: 'windowsDoors', component: 'windows', option: o, fuel: null, size: null })),
  ...['u_1_61', 'u_1_44', 'u_1_22'].map(o => ({ category: 'windowsDoors', component: 'doors', option: o, fuel: null, size: null })),
  ...['untested', 'ach_2_5', 'ach_2', 'ach_1_5', 'ach_1', 'ach_0_6'].map(o => ({ category: 'airTightness', component: 'airtightness', option: o, fuel: null, size: null })),
  ...['sre_60_65', 'sre_65_75', 'sre_75_84'].map(o => ({ category: 'hrv', component: 'hrv', option: o, fuel: null, size: null })),
  ...['rsi_2_98', 'rsi_3_09', 'rsi_3_46', 'rsi_3_9'].map(o => ({ category: 'belowGradeWalls', component: 'foundation_assembly', option: o, fuel: null, size: null })),
  ...Object.keys(WH_PARTS).flatMap(o => WATER_HEATER_PARTS(o, WATER_HEATER_FUEL[o]).map(p => ({
    category: 'dhw', component: p.component, option: o, fuel: WATER_HEATER_FUEL[o],
    size: p.component === 'water_heater' && o !== 'tankless_092' ? 50 : null,
  }))),
]
