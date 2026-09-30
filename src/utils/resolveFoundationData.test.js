import { describe, it, expect } from 'vitest'
import { resolveFoundationData } from './resolveFoundationData'
import { calculateBelowGradeAssembly, getBelowGradePoints, EMPTY_CAVITY } from '../data/ecpData'
import { parallelPath } from '@scripts/compute.js'

// Default concrete wall: 200 mm concrete + 2x6 @ 16" R22 batt + 1/2" gypsum (design example 1)
const defaultConcrete = {
  foundationType: 'concrete', concreteThickness: '200',
  extInsThickness: 'None', intInsThickness: 'None',
  hasStudWall: true, studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R22',
  finish: 'gypsum',
}

const pwfDefault = {
  foundationType: 'pwf', pwfStud: '2x8', pwfSpacing: '16"',
  pwfCavityMaterial: 'Fiberglass Batt', pwfCavityType: '2x8 R28', finish: 'gypsum',
}

describe('resolveFoundationData', () => {
  describe('default concrete wall', () => {
    const result = resolveFoundationData(defaultConcrete)

    it('returns foundation type metadata', () => {
      expect(result.foundationType).toBe('concrete')
      expect(result.foundationTypeLabel).toBe('Poured Concrete')
      expect(result.structure).toContain('200 mm')
      expect(result.spacing).toBe('16"')
      expect(result.finishLabel).toBe('1/2" gypsum board')
      expect(result.finishForced).toBe(false)
      expect(result.gypsum).toEqual({ thicknessMm: 12.7, rsiPerMm: 0.0061, rsi: 0.0775 })
    })

    it('lists the layers outside to inside, same as the data layer', () => {
      expect(result.layers.map(l => l.id)).toEqual(['concrete', 'frame', 'finish', 'inside_air'])
      expect(result.layers.every(l => typeof l.label === 'string' && Number.isFinite(l.rsi))).toBe(true)
      expect(result.layers[0].rsi).toBeCloseTo(0.08, 6)
      expect(result.layers[3].rsi).toBe(0.12)
    })

    it('resolves the parallel-path working for the frame layer', () => {
      expect(result.frame).not.toBeNull()
      expect(result.frame.stud).toBe('2x6')
      expect(result.frame.spacing).toBe('16"')
      expect(result.frame.studDepthMm).toBe(140)
      expect(result.frame.studRsi).toBeCloseTo(1.19, 6)
      expect(result.frame.cavityRsi).toBe(3.87)
      expect(result.frame.framingPct).toBe(16)
      expect(result.frame.cavityPct).toBe(84)
      expect(result.frame.cavityMaterial).toBe('Fiberglass Batt')
      expect(result.frame.cavityType).toBe('2x6 R22')
      expect(result.frame.offset).toBe(false)
      expect(result.frame.ppRsi).toBeCloseTo(2.845, 3)
    })

    it('frame working reproduces the frame layer RSI', () => {
      const frameLayer = result.layers.find(l => l.id === 'frame')
      expect(parallelPath(result.frame.studRsi, result.frame.cavityRsi, result.frame.cavityPct)).toBeCloseTo(frameLayer.rsi, 9)
    })

    it('carries the concrete working and no other structural section', () => {
      expect(result.concrete).toEqual({ mm: 200, rsiPerMm: 0.0004 })
      expect(result.block).toBeNull()
      expect(result.icf).toBeNull()
    })

    it('calculates total 3.12, 0.2 points, meets the 2.98 minimum', () => {
      expect(result.totalRsi).toBeCloseTo(3.1224, 3)
      expect(result.roundedRsi).toBe(3.12)
      expect(result.points).toBe(0.2)
      expect(result.minRsi).toBe(2.98)
      expect(result.meetsMinimum).toBe(true)
    })
  })

  describe('concrete variants', () => {
    it('R20 @ 16" fails the minimum', () => {
      const r = resolveFoundationData({ ...defaultConcrete, cavityType: '2x6 R20' })
      expect(r.roundedRsi).toBe(2.87)
      expect(r.points).toBe(0)
      expect(r.meetsMinimum).toBe(false)
    })

    it('spacing changes the framing %: 19" -> 14.5, 24" -> 13', () => {
      expect(resolveFoundationData({ ...defaultConcrete, studSpacing: '19"' }).frame.framingPct).toBeCloseTo(14.5, 6)
      expect(resolveFoundationData({ ...defaultConcrete, studSpacing: '24"' }).frame.framingPct).toBe(13)
    })

    it('R20 held off the wall uses the 3.52 cavity RSI', () => {
      const r = resolveFoundationData({ ...defaultConcrete, cavityType: '2x6 R20', studOffset: true })
      expect(r.frame.cavityRsi).toBe(3.52)
      expect(r.frame.offset).toBe(true)
    })

    it('empty cavity uses studDepth and the 0.18 air space', () => {
      const r = resolveFoundationData({ ...defaultConcrete, cavityMaterial: EMPTY_CAVITY, studDepth: '2x4' })
      expect(r.frame.stud).toBe('2x4')
      expect(r.frame.studDepthMm).toBe(89)
      expect(r.frame.cavityRsi).toBe(0.18)
      expect(r.frame.cavityType).toBeNull()
    })

    it('no stud wall, exterior 4" XPS, no finish: no frame, no finish layer', () => {
      const r = resolveFoundationData({ ...defaultConcrete, hasStudWall: false, extInsType: 'XPS', extInsThickness: '4"', finish: 'none' })
      expect(r.frame).toBeNull()
      expect(r.spacing).toBeNull()
      expect(r.layers.map(l => l.id)).toEqual(['ext_ins', 'concrete', 'inside_air'])
      expect(r.finishLabel).toBe('None')
      expect(r.roundedRsi).toBe(3.61)
      expect(r.points).toBe(0.8)
    })

    it('interior foam forces the gypsum finish', () => {
      const r = resolveFoundationData({ ...defaultConcrete, cavityType: '2x4 R14', intInsType: 'XPS', intInsThickness: '1-1/2"', finish: 'none' })
      expect(r.finishForced).toBe(true)
      expect(r.finishLabel).toBe('1/2" gypsum board')
      expect(r.layers.map(l => l.id)).toContain('finish')
      expect(r.roundedRsi).toBe(3.37)
    })
  })

  describe('concrete block', () => {
    const r = resolveFoundationData({ ...defaultConcrete, foundationType: 'block', blockType: 'light_empty', concreteThickness: undefined })

    it('carries the block working', () => {
      expect(r.foundationTypeLabel).toBe('Concrete Block')
      expect(r.block).toEqual({ id: 'light_empty', label: 'Light-weight, cores empty', thicknessMm: 190, rsi: 0.32 })
      expect(r.concrete).toBeNull()
      expect(r.structure).toContain('Light-weight')
    })

    it('still resolves the frame and total', () => {
      expect(r.frame.studDepthMm).toBe(140)
      expect(r.roundedRsi).toBe(3.36)
    })
  })

  describe('ICF 2-1/2"', () => {
    const r = resolveFoundationData({ foundationType: 'icf', icfFormThickness: '2-1/2"' })

    it('has no frame rows and carries the ICF working', () => {
      expect(r.foundationTypeLabel).toBe('ICF')
      expect(r.frame).toBeNull()
      expect(r.spacing).toBeNull()
      expect(r.icf.formLabel).toBe('2-1/2"')
      expect(r.icf.formThicknessMm).toBe(63.5)
      expect(r.icf.epsRsiPerMm).toBe(0.026)
      expect(r.icf.concreteCoreMm).toBe(152.4)
      expect(r.icf.concreteRsiPerMm).toBe(0.0004)
      expect(r.layers.map(l => l.id)).toEqual(['icf_forms', 'icf_core', 'finish', 'inside_air'])
    })

    it('forces gypsum and scores 3.56 / 0.8', () => {
      expect(r.finishForced).toBe(true)
      expect(r.roundedRsi).toBe(3.56)
      expect(r.points).toBe(0.8)
      expect(r.meetsMinimum).toBe(true)
    })
  })

  describe('PWF 2x8 @ 16" R28', () => {
    const r = resolveFoundationData(pwfDefault)

    it('resolves the 184 mm stud and the PWF framing %', () => {
      expect(r.foundationTypeLabel).toBe('Permanent Wood Foundation')
      expect(r.frame.stud).toBe('2x8')
      expect(r.frame.studDepthMm).toBe(184)
      expect(r.frame.studRsi).toBeCloseTo(184 * 0.0085, 6)
      expect(r.frame.cavityRsi).toBe(4.93)
      expect(r.frame.cavityPct).toBe(84)
      expect(r.frame.framingPct).toBe(16)
      expect(r.frame.cavityType).toBe('2x8 R28')
    })

    it('cavity % by spacing: 8" -> 76, 12" -> 81, 16" -> 84', () => {
      expect(resolveFoundationData({ ...pwfDefault, pwfSpacing: '8"' }).frame.cavityPct).toBe(76)
      expect(resolveFoundationData({ ...pwfDefault, pwfSpacing: '12"' }).frame.cavityPct).toBe(81)
      expect(resolveFoundationData({ ...pwfDefault, pwfSpacing: '16"' }).frame.cavityPct).toBe(84)
    })

    it('has the plywood sheathing outside the frame and no concrete section', () => {
      expect(r.layers.map(l => l.id)).toEqual(['pwf_sheathing', 'frame', 'finish', 'inside_air'])
      expect(r.concrete).toBeNull()
      expect(r.block).toBeNull()
      expect(r.icf).toBeNull()
    })

    it('scores 3.97 / 1.4', () => {
      expect(r.roundedRsi).toBe(3.97)
      expect(r.points).toBe(1.4)
    })
  })

  describe('cross-check: total and points match the data layer', () => {
    const cases = [
      { name: 'default concrete', sel: defaultConcrete },
      { name: 'R20 @ 24"', sel: { ...defaultConcrete, cavityType: '2x6 R20', studSpacing: '24"' } },
      { name: 'R24 @ 24"', sel: { ...defaultConcrete, cavityType: '2x6 R24', studSpacing: '24"' } },
      { name: 'ext 2" XPS + R20', sel: { ...defaultConcrete, cavityType: '2x6 R20', extInsType: 'XPS', extInsThickness: '2"' } },
      { name: 'spray foam 2" + 2x4 R14', sel: { ...defaultConcrete, cavityType: '2x4 R14', intInsType: 'Closed-Cell Spray Foam', intInsThickness: '2"' } },
      { name: 'block light perlite', sel: { ...defaultConcrete, foundationType: 'block', blockType: 'light_perlite', concreteThickness: undefined } },
      { name: 'ICF 3-1/8"', sel: { foundationType: 'icf', icfFormThickness: '3-1/8"' } },
      { name: 'PWF 2x6 @ 12" R20', sel: { ...pwfDefault, pwfStud: '2x6', pwfSpacing: '12"', pwfCavityType: '2x6 R20' } },
    ]

    for (const { name, sel } of cases) {
      it(`matches calculateBelowGradeAssembly for ${name}`, () => {
        const resolved = resolveFoundationData(sel)
        const expected = calculateBelowGradeAssembly(sel)
        expect(resolved.totalRsi).toBeCloseTo(expected.total, 9)
        expect(resolved.layers).toEqual(expected.layers)
        expect(resolved.points).toBe(getBelowGradePoints(expected.total))
        if (resolved.frame) {
          const frameLayer = expected.layers.find(l => l.id === 'frame')
          expect(parallelPath(resolved.frame.studRsi, resolved.frame.cavityRsi, resolved.frame.cavityPct)).toBeCloseTo(frameLayer.rsi, 9)
        }
      })
    }
  })

  describe('blown-in cavity', () => {
    it('keys the basement stud wall by studDepth and falls back to cavityType', () => {
      const withDepth = resolveFoundationData({ ...defaultConcrete, cavityMaterial: 'Loose Fill Cellulose', cavityType: undefined, studDepth: '2x6' })
      const withType = resolveFoundationData({ ...defaultConcrete, cavityMaterial: 'Loose Fill Cellulose', cavityType: '2x6', studDepth: undefined })
      expect(withDepth).not.toBeNull()
      expect(withDepth.frame.stud).toBe('2x6')
      expect(withDepth.frame.cavityType).toBe('2x6')
      expect(withType.frame.cavityRsi).toBe(withDepth.frame.cavityRsi)
      expect(withType.totalRsi).toBeCloseTo(withDepth.totalRsi, 9)
    })
  })

  describe('null selection', () => {
    it('returns null when the assembly is null', () => {
      expect(resolveFoundationData({})).toBeNull()
      expect(resolveFoundationData(null)).toBeNull()
      expect(resolveFoundationData(undefined)).toBeNull()
      expect(resolveFoundationData({ foundationType: 'icf' })).toBeNull()
      expect(resolveFoundationData({ ...defaultConcrete, cavityType: undefined })).toBeNull()
    })
  })
})
