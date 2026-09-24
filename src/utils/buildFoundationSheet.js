/**
 * Build an Excel sheet with live formulas for a below-grade (foundation) wall RSI calculation.
 *
 * One layout for all four foundation types: header, one row per layer (outside to inside),
 * the parallel-path working under the frame layer, total, rounded total, code minimum,
 * Meets / Does not meet, points, then the notes. Row positions depend on which layers are
 * present, so formulas are built from the row numbers as they are written.
 */

import { belowGradePointsThresholds } from '../data/ecpData'

const HEADER_FONT = { bold: true, size: 14 }
const LABEL_FONT = { bold: true, size: 11 }
const SUB_FONT = { italic: true, size: 10, color: { argb: 'FF666666' } }
const TOTAL_FONT = { bold: true, size: 12 }
const NOTE_FONT = { size: 10 }
const SOURCE_FONT = { size: 9, color: { argb: 'FF888888' }, italic: true }
const RSI_FORMAT = '0.000'
const ROUNDED_FORMAT = '0.00'

const TABLE_D = 'NBC 2020 Table A-9.36.2.4.(1)-D'
const BASEMENT_FRAMING_SOURCE = 'NBC 2020 Table A-9.36.2.4.(1)-A (basement wall row)'
const PWF_FRAMING_SOURCE = 'NBC 2020 Table A-9.36.2.8.(1)-B'
const NOTE_A_SOURCE = 'NBC 2020 Note A-9.36.2.8.(1)'
const MIN_SOURCE = 'NBC 2020 Table 9.36.2.8.-B (Zone 6)'
const POINTS_SOURCE = 'NBC 2020 Table 9.36.8.7 (Zone 6)'

/** Column A label per layer id. The frame label depends on the foundation type. */
const LAYER_NAMES = {
  ext_ins: 'Exterior Insulation',
  pwf_sheathing: 'Exterior Sheathing',
  concrete: 'Concrete Wall',
  block: 'Concrete Block Wall',
  icf_forms: 'EPS Forms (x2 sides)',
  icf_core: 'Concrete Core',
  int_ins: 'Interior Insulation',
  frame: 'Stud Wall (parallel path)',
  finish: 'Interior Finish',
  inside_air: 'Interior Air Film',
}

function labelCell(sheet, ref, text, font = LABEL_FONT) {
  const cell = sheet.getCell(ref)
  cell.value = text
  cell.font = font
}

function rsiCell(sheet, ref, value, numFmt = RSI_FORMAT) {
  const cell = sheet.getCell(ref)
  cell.value = value
  cell.numFmt = numFmt
}

/** Formula cell with a cached result so viewers that do not recalculate still show a value. */
function formulaCell(sheet, ref, formula, result, numFmt = RSI_FORMAT) {
  const cell = sheet.getCell(ref)
  cell.value = { formula, result }
  if (numFmt) cell.numFmt = numFmt
}

function sourceCell(sheet, row, text) {
  if (!text) return
  const cell = sheet.getCell(`E${row}`)
  cell.value = text
  cell.font = SOURCE_FONT
}

function setColumnWidths(sheet) {
  sheet.getColumn('A').width = 30
  sheet.getColumn('B').width = 40
  sheet.getColumn('C').width = 22
  sheet.getColumn('D').width = 18
  sheet.getColumn('E').width = 45
}

/** Header block (rows 1-5). Row 4 is left empty when there is no frame. */
function writeHeader(sheet, data) {
  sheet.getCell('A1').value = 'Foundation Wall Assembly RSI Calculation'
  sheet.getCell('A1').font = HEADER_FONT
  sheet.mergeCells('A1:D1')

  labelCell(sheet, 'A2', 'Foundation Type')
  sheet.getCell('B2').value = data.foundationTypeLabel

  labelCell(sheet, 'A3', 'Structure')
  sheet.getCell('B3').value = data.structure

  if (data.spacing) {
    labelCell(sheet, 'A4', 'Stud Spacing')
    sheet.getCell('B4').value = data.spacing
  }

  labelCell(sheet, 'A5', 'ECP Points')
  sheet.getCell('B5').value = data.points
}

/**
 * Frame layer: the parallel-path row followed by its working rows.
 * Returns the row number after the last working row.
 */
function writeFrameRows(sheet, row, layer, data) {
  const { frame } = data
  const isPwf = data.foundationType === 'pwf'
  const ppRow = row
  const depthRow = row + 1
  const studRsiRow = row + 2
  const cavRsiRow = row + 3
  const cavPctRow = row + 4
  const frmPctRow = row + 5

  labelCell(sheet, `A${ppRow}`, isPwf ? 'PWF Stud Wall (parallel path)' : 'Stud Wall (parallel path)')
  sheet.getCell(`B${ppRow}`).value = layer.label
  sheet.getCell(`C${ppRow}`).value = '100/(frm%/studRsi + cav%/cavRsi)'
  formulaCell(sheet, `D${ppRow}`, `100/(D${frmPctRow}/D${studRsiRow}+D${cavPctRow}/D${cavRsiRow})`, layer.rsi)
  sourceCell(sheet, ppRow, 'NBC 2020 Note A-9.36.2.4.(1), parallel path')

  labelCell(sheet, `A${depthRow}`, ' Stud Depth (mm)', SUB_FONT)
  sheet.getCell(`B${depthRow}`).value = frame.stud
  sheet.getCell(`D${depthRow}`).value = frame.studDepthMm

  labelCell(sheet, `A${studRsiRow}`, ' Stud RSI', SUB_FONT)
  sheet.getCell(`C${studRsiRow}`).value = 'depth × 0.0085'
  formulaCell(sheet, `D${studRsiRow}`, `D${depthRow}*0.0085`, frame.studRsi)
  sourceCell(sheet, studRsiRow, `${TABLE_D} (softwood 0.0085 RSI/mm)`)

  labelCell(sheet, `A${cavRsiRow}`, ' Cavity Insulation RSI', SUB_FONT)
  sheet.getCell(`B${cavRsiRow}`).value = frame.cavityMaterial
  sheet.getCell(`C${cavRsiRow}`).value = frame.cavityType || (frame.cavityMaterial === 'None (empty)' ? 'air space' : '—')
  rsiCell(sheet, `D${cavRsiRow}`, frame.cavityRsi)
  sourceCell(sheet, cavRsiRow, frame.offset ? 'NBC 2020 Table A-9.36.2.8.(1)-A Note (3), batt held off the concrete' : TABLE_D)

  labelCell(sheet, `A${cavPctRow}`, ' Cavity %', SUB_FONT)
  sheet.getCell(`D${cavPctRow}`).value = frame.cavityPct
  sourceCell(sheet, cavPctRow, isPwf ? PWF_FRAMING_SOURCE : BASEMENT_FRAMING_SOURCE)

  labelCell(sheet, `A${frmPctRow}`, ' Framing %', SUB_FONT)
  formulaCell(sheet, `D${frmPctRow}`, `100-D${cavPctRow}`, frame.framingPct, null)

  return frmPctRow + 1
}

/** A continuous layer: static value, or a formula for the layers with a known mm x RSI/mm working. */
function writeLayerRow(sheet, row, layer, data) {
  labelCell(sheet, `A${row}`, LAYER_NAMES[layer.id] || layer.id)
  sheet.getCell(`B${row}`).value = layer.label

  switch (layer.id) {
    case 'concrete': {
      const { mm, rsiPerMm } = data.concrete
      sheet.getCell(`C${row}`).value = `${mm} mm × ${rsiPerMm}`
      formulaCell(sheet, `D${row}`, `${mm}*${rsiPerMm}`, layer.rsi)
      sourceCell(sheet, row, `${TABLE_D} (concrete 0.0004 RSI/mm)`)
      break
    }
    case 'icf_forms': {
      const { formThicknessMm, epsRsiPerMm } = data.icf
      sheet.getCell(`C${row}`).value = `${formThicknessMm} mm × 2 × ${epsRsiPerMm}`
      formulaCell(sheet, `D${row}`, `${formThicknessMm}*2*${epsRsiPerMm}`, layer.rsi)
      sourceCell(sheet, row, TABLE_D)
      break
    }
    case 'icf_core': {
      const { concreteCoreMm, concreteRsiPerMm } = data.icf
      sheet.getCell(`C${row}`).value = `${concreteCoreMm} mm × ${concreteRsiPerMm}`
      formulaCell(sheet, `D${row}`, `${concreteCoreMm}*${concreteRsiPerMm}`, layer.rsi)
      sourceCell(sheet, row, TABLE_D)
      break
    }
    case 'block':
      sheet.getCell(`C${row}`).value = `${data.block.thicknessMm} mm`
      rsiCell(sheet, `D${row}`, layer.rsi)
      sourceCell(sheet, row, TABLE_D)
      break
    case 'inside_air':
      rsiCell(sheet, `D${row}`, layer.rsi)
      sourceCell(sheet, row, `${TABLE_D}; ${NOTE_A_SOURCE}`)
      break
    default:
      rsiCell(sheet, `D${row}`, layer.rsi)
      sourceCell(sheet, row, TABLE_D)
  }
}

/** Points as a nested IF over the Zone 6 levels, highest first. */
function pointsFormula(ref) {
  const levels = [...belowGradePointsThresholds].sort((a, b) => b.minRsi - a.minRsi)
  return levels.reduceRight((inner, t) => `IF(${ref}>=${t.minRsi},${t.points},${inner})`, '0')
}

function buildNotes(data) {
  const levels = [...belowGradePointsThresholds].sort((a, b) => a.minRsi - b.minRsi)
  const levelText = levels.map(t => `>= ${t.minRsi.toFixed(2)} gives ${t.points}`).join(', ')
  const notes = [
    `Layers counted: the materials plus the interior air film (0.12). No exterior air film and no soil (${NOTE_A_SOURCE}; ${TABLE_D}).`,
  ]
  // Type-specific notes: each foundation type states only the values it uses.
  switch (data.foundationType) {
    case 'concrete':
    case 'block':
      notes.push(
        data.foundationType === 'concrete'
          ? `Poured concrete: 0.0004 RSI/mm (${TABLE_D}).`
          : `Concrete block: 190 mm, RSI by block type (${TABLE_D}, concrete blocks, 2 or 3 cores).`,
        'Basement stud wall framing: 16% at 16", 14.5% at 19" (19.2" o.c.), 13% at 24" (NBC 2020 Table A-9.36.2.4.(1)-A, basement wood-frame wall inside a concrete foundation wall). The above-ground 23% row does not apply.',
      )
      break
    case 'icf':
      notes.push(`ICF: EPS forms at 0.026 RSI/mm per form, 152 mm concrete core at 0.0004 RSI/mm, plastic ties (${TABLE_D}).`)
      break
    case 'pwf':
      notes.push(
        'PWF framing: 24% at 8", 19% at 12", 16% at 16". These reproduce NBC 2020 Table A-9.36.2.8.(1)-B with actual stud depths (2x6 140 mm, 2x8 184 mm, 2x10 235 mm).',
        `PWF sheathing: 12.5 mm plywood, RSI 0.109 (${TABLE_D}).`,
      )
      break
  }
  if (data.frame?.offset) {
    notes.push('Stud wall held off the concrete: the R20 batt expands to RSI 3.52 (NBC 2020 Table A-9.36.2.8.(1)-A Note (3)). The air gap itself is not counted.')
  }
  if (data.finishForced) {
    notes.push('Interior foam plastic insulation and ICF must be covered by a thermal barrier such as gypsum board (NBC 2020 9.10.17.10). The finish is counted as 1/2" gypsum.')
  }
  notes.push(
    'Where a house has more than one below-grade wall assembly, the lowest effective RSI governs (NBC 2020 9.36.8.7.(4)).',
    `Minimum effective RSI ${data.minRsi.toFixed(2)} (${MIN_SOURCE}). Points: ${levelText} (${POINTS_SOURCE}). The RSI is rounded to 2 decimals before it is compared with a level or the minimum.`,
  )
  return notes
}

/**
 * Main entry: add a "Foundation Wall RSI" worksheet to the workbook.
 *
 * @param {object} workbook - ExcelJS workbook
 * @param {object} data - result of resolveFoundationData()
 * @returns the worksheet
 */
export function buildFoundationSheet(workbook, data) {
  const sheet = workbook.addWorksheet('Foundation Wall RSI')
  setColumnWidths(sheet)
  writeHeader(sheet, data)

  // Row 7: column headers
  labelCell(sheet, 'A7', 'Layer')
  labelCell(sheet, 'B7', 'Material')
  labelCell(sheet, 'C7', 'Detail')
  labelCell(sheet, 'D7', 'RSI (m²·K/W)')
  labelCell(sheet, 'E7', 'Source')

  // Layers, outside to inside
  let row = 8
  const layerRows = []
  for (const layer of data.layers) {
    layerRows.push(row)
    if (layer.id === 'frame' && data.frame) {
      row = writeFrameRows(sheet, row, layer, data)
    } else {
      // A frame layer with no resolved working (should not happen) is written as a plain value
      writeLayerRow(sheet, row, layer, data)
      row++
    }
  }

  // Totals
  row++
  const totalRow = row++
  labelCell(sheet, `A${totalRow}`, 'Total Effective RSI', TOTAL_FONT)
  formulaCell(sheet, `D${totalRow}`, layerRows.map(r => `D${r}`).join('+'), data.totalRsi)
  sheet.getCell(`D${totalRow}`).font = TOTAL_FONT

  const roundedRow = row++
  labelCell(sheet, `A${roundedRow}`, 'Rounded to 2 decimals')
  formulaCell(sheet, `D${roundedRow}`, `ROUND(D${totalRow},2)`, data.roundedRsi, ROUNDED_FORMAT)

  const minRow = row++
  labelCell(sheet, `A${minRow}`, 'Code Minimum RSI')
  rsiCell(sheet, `D${minRow}`, data.minRsi, ROUNDED_FORMAT)
  sourceCell(sheet, minRow, MIN_SOURCE)

  const meetsRow = row++
  labelCell(sheet, `A${meetsRow}`, 'Meets Minimum?')
  formulaCell(sheet, `D${meetsRow}`, `IF(D${roundedRow}>=D${minRow},"Meets","Does not meet")`,
    data.meetsMinimum ? 'Meets' : 'Does not meet', null)
  sheet.getCell(`D${meetsRow}`).font = TOTAL_FONT

  const pointsRow = row++
  labelCell(sheet, `A${pointsRow}`, 'ECP Points', TOTAL_FONT)
  formulaCell(sheet, `D${pointsRow}`, pointsFormula(`D${roundedRow}`), data.points, '0.0')
  sheet.getCell(`D${pointsRow}`).font = TOTAL_FONT
  sourceCell(sheet, pointsRow, POINTS_SOURCE)

  // Notes
  row++
  labelCell(sheet, `A${row++}`, 'Notes')
  for (const note of buildNotes(data)) {
    const cell = sheet.getCell(`A${row}`)
    cell.value = note
    cell.font = NOTE_FONT
    cell.alignment = { wrapText: true, vertical: 'top' }
    sheet.mergeCells(`A${row}:E${row}`)
    sheet.getRow(row).height = 30
    row++
  }

  return sheet
}
