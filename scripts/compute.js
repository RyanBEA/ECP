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
 * Total RSI for a steel-framed wall assembly.
 *
 * Uses modified zone method: RSI = k_iso * V_iso + k_pp * T_pp
 * where k_iso=0.4, k_pp=0.6 (from RSI-calc.xlsx)
 *
 * @param {object} params
 * @param {number} params.studDepthMm - Steel stud depth in mm
 * @param {number} params.cavityRsi - Cavity insulation RSI
 * @param {number} params.spacingInches - Stud spacing in inches
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} params.airSpace - Air space RSI (typically 0.18)
 * @param {number} [params.contInsRsi=0] - Continuous insulation RSI
 * @param {number} [params.kIso=0.4] - Isothermal planes weight
 * @param {number} [params.kPp=0.6] - Parallel-path weight
 * @returns {number} Total effective RSI
 */
export function steelWallRsi({
  studDepthMm,
  cavityRsi,
  spacingInches,
  boundary,
  airSpace,
  contInsRsi = 0,
  kIso = 0.4,
  kPp = 0.6,
}) {
  const studRsi = studDepthMm * 0.0000161
  const webThicknessIn = 0.125
  const cavityPct = (spacingInches - webThicknessIn) * 100 / spacingInches

  // Boundary sum for steel (includes air space, no sheathing typically)
  const bSum = (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + (airSpace || 0)
    + (contInsRsi || 0)
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)

  // Isothermal planes: full assembly as two parallel paths (stud path, cavity path)
  const tStud = bSum + studRsi
  const tCavity = bSum + cavityRsi
  const framingPct = 100 - cavityPct
  const vIso = 100 / (framingPct / tStud + cavityPct / tCavity)

  // Parallel-path: stud-cavity layer only, then add boundary in series
  const wPp = parallelPath(studRsi, cavityRsi, cavityPct)
  const tPp = bSum + wPp

  return kIso * vIso + kPp * tPp
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
