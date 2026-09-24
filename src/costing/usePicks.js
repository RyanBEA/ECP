// Selection logic shared by Points and the baseline editor (spec 5). Pure functions over the index-based
// `selections` shape App.jsx already uses, plus conversion to and from the by-value picks shape (spec 5.1).
import { categories, calculateWallRsi, getWallPoints, calculateBelowGradeRsi, getBelowGradePoints } from '../data/ecpData'

const cat = id => categories.find(c => c.id === id)

// Same behaviour as main's App.jsx handleSelect: picking a card in an exclusive group (the two DHW cards)
// clears the other members; null clears the card.
export function applySelect(selections, categoryId, optionIndex) {
  const category = cat(categoryId)
  const next = { ...selections }
  if (category?.exclusiveGroup) {
    categories.filter(c => c.exclusiveGroup === category.exclusiveGroup && c.id !== categoryId).forEach(c => delete next[c.id])
  }
  if (optionIndex === null) delete next[categoryId]
  else next[categoryId] = optionIndex
  return next
}

// Same behaviour as main's App.jsx isDisabled: disabled while another member of its exclusive group is picked.
export function isCategoryDisabled(selections, category) {
  if (!category.exclusiveGroup) return false
  return categories.filter(c => c.exclusiveGroup === category.exclusiveGroup && c.id !== category.id).some(c => selections[c.id] !== undefined)
}

// Main's App.jsx totalPoints card sum, verbatim in behaviour (App uses it for Points, ruling R45).
export function totalCardPoints(selections) {
  return Object.entries(selections).reduce((sum, [categoryId, optionIndex]) => {
    const category = cat(categoryId)
    if (category && category.options && optionIndex !== null) return sum + category.options[optionIndex].points
    return sum
  }, 0)
}

// Main's App.jsx wallPoints.
export function wallPointsFor(wallSelection) {
  const ws = wallSelection || {}
  if (ws.simpleIndex !== undefined && ws.simpleIndex !== null) return cat('aboveGroundWalls').options[ws.simpleIndex].points
  return getWallPoints(calculateWallRsi(ws))
}

// Below-grade wall builder points (simple or builder mode), parallel to wallPointsFor.
export function belowGradePointsFor(belowGradeSelection) {
  const s = belowGradeSelection || {}
  if (s.simpleIndex !== undefined && s.simpleIndex !== null) return cat('belowGradeWalls').options[s.simpleIndex].points
  return getBelowGradePoints(calculateBelowGradeRsi(s))
}

// The below-grade builder keeps its own selection (like the wall builder), but the cost and optimize code read
// the belowGradeWalls card from `selections` as an option index. Simple mode is that index; builder mode is the
// highest option the assembly's 2-decimal RSI meets (the same rounding as its points). Below the code minimum,
// or an assembly not yet complete, is no pick.
export function belowGradeIndexFor(belowGradeSelection) {
  const s = belowGradeSelection || {}
  if (s.simpleIndex !== undefined && s.simpleIndex !== null) return s.simpleIndex
  const rsi = calculateBelowGradeRsi(s)
  if (!rsi) return undefined
  const r = Math.round(rsi * 100) / 100
  let idx
  cat('belowGradeWalls').options.forEach((o, i) => { if (r >= o.value) idx = i })
  return idx
}

// `selections` with the below-grade builder's pick folded in as the belowGradeWalls card, for the cost and
// optimize code. Returns `selections` itself when there is no below-grade pick.
export function withBelowGrade(selections, belowGradeSelection) {
  const idx = belowGradeIndexFor(belowGradeSelection)
  if (idx === undefined) {
    if (selections.belowGradeWalls === undefined) return selections
    const { belowGradeWalls: _drop, ...rest } = selections
    return rest
  }
  return { ...selections, belowGradeWalls: idx }
}

// picks (by value) -> what the cards can show. Values with no option index go to presetOnly.
export function picksToSelections(picks) {
  const selections = {}, presetOnly = {}
  for (const [id, value] of Object.entries(picks.cards || {})) {
    const idx = cat(id)?.options.findIndex(o => o.value === value) ?? -1
    if (idx >= 0) selections[id] = idx; else presetOnly[id] = value
  }
  let wallSelection = {}
  if (picks.wall?.kind === 'assembly') wallSelection = { ...picks.wall.selection }
  else if (picks.wall?.kind === 'level') {
    const idx = cat('aboveGroundWalls').options.findIndex(o => o.value === picks.wall.rsi)
    if (idx >= 0) wallSelection = { simpleIndex: idx }; else presetOnly.aboveGroundWalls = picks.wall.rsi
  }
  return { selections, wallSelection, presetOnly }
}

// A selected card's exclusive-group siblings (e.g. dhwElectric when dhwGas is picked).
function siblingsOfSelected(selections) {
  const out = new Set()
  for (const [id, idx] of Object.entries(selections)) {
    const g = cat(id)?.exclusiveGroup
    if (!g || cat(id).options[idx]?.value === undefined) continue
    categories.filter(c => c.exclusiveGroup === g && c.id !== id).forEach(c => out.add(c.id))
  }
  return out
}

// editor state -> picks (by value). A picked option replaces the card's preset-only value, and drops the
// preset-only values of the other members of its exclusive group (ruling R31).
export function selectionsToPicks(selections, wallSelection, presetOnly = {}) {
  const cards = {}
  const dropped = siblingsOfSelected(selections)
  for (const [id, value] of Object.entries(presetOnly)) if (id !== 'aboveGroundWalls' && !dropped.has(id)) cards[id] = value
  for (const [id, idx] of Object.entries(selections)) { const v = cat(id)?.options[idx]?.value; if (v !== undefined) cards[id] = v }
  const ws = wallSelection || {}
  let wall = null
  if (ws.simpleIndex !== undefined && ws.simpleIndex !== null) wall = { kind: 'level', rsi: cat('aboveGroundWalls').options[ws.simpleIndex].value }
  else if (ws.wallType) wall = { kind: 'assembly', selection: ws }
  else if (presetOnly.aboveGroundWalls !== undefined) wall = { kind: 'level', rsi: presetOnly.aboveGroundWalls }
  return { cards, wall }
}
