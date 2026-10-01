// One set of picks + quantities + overrides -> a priced house, per category (spec 4.4, 4.5, 7.2).
import { categories } from '../data/ecpData'
import { lookupCost } from '../costSystem/client'
import { cardOptionId, WATER_HEATER_PARTS, WATER_HEATER_FUEL, hrvSizeClass } from './optionMap'
import { wallLayers } from './wallLayers'
import { assumedWallSelection, describeWall, ASSUMED_FOUNDATIONS } from './assumedAssemblies'

export const COSTED_CATEGORIES = ['aboveGroundWalls', 'belowGradeWalls', 'windowsDoors', 'airTightness', 'hrv', 'dhw']
export const overrideKey = (side, categoryId, component, option) => `${side}/${categoryId}/${component}/${option}`
export const lineOverrideKey = (side, categoryId) => `${side}/${categoryId}/__line`

const cat = id => categories.find(c => c.id === id)

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
  const row = lookupCost({ category: categoryId, component: spec.component, option: spec.option, fuel: spec.fuel ?? null, size: spec.size ?? null })
  if (!row) return null
  const ov = { ...(overrides[overrideKey('both', categoryId, spec.component, spec.option)] || {}), ...(overrides[overrideKey(side, categoryId, spec.component, spec.option)] || {}) }
  return {
    component: spec.component, option: spec.option, label: spec.label || row.priced_item, unit: row.unit, quantity,
    material: ov.material ?? row.material, labour: ov.labour ?? row.labour,
    overridden: { material: ov.material !== undefined, labour: ov.labour !== undefined }, source: row.source,
  }
}

function finish(categoryId, specs, unit, quantity, description, assumed, overrides, side) {
  const components = specs.map(s => component(categoryId, s, s.quantity ?? quantity, overrides, side))
  if (components.some(c => c === null)) return { state: 'notPriced', reason: 'no price for one of the parts', description, assumed, unit, quantity, perUnit: 0, cost: 0, components: components.filter(Boolean), lineOverride: null }
  const exact = components.reduce((s, c) => s + (c.material + c.labour) * c.quantity, 0)
  const lineOverride = overrides[lineOverrideKey(side, categoryId)]?.line ?? null
  const perUnit = lineOverride ?? (quantity ? exact / quantity : exact)
  const cost = lineOverride !== null ? lineOverride * quantity : exact
  return { state: 'priced', description, assumed, unit, quantity, perUnit, cost, components, lineOverride }
}

export function priceHouse(picks, q, overrides = {}, side = 'design') {
  const out = {}
  const cards = picks.cards || {}

  // above-ground walls
  if (!picks.wall) out.aboveGroundWalls = { state: 'unselected', description: 'not selected', assumed: false, components: [], cost: 0 }
  else {
    const assumed = picks.wall.kind === 'level'
    const sel = assumed ? assumedWallSelection(picks.wall.rsi) : picks.wall.selection
    const wl = sel ? wallLayers(sel) : { priced: false, reason: `no assumed assembly for RSI ${picks.wall.rsi}` }
    const description = assumed ? `RSI ${picks.wall.rsi}, assumed assembly: ${describeWall(sel)}` : describeWall(sel)
    out.aboveGroundWalls = wl.priced
      ? finish('aboveGroundWalls', wl.layers, 'm2', q.opaqueWallM2, description, assumed, overrides, side)
      : { state: 'notPriced', reason: wl.reason, description, assumed, components: [], cost: 0 }
  }

  // below-grade walls
  if (!q.belowGradeApplicable) out.belowGradeWalls = { state: 'notApplicable', description: 'no foundation wall', assumed: false, components: [], cost: 0 }
  else if (cards.belowGradeWalls === undefined) out.belowGradeWalls = { state: 'unselected', description: 'not selected', assumed: false, components: [], cost: 0 }
  else {
    const f = ASSUMED_FOUNDATIONS[cards.belowGradeWalls]
    out.belowGradeWalls = f
      ? finish('belowGradeWalls', f.layers, 'm2', q.belowGradeM2, `RSI ${cards.belowGradeWalls}, assumed: ${f.label}`, true, overrides, side)
      : { state: 'notPriced', reason: `no assumed assembly for RSI ${cards.belowGradeWalls}`, description: '', assumed: true, components: [], cost: 0 }
  }

  // windows and doors
  if (cards.windowsDoors === undefined) out.windowsDoors = { state: 'unselected', description: 'not selected', assumed: false, components: [], cost: 0 }
  else {
    const o = cardOptionId('windowsDoors', cards.windowsDoors)
    out.windowsDoors = finish('windowsDoors', [
      { component: 'windows', option: o, label: `windows, U ${cards.windowsDoors}`, quantity: q.windowAreaM2 },
      { component: 'doors', option: o, label: `exterior doors, U ${cards.windowsDoors}`, quantity: q.doors },
    ], 'm2', q.windowAreaM2, `U ${cards.windowsDoors}`, false, overrides, side)
  }

  // airtightness
  if (cards.airTightness === undefined) out.airTightness = { state: 'unselected', description: 'not selected', assumed: false, components: [], cost: 0 }
  else {
    const v = cards.airTightness
    out.airTightness = finish('airTightness', [{ component: 'airtightness', option: cardOptionId('airTightness', v), label: v === 'untested' ? 'untested, prescriptive air-barrier detailing' : `${v} ACH50, tested`, quantity: 1 }],
      'house', 1, v === 'untested' ? 'untested' : `${v} ACH50`, false, overrides, side)
  }

  // ventilation
  if (cards.hrv === undefined) out.hrv = { state: 'unselected', description: 'not selected', assumed: false, components: [], cost: 0 }
  else if (!q.airflow) out.hrv = { state: 'notPriced', reason: 'enter the designed airflow to price the HRV', description: `${cards.hrv}% SRE`, assumed: false, components: [], cost: 0 }
  // No nearest-size substitution (spec 6.4, ruling R22): above the largest class there is no priced unit.
  else if (hrvSizeClass(q.airflow) === null) out.hrv = { state: 'notPriced', reason: 'airflow above the largest HRV size priced in this version', description: `${cards.hrv}% SRE`, assumed: false, components: [], cost: 0 }
  else out.hrv = finish('hrv', [{ component: 'hrv', option: cardOptionId('hrv', cards.hrv), size: hrvSizeClass(q.airflow), label: `HRV, ${cards.hrv}% SRE`, quantity: 1 }], 'each', 1, `${cards.hrv}% SRE`, false, overrides, side)

  // water heating: the two exclusive cards map to one line
  const whValue = cards.dhwElectric ?? cards.dhwGas
  const whCat = cards.dhwElectric !== undefined ? 'dhwElectric' : 'dhwGas'
  if (whValue === undefined) out.dhw = { state: 'unselected', description: 'not selected', assumed: false, components: [], cost: 0 }
  else {
    const o = cardOptionId(whCat, whValue)
    const fuel = WATER_HEATER_FUEL[o]
    const parts = WATER_HEATER_PARTS(o, fuel).map(p => ({ ...p, size: p.component === 'water_heater' && o !== 'tankless_092' ? q.waterHeaterGal : null, quantity: 1 }))
    out.dhw = finish('dhw', parts, 'each', 1, whValue === 'electricStorage' ? 'electric storage tank, code minimum' : `${whCat === 'dhwElectric' ? 'EF' : 'UEF'} ${whValue}`, false, overrides, side)
  }

  out.volume = { state: 'notCosted', description: 'earns points, no cost attached', assumed: false, components: [], cost: 0 }
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
