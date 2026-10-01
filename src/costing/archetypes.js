// House archetypes (spec 6.2). Placeholder geometry until checked against NS data.
// Every value is editable on the Cost tab; the last five are the hidden "More about this house" group.

export const HOUSE_FIELD_KEYS = [
  'storeys', 'lengthFt', 'widthFt', 'glazingRatio', 'bedrooms',
  'storeyHeightFt', 'foundationHeightFt', 'doors', 'partyWalls', 'waterHeaterGal',
]
export const VISIBLE_FIELD_KEYS = HOUSE_FIELD_KEYS.slice(0, 5)

export const ARCHETYPES = [
  {
    type: 'singleDetached', name: 'Single detached',
    fields: { storeys: 2, lengthFt: 33, widthFt: 30, glazingRatio: 0.17, bedrooms: 3,
      storeyHeightFt: 9, foundationHeightFt: 8, doors: 2, partyWalls: 0, waterHeaterGal: 50 },
  },
  {
    type: 'rowHome', name: 'Row home',
    fields: { storeys: 2, lengthFt: 36, widthFt: 20, glazingRatio: 0.15, bedrooms: 3,
      storeyHeightFt: 9, foundationHeightFt: 8, doors: 1, partyWalls: 2, waterHeaterGal: 40 },
  },
  {
    type: 'miniHome', name: 'Mini-home',
    fields: { storeys: 1, lengthFt: 66, widthFt: 16, glazingRatio: 0.12, bedrooms: 3,
      storeyHeightFt: 9, foundationHeightFt: 0, doors: 2, partyWalls: 0, waterHeaterGal: 40 },
  },
]

export function getArchetype(type) {
  return ARCHETYPES.find(a => a.type === type) ?? null
}
