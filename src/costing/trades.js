// Trade mapping for variant B: which trade does each priced component belong to, per category.
// Data only. A component id a category lists nowhere here falls to OTHER, so no money is dropped.
export const TRADES = [
  { id: 'framer', label: 'Framer', covers: { aboveGroundWalls: ['framing', 'sheathing', 'strapping', 'continuous_insulation', 'double_stud_plate'], windowsDoors: ['windows', 'doors'] }, sub: { windowsDoors: 'windows and doors, supplied and installed' } },
  { id: 'insulator', label: 'Insulator', covers: { aboveGroundWalls: ['cavity_insulation'] } },
  { id: 'drywaller', label: 'Drywaller', covers: { aboveGroundWalls: ['interior_finish', 'air_vapour_barrier'] } },
  { id: 'siding', label: 'Siding', covers: { aboveGroundWalls: ['cladding'] } },
  { id: 'plumber', label: 'Plumber', covers: { dhw: ['water_heater', 'condensate_drain', 'venting', 'gas_branch'] } },
  { id: 'electrician', label: 'Electrician', covers: { dhw: ['receptacle_120v', 'circuit_240v'] } },
  { id: 'hvac', label: 'HVAC contractor', covers: { hrv: ['hrv'] } },
  { id: 'airSealer', label: 'Air sealer', covers: { airTightness: ['airtightness'] } },
  { id: 'foundation', label: 'Foundation contractor', covers: { belowGradeWalls: ['foundation_assembly'] } },
]
export const OTHER = { id: 'other', label: 'Other' }

export function tradeFor(categoryId, component) {
  return TRADES.find(t => t.covers[categoryId]?.includes(component)) || OTHER
}
