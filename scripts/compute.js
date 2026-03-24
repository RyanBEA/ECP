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
