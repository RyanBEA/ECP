// What the optimizer may pick, per card (Capability 2 spec 2 step 1, 4, 5.1). Every option is priced for this house
// through priceHouse, so a candidate's cost is exactly what the Cost tab would show for that pick.
import { categories } from '../data/ecpData'
import { priceHouse } from '../costing/priceHouse'
import { wallCandidates, WALL_TYPES, STANDARD_TYPE_ID } from './wallTypes'

export const LEVER_CARDS = ['aboveGroundWalls', 'belowGradeWalls', 'windowsDoors', 'airTightness', 'hrv', 'dhw']
export const CARD_NAMES = {
  aboveGroundWalls: 'Above-ground walls', belowGradeWalls: 'Below-grade walls', windowsDoors: 'Windows and doors',
  airTightness: 'Airtightness', hrv: 'Ventilation', dhw: 'Water heating', volume: 'Heated volume',
}

const cat = id => categories.find(c => c.id === id)

// Code-minimum values with no card button (the values baselines.js uses), first in each list.
const CODE_MIN = {
  belowGradeWalls: { value: 2.98, label: 'RSI 2.98, code minimum' },
  windowsDoors: { value: 1.61, label: 'U 1.61 (double glazed), code minimum' },
  airTightness: { value: 'untested', label: 'untested, prescriptive air-barrier detailing' },
  hrv: null,
}
const LABEL = {
  belowGradeWalls: v => `RSI ${v}`,
  windowsDoors: v => `U ${v} (${v <= 1.22 ? 'triple' : 'double'} glazed)`,
  airTightness: v => `${v} ACH50, tested`,
  hrv: v => `HRV, ${v}% SRE`,
}
const DHW_LABEL = {
  2.35: 'heat pump water heater, EF 2.35', 0.79: 'gas storage tank, UEF 0.79 (commercial)', 0.83: 'gas storage tank, UEF 0.83 (residential)',
  0.85: 'gas storage tank, UEF 0.85 (commercial)', 0.92: 'gas tankless condensing, UEF 0.92',
}

export function cardOptions(cardId) {
  if (cardId === 'aboveGroundWalls') return WALL_TYPES.map(t => ({ value: t.id, label: t.label, points: null, pickCard: 'wall', locked: t.locked === true }))
  if (cardId === 'dhw') {
    return [
      { value: 'electricStorage', label: 'electric storage tank, code minimum', points: 0, pickCard: 'dhwElectric' },
      ...cat('dhwElectric').options.map(o => ({ value: o.value, label: DHW_LABEL[o.value], points: o.points, pickCard: 'dhwElectric' })),
      ...cat('dhwGas').options.map(o => ({ value: o.value, label: DHW_LABEL[o.value], points: o.points, pickCard: 'dhwGas' })),
    ]
  }
  const min = CODE_MIN[cardId] ? [{ ...CODE_MIN[cardId], points: 0, pickCard: cardId }] : []
  return [...min, ...cat(cardId).options.map(o => ({ value: o.value, label: LABEL[cardId](o.value), points: o.points, pickCard: cardId }))]
}

export function defaultConsider() {
  const c = {}
  for (const id of LEVER_CARDS) c[id] = new Set(cardOptions(id).map(o => o.value))
  return c
}

// Tick or untick one value. The standard wall type stays ticked whatever is asked.
export function toggleConsider(consider, cardId, value) {
  if (cardId === 'aboveGroundWalls' && value === STANDARD_TYPE_ID) return consider
  const next = new Set(consider[cardId])
  if (next.has(value)) next.delete(value); else next.add(value)
  return { ...consider, [cardId]: next }
}

const picksFor = c => (c.pickCard === 'wall' ? { cards: {}, wall: { kind: 'assembly', selection: c.selection } } : { cards: { [c.pickCard]: c.value }, wall: null })

export function buildCandidates(consider, { wallSelection, quantities, overrides = {} }) {
  const cards = {}
  const leftOut = []
  const unavailable = []
  for (const cardId of LEVER_CARDS) {
    const list = cardId === 'aboveGroundWalls'
      ? wallCandidates(consider.aboveGroundWalls, wallSelection).map(w => ({ ...w, cardId, pickCard: 'wall' }))
      : cardOptions(cardId).filter(o => consider[cardId].has(o.value)).map(o => ({ ...o, cardId, id: `${o.pickCard}:${o.value}` }))
    if (list.length === 0) { leftOut.push(cardId); continue }
    const priced = []
    let blocked = null
    for (const c of list) {
      const r = priceHouse(picksFor(c), quantities, overrides, 'design')[cardId]
      if (r.state === 'notApplicable') { blocked = `not applicable (${r.description})`; break }
      if (r.state === 'priced') priced.push({ ...c, cost: r.cost, description: r.description })
      else if (!blocked && r.state === 'notPriced') blocked = r.reason
    }
    if (blocked && priced.length === 0) { unavailable.push({ cardId, reason: blocked }); continue }
    if (priced.length === 0) { unavailable.push({ cardId, reason: 'no priced option' }); continue }
    cards[cardId] = priced
  }
  return { cards, leftOut, unavailable }
}
