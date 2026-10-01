import { ARCHETYPES, getArchetype, HOUSE_FIELD_KEYS, VISIBLE_FIELD_KEYS } from './archetypes'

describe('archetypes', () => {
  it('has the three types with every field', () => {
    expect(ARCHETYPES.map(a => a.type)).toEqual(['singleDetached', 'rowHome', 'miniHome'])
    for (const a of ARCHETYPES) {
      for (const k of HOUSE_FIELD_KEYS) expect(a.fields).toHaveProperty(k)
    }
  })
  it('mini-home has no foundation wall and row home has two party walls', () => {
    expect(getArchetype('miniHome').fields.foundationHeightFt).toBe(0)
    expect(getArchetype('rowHome').fields.partyWalls).toBe(2)
    expect(getArchetype('singleDetached').fields.partyWalls).toBe(0)
  })
  it('visible keys are the first five', () => {
    expect(VISIBLE_FIELD_KEYS).toEqual(['storeys', 'lengthFt', 'widthFt', 'glazingRatio', 'bedrooms'])
  })
  it('returns null for an unknown type', () => {
    expect(getArchetype('castle')).toBeNull()
  })
})
