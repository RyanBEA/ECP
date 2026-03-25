import { describe, it, expect, beforeAll } from 'vitest'

// ExcelJS is a devDependency — import it directly for tests
import ExcelJS from 'exceljs'
import { buildWallSheet } from './buildWallSheet'
import { resolveWallData } from './resolveWallData'

describe('buildWallSheet', () => {
  describe('wood single stud', () => {
    let sheet

    beforeAll(() => {
      const data = resolveWallData({
        wallType: 'wood', assemblyType: 'single', studSpacing: '16"',
        cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
        contInsType: null, contInsThickness: 'None',
        sheathingId: 'osb_11', claddingId: 'vinyl_siding',
      })
      const workbook = new ExcelJS.Workbook()
      buildWallSheet(workbook, data)
      sheet = workbook.getWorksheet('Wall Assembly RSI')
    })

    it('creates a sheet named "Wall Assembly RSI"', () => {
      expect(sheet).toBeTruthy()
    })

    it('has header with wall type', () => {
      expect(sheet.getCell('B2').value).toBe('Wood Frame')
    })

    it('has header with assembly type', () => {
      expect(sheet.getCell('B3').value).toBe('Single Stud')
    })

    it('has boundary layer RSI values', () => {
      // Outside air film in column D of the layer stack
      expect(sheet.getCell('D8').value).toBe(0.03)   // outside air
      expect(sheet.getCell('D28').value).toBe(0.08)   // drywall
      expect(sheet.getCell('D29').value).toBe(0.12)   // inside air
    })

    it('has parallel-path formula for main wall', () => {
      const cell = sheet.getCell('D12')
      // Should be a formula, not a static value
      expect(cell.value).toHaveProperty('formula')
      expect(cell.value.formula).toContain('100')
    })

    it('has total RSI formula', () => {
      const cell = sheet.getCell('D31')
      expect(cell.value).toHaveProperty('formula')
    })

    it('has zero for unused rows (double stud, service wall)', () => {
      expect(sheet.getCell('D17').value).toBe(0)  // gap insulation
      expect(sheet.getCell('D18').value).toBe(0)  // inner stud row PP
      expect(sheet.getCell('D23').value).toBe(0)  // service wall PP
    })
  })

  describe('steel frame', () => {
    let sheet

    beforeAll(() => {
      const data = resolveWallData({
        wallType: 'steel', studSpacing: '16"',
        cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
        contInsType: 'XPS', contInsThickness: '2"',
        claddingId: 'metal_siding',
      })
      const workbook = new ExcelJS.Workbook()
      buildWallSheet(workbook, data)
      sheet = workbook.getWorksheet('Wall Assembly RSI')
    })

    it('creates the sheet', () => {
      expect(sheet).toBeTruthy()
    })

    it('has wall type in header', () => {
      expect(sheet.getCell('B2').value).toBe('Steel Frame')
    })

    it('has K1 as conditional formula', () => {
      // K1 should be an IF formula referencing spacing and cont ins cells
      let found = false
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'K1') {
          const cell = row.getCell(4)
          expect(cell.value).toHaveProperty('formula')
          expect(cell.value.formula).toContain('IF')
          found = true
        }
      })
      expect(found).toBe(true)
    })

    it('has total RSI as K-factor formula', () => {
      // Find the total row — should be a formula containing K1*T1
      let found = false
      sheet.eachRow((row) => {
        if (row.getCell(1).value === 'Total Effective RSI') {
          const cell = row.getCell(4)
          expect(cell.value).toHaveProperty('formula')
          found = true
        }
      })
      expect(found).toBe(true)
    })
  })

  describe('ICF', () => {
    let sheet

    beforeAll(() => {
      const data = resolveWallData({
        wallType: 'icf', icfFormThickness: '2-1/2"',
        claddingId: 'stucco_19',
      })
      const workbook = new ExcelJS.Workbook()
      buildWallSheet(workbook, data)
      sheet = workbook.getWorksheet('Wall Assembly RSI')
    })

    it('creates the sheet', () => {
      expect(sheet).toBeTruthy()
    })

    it('has EPS form formula', () => {
      const cell = sheet.getCell('D10')
      expect(cell.value).toHaveProperty('formula')
    })

    it('has total as SUM formula', () => {
      const cell = sheet.getCell('D15')
      expect(cell.value).toHaveProperty('formula')
      expect(cell.value.formula).toContain('SUM')
    })
  })

  describe('wood double stud', () => {
    let sheet

    beforeAll(() => {
      const data = resolveWallData({
        wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"',
        outerStud: '2x4', innerStud: '2x4', plate: '2x10',
        doubleStudMaterial: 'Loose Fill Cellulose',
        sheathingId: 'osb_11', claddingId: 'vinyl_siding',
      })
      const workbook = new ExcelJS.Workbook()
      buildWallSheet(workbook, data)
      sheet = workbook.getWorksheet('Wall Assembly RSI')
    })

    it('has inner stud row PP formula at D18', () => {
      const cell = sheet.getCell('D18')
      expect(cell.value).toHaveProperty('formula')
    })

    it('has gap insulation formula at D17', () => {
      const cell = sheet.getCell('D17')
      expect(cell.value).toHaveProperty('formula')
    })
  })
})
