/**
 * Round-trip validation — verifies ALL generated JSON by re-computing from
 * YAML inputs using compute.js. If either generate.js or compute.js changes
 * in a way that breaks consistency, these tests catch it.
 *
 * Coverage: 255 combos across 7 groups:
 *   - Wood single-stud: 87 combos
 *   - Steel single-stud: 42 combos
 *   - Double stud: 72 combos
 *   - Continuous insulation: 25 combos
 *   - ICF forms: 3 combos
 *   - Boundary options: 15 combos (7 sheathing + 8 cladding)
 *   - Thresholds: 11 entries + structural checks
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadMaterials } from './loadMaterials.js'
import { parallelPath, steelCavityPct } from './compute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const genDir = join(__dirname, '..', 'src', 'data', 'generated')

function readJson(filename) {
  return JSON.parse(readFileSync(join(genDir, filename), 'utf8'))
}

function round6(n) { return Math.round(n * 1000000) / 1000000 }

const m = loadMaterials()
const wallData = readJson('wall-data.json')
const doubleStudData = readJson('double-stud-data.json')
const contInsData = readJson('continuous-ins.json')
const icfData = readJson('icf-data.json')
const boundaryData = readJson('boundary-options.json')
const thresholdData = readJson('thresholds.json')

// Map display labels back to YAML material keys
const labelToKey = {}
for (const [key, mat] of Object.entries(m.cavity)) {
  labelToKey[mat.label] = key
}

// ─────────────────────────────────────────────────────────────
// 1. Wood single-stud wall combos (87 tests)
// ─────────────────────────────────────────────────────────────
describe('Wood single-stud wall combos', () => {
  for (const [spacing, spData] of Object.entries(wallData.wood.spacings)) {
    for (const [matLabel, entries] of Object.entries(spData.materials)) {
      for (const [cavType, entry] of Object.entries(entries)) {
        const matKey = labelToKey[matLabel]
        const mat = m.cavity[matKey]
        // Blown-in tolerance is wider due to RSI/mm depth approximation
        const tolerance = mat.type === 'blown' ? 1 : 4

        it(`wood/${spacing}"/${matLabel}/${cavType} ppRsi = ${entry.ppRsi}`, () => {
          const studDepthMm = m.framing.wood.studs[entry.stud].depth_mm
          const studRsi = studDepthMm * m.framing.wood.rsi_per_mm
          const cavityPct = spData.cavity_pct

          // Reconstruct cavity RSI the same way generate.js does
          let cavityRsi
          if (mat.type === 'batt') {
            const cav = mat.cavities.find(c => c.id === cavType)
            expect(cav, `cavity ${cavType} should exist in YAML`).toBeTruthy()
            cavityRsi = cav.wood_rsi || cav.rsi
          } else {
            if (matKey === 'loose_fill_fiberglass' && mat.depth_specific) {
              const depthEntry = mat.depth_specific[studDepthMm]
              cavityRsi = depthEntry ? depthEntry.rsi : studDepthMm * mat.rsi_per_mm_deep
            } else {
              cavityRsi = studDepthMm * mat.rsi_per_mm
            }
          }

          const ppRsi = parallelPath(studRsi, cavityRsi, cavityPct)

          // Verify stored studRsi
          expect(round6(studRsi)).toBeCloseTo(entry.studRsi, 6)
          // Verify stored cavityRsi
          expect(round6(cavityRsi)).toBeCloseTo(entry.cavityRsi, tolerance)
          // Verify ppRsi
          expect(round6(ppRsi)).toBeCloseTo(entry.ppRsi, tolerance)
        })
      }
    }
  }
})

// ─────────────────────────────────────────────────────────────
// 2. Steel single-stud wall combos (42 tests)
// ─────────────────────────────────────────────────────────────
describe('Steel single-stud wall combos', () => {
  for (const [spacing, spData] of Object.entries(wallData.steel.spacings)) {
    const spacingNum = parseInt(spacing)
    const expectedCavityPct = steelCavityPct(spacingNum)

    it(`steel/${spacing}" cavity_pct matches steelCavityPct()`, () => {
      expect(round6(expectedCavityPct)).toBeCloseTo(spData.cavity_pct, 6)
    })

    for (const [matLabel, entries] of Object.entries(spData.materials)) {
      for (const [cavType, entry] of Object.entries(entries)) {
        const matKey = labelToKey[matLabel]
        const mat = m.cavity[matKey]

        it(`steel/${spacing}"/${matLabel}/${cavType} ppRsi = ${entry.ppRsi}`, () => {
          const studDepthMm = m.framing.steel.studs[entry.stud].depth_mm
          const studRsi = studDepthMm * m.framing.steel.rsi_per_mm
          const cavityPct = expectedCavityPct

          // Reconstruct cavity RSI
          let cavityRsi
          if (mat.type === 'batt') {
            // Steel batts: match by steel_studs membership
            let cav = mat.cavities.find(c => c.id === cavType)
            if (!cav) {
              // For steel, cavity names might reference steel stud sizes
              const rVal = cavType.split(' ').pop()
              cav = mat.cavities.find(c =>
                c.steel_studs?.includes(cavType.split(' ')[0]) &&
                c.id.endsWith(rVal)
              )
            }
            expect(cav, `cavity ${cavType} should exist for steel`).toBeTruthy()
            cavityRsi = cav.steel_rsi || cav.rsi
          } else {
            if (matKey === 'loose_fill_fiberglass' && mat.depth_specific) {
              const depthEntry = mat.depth_specific[studDepthMm]
              cavityRsi = depthEntry ? depthEntry.rsi : studDepthMm * (mat.rsi_per_mm_deep || 0.029)
            } else {
              cavityRsi = studDepthMm * mat.rsi_per_mm
            }
          }

          const ppRsi = parallelPath(studRsi, cavityRsi, cavityPct)

          // Verify stored studRsi
          expect(round6(studRsi)).toBeCloseTo(entry.studRsi, 6)
          // Verify stored cavityRsi
          expect(round6(cavityRsi)).toBeCloseTo(entry.cavityRsi, 2)
          // Verify ppRsi (steel has intermediate rounding from K-factor method)
          expect(round6(ppRsi)).toBeCloseTo(entry.ppRsi, 2)
        })
      }
    }
  }
})

// ─────────────────────────────────────────────────────────────
// 3. Double stud combos (72 tests)
// ─────────────────────────────────────────────────────────────
describe('Double stud wall combos', () => {
  for (const [spacing, combos] of Object.entries(doubleStudData)) {
    const cavityPct = wallData.wood.spacings[spacing].cavity_pct

    for (const [comboKey, entry] of Object.entries(combos)) {
      it(`dbl/${spacing}"/${comboKey} totalPpRsi = ${entry.totalPpRsi}`, () => {
        const outerMm = m.framing.wood.studs[entry.outerStud].depth_mm
        const innerMm = m.framing.wood.studs[entry.innerStud].depth_mm
        const rsiPerMm = entry.rsiPerMm

        // Outer stud row
        const outerStudRsi = outerMm * 0.0085
        const outerCavRsi = outerMm * rsiPerMm
        const outerPp = parallelPath(outerStudRsi, outerCavRsi, cavityPct)

        // Inner stud row
        const innerStudRsi = innerMm * 0.0085
        const innerCavRsi = innerMm * rsiPerMm
        const innerPp = parallelPath(innerStudRsi, innerCavRsi, cavityPct)

        // Gap
        const gapRsi = entry.gapMm * rsiPerMm

        // Total
        const totalPp = outerPp + gapRsi + innerPp

        expect(round6(outerPp)).toBeCloseTo(entry.outerPpRsi, 2)
        expect(round6(gapRsi)).toBeCloseTo(entry.gapRsi, 4)
        expect(round6(innerPp)).toBeCloseTo(entry.innerPpRsi, 2)
        expect(round6(totalPp)).toBeCloseTo(entry.totalPpRsi, 2)

        // Verify additive identity: totalPpRsi = outerPpRsi + gapRsi + innerPpRsi
        expect(entry.totalPpRsi).toBeCloseTo(
          entry.outerPpRsi + entry.gapRsi + entry.innerPpRsi, 4
        )
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────
// 4. Continuous insulation (25 tests)
// ─────────────────────────────────────────────────────────────
describe('Continuous insulation', () => {
  for (const [matLabel, matData] of Object.entries(contInsData)) {
    // Find corresponding YAML entry by label
    const yamlEntry = Object.values(m.continuous).find(c => c.label === matLabel)

    it(`${matLabel}: rsi_per_mm matches YAML`, () => {
      expect(yamlEntry, `YAML entry for ${matLabel} should exist`).toBeTruthy()
      expect(matData.rsi_per_mm).toBe(yamlEntry.rsi_per_mm)
    })

    for (const [thickLabel, rsi] of Object.entries(matData.thicknesses)) {
      it(`${matLabel}/${thickLabel}: RSI = ${rsi}`, () => {
        // Find matching thickness in YAML
        const yamlThick = yamlEntry.thicknesses.find(t => t.label === thickLabel)
        expect(yamlThick, `thickness ${thickLabel} should exist in YAML`).toBeTruthy()

        // JSON RSI should match YAML RSI exactly
        expect(rsi).toBe(yamlThick.rsi)

        // RSI should be positive
        expect(rsi).toBeGreaterThan(0)
      })
    }
  }
})

// ─────────────────────────────────────────────────────────────
// 5. ICF forms (3 tests)
// ─────────────────────────────────────────────────────────────
describe('ICF forms', () => {
  it('eps_rsi_per_mm matches YAML', () => {
    expect(icfData.eps_rsi_per_mm).toBe(m.icf.eps_rsi_per_mm)
  })

  it('concrete_core_mm matches YAML', () => {
    expect(icfData.concrete_core_mm).toBe(m.icf.concrete_core_mm)
  })

  it('concrete_rsi_per_mm matches YAML', () => {
    expect(icfData.concrete_rsi_per_mm).toBe(m.icf.concrete_rsi_per_mm)
  })

  icfData.forms.forEach((form, i) => {
    const yamlForm = m.icf.forms[i]

    it(`ICF ${form.label}: total_form_rsi = thickness_mm * 2 * eps_rsi_per_mm`, () => {
      expect(form.thickness_mm).toBe(yamlForm.thickness_mm)

      const expectedFormRsi = round6(form.thickness_mm * 2 * icfData.eps_rsi_per_mm)
      expect(form.total_form_rsi).toBeCloseTo(expectedFormRsi, 4)
    })

    it(`ICF ${form.label}: concrete_rsi = core_mm * concrete_rsi_per_mm`, () => {
      const expectedConcreteRsi = round6(icfData.concrete_core_mm * icfData.concrete_rsi_per_mm)
      expect(form.concrete_rsi).toBeCloseTo(expectedConcreteRsi, 4)
    })
  })
})

// ─────────────────────────────────────────────────────────────
// 6. Boundary options (15 tests: 7 sheathing + 8 cladding)
// ─────────────────────────────────────────────────────────────
describe('Boundary options — sheathing', () => {
  const yamlSheathing = m.boundary.sheathing

  it('sheathing applies_to matches YAML', () => {
    expect(boundaryData.sheathing.applies_to).toEqual(yamlSheathing.applies_to)
  })

  it('sheathing default matches YAML', () => {
    expect(boundaryData.sheathing.default).toBe(yamlSheathing.default)
  })

  boundaryData.sheathing.options.forEach(opt => {
    const yamlOpt = yamlSheathing.options.find(o => o.id === opt.id)

    it(`sheathing/${opt.id}: RSI = ${opt.rsi}, label non-empty`, () => {
      expect(yamlOpt, `YAML entry for ${opt.id} should exist`).toBeTruthy()
      expect(opt.rsi).toBe(yamlOpt.rsi)
      expect(opt.rsi).toBeGreaterThan(0)
      expect(opt.label).toBeTruthy()
      expect(opt.label.length).toBeGreaterThan(0)
    })
  })
})

describe('Boundary options — cladding', () => {
  const yamlCladding = m.boundary.cladding

  it('cladding applies_to matches YAML', () => {
    expect(boundaryData.cladding.applies_to).toEqual(yamlCladding.applies_to)
  })

  it('cladding defaults match YAML', () => {
    expect(boundaryData.cladding.defaults).toEqual(yamlCladding.defaults)
  })

  boundaryData.cladding.options.forEach(opt => {
    const yamlOpt = yamlCladding.options.find(o => o.id === opt.id)

    it(`cladding/${opt.id}: RSI = ${opt.rsi}, label non-empty`, () => {
      expect(yamlOpt, `YAML entry for ${opt.id} should exist`).toBeTruthy()
      expect(opt.rsi).toBe(yamlOpt.rsi)
      expect(opt.rsi).toBeGreaterThan(0)
      expect(opt.label).toBeTruthy()
      expect(opt.label.length).toBeGreaterThan(0)
    })
  })
})

describe('Boundary options — fixed layers', () => {
  it('air films match YAML', () => {
    expect(boundaryData.air_films.outside).toBe(m.boundary.air_films.outside)
    expect(boundaryData.air_films.inside).toBe(m.boundary.air_films.inside)
  })

  it('drywall matches YAML', () => {
    expect(boundaryData.drywall.default).toBe(m.boundary.drywall.default)
  })

  it('steel air space matches YAML', () => {
    expect(boundaryData.steel_air_space.rsi).toBe(m.boundary.steel_air_space.rsi)
  })
})

// ─────────────────────────────────────────────────────────────
// 7. Thresholds (structural checks)
// ─────────────────────────────────────────────────────────────
describe('Thresholds', () => {
  it('walls array is non-empty', () => {
    expect(thresholdData.walls.length).toBeGreaterThan(0)
  })

  it('walls array is sorted by minRsi ascending', () => {
    for (let i = 1; i < thresholdData.walls.length; i++) {
      expect(thresholdData.walls[i].minRsi).toBeGreaterThan(
        thresholdData.walls[i - 1].minRsi
      )
    }
  })

  it('no duplicate minRsi values', () => {
    const rsiValues = thresholdData.walls.map(w => w.minRsi)
    expect(new Set(rsiValues).size).toBe(rsiValues.length)
  })

  it('no duplicate points values', () => {
    const pointValues = thresholdData.walls.map(w => w.points)
    expect(new Set(pointValues).size).toBe(pointValues.length)
  })

  it('minWallRsi is present and positive', () => {
    expect(thresholdData.minWallRsi).toBeGreaterThan(0)
  })

  it('minWallRsi is less than first threshold', () => {
    expect(thresholdData.minWallRsi).toBeLessThan(thresholdData.walls[0].minRsi)
  })

  thresholdData.walls.forEach(entry => {
    it(`threshold minRsi=${entry.minRsi}: points=${entry.points} > 0`, () => {
      expect(entry.minRsi).toBeGreaterThan(0)
      expect(entry.points).toBeGreaterThan(0)
    })
  })
})
