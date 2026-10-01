// Selection logic shared by Points and the baseline editor (spec 5). Pure functions over the index-based
// `selections` shape App.jsx already uses, plus conversion to and from the by-value picks shape (spec 5.1).
import { categories, calculateWallRsi, getWallPoints } from '../data/ecpData'

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

export function totalCardPoints(selections) {
  return Object.entries(selections).reduce((sum, [id, idx]) => sum + (idx === null ? 0 : cat(id)?.options[idx]?.points ?? 0), 0)
}

export function wallPointsFor(wallSelection) {
  const ws = wallSelection || {}
  if (ws.simpleIndex !== undefined && ws.simpleIndex !== null) return cat('aboveGroundWalls').options[ws.simpleIndex].points
  return getWallPoints(calculateWallRsi(ws))
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

// editor state -> picks (by value). A picked option replaces the card's preset-only value.
export function selectionsToPicks(selections, wallSelection, presetOnly = {}) {
  const cards = {}
  for (const [id, value] of Object.entries(presetOnly)) if (id !== 'aboveGroundWalls') cards[id] = value
  for (const [id, idx] of Object.entries(selections)) { const v = cat(id)?.options[idx]?.value; if (v !== undefined) cards[id] = v }
  const ws = wallSelection || {}
  let wall = null
  if (ws.simpleIndex !== undefined && ws.simpleIndex !== null) wall = { kind: 'level', rsi: cat('aboveGroundWalls').options[ws.simpleIndex].value }
  else if (ws.wallType) wall = { kind: 'assembly', selection: ws }
  else if (presetOnly.aboveGroundWalls !== undefined) wall = { kind: 'level', rsi: presetOnly.aboveGroundWalls }
  return { cards, wall }
}
