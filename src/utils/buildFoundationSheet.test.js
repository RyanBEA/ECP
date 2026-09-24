import { describe, it, expect, beforeAll } from 'vitest'

// ExcelJS is a devDependency — import it directly for tests
import ExcelJS from 'exceljs'
import { buildFoundationSheet } from './buildFoundationSheet'
import { resolveFoundationData } from './resolveFoundationData'

const defaultConcrete = {
  foundationType: 'concrete', concreteThickness: '200',
  extInsThickness: 'None', intInsThickness: 'None',
  hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22',
  finish: 'gypsum',
}

function build(selection) {
  const workbook = new ExcelJS.Workbook()
  buildFoundationSheet(workbook, resolveFoundationData(selection))
  return workbook.getWorksheet('Foundation Wall RSI')
}

/** Row number of the first row below the header block (row 7 on) whose column A equals `label`. */
function findRow(sheet, label) {
  let found = null
  sheet.eachRow((row, n) => {
    const v = row.getCell(1).value
    if (n >= 7 && found === null && typeof v === 'string' && v.trim() === label) found = n
  })
  return found
}

/** All column-A strings, for scanning the notes. */
function columnA(sheet) {
  const out = []
  sheet.eachRow((row) => { const v = row.getCell(1).value; if (typeof v === 'string') out.push(v) })
  return out
}

describe('buildFoundationSheet', () => {
  describe('default concrete wall (200 mm + 2x6 @ 16" R22 + gypsum)', () => {
    let sheet
    beforeAll(() => { sheet = build(defaultConcrete) })

    it('creates a sheet named "Foundation Wall RSI"', () => {
      expect(sheet).toBeTruthy()
    })

    it('has the header block', () => {
      expect(sheet.getCell('A1').value).toBe('Foundation Wall Assembly RSI Calculation')
      expect(sheet.getCell('B2').value).toBe('Poured Concrete')
      expect(sheet.getCell('B3').value).toContain('200 mm')
      expect(sheet.getCell('B4').value).toBe('16"')
      expect(sheet.getCell('B5').value).toBe(0.2)
    })

    it('has the column headers on row 7', () => {
      expect(sheet.getCell('A7').value).toBe('Layer')
      expect(sheet.getCell('B7').value).toBe('Material')
      expect(sheet.getCell('D7').value).toContain('RSI')
    })

    it('writes the concrete layer as a live formula with a cached result', () => {
      expect(sheet.getCell('A8').value).toBe('Concrete Wall')
      expect(sheet.getCell('B8').value).toBe('200 mm (8") concrete')
      const cell = sheet.getCell('D8')
      expect(cell.value).toHaveProperty('formula')
      expect(cell.value.formula).toBe('200*0.0004')
      expect(cell.value.result).toBeCloseTo(0.08, 9)
      expect(cell.numFmt).toBe('0.000')
    })

    it('writes the frame layer as a parallel-path formula over its working rows', () => {
      expect(sheet.getCell('A9').value).toBe('Stud Wall (parallel path)')
      expect(sheet.getCell('B9').value).toBe('2x6 @ 16" Fiberglass Batt R22')
      const pp = sheet.getCell('D9')
      expect(pp.value).toHaveProperty('formula')
      expect(pp.value.formula).toBe('100/(D14/D11+D13/D12)')
      expect(pp.value.result).toBeCloseTo(2.845, 3)

      // Working rows 10-14: stud depth, stud RSI, cavity RSI, cavity %, framing %
      expect(sheet.getCell('A10').value.trim()).toBe('Stud Depth (mm)')
      expect(sheet.getCell('D10').value).toBe(140)
      expect(sheet.getCell('A11').value.trim()).toBe('Stud RSI')
      expect(sheet.getCell('D11').value.formula).toBe('D10*0.0085')
      expect(sheet.getCell('D11').value.result).toBeCloseTo(1.19, 9)
      expect(sheet.getCell('A12').value.trim()).toBe('Cavity Insulation RSI')
      expect(sheet.getCell('B12').value).toBe('Fiberglass Batt')
      expect(sheet.getCell('C12').value).toBe('2x6 R22')
      expect(sheet.getCell('D12').value).toBe(3.87)
      expect(sheet.getCell('A13').value.trim()).toBe('Cavity %')
      expect(sheet.getCell('D13').value).toBe(84)
      expect(sheet.getCell('A14').value.trim()).toBe('Framing %')
      expect(sheet.getCell('D14').value.formula).toBe('100-D13')
      expect(sheet.getCell('D14').value.result).toBe(16)
    })

    it('writes finish and interior air film as numbers', () => {
      expect(sheet.getCell('A15').value).toBe('Interior Finish')
      expect(sheet.getCell('D15').value).toBe(0.08)
      expect(sheet.getCell('A16').value).toBe('Interior Air Film')
      expect(sheet.getCell('D16').value).toBe(0.12)
      expect(sheet.getCell('D16').numFmt).toBe('0.000')
    })

    it('totals only the layer rows, then rounds to 2 decimals', () => {
      const total = sheet.getCell('D18')
      expect(sheet.getCell('A18').value).toBe('Total Effective RSI')
      expect(total.value.formula).toBe('D8+D9+D15+D16')
      expect(total.value.result).toBeCloseTo(3.1249, 3)
      const rounded = sheet.getCell('D19')
      expect(rounded.value.formula).toBe('ROUND(D18,2)')
      expect(rounded.value.result).toBe(3.12)
      expect(rounded.numFmt).toBe('0.00')
    })

    it('shows the 2.98 minimum, a Meets line and the points', () => {
      expect(sheet.getCell('A20').value).toBe('Code Minimum RSI')
      expect(sheet.getCell('D20').value).toBe(2.98)
      expect(sheet.getCell('A21').value).toBe('Meets Minimum?')
      expect(sheet.getCell('D21').value.formula).toBe('IF(D19>=D20,"Meets","Does not meet")')
      expect(sheet.getCell('D21').value.result).toBe('Meets')
      expect(sheet.getCell('A22').value).toBe('ECP Points')
      expect(sheet.getCell('D22').value.formula).toBe('IF(D19>=3.9,1.4,IF(D19>=3.46,0.8,IF(D19>=3.09,0.2,0)))')
      expect(sheet.getCell('D22').value.result).toBe(0.2)
    })

    it('carries the notes list', () => {
      const text = columnA(sheet).join('\n')
      expect(text).toContain('Notes')
      expect(text).toMatch(/interior air film/i)
      expect(text).toMatch(/no exterior air film/i)
      expect(text).toMatch(/no soil/i)
      expect(text).toMatch(/16% at 16", 14.5% at 19" \(19.2" o.c.\), 13% at 24"/)
      expect(text).toMatch(/lowest/i)
      expect(text).toContain('9.36.8.7.(4)')
      expect(text).toContain('2.98')
      expect(text).toContain('Table 9.36.2.8.-B')
      expect(text).toMatch(/rounded to 2 decimals/i)
      // Not applicable to this wall
      expect(text).not.toContain('9.10.17.10')
      expect(text).not.toMatch(/held off/i)
    })
  })

  describe('R20 @ 16" (fails the minimum)', () => {
    it('says Does not meet and scores 0', () => {
      const sheet = build({ ...defaultConcrete, cavityType: '2x6 R20' })
      const meets = findRow(sheet, 'Meets Minimum?')
      expect(sheet.getCell(`D${meets}`).value.result).toBe('Does not meet')
      const pts = findRow(sheet, 'ECP Points')
      // ExcelJS drops a falsy cached result from a formula cell, so 0 reads back as undefined
      expect(sheet.getCell(`D${pts}`).value).toHaveProperty('formula')
      expect(sheet.getCell(`D${pts}`).value.result ?? 0).toBe(0)
      expect(sheet.getCell('B5').value).toBe(0)
    })

    it('adds the held-off note when the stud wall is offset', () => {
      const sheet = build({ ...defaultConcrete, cavityType: '2x6 R20', studOffset: true })
      const text = columnA(sheet).join('\n')
      expect(text).toMatch(/held off/i)
      expect(text).toContain('3.52')
      const cav = findRow(sheet, 'Cavity Insulation RSI')
      expect(sheet.getCell(`D${cav}`).value).toBe(3.52)
    })
  })

  describe('ICF 2-1/2"', () => {
    let sheet
    beforeAll(() => { sheet = build({ foundationType: 'icf', icfFormThickness: '2-1/2"' }) })

    it('has no frame working rows and no stud spacing', () => {
      expect(findRow(sheet, 'Stud RSI')).toBeNull()
      expect(findRow(sheet, 'Cavity %')).toBeNull()
      expect(sheet.getCell('A4').value).toBeNull()
    })

    it('writes EPS forms and concrete core as formulas', () => {
      const forms = findRow(sheet, 'EPS Forms (x2 sides)')
      expect(forms).toBe(8)
      expect(sheet.getCell(`D${forms}`).value.formula).toBe('63.5*2*0.026')
      expect(sheet.getCell(`D${forms}`).value.result).toBeCloseTo(3.302, 6)
      const core = findRow(sheet, 'Concrete Core')
      expect(core).toBe(9)
      expect(sheet.getCell(`D${core}`).value.formula).toBe('152.4*0.0004')
    })

    it('totals to 3.56 and 0.8 points', () => {
      const total = findRow(sheet, 'Total Effective RSI')
      expect(sheet.getCell(`D${total}`).value.formula).toBe('D8+D9+D10+D11')
      const rounded = findRow(sheet, 'Rounded to 2 decimals')
      expect(sheet.getCell(`D${rounded}`).value.result).toBe(3.56)
      const pts = findRow(sheet, 'ECP Points')
      expect(sheet.getCell(`D${pts}`).value.result).toBe(0.8)
    })

    it('carries the forced-gypsum note', () => {
      expect(columnA(sheet).join('\n')).toContain('9.10.17.10')
    })
  })

  describe('PWF 2x8 @ 16" R28', () => {
    let sheet
    beforeAll(() => {
      sheet = build({ foundationType: 'pwf', pwfStud: '2x8', pwfSpacing: '16"', pwfCavityMaterial: 'Fiberglass Batt', pwfCavityType: '2x8 R28', finish: 'gypsum' })
    })

    it('has the plywood sheathing first, then the PWF frame', () => {
      expect(sheet.getCell('A8').value).toBe('Exterior Sheathing')
      expect(sheet.getCell('D8').value).toBe(0.109)
      expect(sheet.getCell('A9').value).toBe('PWF Stud Wall (parallel path)')
      expect(sheet.getCell('B4').value).toBe('16"')
    })

    it('uses the 184 mm stud and 84% cavity', () => {
      expect(sheet.getCell(`D${findRow(sheet, 'Stud Depth (mm)')}`).value).toBe(184)
      expect(sheet.getCell(`D${findRow(sheet, 'Cavity %')}`).value).toBe(84)
      expect(sheet.getCell(`D${findRow(sheet, 'Cavity Insulation RSI')}`).value).toBe(4.93)
    })

    it('scores 3.98 and 1.4 points, and notes the PWF framing table', () => {
      expect(sheet.getCell(`D${findRow(sheet, 'Rounded to 2 decimals')}`).value.result).toBe(3.98)
      expect(sheet.getCell(`D${findRow(sheet, 'ECP Points')}`).value.result).toBe(1.4)
      const text = columnA(sheet).join('\n')
      expect(text).toMatch(/24% at 8", 19% at 12", 16% at 16"/)
      expect(text).toContain('Table A-9.36.2.8.(1)-B')
    })
  })

  describe('frame layer without resolved working', () => {
    it('does not throw and writes the frame RSI as a plain value', () => {
      const data = { ...resolveFoundationData(defaultConcrete), frame: null, spacing: null }
      const workbook = new ExcelJS.Workbook()
      expect(() => buildFoundationSheet(workbook, data)).not.toThrow()
      const sheet = workbook.getWorksheet('Foundation Wall RSI')
      expect(sheet.getCell('A9').value).toBe('Stud Wall (parallel path)')
      expect(sheet.getCell('D9').value).toBeCloseTo(2.845, 3)
      expect(findRow(sheet, 'Stud RSI')).toBeNull()
      expect(sheet.getCell(`D${findRow(sheet, 'Total Effective RSI')}`).value.formula).toBe('D8+D9+D10+D11')
    })
  })

  describe('exterior insulation only (no stud wall, no finish)', () => {
    it('lists exterior insulation, concrete and the air film only', () => {
      const sheet = build({ ...defaultConcrete, hasStudWall: false, extInsType: 'XPS', extInsThickness: '4"', finish: 'none' })
      expect(sheet.getCell('A8').value).toBe('Exterior Insulation')
      expect(sheet.getCell('B8').value).toBe('4" XPS (exterior)')
      expect(sheet.getCell('A9').value).toBe('Concrete Wall')
      expect(sheet.getCell('A10').value).toBe('Interior Air Film')
      expect(findRow(sheet, 'Interior Finish')).toBeNull()
      expect(sheet.getCell(`D${findRow(sheet, 'Total Effective RSI')}`).value.formula).toBe('D8+D9+D10')
      expect(sheet.getCell(`D${findRow(sheet, 'Rounded to 2 decimals')}`).value.result).toBe(3.61)
    })
  })
})
