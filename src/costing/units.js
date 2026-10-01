// Unit conversion and display rounding for the cost layer.
// Everything is computed in metric; the Cost tab displays imperial (spec 1.2).

export const FT_PER_M = 3.280839895
export const SQFT_PER_M2 = 10.76391042

export const ftToM = ft => ft / FT_PER_M
export const mToFt = m => m * FT_PER_M
export const m2ToSqFt = m2 => m2 * SQFT_PER_M2
export const sqFtToM2 = sqft => sqft / SQFT_PER_M2
export const perM2ToPerSqFt = x => x / SQFT_PER_M2

// Display rounding (spec 7.1). 500 while stand-in prices are in use; 100 with real data.
export const ROUNDING_UNIT = 500

export function roundDisplay(dollars) {
  return Math.round(dollars / ROUNDING_UNIT) * ROUNDING_UNIT
}

const money = n => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

// '+$8,500', '-$500', '< $500' (non-zero but under half a unit), '$0' (exactly zero)
export function formatDelta(dollars) {
  if (dollars === 0) return '$0'
  const rounded = roundDisplay(dollars)
  if (rounded === 0) return `< ${money(ROUNDING_UNIT)}`
  return (rounded > 0 ? '+' : '-') + money(Math.abs(rounded))
}
