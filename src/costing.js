// Costing — pure module. Computes the incremental $ of the envelope/mechanical
// upgrades selected on the Prescriptive tab, relative to the base.h2k baseline,
// scaling envelope costs by geometry-derived areas. No React; fully testable.
//
// Geometry constants are mirrored from server/src/perf_server/mutations.py.
// SOURCE OF TRUTH: mutations.py / server/GEOMETRY_XPATHS.md. If base.h2k is
// regenerated, re-verify these three constants against that file.
const WALL_HEIGHT_SUM_M = 5.05          // main 2.6 + second 2.45
const DOOR_AREA_M2 = 3.528              // 2 doors, fixed (not scaled)
const BELOW_GRADE_WALL_HEIGHT_M = 2.3   // basement wall height

// Derive the areas the cost table needs, replicating mutations.geometry_mutations.
// windowArea may be <= 0 when FDWR is too low to fit the door; callers guard.
export function deriveAreas({ length_m, width_m, fdwr }) {
  const L = Number(length_m) || 0
  const W = Number(width_m) || 0
  const f = Number(fdwr) || 0
  const perimeter = 2 * (L + W)
  const grossAboveWall = perimeter * WALL_HEIGHT_SUM_M
  const fda = f * grossAboveWall              // fenestration + door area
  const windowArea = fda - DOOR_AREA_M2
  const netAboveWall = grossAboveWall - fda   // opaque above-grade wall
  const belowGradeWall = perimeter * BELOW_GRADE_WALL_HEIGHT_M
  return { perimeter, grossAboveWall, fda, windowArea, netAboveWall, belowGradeWall }
}
