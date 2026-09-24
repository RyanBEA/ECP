/**
 * Resolve all intermediate calculation values from a below-grade (foundation) wall selection.
 *
 * Wraps ecpData.js calculateBelowGradeAssembly() and adds the working the Excel export
 * needs: the parallel-path inputs for the frame layer (stud depth, stud RSI, cavity RSI,
 * framing / cavity %), the structural layer inputs (concrete mm, block, ICF forms), the
 * points and the code-minimum check. Returns null whenever the assembly is null.
 *
 * Framing data comes from the same sources the data layer uses: foundation-data.json
 * (basement stud wall and PWF cavity %, empty cavity, offset batt) and wall-data.json
 * (stud depths, cavity RSI by material and size).
 */

import wallData from '../data/generated/wall-data.json'
import icfData from '../data/generated/icf-data.json'
import foundationData from '../data/generated/foundation-data.json'
import { parallelPath } from '@scripts/compute.js'
import {
  calculateBelowGradeAssembly, getBelowGradePoints, foundationTypes, EMPTY_CAVITY, MIN_BELOW_GRADE_RSI,
  isBlownInMaterial,
} from '../data/ecpData'

const SOFTWOOD_RSI_PER_MM = 0.0085

// Cavity RSI does not depend on spacing, so the 16" wood table is the canonical lookup
// (same as ecpData.js).
const woodCavityEntries = wallData.wood.spacings['16'].materials

/**
 * Parallel-path working for the frame layer. Mirrors framedLayer() in ecpData.js; only
 * called once the assembly is known to be valid, so every lookup is expected to succeed.
 */
function resolveFrame(selection) {
  const isPwf = selection.foundationType === 'pwf'
  const spacing = isPwf ? selection.pwfSpacing : selection.studSpacing
  const cavityMaterial = isPwf ? selection.pwfCavityMaterial : selection.cavityMaterial
  const cavityType = isPwf ? selection.pwfCavityType : selection.cavityType
  const cavityPctByKey = isPwf ? foundationData.pwf.cavity_pct : foundationData.interior_stud_wall.cavity_pct
  const cavityPct = cavityPctByKey[spacing?.replace('"', '')]

  let stud, cavityRsi, resolvedType = null, offset = false
  if (cavityMaterial === EMPTY_CAVITY) {
    stud = selection.studDepth
    cavityRsi = foundationData.interior_stud_wall.empty_cavity_rsi
  } else {
    const entries = woodCavityEntries[cavityMaterial] || {}
    const key = isBlownInMaterial(cavityMaterial) ? (isPwf ? selection.pwfStud : (selection.studDepth || cavityType)) : cavityType
    const entry = entries[key]
    if (!entry) return null
    stud = entry.stud
    cavityRsi = entry.cavityRsi
    resolvedType = key
    const offsetRsi = foundationData.interior_stud_wall.offset_cavity_rsi[key]
    if (!isPwf && selection.studOffset && offsetRsi) {
      cavityRsi = offsetRsi
      offset = true
    }
  }

  const studDepthMm = wallData.wood.studs[stud]?.depth_mm
  if (!studDepthMm || !cavityRsi || !cavityPct) return null
  const studRsi = studDepthMm * SOFTWOOD_RSI_PER_MM

  return {
    stud,
    spacing,
    studDepthMm,
    studRsi,
    cavityMaterial,
    cavityType: resolvedType,
    cavityRsi,
    cavityPct,
    framingPct: 100 - cavityPct,
    offset,
    ppRsi: parallelPath(studRsi, cavityRsi, cavityPct),
  }
}

/** One-line description of the structural wall for the sheet header. */
function describeStructure(selection, { concreteLabel, block, icf, frame }) {
  switch (selection.foundationType) {
    case 'concrete': return `${concreteLabel} poured concrete`
    case 'block': return `${block.thicknessMm} mm concrete block, ${block.label}`
    case 'icf': return `${icf.formLabel} EPS forms each side, ${Math.round(icf.concreteCoreMm)} mm concrete core`
    case 'pwf': return `Permanent wood foundation, ${frame.stud} @ ${frame.spacing}`
    default: return ''
  }
}

export function resolveFoundationData(selection) {
  const assembly = calculateBelowGradeAssembly(selection)
  if (!assembly) return null

  const { foundationType, concreteThickness, blockType, icfFormThickness, intInsThickness, finish } = selection
  const layerIds = assembly.layers.map(l => l.id)

  // Structural layer working
  let concrete = null, concreteLabel = null, block = null, icf = null
  if (foundationType === 'concrete') {
    const c = foundationData.concrete.thicknesses.find(t => t.id === concreteThickness)
    concrete = { mm: c.mm, rsiPerMm: foundationData.concrete.rsi_per_mm }
    concreteLabel = c.label
  } else if (foundationType === 'block') {
    const b = foundationData.block.options.find(o => o.id === blockType)
    block = { id: b.id, label: b.label, thicknessMm: foundationData.block.thickness_mm, rsi: b.rsi }
  } else if (foundationType === 'icf') {
    const form = icfData.forms.find(f => f.label === icfFormThickness)
    icf = {
      formLabel: form.label,
      formThicknessMm: form.thickness_mm,
      epsRsiPerMm: icfData.eps_rsi_per_mm,
      concreteCoreMm: icfData.concrete_core_mm,
      concreteRsiPerMm: icfData.concrete_rsi_per_mm,
    }
  }

  // Frame working (basement stud wall or PWF)
  const hasFrameLayer = layerIds.includes('frame')
  const frame = hasFrameLayer ? resolveFrame(selection) : null
  // The data layer validated the frame, so this only fails if the two drift apart. Return
  // null rather than hand the sheet builder a frame layer with no working rows.
  if (hasFrameLayer && !frame) return null

  // Finish: forced to gypsum for ICF and whenever interior insulation is present (9.10.17.10)
  const hasIntIns = layerIds.includes('int_ins')
  const finishForced = foundationType === 'icf' || hasIntIns
  const hasFinish = layerIds.includes('finish')
  const finishLabel = hasFinish ? foundationData.finish.gypsum.label : 'None'

  const totalRsi = assembly.total
  const roundedRsi = Math.round(totalRsi * 100) / 100

  const structure = describeStructure(selection, { concreteLabel, block, icf, frame })

  return {
    foundationType,
    foundationTypeLabel: foundationTypes.find(t => t.id === foundationType)?.label || foundationType,
    structure,
    spacing: frame ? frame.spacing : null,
    finishLabel,
    finishForced,
    finishSelected: finish || 'gypsum',
    intInsThickness: hasIntIns ? intInsThickness : null,
    layers: assembly.layers,
    concrete,
    block,
    icf,
    frame,
    totalRsi,
    roundedRsi,
    points: getBelowGradePoints(totalRsi),
    minRsi: MIN_BELOW_GRADE_RSI,
    meetsMinimum: roundedRsi >= MIN_BELOW_GRADE_RSI,
  }
}
