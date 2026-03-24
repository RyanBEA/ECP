#!/usr/bin/env node
/**
 * ECP Calculator — Data Pipeline
 *
 * Reads YAML material files, computes wall RSI values, and writes:
 *   - src/data/generated/wall-data.json       (stud-cavity lookups)
 *   - src/data/generated/continuous-ins.json   (rigid insulation RSI)
 *   - src/data/generated/icf-data.json         (ICF form RSI)
 *   - src/data/generated/boundary-options.json  (cladding/sheathing options)
 *   - src/data/generated/thresholds.json       (ECP point thresholds)
 *   - src/data/generated/double-stud-data.json (double stud combos)
 *
 * Usage:
 *   node scripts/generate.js           # generate all JSON
 *   node scripts/generate.js --audit   # compare against previous JSON
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadMaterials } from './loadMaterials.js'
import { parallelPath, steelCavityPct } from './compute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'data', 'generated')
const audit = process.argv.includes('--audit')

// Ensure output directory exists
mkdirSync(outDir, { recursive: true })

const m = loadMaterials()

// --- Wall Data JSON ---
// Structure: { wallType: { studs, rsi_per_mm, spacings: { spacing: { cavity_pct, materials: { label: { cavityType: { stud, studRsi, cavityRsi, ppRsi } } } } } } }
// ppRsi = parallel-path RSI of stud-cavity layer only (no boundary layers)

function generateWallData() {
  const data = {}

  for (const [wallType, framing] of Object.entries(m.framing)) {
    data[wallType] = { studs: framing.studs }

    if (wallType === 'wood') {
      data[wallType].rsi_per_mm = framing.rsi_per_mm
      data[wallType].spacings = {}

      for (const [spacingStr, cavityPct] of Object.entries(framing.cavity_pct)) {
        const spacing = spacingStr
        data[wallType].spacings[spacing] = { cavity_pct: cavityPct, materials: {} }

        for (const [matKey, mat] of Object.entries(m.cavity)) {
          const label = mat.label
          const entries = {}

          if (mat.type === 'batt') {
            for (const cav of mat.cavities) {
              if (!cav.wood_studs) continue
              for (const studId of cav.wood_studs) {
                const stud = framing.studs[studId]
                if (!stud) continue
                const studRsi = stud.depth_mm * framing.rsi_per_mm
                const cavRsi = cav.wood_rsi || cav.rsi
                const ppRsi = parallelPath(studRsi, cavRsi, cavityPct)
                entries[cav.id] = {
                  stud: studId,
                  studRsi: round6(studRsi),
                  cavityRsi: cavRsi,
                  ppRsi: round6(ppRsi),
                }
              }
            }
          } else {
            // Blown-in: available in all wood stud sizes
            for (const [studId, stud] of Object.entries(framing.studs)) {
              const studRsi = stud.depth_mm * framing.rsi_per_mm
              let cavRsi
              // Loose fill fiberglass uses depth-specific values
              if (matKey === 'loose_fill_fiberglass' && mat.depth_specific) {
                const depthEntry = mat.depth_specific[stud.depth_mm]
                cavRsi = depthEntry ? depthEntry.rsi : stud.depth_mm * mat.rsi_per_mm_deep
              } else {
                cavRsi = stud.depth_mm * mat.rsi_per_mm
              }
              const ppRsi = parallelPath(studRsi, cavRsi, cavityPct)
              entries[studId] = {
                stud: studId,
                studRsi: round6(studRsi),
                cavityRsi: round6(cavRsi),
                ppRsi: round6(ppRsi),
              }
            }
          }

          if (Object.keys(entries).length > 0) {
            data[wallType].spacings[spacing].materials[label] = entries
          }
        }
      }
    }

    if (wallType === 'steel') {
      data[wallType].rsi_per_mm = framing.rsi_per_mm
      data[wallType].k_values = framing.k_values
      data[wallType].spacings = {}

      const spacings = [16, 19, 24]
      for (const spacing of spacings) {
        const cavityPct = steelCavityPct(spacing)
        data[wallType].spacings[spacing] = { cavity_pct: round6(cavityPct), materials: {} }

        for (const [matKey, mat] of Object.entries(m.cavity)) {
          const label = mat.label
          const entries = {}

          if (mat.type === 'batt') {
            for (const cav of mat.cavities) {
              if (!cav.steel_studs) continue
              for (const studId of cav.steel_studs) {
                const stud = framing.studs[studId]
                if (!stud) continue
                const studRsi = stud.depth_mm * framing.rsi_per_mm
                const cavRsi = cav.steel_rsi || cav.rsi
                const ppRsi = parallelPath(studRsi, cavRsi, cavityPct)
                entries[cav.id] = {
                  stud: studId,
                  studRsi: round6(studRsi),
                  cavityRsi: cavRsi,
                  ppRsi: round6(ppRsi),
                }
              }
            }
          } else {
            for (const [studId, stud] of Object.entries(framing.studs)) {
              const studRsi = stud.depth_mm * framing.rsi_per_mm
              let cavRsi
              if (matKey === 'loose_fill_fiberglass' && mat.depth_specific) {
                const depthEntry = mat.depth_specific[stud.depth_mm]
                cavRsi = depthEntry ? depthEntry.rsi : stud.depth_mm * (mat.rsi_per_mm_deep || 0.029)
              } else {
                cavRsi = stud.depth_mm * mat.rsi_per_mm
              }
              const ppRsi = parallelPath(studRsi, cavRsi, cavityPct)
              entries[studId] = {
                stud: studId,
                studRsi: round6(studRsi),
                cavityRsi: round6(cavRsi),
                ppRsi: round6(ppRsi),
              }
            }
          }

          if (Object.keys(entries).length > 0) {
            data[wallType].spacings[spacing].materials[label] = entries
          }
        }
      }
    }
  }

  return data
}

// --- Continuous Insulation JSON ---
function generateContinuousIns() {
  const data = {}
  for (const [key, mat] of Object.entries(m.continuous)) {
    data[mat.label] = {
      rsi_per_mm: mat.rsi_per_mm,
      thicknesses: {},
    }
    for (const t of mat.thicknesses) {
      data[mat.label].thicknesses[t.label] = t.rsi
    }
  }
  return data
}

// --- ICF JSON ---
function generateIcf() {
  return {
    eps_rsi_per_mm: m.icf.eps_rsi_per_mm,
    concrete_core_mm: m.icf.concrete_core_mm,
    concrete_rsi_per_mm: m.icf.concrete_rsi_per_mm,
    forms: m.icf.forms.map(f => ({
      label: f.label,
      thickness_mm: f.thickness_mm,
      total_form_rsi: round6(f.thickness_mm * 2 * m.icf.eps_rsi_per_mm),
      concrete_rsi: round6(m.icf.concrete_core_mm * m.icf.concrete_rsi_per_mm),
    })),
  }
}

// --- Boundary Options JSON ---
function generateBoundaryOptions() {
  return {
    air_films: m.boundary.air_films,
    drywall: m.boundary.drywall,
    sheathing: {
      applies_to: m.boundary.sheathing.applies_to,
      default: m.boundary.sheathing.default,
      options: m.boundary.sheathing.options,
    },
    cladding: {
      applies_to: m.boundary.cladding.applies_to,
      defaults: m.boundary.cladding.defaults,
      options: m.boundary.cladding.options,
    },
    steel_air_space: m.boundary.steel_air_space,
  }
}

// --- Thresholds JSON ---
function generateThresholds() {
  return {
    walls: [
      { minRsi: 3.08, points: 1.6 },
      { minRsi: 3.69, points: 6.2 },
      { minRsi: 3.85, points: 6.9 },
      { minRsi: 3.96, points: 7.7 },
      { minRsi: 4.29, points: 9.2 },
      { minRsi: 4.4, points: 9.9 },
      { minRsi: 4.57, points: 10.6 },
      { minRsi: 4.73, points: 11.1 },
      { minRsi: 4.84, points: 11.6 },
      { minRsi: 5.01, points: 12.2 },
      { minRsi: 5.45, points: 13.6 },
    ],
    minWallRsi: 2.97,
  }
}

// --- Double Stud Presets JSON ---
function generateDoubleStudData() {
  const studs = ['2x4', '2x6']
  const plates = {
    '2x8': 184,
    '2x10': 235,
    '2x12': 286,
  }
  const spacings = { 16: 77, 19: 78.5, 24: 80 }
  const blownMaterials = Object.entries(m.cavity)
    .filter(([_, mat]) => mat.type === 'blown')

  const data = {}
  for (const [spacingStr, cavPct] of Object.entries(spacings)) {
    data[spacingStr] = {}
    for (const outerStud of studs) {
      for (const innerStud of studs) {
        for (const [plateId, plateMm] of Object.entries(plates)) {
          const outerMm = m.framing.wood.studs[outerStud].depth_mm
          const innerMm = m.framing.wood.studs[innerStud].depth_mm
          const gapMm = plateMm - outerMm - innerMm
          if (gapMm <= 0) continue

          for (const [matKey, mat] of blownMaterials) {
            const rsiPerMm = mat.rsi_per_mm || mat.rsi_per_mm_deep || 0.029
            const outerStudRsi = outerMm * 0.0085
            const outerCavRsi = outerMm * rsiPerMm
            const outerPp = parallelPath(outerStudRsi, outerCavRsi, cavPct)

            const innerStudRsi = innerMm * 0.0085
            const innerCavRsi = innerMm * rsiPerMm
            const innerPp = parallelPath(innerStudRsi, innerCavRsi, cavPct)

            const gapRsi = gapMm * rsiPerMm

            const key = `${outerStud}+${innerStud}|${plateId}|${mat.label}`
            data[spacingStr][key] = {
              outerStud, innerStud, plate: plateId,
              material: mat.label,
              rsiPerMm,
              outerPpRsi: round6(outerPp),
              gapMm, gapRsi: round6(gapRsi),
              innerPpRsi: round6(innerPp),
              totalPpRsi: round6(outerPp + gapRsi + innerPp),
            }
          }
        }
      }
    }
  }
  return data
}

// --- Utilities ---
function round6(n) { return Math.round(n * 1000000) / 1000000 }

function writeJson(filename, data) {
  const path = join(outDir, filename)
  const json = JSON.stringify(data, null, 2) + '\n'

  if (audit && existsSync(path)) {
    const prev = readFileSync(path, 'utf8')
    if (prev === json) {
      console.log(`  ${filename}: unchanged`)
    } else {
      console.log(`  ${filename}: CHANGED`)
    }
  }

  writeFileSync(path, json)
}

// --- Main ---
console.log('Generating ECP data...')

writeJson('wall-data.json', generateWallData())
writeJson('continuous-ins.json', generateContinuousIns())
writeJson('icf-data.json', generateIcf())
writeJson('boundary-options.json', generateBoundaryOptions())
writeJson('thresholds.json', generateThresholds())
writeJson('double-stud-data.json', generateDoubleStudData())

// Summary
const wallData = generateWallData()
let woodCount = 0, steelCount = 0
for (const [wt, data] of Object.entries(wallData)) {
  if (!data.spacings) continue
  for (const sp of Object.values(data.spacings)) {
    for (const mats of Object.values(sp.materials)) {
      const n = Object.keys(mats).length
      if (wt === 'wood') woodCount += n
      if (wt === 'steel') steelCount += n
    }
  }
}

const dsData = generateDoubleStudData()
const dsCount = Object.values(dsData).reduce((sum, sp) => sum + Object.keys(sp).length, 0)

console.log(`  Wood single wall combos: ${woodCount}`)
console.log(`  Steel single wall combos: ${steelCount}`)
console.log(`  Double stud combos: ${dsCount}`)
console.log('Done.')
