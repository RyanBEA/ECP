/**
 * Build an Excel sheet with live formulas for a wall assembly RSI calculation.
 *
 * Three layouts: wood (universal template), steel (K-factor method), ICF (series sum).
 * Wood template uses fixed row positions so formulas reference stable cells.
 */

const HEADER_FONT = { bold: true, size: 14 }
const LABEL_FONT = { bold: true, size: 11 }
const SUB_FONT = { italic: true, size: 10, color: { argb: 'FF666666' } }
const INACTIVE_FONT = { size: 10, color: { argb: 'FF999999' } }
const TOTAL_FONT = { bold: true, size: 12 }
const RSI_FORMAT = '0.000'

/**
 * Style a cell as a label.
 */
function labelCell(sheet, ref, text, font = LABEL_FONT) {
  const cell = sheet.getCell(ref)
  cell.value = text
  cell.font = font
}

/**
 * Set a numeric value with RSI formatting.
 */
function rsiCell(sheet, ref, value, inactive = false) {
  const cell = sheet.getCell(ref)
  cell.value = value
  cell.numFmt = RSI_FORMAT
  if (inactive && value === 0) cell.font = INACTIVE_FONT
}

/**
 * Set a formula cell with RSI formatting.
 */
function formulaCell(sheet, ref, formula, inactive = false) {
  const cell = sheet.getCell(ref)
  cell.value = { formula }
  cell.numFmt = RSI_FORMAT
  if (inactive) cell.font = INACTIVE_FONT
}

/**
 * Write the header section (rows 1-5).
 */
function writeHeader(sheet, data) {
  sheet.getCell('A1').value = 'Wall Assembly RSI Calculation'
  sheet.getCell('A1').font = HEADER_FONT
  sheet.mergeCells('A1:D1')

  labelCell(sheet, 'A2', 'Wall Type')
  sheet.getCell('B2').value = data.wallTypeLabel

  if (data.assemblyType) {
    labelCell(sheet, 'A3', 'Assembly')
    sheet.getCell('B3').value = data.assemblyType === 'doubleStud' ? 'Double Stud' : 'Single Stud'
  }

  if (data.studSpacing) {
    labelCell(sheet, 'A4', 'Stud Spacing')
    sheet.getCell('B4').value = data.studSpacing
  }

  labelCell(sheet, 'A5', 'ECP Points')
  sheet.getCell('B5').value = data.points
}

/**
 * Set column widths for the standard 4-column layout.
 */
function setColumnWidths(sheet) {
  sheet.getColumn('A').width = 30
  sheet.getColumn('B').width = 35
  sheet.getColumn('C').width = 20
  sheet.getColumn('D').width = 18
}

/**
 * Build wood wall template (universal for single/double/service).
 *
 * Fixed row layout:
 *   7: Header row
 *   8: Outside air film
 *   9: Cladding
 *   10: Continuous insulation
 *   11: Exterior sheathing
 *   12: Main wall / outer stud row (parallel path formula)
 *   13: — Stud RSI (formula)
 *   14: — Cavity %
 *   15: — Cavity insulation RSI
 *   16: — Stud depth (mm)
 *   17: Gap insulation (double stud)
 *   18: Inner stud row (parallel path formula)
 *   19: — Inner stud RSI (formula: =D20*0.0085)
 *   20: — Inner stud depth (mm)
 *   21: — Inner cavity RSI
 *   22: Interior layer (service wall)
 *   23: Service wall (parallel path formula)
 *   24: — Service stud RSI (formula)
 *   25: — Service cavity %
 *   26: — Service cavity RSI
 *   27: — Service stud depth (mm)
 *   28: Drywall
 *   29: Inside air film
 *   31: Total effective RSI
 */
function buildWoodSheet(sheet, data) {
  const { boundary, mainWall, doubleStud: ds, serviceWall: sw, interiorLayer: il, contIns } = data
  const hasDs = ds !== null
  const hasSw = sw !== null

  // Row 7: Column headers
  labelCell(sheet, 'A7', 'Layer')
  labelCell(sheet, 'B7', 'Material')
  labelCell(sheet, 'C7', 'Detail')
  labelCell(sheet, 'D7', 'RSI (m\u00B2\u00B7K/W)')

  // Row 8: Outside air film
  labelCell(sheet, 'A8', 'Outside Air Film')
  rsiCell(sheet, 'D8', boundary.outsideAir.rsi)

  // Row 9: Cladding
  labelCell(sheet, 'A9', 'Cladding')
  sheet.getCell('B9').value = boundary.cladding.label
  rsiCell(sheet, 'D9', boundary.cladding.rsi)

  // Row 10: Continuous insulation
  const hasContIns = contIns && contIns.rsi > 0
  labelCell(sheet, 'A10', 'Continuous Insulation', hasContIns ? LABEL_FONT : INACTIVE_FONT)
  sheet.getCell('B10').value = hasContIns ? contIns.type : '—'
  sheet.getCell('C10').value = hasContIns ? contIns.thickness : '—'
  rsiCell(sheet, 'D10', hasContIns ? contIns.rsi : 0, !hasContIns)

  // Row 11: Exterior sheathing
  const hasSh = boundary.sheathing !== null
  labelCell(sheet, 'A11', 'Exterior Sheathing', hasSh ? LABEL_FONT : INACTIVE_FONT)
  sheet.getCell('B11').value = hasSh ? boundary.sheathing.label : '—'
  rsiCell(sheet, 'D11', hasSh ? boundary.sheathing.rsi : 0, !hasSh)

  // Rows 12-16: Main wall / outer stud row
  const mainLabel = hasDs ? 'Outer Stud Row (parallel path)' : 'Main Wall (parallel path)'
  labelCell(sheet, 'A12', mainLabel)
  formulaCell(sheet, 'D12', '100/((100-D14)/D13+D14/D15)')

  labelCell(sheet, 'A13', '\u2003Stud RSI', SUB_FONT)
  sheet.getCell('C13').value = 'depth \u00D7 0.0085'
  formulaCell(sheet, 'D13', 'D16*0.0085')

  labelCell(sheet, 'A14', '\u2003Cavity %', SUB_FONT)
  rsiCell(sheet, 'D14', mainWall.cavityPct)

  labelCell(sheet, 'A15', '\u2003Cavity Insulation RSI', SUB_FONT)
  sheet.getCell('B15').value = mainWall.cavityMaterial
  sheet.getCell('C15').value = mainWall.cavityType || '—'
  rsiCell(sheet, 'D15', mainWall.cavityRsi)

  labelCell(sheet, 'A16', '\u2003Stud Depth (mm)', SUB_FONT)
  sheet.getCell('D16').value = mainWall.studDepthMm

  // Row 17: Gap insulation (double stud only)
  labelCell(sheet, 'A17', 'Gap Insulation', hasDs ? LABEL_FONT : INACTIVE_FONT)
  if (hasDs) {
    sheet.getCell('C17').value = `${ds.gapMm} mm \u00D7 ${ds.rsiPerMm} RSI/mm`
    formulaCell(sheet, 'D17', `${ds.gapMm}*${ds.rsiPerMm}`)
  } else {
    rsiCell(sheet, 'D17', 0, true)
  }

  // Rows 18-21: Inner stud row (double stud only)
  labelCell(sheet, 'A18', 'Inner Stud Row (parallel path)', hasDs ? LABEL_FONT : INACTIVE_FONT)
  if (hasDs) {
    formulaCell(sheet, 'D18', '100/((100-D14)/D19+D14/D21)')
    labelCell(sheet, 'A19', '\u2003Inner Stud RSI', SUB_FONT)
    sheet.getCell('C19').value = 'depth \u00D7 0.0085'
    formulaCell(sheet, 'D19', 'D20*0.0085')
    labelCell(sheet, 'A20', '\u2003Inner Stud Depth (mm)', SUB_FONT)
    sheet.getCell('D20').value = ds.innerDepthMm
    labelCell(sheet, 'A21', '\u2003Inner Cavity RSI', SUB_FONT)
    sheet.getCell('D21').value = ds.innerCavityRsi
    sheet.getCell('D21').numFmt = RSI_FORMAT
  } else {
    rsiCell(sheet, 'D18', 0, true)
    rsiCell(sheet, 'D19', 0, true)
    sheet.getCell('D20').value = 0
    rsiCell(sheet, 'D21', 0, true)
  }

  // Row 22: Interior layer (service wall only)
  const hasIl = il !== null
  labelCell(sheet, 'A22', 'Interior Layer', hasIl ? LABEL_FONT : INACTIVE_FONT)
  sheet.getCell('B22').value = hasIl ? il.material : '—'
  rsiCell(sheet, 'D22', hasIl ? il.rsi : 0, !hasIl)

  // Rows 23-27: Service wall (service wall only)
  labelCell(sheet, 'A23', 'Service Wall (parallel path)', hasSw ? LABEL_FONT : INACTIVE_FONT)
  if (hasSw) {
    formulaCell(sheet, 'D23', '100/((100-D25)/D24+D25/D26)')
    labelCell(sheet, 'A24', '\u2003Service Stud RSI', SUB_FONT)
    sheet.getCell('C24').value = 'depth \u00D7 0.0085'
    formulaCell(sheet, 'D24', 'D27*0.0085')
    labelCell(sheet, 'A25', '\u2003Service Cavity %', SUB_FONT)
    rsiCell(sheet, 'D25', sw.cavityPct)
    labelCell(sheet, 'A26', '\u2003Service Cavity RSI', SUB_FONT)
    sheet.getCell('B26').value = sw.cavityMaterial
    sheet.getCell('C26').value = sw.cavityType
    rsiCell(sheet, 'D26', sw.cavityRsi)
    labelCell(sheet, 'A27', '\u2003Service Stud Depth (mm)', SUB_FONT)
    sheet.getCell('D27').value = sw.studDepthMm
  } else {
    rsiCell(sheet, 'D23', 0, true)
    rsiCell(sheet, 'D24', 0, true)
    rsiCell(sheet, 'D25', 0, true)
    rsiCell(sheet, 'D26', 0, true)
    sheet.getCell('D27').value = 0
  }

  // Row 28: Drywall
  labelCell(sheet, 'A28', 'Drywall')
  sheet.getCell('B28').value = boundary.drywall.label
  rsiCell(sheet, 'D28', boundary.drywall.rsi)

  // Row 29: Inside air film
  labelCell(sheet, 'A29', 'Inside Air Film')
  rsiCell(sheet, 'D29', boundary.insideAir.rsi)

  // Row 31: Total
  labelCell(sheet, 'A31', 'Total Effective RSI', TOTAL_FONT)
  formulaCell(sheet, 'D31', 'D8+D9+D10+D11+D12+D17+D18+D22+D23+D28+D29')
  sheet.getCell('D31').font = TOTAL_FONT
}

/**
 * Build steel wall sheet with K-factor weighted method.
 */
function buildSteelSheet(sheet, data) {
  const { boundary, mainWall, steel, contIns } = data

  // Row 7: Column headers
  labelCell(sheet, 'A7', 'Layer / Parameter')
  labelCell(sheet, 'B7', 'Material / Value')
  labelCell(sheet, 'C7', 'Detail')
  labelCell(sheet, 'D7', 'RSI (m\u00B2\u00B7K/W)')

  // Boundary layers
  let row = 8
  const boundaryRows = []

  labelCell(sheet, `A${row}`, 'Outside Air Film')
  rsiCell(sheet, `D${row}`, boundary.outsideAir.rsi)
  boundaryRows.push(row++)

  labelCell(sheet, `A${row}`, 'Cladding')
  sheet.getCell(`B${row}`).value = boundary.cladding.label
  rsiCell(sheet, `D${row}`, boundary.cladding.rsi)
  boundaryRows.push(row++)

  labelCell(sheet, `A${row}`, 'Air Space')
  rsiCell(sheet, `D${row}`, boundary.airSpace.rsi)
  boundaryRows.push(row++)

  const hasContIns = contIns && contIns.rsi > 0
  labelCell(sheet, `A${row}`, 'Continuous Insulation')
  sheet.getCell(`B${row}`).value = hasContIns ? contIns.type : '—'
  sheet.getCell(`C${row}`).value = hasContIns ? contIns.thickness : '—'
  rsiCell(sheet, `D${row}`, hasContIns ? contIns.rsi : 0)
  boundaryRows.push(row++)

  labelCell(sheet, `A${row}`, 'Drywall')
  sheet.getCell(`B${row}`).value = boundary.drywall.label
  rsiCell(sheet, `D${row}`, boundary.drywall.rsi)
  boundaryRows.push(row++)

  labelCell(sheet, `A${row}`, 'Inside Air Film')
  rsiCell(sheet, `D${row}`, boundary.insideAir.rsi)
  boundaryRows.push(row++)

  // Boundary sum formula
  const bSumFormula = boundaryRows.map(r => `D${r}`).join('+')
  row++
  labelCell(sheet, `A${row}`, 'Boundary Sum', LABEL_FONT)
  formulaCell(sheet, `D${row}`, bSumFormula)
  const bSumRow = row++

  // Steel calculation parameters
  row++
  labelCell(sheet, `A${row}`, 'Steel Calculation Parameters', HEADER_FONT)
  sheet.mergeCells(`A${row}:D${row}`)
  row++

  labelCell(sheet, `A${row}`, 'Cavity Insulation')
  sheet.getCell(`B${row}`).value = mainWall.cavityMaterial
  sheet.getCell(`C${row}`).value = mainWall.cavityType
  rsiCell(sheet, `D${row}`, mainWall.cavityRsi)
  const cavRsiRow = row++

  labelCell(sheet, `A${row}`, 'Stud Depth (mm)')
  sheet.getCell(`D${row}`).value = mainWall.studDepthMm
  const studDepthRow = row++

  labelCell(sheet, `A${row}`, 'Stud RSI')
  sheet.getCell(`C${row}`).value = 'depth \u00D7 0.0000161'
  formulaCell(sheet, `D${row}`, `D${studDepthRow}*0.0000161`)
  const studRsiRow = row++

  labelCell(sheet, `A${row}`, 'Stud Spacing (inches)')
  sheet.getCell(`D${row}`).value = parseInt(data.studSpacing?.replace('"', '') || '16')
  const spacingRow = row++

  labelCell(sheet, `A${row}`, 'Cavity %')
  sheet.getCell(`C${row}`).value = '(spacing - 0.125) \u00D7 100 / spacing'
  formulaCell(sheet, `D${row}`, `(D${spacingRow}-0.125)*100/D${spacingRow}`)
  const cavPctRow = row++

  labelCell(sheet, `A${row}`, 'Framing %')
  formulaCell(sheet, `D${row}`, `100-D${cavPctRow}`)
  const frmPctRow = row++

  // Cont ins cell reference for K1 IF formula
  const contInsRow = boundaryRows[3]  // 4th boundary row = continuous insulation

  labelCell(sheet, `A${row}`, 'K1')
  sheet.getCell(`C${row}`).value = 'NBC Table A-9.36.2.4.(1)-B'
  formulaCell(sheet, `D${row}`, `IF(D${spacingRow}>=24,0.5,IF(D${contInsRow}>0,0.4,0.33))`)
  const k1Row = row++

  labelCell(sheet, `A${row}`, 'K2')
  formulaCell(sheet, `D${row}`, `1-D${k1Row}`)
  const k2Row = row++

  // T1, T2, T3 formulas
  row++
  labelCell(sheet, `A${row}`, 'NBC K-Factor Method', HEADER_FONT)
  sheet.mergeCells(`A${row}:D${row}`)
  row++

  labelCell(sheet, `A${row}`, 'RSI_T1 (full assembly PP)')
  sheet.getCell(`C${row}`).value = '100/(frm%/(bSum+studRsi) + cav%/(bSum+cavRsi))'
  formulaCell(sheet, `D${row}`, `100/(D${frmPctRow}/(D${bSumRow}+D${studRsiRow})+D${cavPctRow}/(D${bSumRow}+D${cavRsiRow}))`)
  const t1Row = row++

  labelCell(sheet, `A${row}`, 'RSI_T2 (stud-cavity PP)')
  sheet.getCell(`C${row}`).value = '100/(frm%/studRsi + cav%/cavRsi)'
  formulaCell(sheet, `D${row}`, `100/(D${frmPctRow}/D${studRsiRow}+D${cavPctRow}/D${cavRsiRow})`)
  const t2Row = row++

  labelCell(sheet, `A${row}`, 'RSI_T3')
  sheet.getCell(`C${row}`).value = 'T2 + boundary sum'
  formulaCell(sheet, `D${row}`, `D${t2Row}+D${bSumRow}`)
  const t3Row = row++

  // Total
  row++
  labelCell(sheet, `A${row}`, 'Total Effective RSI', TOTAL_FONT)
  sheet.getCell(`C${row}`).value = 'K1 \u00D7 T1 + K2 \u00D7 T3'
  formulaCell(sheet, `D${row}`, `D${k1Row}*D${t1Row}+D${k2Row}*D${t3Row}`)
  sheet.getCell(`D${row}`).font = TOTAL_FONT
}

/**
 * Build ICF wall sheet (pure series sum).
 */
function buildIcfSheet(sheet, data) {
  const { boundary, icf } = data

  // Row 7: Column headers
  labelCell(sheet, 'A7', 'Layer')
  labelCell(sheet, 'B7', 'Material / Value')
  labelCell(sheet, 'C7', 'Detail')
  labelCell(sheet, 'D7', 'RSI (m\u00B2\u00B7K/W)')

  labelCell(sheet, 'A8', 'Outside Air Film')
  rsiCell(sheet, 'D8', boundary.outsideAir.rsi)

  labelCell(sheet, 'A9', 'Cladding')
  sheet.getCell('B9').value = boundary.cladding.label
  rsiCell(sheet, 'D9', boundary.cladding.rsi)

  labelCell(sheet, 'A10', 'EPS Form (x2 sides)')
  sheet.getCell('B10').value = icf.formLabel
  sheet.getCell('C10').value = `${icf.formThicknessMm} mm \u00D7 2 \u00D7 ${icf.epsRsiPerMm}`
  formulaCell(sheet, 'D10', `${icf.formThicknessMm}*2*${icf.epsRsiPerMm}`)

  labelCell(sheet, 'A11', 'Concrete Core')
  sheet.getCell('C11').value = `${icf.concreteCoreMm} mm \u00D7 ${icf.concreteRsiPerMm}`
  formulaCell(sheet, 'D11', `${icf.concreteCoreMm}*${icf.concreteRsiPerMm}`)

  labelCell(sheet, 'A12', 'Drywall')
  sheet.getCell('B12').value = boundary.drywall.label
  rsiCell(sheet, 'D12', boundary.drywall.rsi)

  labelCell(sheet, 'A13', 'Inside Air Film')
  rsiCell(sheet, 'D13', boundary.insideAir.rsi)

  // Total
  labelCell(sheet, 'A15', 'Total Effective RSI', TOTAL_FONT)
  formulaCell(sheet, 'D15', 'SUM(D8:D13)')
  sheet.getCell('D15').font = TOTAL_FONT
}

/**
 * Main entry: build the appropriate sheet layout based on wall type.
 */
export function buildWallSheet(workbook, data) {
  const sheet = workbook.addWorksheet('Wall Assembly RSI')
  setColumnWidths(sheet)
  writeHeader(sheet, data)

  if (data.wallType === 'icf') {
    buildIcfSheet(sheet, data)
  } else if (data.wallType === 'steel') {
    buildSteelSheet(sheet, data)
  } else {
    buildWoodSheet(sheet, data)
  }

  return sheet
}
