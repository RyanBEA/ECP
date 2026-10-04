// Test support (not a test): a priced design and baseline for given picks, through the real modules.
import { resolveHouseFields } from '../useHouseCost'
import { computeQuantities, quantitySentences } from '../quantities'
import { priceHouse, designPicks } from '../priceHouse'
import { getPresetPicks, BASELINE_NAMES } from '../baselines'
import { computeDelta } from '../delta'
import { getArchetype } from '../archetypes'

export function scenario({ selections = {}, wallSelection = {}, houseType = 'singleDetached', fields = {}, overrides = {}, baselineId = 'typicalTier2' } = {}) {
  const houseFields = resolveHouseFields(houseType, { [houseType]: fields })
  const quantities = computeQuantities(houseFields)
  const dp = designPicks(selections, wallSelection)
  const bp = getPresetPicks(baselineId, houseType)
  const baselineName = BASELINE_NAMES[baselineId]
  const delta = computeDelta(priceHouse(dp, quantities, overrides, 'design'), priceHouse(bp, quantities, overrides, 'baseline'), baselineName)
  const ctx = { baselineName, quantities, houseFields, designPicks: dp, baselinePicks: bp, typeName: getArchetype(houseType).name }
  return { ctx, sentences: quantitySentences(quantities, houseFields), line: id => delta.lines.find(l => l.categoryId === id) }
}
