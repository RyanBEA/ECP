// Two priced houses -> category lines, headline, covered count (spec 3.2, 7.1).
// Sorting and line states use exact deltas; only display text rounds.
import { formatDelta, roundDisplay } from './units'

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

// Proof-of-concept price source (spec 3.2, standing rule 3).
export const SECOND_LINE = 'For comparing options. Placeholder and LEEP 2013-2016 prices; not a quote.'

function lineFor(id, d, b, baselineName) {
  const line = { categoryId: id, name: NAMES[id], delta: 0, design: d, baseline: b }
  if (id === 'volume') return { ...line, state: 'notCosted', smallPrint: 'earns points, no cost attached' }
  if (d.state === 'notApplicable' || b.state === 'notApplicable') return { ...line, state: 'notApplicable', smallPrint: 'not applicable (no foundation wall)' }
  if (d.state === 'notPriced') return { ...line, state: 'notPriced', reason: d.reason, smallPrint: d.reason }
  if (b.state === 'notPriced') return { ...line, state: 'notPriced', reason: b.reason, smallPrint: `${baselineName}: ${b.reason}` }
  if (d.state === 'unselected') return { ...line, state: 'sameAsBaseline', smallPrint: `not selected - treated as the same as ${baselineName}` }
  const delta = d.cost - b.cost
  const smallPrint = delta === 0 && d.description === b.description
    ? `same as ${baselineName}`
    : `This design: ${d.description} . ${baselineName}: ${b.description}`
  return { ...line, delta, state: 'priced', smallPrint }
}

// non-zero deltas first, then $0 lines, then not costed, then not applicable (spec 3.2, M3)
const rank = l => (l.state === 'notApplicable' ? 3 : l.state === 'notCosted' ? 2 : l.delta === 0 ? 1 : 0)

const isFullOrder = o => Array.isArray(o) && o.length === ORDER_ALL.length && ORDER_ALL.every(id => o.includes(id))

const deltaTextOf = l => (l.state === 'priced' ? formatDelta(l.delta) : l.state === 'sameAsBaseline' ? '$0' : '')

export function computeDelta(design, baseline, baselineName, frozenOrder = null) {
  const byId = Object.fromEntries(ORDER_ALL.map(id => [id, lineFor(id, design[id], baseline[id], baselineName)]))
  const order = isFullOrder(frozenOrder)
    ? [...frozenOrder]
    : ORDER_ALL.map(id => byId[id])
      .sort((a, b) => rank(a) - rank(b) || Math.abs(b.delta) - Math.abs(a.delta))
      .map(l => l.categoryId)
  const lines = order.map(id => ({ ...byId[id], deltaText: deltaTextOf(byId[id]) }))

  const exact = lines.reduce((s, l) => s + l.delta, 0)
  const costedCount = lines.filter(l => !UNCOSTED.includes(l.state)).length
  const coveredCount = lines.filter(l => l.state === 'priced').length
  const hasPicks = lines.some(l => l.design.state !== 'unselected' && !UNCOSTED.includes(l.state))

  let text
  if (!hasPicks) text = '$0'
  else if (exact === 0) text = `About the same as ${baselineName}.`
  else if (roundDisplay(exact) === 0) text = `Less than ${money(500)} different from ${baselineName}, before HST.`
  else if (exact > 0) text = `${formatDelta(exact)} more than ${baselineName}, before HST.`
  else text = `${money(Math.abs(roundDisplay(exact)))} less than ${baselineName}, before HST.`
  const coveredText = hasPicks && coveredCount < costedCount
    ? `Covers the ${coveredCount} card${coveredCount === 1 ? '' : 's'} you have picked`
    : ''

  return { lines, headline: { exact, text, secondLine: SECOND_LINE, coveredText }, coveredCount, costedCount, hasPicks, order }
}

// Header chip on Points (spec 2.3): '+$8,500' / '-$1,000' / '$0'.
export const chipText = exact => formatDelta(exact)
// 'more than Typical Tier 2 . details ->', with ' . your prices' when any override applies.
export const chipSecondLine = (exact, baselineName, hasOverrides) =>
  `${exact < 0 ? 'less than' : 'more than'} ${baselineName}${hasOverrides ? ' . your prices' : ''} . details ->`
