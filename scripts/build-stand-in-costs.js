// Builds src/costing/data/stand-in-costs.json: LEEP wall rows where they exist, placeholders elsewhere.
// Run: npm run build:costs. Input: env STAND_IN_HTAP, default
// /srv/clients/BTZx/cost-DB-and-ECP/25_Working/made-up-numbers-db/htap-walls-mapped.json ($ per sq ft, -> $/m2 here).
//
// Source rule (ruling R13): LEEP rows only (source 'LEEP-*'; MiscNRCanEstimates2019 and Northern-costs are dropped),
// atomic rows priced per sq ft (sf applied / sf wall) with labour > 0. For each id the LEEP-ON-Ottawa rows are used
// when there are any, else the median of the other LEEP regions' rows. The row's source names the region(s) used:
// 'LEEP ON', 'LEEP MB', 'LEEP BC', or a blend such as 'LEEP MB/BC'.
//
// Placeholder rule (ruling R14): a wall layer with no LEEP row is derived from LEEP rows of the same family.
//   framing    16 in material by stud depth (least-squares line through the LEEP 16 in rows), labour the median of
//              the LEEP 16 in rows; times a spacing factor from stud sizes LEEP prices at both 16 and 24 in
//              (19 in interpolated linearly between 16 and 24).
//   foam CI    per inch by material, from that material's LEEP rows; anchored on the material's LEEP-priced
//              thicknesses (interpolated between them, extended from the nearest one). Mineral wool board has no
//              LEEP rows, so it uses LEEP's generic rigid board rows ('rigid_generic').
//   cavities   by R-value: $ per RSI. Batts and loose fill from the LEEP batt rows; dense pack from LEEP's
//              dense-pack row.
//   sheathing  per inch of thickness from the LEEP sheathing rows, labour their median.
// Cladding has no LEEP rows at all, so every cladding keeps one flat invented placeholder (PH_WALL below).
// Non-wall cards (windows, doors, airtightness, HRV, below-grade, water heating) are flat invented placeholders.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WALL_LAYER_OPTIONS, CARD_OPTIONS, HRV_SIZE_CLASSES, WATER_HEATER_SIZES } from '../src/costing/optionMap.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const HTAP = process.env.STAND_IN_HTAP || '/srv/clients/BTZx/cost-DB-and-ECP/25_Working/made-up-numbers-db/htap-walls-mapped.json'
const WALL_DATA = path.join(here, '..', 'src', 'data', 'generated', 'wall-data.json')
const OUT = path.join(here, '..', 'src', 'costing', 'data', 'stand-in-costs.json')
const SQFT_PER_M2 = 10.76391042
const RSI_PER_R = 1 / 5.678

const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const r2 = x => Math.round(x * 100) / 100
const toM2 = p => ({ material: r2(p.material * SQFT_PER_M2), labour: r2(p.labour * SQFT_PER_M2) })

// --- LEEP rows, region rule ---
const REGION = { ON: 'ON', MB: 'MB', 'BC-Van': 'BC', 'BC-Kam': 'BC' }
const REGION_ORDER = ['ON', 'MB', 'BC']
const SQFT_UNITS = new Set(['sf applied', 'sf wall'])
const leepRows = JSON.parse(fs.readFileSync(HTAP, 'utf8')).rows.filter(r =>
  r.source.startsWith('LEEP-') && REGION[r.region] && r.kind === 'atomic' && r.labour > 0 &&
  SQFT_UNITS.has(r.units) && typeof r.target_id === 'string' && r.target_id.startsWith('wall.'))
const byTarget = {}
for (const r of leepRows) (byTarget[r.target_id] ||= []).push(r)

// $ per sq ft for one LEEP target id, or null
function leepPrice(targetId) {
  const rs = byTarget[targetId]
  if (!rs) return null
  const on = rs.filter(r => REGION[r.region] === 'ON')
  const use = on.length ? on : rs
  const regions = REGION_ORDER.filter(g => use.some(r => REGION[r.region] === g))
  return { material: median(use.map(r => r.material)), labour: median(use.map(r => r.labour)), priced_item: use[0].description, source: `LEEP ${regions.join('/')}` }
}

// Price option id -> LEEP target id. The LEEP "Insulation, R31 batt" row is filed under 2x8 by map_htap.py;
// the wall builder offers R31 batts in 2x10, so that row prices r31_batt_2x10.
const LEEP_ALIAS = { 'cavity_insulation/r31_batt_2x10': 'wall.cavity_insulation.r31_batt_2x8' }
const leepTarget = (component, option) =>
  LEEP_ALIAS[`${component}/${option}`] || `wall.${component === 'air_vapour_barrier' ? 'control_layer' : component}.${option}`
const leepFor = (component, option) => leepPrice(leepTarget(component, option))

const wallOpts = c => WALL_LAYER_OPTIONS.filter(o => o.component === c)
const wallData = JSON.parse(fs.readFileSync(WALL_DATA, 'utf8')).wood

// --- framing ---
const studDepth = s => wallData.studs[s].depth_mm
const framingParts = option => { const m = option.match(/^stud_(2x\d+)_(\d+)oc$/); return { stud: m[1], spacing: Number(m[2]) } }
const framingLeep = {}
for (const o of wallOpts('framing')) { const p = leepFor('framing', o.option); if (p) framingLeep[o.option] = p }
const leep16 = Object.entries(framingLeep).map(([id, p]) => ({ ...framingParts(id), p })).filter(x => x.spacing === 16)
function lineFit(points) { // least squares y = a + b x; one point -> through the origin
  if (points.length === 1) return x => points[0].y * x / points[0].x
  const n = points.length, mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n
  const b = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  return x => my + b * (x - mx)
}
const framingMaterial16 = lineFit(leep16.map(x => ({ x: studDepth(x.stud), y: x.p.material })))
const framingLabour16 = median(leep16.map(x => x.p.labour))
const pairs24 = leep16.map(x => ({ a: x.p, b: framingLeep[`stud_${x.stud}_24oc`] })).filter(x => x.b)
const ratio24 = { material: median(pairs24.map(x => x.b.material / x.a.material)), labour: median(pairs24.map(x => x.b.labour / x.a.labour)) }
const spacingFactor = (sp, k) => 1 + (ratio24[k] - 1) * (sp - 16) / 8
function deriveFraming(option) {
  const { stud, spacing } = framingParts(option)
  const base = framingLeep[`stud_${stud}_16oc`] || { material: framingMaterial16(studDepth(stud)), labour: framingLabour16 }
  return { material: base.material * spacingFactor(spacing, 'material'), labour: base.labour * spacingFactor(spacing, 'labour') }
}

// --- continuous insulation (foam and board) ---
const inches = t => (t === '3_4' ? 0.75 : Number(t.replace('_', '.')))
const ciParts = option => { const m = option.match(/^(.*?)_(\d+(?:_\d+)?)in$/); return { material: m[1], thickness: inches(m[2]) } }
const CI_RATE_FAMILY = { eps_i: 'eps_i', xps_iv: 'xps_iv', isocyanurate: 'isocyanurate', mineral_wool_rock: 'rigid_generic', mineral_wool_glass: 'rigid_generic' }
function ciRate(family) { // per-inch material and median labour over that family's LEEP rows
  const re = new RegExp(`^wall\\.continuous_insulation\\.${family}_(\\d+(?:_\\d+)?)in$`)
  const ps = Object.keys(byTarget).map(t => [t, t.match(re)]).filter(([, m]) => m).map(([t, m]) => ({ t: inches(m[1]), p: leepPrice(t) }))
  if (!ps.length) throw new Error(`no LEEP rows for foam family ${family}`)
  return { perInch: median(ps.map(x => x.p.material / x.t)), labour: median(ps.map(x => x.p.labour)) }
}
function deriveCi(option) {
  const { material, thickness: t } = ciParts(option)
  const rate = ciRate(CI_RATE_FAMILY[material])
  const anchors = wallOpts('continuous_insulation').map(o => ({ ...ciParts(o.option), p: leepFor('continuous_insulation', o.option) }))
    .filter(a => a.material === material && a.p).sort((a, b) => a.thickness - b.thickness)
  const lo = [...anchors].reverse().find(a => a.thickness < t), hi = anchors.find(a => a.thickness > t)
  if (lo && hi) {
    const f = (t - lo.thickness) / (hi.thickness - lo.thickness)
    return { material: lo.p.material + f * (hi.p.material - lo.p.material), labour: lo.p.labour + f * (hi.p.labour - lo.p.labour) }
  }
  if (lo) return { material: lo.p.material + rate.perInch * (t - lo.thickness), labour: lo.p.labour }
  if (hi) return { material: Math.max(0, hi.p.material - rate.perInch * (hi.thickness - t)), labour: hi.p.labour }
  return { material: rate.perInch * t, labour: rate.labour }
}

// --- cavity insulation ---
const battId = t => { const [s, r] = t.split(' '); return `${r.toLowerCase()}_batt_${s}` }
const CAVITY_ID = {
  'Fiberglass Batt': battId,
  'Mineral Wool Batt': battId,
  'Loose Fill Cellulose': t => `loose_fill_cellulose_${t}`,
  'Dense Pack Cellulose': t => `dense_pack_cellulose_${t}`,
  'Loose Fill Fiberglass': t => `loose_fill_fiberglass_${t}`,
}
const cavityRsi = {}
for (const [mat, types] of Object.entries(wallData.spacings['16'].materials)) {
  for (const [t, e] of Object.entries(types)) {
    const id = CAVITY_ID[mat](t)
    if (cavityRsi[id] !== undefined && cavityRsi[id] !== e.cavityRsi) throw new Error(`cavity id ${id} has two RSI values`)
    cavityRsi[id] = e.cavityRsi
  }
}
const battPerRsi = (() => {
  const ps = wallOpts('cavity_insulation').filter(o => /_batt_/.test(o.option))
    .map(o => ({ p: leepFor('cavity_insulation', o.option), rsi: cavityRsi[o.option] })).filter(x => x.p)
  return { material: median(ps.map(x => x.p.material / x.rsi)), labour: median(ps.map(x => x.p.labour / x.rsi)) }
})()
const densePackPerRsi = (() => {
  const p = leepPrice('wall.cavity_insulation.dense_pack_cellulose_r3_7_per_in')
  // The ON row used is "R40 dense-pack cellulose"; its R-value comes from that description.
  const m = p && p.priced_item.match(/\bR(\d+)\b/)
  if (!m) throw new Error('dense-pack LEEP row has no R-value in its description')
  const rsi = Number(m[1]) * RSI_PER_R
  return { material: p.material / rsi, labour: p.labour / rsi }
})()
function deriveCavity(option) {
  const rsi = cavityRsi[option]
  if (rsi === undefined) throw new Error(`no RSI for cavity option ${option}`)
  const rate = option.startsWith('dense_pack_cellulose_') ? densePackPerRsi : battPerRsi
  return { material: rate.material * rsi, labour: rate.labour * rsi }
}

// --- sheathing ---
const sheathingInches = option => { const m = option.match(/_(\d+)_(\d+)in$/); return Number(m[1]) / Number(m[2]) }
const sheathingRate = (() => {
  const ps = Object.keys(byTarget).filter(t => t.startsWith('wall.sheathing.')).map(t => ({ t: sheathingInches(t), p: leepPrice(t) }))
  return { perInch: median(ps.map(x => x.p.material / x.t)), labour: median(ps.map(x => x.p.labour)) }
})()
const deriveSheathing = option => ({ material: sheathingRate.perInch * sheathingInches(option), labour: sheathingRate.labour })

const DERIVE = { framing: deriveFraming, continuous_insulation: deriveCi, cavity_insulation: deriveCavity, sheathing: deriveSheathing }
// Flat invented placeholder, $/m2 [material, labour]: only for families with no LEEP rows at all.
const PH_WALL = { cladding: [5, 7] }

// --- non-wall placeholders (invented, $ each, $/m2 or $ per house) ---
const PH_CARD = {
  'windows/u_1_61': [565, 95], 'windows/u_1_44': [640, 95], 'windows/u_1_22': [760, 95],
  'doors/u_1_61': [900, 250], 'doors/u_1_44': [1050, 250], 'doors/u_1_22': [1300, 250],
  'airtightness/untested': [0, 0], 'airtightness/ach_2_5': [150, 350], 'airtightness/ach_2': [600, 1400], 'airtightness/ach_1_5': [1100, 2600], 'airtightness/ach_1': [1800, 4200], 'airtightness/ach_0_6': [2800, 6500],
  'foundation_assembly/rsi_2_98': [60, 55], 'foundation_assembly/rsi_3_09': [64, 57], 'foundation_assembly/rsi_3_46': [72, 60], 'foundation_assembly/rsi_3_9': [84, 66],
}
const PH_HRV = { sre_60_65: 1450, sre_65_75: 1900, sre_75_84: 2600 }
const PH_WH = { // material by size index for tanks; single value for tankless
  elec_storage: [850, 950, 1100, 1350], heat_pump: [2700, 2900, 3100, 3700], rdc_079: [3700, 3900, 4200, 4900],
  rdc_085: [4300, 4500, 4800, 5500], res_083: [3300, 3500, 3800, 4300], tankless_092: 2900,
}
const PH_PART = { circuit_240v: [200, 250], condensate_drain: [130, 120], venting: [180, 220], gas_branch: [100, 180], receptacle_120v: [40, 60] }

const rows = []
for (const o of WALL_LAYER_OPTIONS) {
  const base = { category: 'aboveGroundWalls', component: o.component, option: o.option, fuel: null, size: null, sizeUnit: null, unit: 'm2' }
  const h = leepFor(o.component, o.option)
  if (h) { rows.push({ ...base, ...toM2(h), priced_item: h.priced_item, source: h.source }); continue }
  if (DERIVE[o.component]) { rows.push({ ...base, ...toM2(DERIVE[o.component](o.option)), priced_item: o.label, source: 'placeholder' }); continue }
  if (!PH_WALL[o.component]) throw new Error(`no LEEP row and no placeholder rule for ${o.component}/${o.option}`)
  const [m, l] = PH_WALL[o.component]
  rows.push({ ...base, material: m, labour: l, priced_item: o.label, source: 'placeholder' })
}
for (const o of CARD_OPTIONS) {
  if (o.component === 'hrv') {
    HRV_SIZE_CLASSES.forEach((size, i) => rows.push({ ...o, size, sizeUnit: 'L/s', unit: 'each', material: PH_HRV[o.option] + i * 350, labour: 900 + i * 50, priced_item: `HRV, ${o.option.replace('sre_', 'SRE ').replace('_', '-')}%, ${size} L/s`, source: 'placeholder' }))
  } else if (o.category === 'dhw' && o.component === 'water_heater') {
    if (o.option === 'tankless_092') rows.push({ ...o, size: null, sizeUnit: null, unit: 'each', material: PH_WH[o.option], labour: 800, priced_item: 'Condensing tankless, UEF 0.92', source: 'placeholder' })
    else WATER_HEATER_SIZES.forEach((size, i) => rows.push({ ...o, size, sizeUnit: 'gal', unit: 'each', material: PH_WH[o.option][i], labour: 350 + i * 50, priced_item: `${o.option} ${size} gal`, source: 'placeholder' }))
  } else if (o.category === 'dhw') {
    const [m, l] = PH_PART[o.component]
    rows.push({ ...o, sizeUnit: null, unit: 'each', material: m, labour: l, priced_item: o.component.replace(/_/g, ' '), source: 'placeholder' })
  } else {
    const [m, l] = PH_CARD[`${o.component}/${o.option}`]
    const unit = o.category === 'windowsDoors' ? (o.component === 'doors' ? 'each' : 'm2') : o.category === 'airTightness' ? 'house' : 'm2'
    rows.push({ ...o, sizeUnit: null, unit, material: m, labour: l, priced_item: `${o.component} ${o.option}`.replace(/_/g, ' '), source: 'placeholder' })
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1))
const bySource = rows.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] || 0) + 1 }), {})
console.log(`wrote ${rows.length} rows to ${OUT}`)
console.log(Object.entries(bySource).map(([s, n]) => `  ${s}: ${n}`).join('\n'))
