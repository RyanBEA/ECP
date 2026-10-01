// The memoised cost hook (spec 7.5): quantities, the priced design, the priced baseline, the delta and the
// override count. All synchronous; no loading state.
import { useMemo } from 'react'
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

// A usual house is per type (M6); with none saved for this type, compare with Typical Tier 2.
export function resolveBaselinePicks(baselineChoice, houseType, usualHouse) {
  if (baselineChoice === 'usualHouse' && usualHouse?.[houseType]) return { name: BASELINE_NAMES.usualHouse, picks: usualHouse[houseType], id: 'usualHouse' }
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
