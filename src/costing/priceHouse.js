// One set of picks + quantities + overrides -> a priced house, per category (spec 4.4, 4.5, 7.2).
import { categories } from '../data/ecpData'
import { lookupCost } from '../costSystem/client'
import { cardOptionId, WATER_HEATER_PARTS, WATER_HEATER_FUEL, hrvSizeClass } from './optionMap'
import { wallLayers } from './wallLayers'
import { assumedWallSelection, describeWall, wallText, ASSUMED_FOUNDATIONS } from './assumedAssemblies'

export const COSTED_CATEGORIES = ['aboveGroundWalls', 'belowGradeWalls', 'windowsDoors', 'airTightness', 'hrv', 'dhw']
// `option` is the priced-item id: the price option, or `${option}@${size}` for a sized row (ruling R25).
export const overrideKey = (side, categoryId, component, option) => `${side}/${categoryId}/${component}/${option}`
export const lineOverrideKey = (side, categoryId) => `${side}/${categoryId}/__line`

const cat = id => categories.find(c => c.id === id)

// Each category's line unit and quantity (ruling R23). The line's perUnit and a line override cover only the
// components priced in this unit; components in another unit (doors, each) are added at their own cost (R24).
const LINE = {
  aboveGroundWalls: ['m2', q => q.opaqueWallM2],
  belowGradeWalls: ['m2', q => q.belowGradeM2],
  windowsDoors: ['m2', q => q.windowAreaM2],
  airTightness: ['house', () => 1],
  hrv: ['each', () => 1],
  dhw: ['each', () => 1],
  volume: ['house', () => 0],
}
const lineOf = (categoryId, q) => ({ unit: LINE[categoryId][0], quantity: LINE[categoryId][1](q) })

// Any result that is not priced: same shape as a priced one, with no per-unit figure and no components.
function unpriced(categoryId, q, state, description, { reason, assumed = false } = {}) {
  return {
    state, ...(reason !== undefined ? { reason } : {}), description, assumed, ...lineOf(categoryId, q),
    perUnit: null, cost: 0, components: [], lineOverride: null, lineKey: null,
  }
}

// Points state (index-based) -> house picks shape
export function designPicks(selections, wallSelection) {
  const cards = {}
  for (const [id, idx] of Object.entries(selections || {})) {
    const opt = cat(id)?.options[idx]
    if (opt) cards[id] = opt.value
  }
  const ws = wallSelection || {}
  let wall = null
  if (ws.simpleIndex !== undefined && ws.simpleIndex !== null) wall = { kind: 'level', rsi: cat('aboveGroundWalls').options[ws.simpleIndex].value }
  else if (ws.wallType) wall = { kind: 'assembly', selection: ws }
  return { cards, wall }
}

function component(categoryId, spec, quantity, overrides, side) {
  const size = spec.size ?? null
  const row = lookupCost({ category: categoryId, component: spec.component, option: spec.option, fuel: spec.fuel ?? null, size })
  if (!row) return null
  const priceId = size === null ? spec.option : `${spec.option}@${size}`
  const bothKey = overrideKey('both', categoryId, spec.component, priceId)
  const sideKey = overrideKey(side, categoryId, spec.component, priceId)
  const bothOv = overrides[bothKey] || {}
  const sideOv = overrides[sideKey] || {}
  // Per field, the side key wins over the 'both' key; record which key supplied it (ruling R26).
  const field = f => (sideOv[f] !== undefined ? [sideOv[f], sideKey] : bothOv[f] !== undefined ? [bothOv[f], bothKey] : [undefined, null])
  const [material, materialKey] = field('material')
  const [labour, labourKey] = field('labour')
  return {
    component: spec.component, option: spec.option, priceId, label: spec.label || row.priced_item, unit: row.unit, quantity,
    material: material ?? row.material, labour: labour ?? row.labour,
    overridden: { material: material !== undefined, labour: labour !== undefined },
    overrideKeys: { material: materialKey, labour: labourKey },
    source: row.source,
  }
}

function finish(categoryId, q, specs, description, assumed, overrides, side) {
  const { unit, quantity } = lineOf(categoryId, q)
  const components = specs.map(s => component(categoryId, s, s.quantity ?? quantity * (s.quantityFactor ?? 1), overrides, side))
  if (components.some(c => c === null)) return unpriced(categoryId, q, 'notPriced', description, { reason: 'no price for one of the parts', assumed })
  const costOf = c => (c.material + c.labour) * c.quantity
  const inLine = components.filter(c => c.unit === unit).reduce((s, c) => s + costOf(c), 0)
  const onTop = components.filter(c => c.unit !== unit).reduce((s, c) => s + costOf(c), 0)
  const key = lineOverrideKey(side, categoryId)
  const lineOverride = overrides[key]?.line ?? null
  const perUnit = lineOverride ?? (quantity ? inLine / quantity : inLine)
  const cost = (lineOverride !== null ? lineOverride * quantity : inLine) + onTop
  return { state: 'priced', description, assumed, unit, quantity, perUnit, cost, components, lineOverride, lineKey: lineOverride !== null ? key : null }
}

export function priceHouse(picks, q, overrides = {}, side = 'design') {
  const out = {}
  const cards = picks.cards || {}

  // above-ground walls
  if (!picks.wall) out.aboveGroundWalls = unpriced('aboveGroundWalls', q, 'unselected', 'not selected')
  else {
    const assumed = picks.wall.kind === 'level'
    const sel = assumed ? assumedWallSelection(picks.wall.rsi) : picks.wall.selection
    const wl = sel ? wallLayers(sel) : { priced: false, reason: `no assumed assembly for RSI ${picks.wall.rsi}` }
    // Ruling R45: an assembly reads 'RSI 3.99 (2x6 R24 batt + 1 in XPS, OSB, vinyl)'; a level keeps its own wording.
    const description = assumed ? `RSI ${picks.wall.rsi}, assumed assembly: ${describeWall(sel)}` : wallText(sel)
    out.aboveGroundWalls = wl.priced
      ? finish('aboveGroundWalls', q, wl.layers, description, assumed, overrides, side)
      : unpriced('aboveGroundWalls', q, 'notPriced', description, { reason: wl.reason, assumed })
  }

  // below-grade walls
  if (!q.belowGradeApplicable) out.belowGradeWalls = unpriced('belowGradeWalls', q, 'notApplicable', 'no foundation wall')
  else if (cards.belowGradeWalls === undefined) out.belowGradeWalls = unpriced('belowGradeWalls', q, 'unselected', 'not selected')
  else {
    const f = ASSUMED_FOUNDATIONS[cards.belowGradeWalls]
    out.belowGradeWalls = f
      ? finish('belowGradeWalls', q, f.layers, `RSI ${cards.belowGradeWalls}, assumed: ${f.label}`, true, overrides, side)
      : unpriced('belowGradeWalls', q, 'notPriced', '', { reason: `no assumed assembly for RSI ${cards.belowGradeWalls}`, assumed: true })
  }

  // windows and doors
  if (cards.windowsDoors === undefined) out.windowsDoors = unpriced('windowsDoors', q, 'unselected', 'not selected')
  else {
    const o = cardOptionId('windowsDoors', cards.windowsDoors)
    out.windowsDoors = finish('windowsDoors', q, [
      { component: 'windows', option: o, label: `windows, U ${cards.windowsDoors}`, quantity: q.windowAreaM2 },
      { component: 'doors', option: o, label: `exterior doors, U ${cards.windowsDoors}`, quantity: q.doors },
    ], `U ${cards.windowsDoors}`, false, overrides, side)
  }

  // airtightness
  if (cards.airTightness === undefined) out.airTightness = unpriced('airTightness', q, 'unselected', 'not selected')
  else {
    const v = cards.airTightness
    out.airTightness = finish('airTightness', q, [{ component: 'airtightness', option: cardOptionId('airTightness', v), label: v === 'untested' ? 'untested, prescriptive air-barrier detailing' : `${v} ACH50, tested`, quantity: 1 }],
      v === 'untested' ? 'untested' : `${v} ACH50`, false, overrides, side)
  }

  // ventilation
  if (cards.hrv === undefined) out.hrv = unpriced('hrv', q, 'unselected', 'not selected')
  else if (!q.airflow) out.hrv = unpriced('hrv', q, 'notPriced', `${cards.hrv}% SRE`, { reason: 'enter the designed airflow to price the HRV' })
  // No nearest-size substitution (spec 6.4, ruling R22): above the largest class there is no priced unit.
  else if (hrvSizeClass(q.airflow) === null) out.hrv = unpriced('hrv', q, 'notPriced', `${cards.hrv}% SRE`, { reason: 'airflow above the largest HRV size priced in this version' })
  else out.hrv = finish('hrv', q, [{ component: 'hrv', option: cardOptionId('hrv', cards.hrv), size: hrvSizeClass(q.airflow), label: `HRV, ${cards.hrv}% SRE`, quantity: 1 }], `${cards.hrv}% SRE`, false, overrides, side)

  // water heating: the two exclusive cards map to one line
  const whValue = cards.dhwElectric ?? cards.dhwGas
  const whCat = cards.dhwElectric !== undefined ? 'dhwElectric' : 'dhwGas'
  if (whValue === undefined) out.dhw = unpriced('dhw', q, 'unselected', 'not selected')
  else {
    const o = cardOptionId(whCat, whValue)
    const fuel = WATER_HEATER_FUEL[o]
    const parts = WATER_HEATER_PARTS(o, fuel).map(p => ({ ...p, size: p.component === 'water_heater' && o !== 'tankless_092' ? q.waterHeaterGal : null, quantity: 1 }))
    out.dhw = finish('dhw', q, parts, whValue === 'electricStorage' ? 'electric storage tank, code minimum' : `${whCat === 'dhwElectric' ? 'EF' : 'UEF'} ${whValue}`, false, overrides, side)
  }

  out.volume = unpriced('volume', q, 'notCosted', 'earns points, no cost attached')
  return out
}

export function appliedOverrideCount(results) {
  let n = 0
  for (const r of Object.values(results)) {
    for (const c of r.components || []) n += (c.overridden?.material ? 1 : 0) + (c.overridden?.labour ? 1 : 0)
    if (r.lineOverride !== null && r.lineOverride !== undefined) n += 1
  }
  return n
}

// Override keys that changed a price on this house (ruling R26): the key that supplied each overridden field,
// and the line key while a line override is active. Component overrides on the components a line override
// covers (same unit as the line) are dormant and left out.
export function appliedOverrideKeys(results) {
  const keys = new Set()
  for (const r of Object.values(results)) {
    if (r.lineKey) keys.add(r.lineKey)
    for (const c of r.components || []) {
      if (r.lineKey && c.unit === r.unit) continue
      if (c.overrideKeys?.material) keys.add(c.overrideKeys.material)
      if (c.overrideKeys?.labour) keys.add(c.overrideKeys.labour)
    }
  }
  return keys
}
