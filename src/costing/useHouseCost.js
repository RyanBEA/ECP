// The memoised cost hook (spec 7.5): quantities, the priced design, the priced baseline, the delta and the
// override count. All synchronous; no loading state.
import { useMemo } from 'react'
import { categories } from '../data/ecpData'
import { getArchetype } from './archetypes'
import { computeQuantities, quantitySentences } from './quantities'
import { getPresetPicks, BASELINE_NAMES } from './baselines'
import { priceHouse, designPicks, appliedOverrideKeys } from './priceHouse'
import { computeDelta } from './delta'

// Archetype defaults with this type's saved field overrides on top. Extra keys (e.g. designedAirflowLs)
// pass through.
export function resolveHouseFields(houseType, fieldOverrides) {
  return { ...getArchetype(houseType).fields, ...(fieldOverrides?.[houseType] || {}) }
}

// A missing baseline pick means the preset value (spec 5.1, ruling R32): fill missing cards and a missing wall
// from Typical Tier 2 for the type. A card whose exclusive-group sibling is present is not filled. Returns a new
// object; the stored usual house is left as it is.
export function fillFromTypical(usual, houseType) {
  const typical = getPresetPicks('typicalTier2', houseType)
  const cards = { ...(usual.cards || {}) }
  for (const [id, value] of Object.entries(typical.cards)) {
    if (cards[id] !== undefined) continue
    const g = categories.find(c => c.id === id)?.exclusiveGroup
    if (g && categories.some(c => c.exclusiveGroup === g && c.id !== id && cards[c.id] !== undefined)) continue
    cards[id] = value
  }
  return { ...usual, cards, wall: usual.wall ?? typical.wall }
}

// A usual house is per type (M6); with none saved for this type, compare with Typical Tier 2.
export function resolveBaselinePicks(baselineChoice, houseType, usualHouse) {
  if (baselineChoice === 'usualHouse' && usualHouse?.[houseType]) return { name: BASELINE_NAMES.usualHouse, picks: fillFromTypical(usualHouse[houseType], houseType), id: 'usualHouse' }
  const id = baselineChoice === 'usualHouse' ? 'typicalTier2' : baselineChoice
  return { name: BASELINE_NAMES[id], picks: getPresetPicks(id, houseType), id }
}

export function useHouseCost({ selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides, frozenOrder }) {
  return useMemo(() => {
    const quantities = computeQuantities(houseFields)
    const sentences = quantitySentences(quantities, houseFields)
    const { name: baselineName, picks: baselinePicks, id: baselineId } = resolveBaselinePicks(baselineChoice, houseType, usualHouse)
    const design = priceHouse(designPicks(selections, wallSelection), quantities, overrides, 'design')
    const baseline = priceHouse(baselinePicks, quantities, overrides, 'baseline')
    const delta = computeDelta(design, baseline, baselineName, frozenOrder)
    // Ruling R26: a 'both' override applied on both sides counts once.
    const overrideCount = new Set([...appliedOverrideKeys(design), ...appliedOverrideKeys(baseline)]).size
    return { quantities, sentences, design, baseline, baselinePicks, baselineName, baselineId, delta, overrideCount }
  }, [selections, wallSelection, houseType, houseFields, baselineChoice, usualHouse, overrides, frozenOrder])
}
