// Baseline presets (spec 6.1). Data only; revisable without touching logic.
import { categories, getWallPoints, calculateWallRsi } from '../data/ecpData'
import { assumedWallSelection } from './assumedAssemblies'

export const BASELINE_NAMES = { codeMinimum: 'Code minimum', typicalTier2: 'Typical Tier 2', usualHouse: 'Your usual house' }

const CODE_MINIMUM = {
  cards: { belowGradeWalls: 2.98, windowsDoors: 1.61, airTightness: 'untested', hrv: 60, dhwElectric: 'electricStorage' },
  wall: { kind: 'level', rsi: 2.97 },
}
const TYPICAL_DETACHED = {
  cards: { belowGradeWalls: 3.46, windowsDoors: 1.61, airTightness: 'untested', hrv: 65, dhwElectric: 'electricStorage' },
  wall: { kind: 'assembly', selection: assumedWallSelection(3.96) },   // 2x6 R24 + 1 in XPS, 7.7 pts
}
const TYPICAL_MINI = {
  cards: { windowsDoors: 1.61, airTightness: 2.0, hrv: 65, dhwElectric: 'electricStorage' },  // no foundation wall
  wall: { kind: 'assembly', selection: assumedWallSelection(3.96) },
}

export const BASELINE_PRESETS = {
  codeMinimum: {
    name: BASELINE_NAMES.codeMinimum,
    describe: 'NBC 2020 as adopted in Nova Scotia, every card at its minimum. Not a compliant house since April 2026; a reference point.',
    picks: { singleDetached: CODE_MINIMUM, rowHome: CODE_MINIMUM, miniHome: CODE_MINIMUM },
  },
  typicalTier2: {
    name: BASELINE_NAMES.typicalTier2,
    describe: "BEA's assumption of how Nova Scotia builders reach 10 points today.",
    picks: { singleDetached: TYPICAL_DETACHED, rowHome: TYPICAL_DETACHED, miniHome: TYPICAL_MINI },
  },
}

export function getPresetPicks(presetId, archetypeType) {
  const p = BASELINE_PRESETS[presetId]?.picks[archetypeType]
  return p ? { cards: { ...p.cards }, wall: p.wall ? { ...p.wall } : null } : null
}

// Points a set of picks earns on main's tables (preset-only values earn 0)
export function cardPoints(categoryId, value) {
  const cat = categories.find(c => c.id === categoryId)
  const opt = cat?.options.find(o => o.value === value)
  return opt ? opt.points : 0
}
export function wallPoints(wall) {
  if (!wall) return 0
  if (wall.kind === 'level') return getWallPoints(wall.rsi)
  return getWallPoints(calculateWallRsi(wall.selection))
}
export function presetPoints(picks) {
  const cards = Object.entries(picks.cards).reduce((s, [id, v]) => s + cardPoints(id, v), 0)
  return cards + wallPoints(picks.wall)
}
