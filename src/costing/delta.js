// Two priced houses -> category lines, headline, covered count (spec 3.2, 7.1).
// Sorting and line states use exact deltas; only display text rounds.
import { formatDelta, roundDisplay, ROUNDING_UNIT } from './units'

const NAMES = {
  aboveGroundWalls: 'Above-ground walls',
  belowGradeWalls: 'Below-grade walls',
  windowsDoors: 'Windows and doors',
  airTightness: 'Airtightness',
  hrv: 'Ventilation',
  dhw: 'Water heating',
  volume: 'Heated volume',
}
const ORDER_ALL = ['aboveGroundWalls', 'belowGradeWalls', 'windowsDoors', 'airTightness', 'hrv', 'dhw', 'volume']
const UNCOSTED = ['notCosted', 'notApplicable']
const money = n => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
// Exact zero is judged to the cent, so float residues from priceHouse do not count as a difference.
const isZero = x => Math.round(x * 100) === 0
const cards = n => `card${n === 1 ? '' : 's'}`

// Proof-of-concept price source (spec 3.2, standing rule 3).
export const SECOND_LINE = 'For comparing options. Placeholder and LEEP 2013-2016 prices; not a quote.'

function lineFor(id, d, b, baselineName) {
  const line = { categoryId: id, name: NAMES[id], delta: 0, design: d, baseline: b }
  if (id === 'volume') return { ...line, state: 'notCosted', smallPrint: 'earns points, no cost attached' }
  if (d.state === 'notApplicable' || b.state === 'notApplicable') return { ...line, state: 'notApplicable', smallPrint: 'not applicable (no foundation wall)' }
  if (d.state === 'notPriced') return { ...line, state: 'notPriced', reason: d.reason, smallPrint: `This design: ${d.reason}` }
  if (b.state === 'notPriced') return { ...line, state: 'notPriced', reason: b.reason, smallPrint: `${baselineName}: ${b.reason}` }
  if (d.state === 'unselected') return { ...line, state: 'sameAsBaseline', smallPrint: `not selected - treated as the same as ${baselineName}` }
  if (b.state === 'unselected') {
    // e.g. the mini-home Typical Tier 2 has no below-grade pick and the builder adds a foundation (R28)
    const reason = `${baselineName} has no pick for this card`
    return { ...line, state: 'notPriced', reason, smallPrint: reason }
  }
  const raw = d.cost - b.cost
  const delta = isZero(raw) ? 0 : raw
  const smallPrint = delta === 0 && d.description === b.description
    ? `same as ${baselineName}`
    : `This design: ${d.description} . ${baselineName}: ${b.description}`
  return { ...line, delta, state: 'priced', smallPrint }
}

// non-zero deltas first, then $0 lines, then not costed, then not applicable (spec 3.2, M3)
const rank = l => (l.state === 'notApplicable' ? 3 : l.state === 'notCosted' ? 2 : l.delta === 0 ? 1 : 0)

const isFullOrder = o => Array.isArray(o) && o.length === ORDER_ALL.length && ORDER_ALL.every(id => o.includes(id))

// Positive: '+$500' / '< $500'. Negative lines carry the word "less" (spec 3.2): '$500 less' / '< $500 less'.
function lineDeltaText(delta) {
  if (delta >= 0) return formatDelta(delta)
  const rounded = roundDisplay(delta)
  return rounded === 0 ? `< ${money(ROUNDING_UNIT)} less` : `${money(Math.abs(rounded))} less`
}

const deltaTextOf = l => (l.state === 'priced' ? lineDeltaText(l.delta) : l.state === 'sameAsBaseline' ? '$0' : '')

export function computeDelta(design, baseline, baselineName, frozenOrder = null) {
  const byId = Object.fromEntries(ORDER_ALL.map(id => [id, lineFor(id, design[id], baseline[id], baselineName)]))
  const order = isFullOrder(frozenOrder)
    ? [...frozenOrder]
    : ORDER_ALL.map(id => byId[id])
      .sort((a, b) => rank(a) - rank(b) || Math.abs(b.delta) - Math.abs(a.delta))
      .map(l => l.categoryId)
  const lines = order.map(id => ({ ...byId[id], deltaText: deltaTextOf(byId[id]) }))

  const sum = lines.reduce((s, l) => s + l.delta, 0)
  const exact = isZero(sum) ? 0 : sum
  const costedCount = lines.filter(l => !UNCOSTED.includes(l.state)).length
  const coveredCount = lines.filter(l => l.state === 'priced').length
  const pickedCount = lines.filter(l => l.design.state !== 'unselected' && !UNCOSTED.includes(l.state)).length
  const hasPicks = pickedCount > 0

  let text
  if (!hasPicks || coveredCount === 0) text = '$0'
  else if (exact === 0) text = `About the same as ${baselineName}.`
  else if (roundDisplay(exact) === 0) text = `Less than ${money(ROUNDING_UNIT)} different from ${baselineName}, before HST.`
  else if (exact > 0) text = `${formatDelta(exact)} more than ${baselineName}, before HST.`
  else text = `${money(Math.abs(roundDisplay(exact)))} less than ${baselineName}, before HST.`
  let coveredText = ''
  if (hasPicks && coveredCount === 0) coveredText = 'None of the cards you have picked can be priced in this version'
  else if (coveredCount < pickedCount) coveredText = `Covers ${coveredCount} of the ${pickedCount} ${cards(pickedCount)} you have picked`
  else if (hasPicks && coveredCount < costedCount) coveredText = `Covers the ${coveredCount} ${cards(coveredCount)} you have picked`

  return { lines, headline: { exact, text, secondLine: SECOND_LINE, coveredText }, coveredCount, costedCount, pickedCount, hasPicks, order }
}

