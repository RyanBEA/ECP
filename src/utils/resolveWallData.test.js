import { describe, it, expect } from 'vitest'
import { resolveWallData } from './resolveWallData'
import { calculateWallRsi } from '../data/ecpData'

describe('resolveWallData', () => {
  describe('wood single stud', () => {
    const selection = {
      wallType: 'wood',
      assemblyType: 'single',
      studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt',
      cavityType: '2x6 R20',
      contInsType: null,
      contInsThickness: 'None',
      sheathingId: 'osb_11',
      claddingId: 'vinyl_siding',
    }

    it('returns correct wall type metadata', () => {
      const result = resolveWallData(selection)
      expect(result.wallType).toBe('wood')
      expect(result.wallTypeLabel).toBe('Wood Frame')
      expect(result.assemblyType).toBe('single')
      expect(result.studSpacing).toBe('16"')
    })

    it('resolves boundary layers with RSI and labels', () => {
      const result = resolveWallData(selection)
      expect(result.boundary.outsideAir.rsi).toBe(0.03)
      expect(result.boundary.cladding.rsi).toBe(0.11)
      expect(result.boundary.cladding.label).toBe('Vinyl/Metal Siding (hollow-backed)')
      expect(result.boundary.sheathing.rsi).toBe(0.108)
      expect(result.boundary.sheathing.label).toContain('OSB')
      expect(result.boundary.drywall.rsi).toBe(0.08)
      expect(result.boundary.insideAir.rsi).toBe(0.12)
      expect(result.boundary.airSpace).toBeNull()
    })

    it('resolves main wall parallel-path values', () => {
      const result = resolveWallData(selection)
      expect(result.mainWall.studDepthMm).toBe(140)
      expect(result.mainWall.studRsi).toBeCloseTo(1.19, 2)
      expect(result.mainWall.cavityPct).toBe(77)
      expect(result.mainWall.cavityRsi).toBe(3.34)
      expect(result.mainWall.ppRsi).toBeCloseTo(2.36, 1)
    })

    it('returns null for unused sections', () => {
      const result = resolveWallData(selection)
      expect(result.doubleStud).toBeNull()
      expect(result.steel).toBeNull()
      expect(result.icf).toBeNull()
      expect(result.serviceWall).toBeNull()
      expect(result.interiorLayer).toBeNull()
    })

    it('calculates correct total RSI', () => {
      const result = resolveWallData(selection)
      // boundary (0.03 + 0.11 + 0.108 + 0.08 + 0.12) + ppRsi (~2.36) + contIns (0) = ~2.81
      expect(result.totalRsi).toBeCloseTo(2.81, 1)
    })

    it('includes continuous insulation when present', () => {
      const withContIns = { ...selection, contInsType: 'XPS', contInsThickness: '2"' }
      const result = resolveWallData(withContIns)
      expect(result.contIns.type).toBe('XPS')
      expect(result.contIns.thickness).toBe('2"')
      expect(result.contIns.rsi).toBe(1.68)
      expect(result.totalRsi).toBeCloseTo(4.49, 1)
    })
  })

  describe('wood single stud with continuous insulation', () => {
    it('includes contIns in resolved data', () => {
      const result = resolveWallData({
        wallType: 'wood', assemblyType: 'single', studSpacing: '16"',
        cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
        contInsType: 'XPS', contInsThickness: '2"',
        sheathingId: 'osb_11', claddingId: 'vinyl_siding',
      })
      expect(result.contIns).toEqual({ type: 'XPS', thickness: '2"', rsi: 1.68 })
      expect(result.totalRsi).toBeCloseTo(4.49, 1)
    })
  })

  describe('wood double stud', () => {
    const selection = {
      wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"',
      outerStud: '2x4', innerStud: '2x4', plate: '2x10',
      doubleStudMaterial: 'Loose Fill Cellulose',
      sheathingId: 'osb_11', claddingId: 'vinyl_siding',
    }

    it('resolves double stud fields', () => {
      const result = resolveWallData(selection)
      expect(result.doubleStud).not.toBeNull()
      expect(result.doubleStud.outerStud).toBe('2x4')
      expect(result.doubleStud.innerStud).toBe('2x4')
      expect(result.doubleStud.plate).toBe('2x10')
      expect(result.doubleStud.gapMm).toBe(57)
      expect(result.doubleStud.outerPpRsi).toBeCloseTo(1.538, 2)
      expect(result.doubleStud.innerPpRsi).toBeCloseTo(1.538, 2)
    })

    it('calculates correct total RSI', () => {
      const result = resolveWallData(selection)
      expect(result.totalRsi).toBeGreaterThan(4)
    })
  })

  describe('wood with service wall', () => {
    const selection = {
      wallType: 'wood', assemblyType: 'single', studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
      sheathingId: 'osb_11', claddingId: 'vinyl_siding',
      hasServiceWall: true,
      serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
    }

    it('resolves service wall fields', () => {
      const result = resolveWallData(selection)
      expect(result.serviceWall).not.toBeNull()
      expect(result.serviceWall.cavityType).toBe('2x4 R12')
      expect(result.serviceWall.ppRsi).toBeCloseTo(1.495, 1)
    })

    it('resolves interior layer', () => {
      const result = resolveWallData(selection)
      expect(result.interiorLayer).not.toBeNull()
      expect(result.interiorLayer.rsi).toBe(0.108)
    })

    it('has no continuous insulation', () => {
      const result = resolveWallData(selection)
      expect(result.contIns).toBeNull()
    })
  })

  describe('steel frame', () => {
    const selection = {
      wallType: 'steel', studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
      contInsType: 'XPS', contInsThickness: '2"',
      claddingId: 'metal_siding',
    }

    it('resolves steel-specific K-factor fields', () => {
      const result = resolveWallData(selection)
      expect(result.steel).not.toBeNull()
      expect(result.steel.k1).toBe(0.4)  // <24" with insulating sheathing
      expect(result.steel.k2).toBe(0.6)
    })

    it('has gypsum sheathing and air space', () => {
      const result = resolveWallData(selection)
      expect(result.boundary.sheathing).not.toBeNull()
      expect(result.boundary.sheathing.rsi).toBe(0.08)  // gypsum sheathing
      expect(result.boundary.airSpace).not.toBeNull()
      expect(result.boundary.airSpace.rsi).toBe(0.18)
    })
  })

  describe('ICF', () => {
    const selection = {
      wallType: 'icf',
      icfFormThickness: '2-1/2"',
      claddingId: 'stucco_19',
    }

    it('resolves ICF-specific fields', () => {
      const result = resolveWallData(selection)
      expect(result.icf).not.toBeNull()
      expect(result.icf.formThicknessMm).toBe(63.5)
      expect(result.icf.epsRsiPerMm).toBe(0.026)
      expect(result.icf.formRsi).toBeCloseTo(3.302, 2)
      expect(result.icf.concreteRsi).toBeCloseTo(0.061, 2)
    })

    it('has correct total RSI', () => {
      const result = resolveWallData(selection)
      // 0.03 + 0.017 + 3.302 + 0.06096 + 0.08 + 0.12 = ~3.61
      expect(result.totalRsi).toBeCloseTo(3.61, 1)
    })
  })

  describe('wood double stud + service wall', () => {
    const selection = {
      wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"',
      outerStud: '2x4', innerStud: '2x4', plate: '2x10',
      doubleStudMaterial: 'Loose Fill Cellulose',
      sheathingId: 'osb_11', claddingId: 'vinyl_siding',
      hasServiceWall: true,
      serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt',
      serviceCavityType: '2x4 R12',
      interiorLayerMaterial: 'osb_11',
    }

    it('has both double stud and service wall populated', () => {
      const result = resolveWallData(selection)
      expect(result.doubleStud).not.toBeNull()
      expect(result.serviceWall).not.toBeNull()
      expect(result.interiorLayer).not.toBeNull()
      expect(result.contIns).toBeNull()
    })
  })

  describe('cross-check: totalRsi matches calculateWallRsi', () => {
    // Paranoia test: ensure resolveWallData.totalRsi stays in sync with calculateWallRsi

    const cases = [
      { name: 'wood single', sel: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', sheathingId: 'osb_11', claddingId: 'vinyl_siding' } },
      { name: 'wood + XPS', sel: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsType: 'XPS', contInsThickness: '2"', sheathingId: 'osb_11', claddingId: 'vinyl_siding' } },
      { name: 'steel', sel: { wallType: 'steel', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsType: 'XPS', contInsThickness: '2"', claddingId: 'metal_siding' } },
      { name: 'ICF', sel: { wallType: 'icf', icfFormThickness: '2-1/2"', claddingId: 'stucco_19' } },
      { name: 'wood doubleStud', sel: { wallType: 'wood', assemblyType: 'doubleStud', studSpacing: '16"', outerStud: '2x4', innerStud: '2x4', plate: '2x10', doubleStudMaterial: 'Loose Fill Cellulose', sheathingId: 'osb_11', claddingId: 'vinyl_siding' } },
      { name: 'wood single + service wall', sel: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', sheathingId: 'osb_11', claddingId: 'vinyl_siding', hasServiceWall: true, serviceSpacing: '16"', serviceCavityMaterial: 'Fiberglass Batt', serviceCavityType: '2x4 R12', interiorLayerMaterial: 'osb_11' } },
    ]

    for (const { name, sel } of cases) {
      it(`matches calculateWallRsi for ${name}`, () => {
        const resolved = resolveWallData(sel)
        const expected = calculateWallRsi(sel)
        expect(resolved.totalRsi).toBeCloseTo(expected, 6)
      })
    }
  })

  describe('null selection', () => {
    it('returns null for missing wallType', () => {
      expect(resolveWallData({})).toBeNull()
      expect(resolveWallData(null)).toBeNull()
    })
  })
})
