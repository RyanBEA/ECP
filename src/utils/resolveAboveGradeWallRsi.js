import { categories, calculateWallRsi } from '../data/ecpData'

// Resolve the effective above-grade wall RSI for EITHER input mode of WallBuilder:
// - simple mode: wallSelection.simpleIndex picks an aboveGroundWalls option whose
//   `value` is the RSI (minRsi threshold).
// - builder mode: calculateWallRsi computes the assembly RSI.
// Always returns a number (0 when nothing valid is selected) — never null.
export function resolveAboveGradeWallRsi(wallSelection = {}) {
  if (wallSelection.simpleIndex != null) {
    const cat = categories.find(c => c.id === 'aboveGroundWalls')
    const v = cat?.options?.[wallSelection.simpleIndex]?.value
    return typeof v === 'number' ? v : 0
  }
  const rsi = calculateWallRsi(wallSelection)
  return typeof rsi === 'number' && rsi > 0 ? rsi : 0
}
