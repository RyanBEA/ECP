// One priced category line -> the Basic view's text and the specifics table model (spec rev 3 sections 4-6).
// Pure: components render what this returns. Price sources are not shown (rev 3 section 9).
import { perM2ToPerSqFt, m2ToSqFt } from './units'
import { hrvSizeClass, WATER_HEATER_FUEL } from './optionMap'
import { ASSUMED_FOUNDATIONS, assumedWallSelection, describeWall } from './assumedAssemblies'
import { MORE_THAN_5 } from './quantities'
import { plural, shapeSentence } from './houseText'

export const OVERHEAD_SENTENCE = 'Installed prices are assumed to include contractor overhead, profit and waste.'

const money = n => Math.round(Math.abs(n)).toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
export const dollars = n => money(n)
export const signedDollars = n => { const r = Math.round(n); return r === 0 ? '$0' : `${r > 0 ? '+' : '-'}${money(r)}` }
export const diffClass = n => { const r = Math.round(n); return r > 0 ? 'more' : r < 0 ? 'less' : '' }

const sqft = m2 => Math.round(m2ToSqFt(m2)).toLocaleString('en-CA')
const perSqFt = c => perM2ToPerSqFt(c.material + c.labour)
const near = (a, b) => Math.abs(a - b) < 1e-6

export const SPECIFICS = {
  aboveGroundWalls: { label: 'Layers', firstCol: 'Layer', per: 'sq ft of wall', caption: 'inside to outside, as on the Points cross-section', perSqFtFooter: true },
  belowGradeWalls: { label: 'Assembly', firstCol: 'Item', per: 'sq ft of foundation wall', caption: 'inside to outside', perSqFtFooter: true },
  windowsDoors: { label: 'U-values and areas', firstCol: 'Part', per: 'sq ft of windows', caption: '', perSqFtFooter: false },
  airTightness: { label: 'Target and testing', firstCol: 'Part', per: 'house', caption: '', perSqFtFooter: false },
  hrv: { label: 'Flow rates and SRE', firstCol: 'Item', per: 'HRV, installed', caption: '', perSqFtFooter: false },
  dhw: { label: 'Heater and parts', firstCol: 'Item', per: 'heater, installed with its parts', caption: '', perSqFtFooter: false },
}

const COMPONENT_NAMES = {
  interior_finish: 'Interior finish', air_vapour_barrier: 'Air/vapour barrier', framing: 'Framing', cavity_insulation: 'Cavity insulation',
  sheathing: 'Sheathing', continuous_insulation: 'Continuous insulation', strapping: 'Strapping', cladding: 'Cladding',
  foundation_assembly: 'Whole assembly', windows: 'Windows', doors: 'Exterior doors', airtightness: 'Air sealing and blower-door test',
  hrv: 'HRV unit', water_heater: 'Water heater', venting: 'Venting', condensate_drain: 'Condensate drain', gas_branch: 'Gas branch line',
  receptacle_120v: '120 V receptacle', circuit_240v: '240 V circuit',
}
// Inside to outside, the order of the Points cross-section (drywall at the top, cladding at the bottom).
const WALL_ORDER = ['interior_finish', 'air_vapour_barrier', 'framing', 'cavity_insulation', 'sheathing', 'continuous_insulation', 'strapping', 'cladding']
export const HEATER_WORDS = {
  elec_storage: 'electric storage tank, code minimum', heat_pump: 'heat pump water heater, EF 2.35',
  rdc_079: 'commercial storage water heater, UEF 0.79', res_083: 'residential storage water heater, UEF 0.83',
  rdc_085: 'commercial storage water heater, UEF 0.85', tankless_092: 'condensing tankless water heater, UEF 0.92',
}
const PART_WORDS = { venting: 'venting', condensate_drain: 'condensate drain', gas_branch: 'gas branch line', receptacle_120v: '120 V receptacle', circuit_240v: '240 V circuit' }

function optionText(categoryId, c) {
  if (categoryId === 'windowsDoors') return c.label.replace(/^(windows|exterior doors), /, '')
  if (categoryId === 'hrv') {
    const size = String(c.priceId).split('@')[1]
    return `${c.label.replace(/^HRV, /, '')}${size ? `, ${size} L/s` : ''}`
  }
  if (categoryId === 'dhw') return c.component === 'water_heater' ? (HEATER_WORDS[c.option] || c.label) : (PART_WORDS[c.component] || c.label)
  if (categoryId === 'belowGradeWalls') return `${c.label.replace(/^foundation wall assembly, /, '')} assembly`
  return c.label
}
function priceText(c) {
  const each = c.material + c.labour
  if (c.unit === 'm2') return `$${perSqFt(c).toFixed(2)} / sq ft`
  if (c.unit === 'house') return `${money(each)} per house`
  return c.quantity > 1 ? `${c.quantity} x ${money(each)}` : money(each)
}
const rowCost = c => (c ? (c.material + c.labour) * c.quantity : 0)
// "The same" (rev 3 5.1): both sides have the component with the same label, unit, material and labour.
const isSame = (d, b) => Boolean(d && b && d.label === b.label && d.unit === b.unit && near(d.material, b.material) && near(d.labour, b.labour))
function rowSub(c) {
  if (c.component === 'windows') return `${sqft(c.quantity)} sq ft`
  if (c.component === 'doors') return plural(c.quantity, 'door')
  if (c.component === 'airtightness') return 'one placeholder price per level'
  if (c.component === 'foundation_assembly') return 'one placeholder price per RSI level'
  return ''
}

function pricedRows(line) {
  const id = line.categoryId
  const byComp = new Map()
  for (const [side, r] of [['design', line.design], ['baseline', line.baseline]]) {
    for (const c of r.components || []) {
      if (!byComp.has(c.component)) byComp.set(c.component, { design: null, baseline: null })
      byComp.get(c.component)[side] = c
    }
  }
  let keys = [...byComp.keys()]
  if (id === 'aboveGroundWalls') keys = WALL_ORDER.filter(k => byComp.has(k)).concat(keys.filter(k => !WALL_ORDER.includes(k)))
  const cell = c => (c ? { text: optionText(id, c), price: priceText(c), cost: rowCost(c), comp: c } : null)
  return keys.map(k => {
    const { design: d, baseline: b } = byComp.get(k)
    const same = isSame(d, b)
    return {
      key: k, item: COMPONENT_NAMES[k] || k.replace(/_/g, ' '), sub: rowSub(d || b), same,
      design: cell(d), baseline: cell(b), diff: same ? 0 : rowCost(d) - rowCost(b), inLine: (d || b).unit === line.design.unit,
    }
  })
}

// Below grade: the assumed assembly's parts, inside to outside, by their ids in ASSUMED_FOUNDATIONS.
const FOUNDATION_ROWS = [['gypsum', 'Interior finish'], ['stud_wall', 'Framing and insulation'], ['foam', 'Foam against the concrete'], ['concrete', 'Foundation wall']]
const foundationPart = (rsi, partId) => {
  const p = ASSUMED_FOUNDATIONS[rsi]?.assembly.find(a => a.id === partId)
  return p ? p.label.replace(/ interior$/, '') : 'none'
}
function specRowsFor(line, ctx) {
  const id = line.categoryId
  const dc = ctx.designPicks?.cards || {}, bc = ctx.baselinePicks?.cards || {}
  const row = (key, item, d, b) => ({ key, item, design: d, baseline: b, same: d === b })
  if (id === 'belowGradeWalls') return FOUNDATION_ROWS.map(([p, item]) => row(p, item, foundationPart(dc.belowGradeWalls, p), foundationPart(bc.belowGradeWalls, p)))
  if (id === 'hrv') {
    const q = ctx.quantities, f = ctx.houseFields
    const need = f.bedrooms === MORE_THAN_5
      ? `${q.airflow.max} L/s, designed airflow`
      : `${q.airflow.min}-${q.airflow.max} L/s for ${plural(f.bedrooms, 'bedroom')} (NBC Table 9.32.3.3)`
    const size = `${hrvSizeClass(q.airflow)} L/s, the smallest size that covers ${q.airflow.max} L/s`
    return [row('airflow', 'Airflow needed', need, need), row('size', 'HRV size priced', size, size), row('sre', 'Sensible recovery efficiency', `${dc.hrv}% SRE`, `${bc.hrv}% SRE`)]
  }
  if (id === 'dhw') {
    const heater = r => (r.components || []).find(c => c.component === 'water_heater')
    const size = c => (c?.option === 'tankless_092' ? 'tankless, sized by input' : `${ctx.quantities.waterHeaterGal} gal, from your house fields`)
    const fuel = c => (WATER_HEATER_FUEL[c?.option] === 'gas' ? 'natural gas' : 'electric')
    const dh = heater(line.design), bh = heater(line.baseline)
    return [row('size', 'Size', size(dh), size(bh)), row('fuel', 'Fuel', fuel(dh), fuel(bh))]
  }
  return []
}

function footerFor(line, rows, spec) {
  const d = line.design, b = line.baseline
  if (!spec.perSqFtFooter) return { kind: 'total', designCost: d.cost, baselineCost: b.cost, diff: d.cost - b.cost }
  // The column adds up: the sum of the displayed (rounded) row prices, unless a line price is in use.
  const sideSum = side => rows.filter(r => r[side] && r.inLine).reduce((s, r) => s + Number(perSqFt(r[side].comp).toFixed(2)), 0)
  const per = (side, r) => (r.lineOverride !== null && r.lineOverride !== undefined ? perM2ToPerSqFt(r.perUnit) : sideSum(side))
  return {
    kind: 'perSqFt', designPerUnit: per('design', d), baselinePerUnit: per('baseline', b),
    quantityText: `x ${sqft(d.quantity)} sq ft`, designCost: d.cost, baselineCost: b.cost, diff: d.cost - b.cost,
  }
}

const EXTRA_NOTES = {
  aboveGroundWalls: ['Rim joists are the same in both houses and are not priced.'],
  windowsDoors: ['Doors are priced at the same U-value as the windows, as on the Points card.'],
  airTightness: ['The method for pricing each airtightness level is still being settled with the cost system; until then each level has one placeholder price.'],
  dhw: ['Fuel supply to the house is not priced.'],
}
function notesFor(line, ctx, specRows) {
  const out = [...(EXTRA_NOTES[line.categoryId] || [])]
  if (line.categoryId === 'dhw' && specRows.some(r => r.key === 'fuel' && (r.design === 'natural gas' || r.baseline === 'natural gas'))) out.push('Gas heaters are priced as natural gas.')
  out.push(OVERHEAD_SENTENCE, shapeSentence(ctx))
  return out
}

const differText = k => (k === 0 ? 'all the same' : `${k} differ${k === 1 ? 's' : ''}`)
function summaryFor(line, m, ctx) {
  const n = m.rows.length
  switch (line.categoryId) {
    case 'aboveGroundWalls': return `${plural(n, 'layer')}, ${differText(m.rows.filter(r => !r.same).length)}`
    case 'belowGradeWalls': {
      const present = m.specRows.filter(r => r.design !== 'none' || r.baseline !== 'none')
      return `${plural(present.length, 'layer')}, ${differText(present.filter(r => !r.same).length)}; priced as one figure per sq ft`
    }
    case 'windowsDoors': {
      const w = line.design.components.find(c => c.component === 'windows')
      const dr = line.design.components.find(c => c.component === 'doors')
      return `${sqft(w.quantity)} sq ft of windows and ${plural(dr.quantity, 'door')}, both priced by U-value`
    }
    case 'airTightness': return 'one placeholder price per airtightness level'
    case 'hrv': {
      const [need, , sre] = m.specRows
      return `${need.design.replace(/ \(NBC Table 9\.32\.3\.3\)$/, '')}, ${hrvSizeClass(ctx.quantities.airflow)} L/s unit; ${sre.same ? `${sre.design} in both` : `${sre.design} vs ${sre.baseline}`}`
    }
    case 'dhw': {
      const [size, fuel] = m.specRows
      const short = t => t.replace(/, from your house fields$/, '')
      const sizeT = size.same ? short(size.design) : `${short(size.design)} vs ${short(size.baseline)}`
      const fuelT = fuel.same ? fuel.design : `${fuel.design} vs ${fuel.baseline}`
      return `${sizeT}, ${fuelT}; ${plural(n, 'part')}, ${m.rows.filter(r => r.same).length} the same`
    }
    default: return ''
  }
}

export function buildSpecifics(line, ctx) {
  const spec = SPECIFICS[line?.categoryId]
  if (!spec || line.state !== 'priced') return null
  const rows = pricedRows(line)
  const specRows = specRowsFor(line, ctx)
  const inUse = [line.design.lineOverride != null && 'This design', line.baseline.lineOverride != null && ctx.baselineName].filter(Boolean)
  const m = {
    categoryId: line.categoryId, ...spec, specRows, rows, footer: footerFor(line, rows, spec), notes: notesFor(line, ctx, specRows),
    lineNote: inUse.length ? `Your own price per ${spec.per} is in use for ${inUse.join(' and ')}; the rows show the prices it replaces.` : null,
  }
  m.summary = summaryFor(line, m, ctx)
  return m
}

// The Basic view (rev 3 section 4, depth 2): the two descriptions, a notice where the price is not the builder's
// own assembly (4.1), and the quantity sentence with the house field its "change house" goes to.
export function basicViewText(line, ctx, sentences) {
  const d = line.design, b = line.baseline
  const dp = ctx.designPicks || {}, bp = ctx.baselinePicks || {}
  const wallWords = (picks, r) => (r.assumed && picks.wall?.kind === 'level'
    ? `RSI ${picks.wall.rsi} level, priced as ${describeWall(assumedWallSelection(picks.wall.rsi))}`
    : r.description)
  switch (line.categoryId) {
    case 'aboveGroundWalls': {
      const level = d.assumed && dp.wall?.kind === 'level' ? dp.wall.rsi : null
      const notice = level === null ? null : {
        text: `You picked this wall by RSI level, so it is priced as a common wall that reaches RSI ${level}: ${describeWall(assumedWallSelection(level))}. To price your own wall, build it layer by layer on Points.`,
        goToPoints: true,
      }
      return { designText: wallWords(dp, d), baselineText: wallWords(bp, b), notice, quantity: { text: sentences.opaqueWall, field: 'storeyHeightFt' } }
    }
    case 'belowGradeWalls': {
      const t = v => `RSI ${v}, priced as ${ASSUMED_FOUNDATIONS[v]?.label ?? 'an assembly'}`
      return {
        designText: t(dp.cards.belowGradeWalls), baselineText: t(bp.cards.belowGradeWalls),
        notice: { text: 'There is no foundation builder yet, so each RSI level is priced as a common assembly that reaches it. Your own foundation cannot be priced in this version.', goToPoints: false },
        quantity: { text: sentences.belowGrade, field: 'foundationHeightFt' },
      }
    }
    case 'windowsDoors':
      return { designText: `${d.description} windows and doors`, baselineText: `${b.description} windows and doors`, notice: null, quantity: { text: sentences.windows, field: 'doors' } }
    case 'airTightness':
      return { designText: d.components[0].label, baselineText: b.components[0].label, notice: null, quantity: { text: 'Priced per house.', field: null } }
    case 'hrv': {
      const f = ctx.houseFields
      const designed = f.bedrooms === MORE_THAN_5
      const text = designed ? `One HRV, sized from your designed airflow of ${ctx.quantities.airflow.max} L/s.` : `One HRV, sized from your ${plural(f.bedrooms, 'bedroom')}.`
      return { designText: `HRV, ${d.description}`, baselineText: `HRV, ${b.description}`, notice: null, quantity: { text, field: designed ? 'airflow' : 'bedrooms' } }
    }
    case 'dhw': {
      const heater = r => r.components.find(c => c.component === 'water_heater')
      const tankless = heater(d)?.option === 'tankless_092'
      return {
        designText: HEATER_WORDS[heater(d)?.option] || d.description, baselineText: HEATER_WORDS[heater(b)?.option] || b.description, notice: null,
        quantity: { text: tankless ? 'One tankless heater, sized by input.' : `One ${ctx.quantities.waterHeaterGal} gal heater, the size from your house fields.`, field: 'waterHeaterGal' },
      }
    }
    default:
      return { designText: d.description, baselineText: b.description, notice: null, quantity: null }
  }
}
