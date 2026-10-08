// src/optimize/considerText.js
// The "Considering: ..." sentence on screen 2 (Capability 2 spec 5.2).
import { LEVER_CARDS, CARD_NAMES, cardOptions } from './candidates'

const WALL_SHORT = { thickFoam: 'thick-foam walls', largeStuds: 'larger-stud walls', serviceCavity: 'service-cavity walls', doubleStud: 'double-stud walls' }
const OPTION_SHORT = {
  windowsDoors: v => `U ${v} windows`,
  airTightness: v => (v === 'untested' ? 'untested airtightness' : `${v} ACH50`),
  belowGradeWalls: v => `below-grade RSI ${v}`,
  hrv: v => `the ${v}% HRV`,
  dhw: v => ({ electricStorage: 'the electric storage tank', 2.35: 'the heat pump water heater', 0.79: 'the UEF 0.79 gas tank', 0.83: 'the UEF 0.83 gas tank', 0.85: 'the UEF 0.85 gas tank', 0.92: 'the gas tankless' })[v] ?? String(v),
}

function joinWords(parts) {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

export function considerSummary(consider) {
  const parts = []
  for (const cardId of LEVER_CARDS) {
    const all = cardOptions(cardId)
    const off = all.filter(o => !consider[cardId].has(o.value))
    if (off.length === 0) continue
    if (cardId !== 'aboveGroundWalls' && off.length === all.length) { parts.push(`${CARD_NAMES[cardId].toLowerCase()} (left out)`); continue }
    for (const o of off) parts.push(cardId === 'aboveGroundWalls' ? WALL_SHORT[o.value] : OPTION_SHORT[cardId](o.value))
  }
  return parts.length === 0 ? 'everything' : `everything except ${joinWords(parts)}`
}
