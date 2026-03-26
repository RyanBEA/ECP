/**
 * Compute module — wall assembly RSI calculations.
 *
 * Implements the exact formulas from RSI-calc.xlsx.
 * Used by the build pipeline AND compiled into the React bundle.
 */

/**
 * Parallel-path effective RSI for a framed layer (stud + cavity).
 *
 * Formula: W = 100 / ((100 - cavity_pct) / stud_rsi + cavity_pct / cavity_rsi)
 *
 * @param {number} studRsi - RSI of the stud (wood: depth_mm * 0.0085)
 * @param {number} cavityRsi - RSI of the cavity insulation
 * @param {number} cavityPct - Cavity area percentage (e.g. 77 for 16" OC wood)
 * @returns {number} Effective RSI of the stud-cavity layer
 */
export function parallelPath(studRsi, cavityRsi, cavityPct) {
  const framingPct = 100 - cavityPct
  return 100 / (framingPct / studRsi + cavityPct / cavityRsi)
}

/**
 * Boundary layer series sum.
 *
 * @param {object} boundary - { outside_air, cladding, sheathing, drywall, inside_air }
 * @param {object} [options] - { air_space, contInsRsi }
 * @returns {number} Total boundary RSI
 */
export function boundarySum(boundary, options = {}) {
  return (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + (boundary.sheathing || 0)
    + (options.air_space || 0)
    + (options.contInsRsi || 0)
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)
}

/**
 * Total RSI for a wood-framed wall assembly.
 *
 * RSI = boundary_layers + parallel_path(stud, cavity) + cont_ins
 *
 * @param {object} params
 * @param {number} params.studDepthMm - Stud depth in mm
 * @param {number} params.cavityRsi - Cavity insulation RSI
 * @param {number} params.cavityPct - Cavity area percentage
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} [params.contInsRsi=0] - Continuous insulation RSI
 * @returns {number} Total effective RSI
 */
export function woodWallRsi({ studDepthMm, cavityRsi, cavityPct, boundary, contInsRsi = 0 }) {
  const studRsi = studDepthMm * 0.0085
  const wPp = parallelPath(studRsi, cavityRsi, cavityPct)
  return boundarySum(boundary, { contInsRsi }) + wPp
}

/**
 * Look up NBC 2020 Table A-9.36.2.4.(1)-B K1/K2 values for steel.
 *
 * @param {number} spacingInches - Stud spacing in inches (16, 19, or 24)
 * @param {boolean} hasInsulatingSheathing - Whether continuous exterior insulation is present
 * @returns {{ k1: number, k2: number }}
 */
export function steelKValues(spacingInches, hasInsulatingSheathing) {
  const spacingMm = spacingInches * 25.4
  if (spacingMm >= 500) {
    return { k1: 0.50, k2: 0.50 }
  }
  if (hasInsulatingSheathing) {
    return { k1: 0.40, k2: 0.60 }
  }
  return { k1: 0.33, k2: 0.67 }
}

/**
 * Compute steel cavity percentage from stud spacing and web thickness.
 *
 * Per NBC 2020 Table A-9.36.2.4.(1)-C Notes: "If the actual % areas of
 * framing and cavity are known, those should be used rather than the ones
 * in this Table." The web thickness of 18-gauge steel is 0.125" (3.175mm).
 *
 * @param {number} spacingInches - Stud spacing in inches
 * @returns {number} Cavity area percentage
 */
export function steelCavityPct(spacingInches) {
  const webThicknessIn = 0.125
  return (spacingInches - webThicknessIn) * 100 / spacingInches
}

/**
 * Total RSI for a steel-framed wall assembly.
 *
 * NBC 2020 A-9.36.2.4.(1): RSI_eff = K1 × RSI_T1 + K2 × RSI_T3
 *   RSI_T1 = full-assembly parallel-path (boundary layers in both stud and cavity paths)
 *   RSI_T2 = stud-cavity parallel-path only
 *   RSI_T3 = RSI_T2 + boundary layers in series
 *   K1, K2 from Table B (depends on spacing and insulating sheathing)
 *   Cavity percentages from Table C (depends on spacing)
 *
 * @param {object} params
 * @param {number} params.studDepthMm - Steel stud depth in mm
 * @param {number} params.cavityRsi - Cavity insulation RSI
 * @param {number} params.spacingInches - Stud spacing in inches
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} params.airSpace - Air space RSI (typically 0.18)
 * @param {number} [params.contInsRsi=0] - Continuous insulation RSI
 * @returns {number} Total effective RSI
 */
export function steelWallRsi({
  studDepthMm,
  cavityRsi,
  spacingInches,
  boundary,
  airSpace,
  contInsRsi = 0,
}) {
  const studRsi = studDepthMm * 0.0000161
  const cavityPct = steelCavityPct(spacingInches)
  const framingPct = 100 - cavityPct
  const hasInsulatingSheathing = contInsRsi > 0
  const { k1, k2 } = steelKValues(spacingInches, hasInsulatingSheathing)

  // Boundary sum for steel (includes air space and sheathing)
  const bSum = (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + (boundary.sheathing || 0)
    + (airSpace || 0)
    + (contInsRsi || 0)
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)

  // RSI_T1: full assembly parallel-path (all layers in stud and cavity paths)
  const tStud = bSum + studRsi
  const tCavity = bSum + cavityRsi
  const rsiT1 = 100 / (framingPct / tStud + cavityPct / tCavity)

  // RSI_T2: stud-cavity parallel-path only
  const rsiT2 = parallelPath(studRsi, cavityRsi, cavityPct)

  // RSI_T3: RSI_T2 + boundary layers in series
  const rsiT3 = bSum + rsiT2

  return k1 * rsiT1 + k2 * rsiT3
}

/**
 * Total RSI for an ICF wall assembly.
 *
 * Simple series sum: boundary + 2 * form_rsi + concrete_rsi
 *
 * @param {object} params
 * @param {number} params.formThicknessMm - EPS form thickness per side (mm)
 * @param {number} params.epsRsiPerMm - EPS RSI per mm (typically 0.026)
 * @param {number} params.concreteCoreMm - Concrete core thickness (mm)
 * @param {number} params.concreteRsiPerMm - Concrete RSI per mm (typically 0.0004)
 * @param {object} params.boundary - Boundary layer RSI values
 * @returns {number} Total effective RSI
 */
export function icfWallRsi({
  formThicknessMm,
  epsRsiPerMm,
  concreteCoreMm,
  concreteRsiPerMm,
  boundary,
}) {
  const formRsi = formThicknessMm * 2 * epsRsiPerMm
  const concreteRsi = concreteCoreMm * concreteRsiPerMm
  return (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + formRsi
    + concreteRsi
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)
}

/**
 * Total RSI for a staggered double stud wall.
 *
 * Two rows of studs on a wider plate, blown insulation fills everything.
 * Each stud row: parallel-path (penalizes bridging)
 * Gap between rows: isothermal plane (no bridging — continuous insulation)
 *
 * @param {object} params
 * @param {number} params.outerStudDepthMm - Outer stud row depth (mm)
 * @param {number} params.innerStudDepthMm - Inner stud row depth (mm)
 * @param {number} params.plateDepthMm - Total plate width (mm), determines gap
 * @param {number} params.cavityRsiPerMm - Blown insulation RSI per mm
 * @param {number} params.cavityPct - Cavity area percentage (same for both rows)
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} [params.contInsRsi=0] - Optional exterior continuous insulation
 * @returns {number} Total effective RSI
 */
export function doubleStudWallRsi({
  outerStudDepthMm,
  innerStudDepthMm,
  plateDepthMm,
  cavityRsiPerMm,
  cavityPct,
  boundary,
  contInsRsi = 0,
}) {
  const gapMm = plateDepthMm - outerStudDepthMm - innerStudDepthMm

  // Each stud row via parallel-path
  const outerStudRsi = outerStudDepthMm * 0.0085
  const outerCavityRsi = outerStudDepthMm * cavityRsiPerMm
  const outerPp = parallelPath(outerStudRsi, outerCavityRsi, cavityPct)

  const innerStudRsi = innerStudDepthMm * 0.0085
  const innerCavityRsi = innerStudDepthMm * cavityRsiPerMm
  const innerPp = parallelPath(innerStudRsi, innerCavityRsi, cavityPct)

  // Gap: continuous insulation (series, no bridging)
  const gapRsi = gapMm * cavityRsiPerMm

  return boundarySum(boundary, { contInsRsi }) + outerPp + gapRsi + innerPp
}

/**
 * Total RSI for a double wall (exterior wall + gap + interior wall).
 *
 * Each wall: parallel-path framed layer
 * Gap: isothermal plane (blown insulation, no bridging)
 *
 * @param {object} params
 * @param {number} params.outerStudDepthMm - Exterior wall stud depth (mm)
 * @param {number} params.outerCavityRsi - Exterior wall cavity insulation RSI
 * @param {number} params.outerCavityPct - Exterior wall cavity percentage
 * @param {number} params.innerStudDepthMm - Interior wall stud depth (mm)
 * @param {number} params.innerCavityRsi - Interior wall cavity insulation RSI
 * @param {number} params.innerCavityPct - Interior wall cavity percentage
 * @param {number} params.gapMm - Gap width in mm
 * @param {number} params.gapRsiPerMm - Gap insulation RSI per mm
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} [params.contInsRsi=0] - Optional exterior continuous insulation
 * @returns {number} Total effective RSI
 */
export function doubleWallRsi({
  outerStudDepthMm,
  outerCavityRsi,
  outerCavityPct,
  innerStudDepthMm,
  innerCavityRsi,
  innerCavityPct,
  gapMm,
  gapRsiPerMm,
  boundary,
  contInsRsi = 0,
}) {
  const outerStudRsi = outerStudDepthMm * 0.0085
  const outerPp = parallelPath(outerStudRsi, outerCavityRsi, outerCavityPct)

  const innerStudRsi = innerStudDepthMm * 0.0085
  const innerPp = parallelPath(innerStudRsi, innerCavityRsi, innerCavityPct)

  const gapRsi = gapMm * gapRsiPerMm

  return boundarySum(boundary, { contInsRsi }) + outerPp + gapRsi + innerPp
}
