# Wall Assembly RSI Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Export to Excel" button to the wall builder that generates a `.xlsx` workbook with live formulas showing the full RSI calculation and an embedded PNG of the wall section diagram.

**Architecture:** Three new utility files: `resolveWallData.js` (extracts all intermediate calculation values from a selection), `buildWallSheet.js` (builds the Excel sheet with live formulas for each wall type), and `exportWallAssembly.js` (orchestrates: resolve data, build sheet, convert SVG to PNG, trigger download). WallBuilder.jsx gets a button and a container ref.

**Tech Stack:** ExcelJS (already installed), native browser Canvas API for SVG-to-PNG, Vitest for testing.

**Spec:** `docs/superpowers/specs/2026-03-25-wall-export-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/utils/resolveWallData.js` | Given a `selection` object, returns a structured object with all intermediate values needed for the Excel sheet (stud RSI, cavity RSI, cavity %, boundary layer RSIs with labels, parallel-path results, K-factors for steel, etc.). Mirrors the logic paths in `calculateWallRsi()` but exposes every intermediate value. |
| `src/utils/resolveWallData.test.js` | Tests for resolveWallData covering all wall type paths. |
| `src/utils/buildWallSheet.js` | Takes an ExcelJS workbook and a resolved data object, builds the appropriate sheet layout with live formulas. Contains three internal functions: `buildWoodSheet`, `buildSteelSheet`, `buildIcfSheet`. |
| `src/utils/buildWallSheet.test.js` | Tests that verify correct cell values and formulas for each wall type template. |
| `src/utils/svgToPng.js` | Converts an SVG DOM element to a base64 PNG string via canvas. |
| `src/utils/exportWallAssembly.js` | Orchestrator: dynamically imports ExcelJS, calls resolveWallData, buildWallSheet, svgToPng, triggers browser download. |
| `src/components/WallBuilder.jsx` | Modified: adds export button below wall section diagram, adds ref on wall-section-container div. |
| `src/App.css` | Modified: button styling for export button. |

---

## Chunk 1: Data Resolution

### Task 1: resolveWallData — extract intermediate calculation values

This function mirrors `calculateWallRsi()` in `src/data/ecpData.js` (lines 220–344) but returns all intermediate values instead of just the total RSI. It imports the same generated JSON data files and compute functions.

**Files:**
- Create: `src/utils/resolveWallData.js`
- Create: `src/utils/resolveWallData.test.js`
- Read (reference, do not modify): `src/data/ecpData.js:220-344` — calculation logic to mirror
- Read (reference, do not modify): `scripts/compute.js` — formula functions
- Read (reference, do not modify): `src/data/generated/wall-data.json` — stud depths, cavity RSI, cavity %, materials
- Read (reference, do not modify): `src/data/generated/boundary-options.json` — air films, cladding, sheathing RSI values and labels
- Read (reference, do not modify): `src/data/generated/continuous-ins.json` — continuous insulation RSI by type/thickness
- Read (reference, do not modify): `src/data/generated/icf-data.json` — ICF form data
- Read (reference, do not modify): `src/data/generated/double-stud-data.json` — double stud pre-computed data

**Context:** The selection object comes from App.jsx state and has these fields:
```
{ wallType, assemblyType, studSpacing, cavityMaterial, cavityType,
  contInsType, contInsThickness, icfFormThickness,
  sheathingId, claddingId,
  outerStud, innerStud, plate, doubleStudMaterial,
  hasServiceWall, serviceSpacing, serviceCavityMaterial, serviceCavityType,
  interiorLayerMaterial, interiorLayerThickness }
```

The function returns a structured object like:
```js
{
  wallType: 'wood',           // 'wood' | 'steel' | 'icf'
  wallTypeLabel: 'Wood Frame',
  assemblyType: 'single',    // 'single' | 'doubleStud'
  studSpacing: '16"',
  totalRsi: 2.81,
  points: 0,

  // Boundary layers — always present, with RSI values AND labels
  boundary: {
    outsideAir: { rsi: 0.03, label: 'Outside Air Film' },
    cladding: { rsi: 0.11, label: 'Vinyl/Metal Siding (hollow-backed)', id: 'vinyl_siding' },
    sheathing: { rsi: 0.108, label: '7/16" (11 mm) OSB', id: 'osb_11' },  // null for steel/icf
    airSpace: { rsi: 0.18, label: 'Air Space' },  // null for wood/icf
    drywall: { rsi: 0.08, label: '1/2" Gypsum' },
    insideAir: { rsi: 0.12, label: 'Inside Air Film' },
  },

  // Continuous insulation — null when not applicable
  contIns: { type: 'XPS', thickness: '2"', rsi: 1.68 },

  // Main wall (wood single stud)
  mainWall: {
    studDepthMm: 140,
    studRsi: 1.19,       // depth_mm * 0.0085 (wood) or depth_mm * 0.0000161 (steel)
    cavityPct: 77,
    cavityRsi: 3.34,
    cavityMaterial: 'Fiberglass Batt',
    cavityType: '2x6 R20',
    ppRsi: 2.36,         // parallel-path result
  },

  // Double stud fields — null when assemblyType !== 'doubleStud'
  doubleStud: {
    outerStud: '2x4', outerDepthMm: 89, outerStudRsi: 0.7565,
    outerCavityRsi: 2.225, outerPpRsi: 1.538,
    innerStud: '2x4', innerDepthMm: 89, innerStudRsi: 0.7565,
    innerCavityRsi: 2.225, innerPpRsi: 1.538,
    plate: '2x10', plateDepthMm: 235,
    gapMm: 57, gapRsi: 1.425,
    material: 'Loose Fill Cellulose', rsiPerMm: 0.025,
    cavityPct: 77,  // same as mainWall.cavityPct (from stud spacing)
  },

  // Steel-specific fields — null when wallType !== 'steel'
  steel: {
    k1: 0.33, k2: 0.67,
    boundarySum: 0.45,
    rsiT1: 2.89, rsiT2: 0.174, rsiT3: 0.624,
  },

  // ICF-specific fields — null when wallType !== 'icf'
  icf: {
    formThicknessMm: 63.5,
    epsRsiPerMm: 0.026,
    formRsi: 3.302,        // formThicknessMm * 2 * epsRsiPerMm
    concreteCoreMm: 152.4,
    concreteRsiPerMm: 0.0004,
    concreteRsi: 0.06096,
  },

  // Service wall fields — null when hasServiceWall is false
  serviceWall: {
    studSpacing: '16"',
    studDepthMm: 89,
    studRsi: 0.7565,
    cavityPct: 77,
    cavityRsi: 2.11,
    cavityMaterial: 'Fiberglass Batt',
    cavityType: '2x4 R12',
    ppRsi: 1.495,
  },

  // Interior layer — null when hasServiceWall is false
  interiorLayer: {
    material: '7/16" (11 mm) OSB',  // resolved label
    rsi: 0.108,
  },
}
```

- [ ] **Step 1: Write tests for wood single stud resolution**

Create `src/utils/resolveWallData.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolveWallData } from './resolveWallData'

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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /srv/clients/BTZx/job-aids/20_Endorsed/D06_Job_Aid_v0.5_Alpha/ECPTool/ecp-calculator
npx vitest run src/utils/resolveWallData.test.js
```

Expected: FAIL — `resolveWallData` module not found.

- [ ] **Step 3: Implement resolveWallData for wood single stud**

Create `src/utils/resolveWallData.js`:

```js
/**
 * Resolve all intermediate calculation values from a wall builder selection.
 *
 * Mirrors the logic in ecpData.js calculateWallRsi() but returns a structured
 * object exposing every intermediate value for Excel export.
 */

import wallData from '../data/generated/wall-data.json'
import continuousInsData from '../data/generated/continuous-ins.json'
import icfData from '../data/generated/icf-data.json'
import boundaryOptions from '../data/generated/boundary-options.json'
import doubleStudData from '../data/generated/double-stud-data.json'
import { parallelPath, boundarySum, steelKValues, steelCavityPct } from '@scripts/compute.js'
import { getContinuousInsRsi, getInteriorLayerRsi, getWallPoints } from '../data/ecpData'

const WALL_TYPE_LABELS = { wood: 'Wood Frame', steel: 'Steel Frame', icf: 'ICF' }

/**
 * Resolve boundary layers with RSI values and human-readable labels.
 */
function resolveBoundary(wallType, sheathingId, claddingId) {
  const outsideAir = { rsi: boundaryOptions.air_films.outside, label: 'Outside Air Film' }
  const insideAir = { rsi: boundaryOptions.air_films.inside, label: 'Inside Air Film' }
  const drywall = { rsi: boundaryOptions.drywall.default, label: '1/2" Gypsum' }

  // Cladding
  const clId = claddingId || boundaryOptions.cladding.defaults[wallType]
  const clOption = boundaryOptions.cladding.options.find(o => o.id === clId)
  const cladding = clOption
    ? { rsi: clOption.rsi, label: clOption.label, id: clId }
    : { rsi: 0, label: 'None', id: null }

  // Sheathing (wood only)
  let sheathing = null
  if (boundaryOptions.sheathing.applies_to.includes(wallType)) {
    const shId = sheathingId || boundaryOptions.sheathing.default
    const shOption = boundaryOptions.sheathing.options.find(o => o.id === shId)
    sheathing = shOption
      ? { rsi: shOption.rsi, label: shOption.label, id: shId }
      : { rsi: 0, label: 'None', id: null }
  }

  // Air space (steel only)
  let airSpace = null
  if (wallType === 'steel') {
    airSpace = { rsi: boundaryOptions.steel_air_space.rsi, label: 'Air Space' }
  }

  return { outsideAir, cladding, sheathing, airSpace, drywall, insideAir }
}

/**
 * Build the boundary object expected by compute.js functions.
 */
function toBoundaryObj(resolved) {
  return {
    outside_air: resolved.outsideAir.rsi,
    cladding: resolved.cladding.rsi,
    sheathing: resolved.sheathing?.rsi || 0,
    air_space: resolved.airSpace?.rsi || 0,
    drywall: resolved.drywall.rsi,
    inside_air: resolved.insideAir.rsi,
  }
}

export function resolveWallData(selection) {
  const {
    wallType, assemblyType = 'single', studSpacing,
    cavityMaterial, cavityType,
    contInsType, contInsThickness,
    icfFormThickness,
    sheathingId, claddingId,
    outerStud, innerStud, plate, doubleStudMaterial,
    hasServiceWall = false,
    serviceSpacing, serviceCavityMaterial, serviceCavityType,
    interiorLayerMaterial, interiorLayerThickness,
  } = selection || {}

  if (!wallType) return null

  const boundary = resolveBoundary(wallType, sheathingId, claddingId)
  const boundaryObj = toBoundaryObj(boundary)
  const contInsRsi = getContinuousInsRsi(contInsType, contInsThickness)
  const contIns = contInsRsi > 0
    ? { type: contInsType, thickness: contInsThickness, rsi: contInsRsi }
    : null

  const base = {
    wallType,
    wallTypeLabel: WALL_TYPE_LABELS[wallType] || wallType,
    assemblyType: wallType === 'wood' ? assemblyType : null,
    studSpacing: wallType !== 'icf' ? studSpacing : null,
    boundary,
    contIns,
    mainWall: null,
    doubleStud: null,
    steel: null,
    icf: null,
    serviceWall: null,
    interiorLayer: null,
    totalRsi: null,
    points: 0,
  }

  const spacing = studSpacing?.replace('"', '') || ''

  // --- ICF path ---
  if (wallType === 'icf') {
    const form = icfData.forms.find(f => f.label === icfFormThickness)
    if (!form) return base

    const formRsi = form.thickness_mm * 2 * icfData.eps_rsi_per_mm
    const concreteRsi = icfData.concrete_core_mm * icfData.concrete_rsi_per_mm

    base.icf = {
      formThicknessMm: form.thickness_mm,
      formLabel: icfFormThickness,
      epsRsiPerMm: icfData.eps_rsi_per_mm,
      formRsi,
      concreteCoreMm: icfData.concrete_core_mm,
      concreteRsiPerMm: icfData.concrete_rsi_per_mm,
      concreteRsi,
    }

    base.totalRsi = boundaryObj.outside_air + boundaryObj.cladding
      + formRsi + concreteRsi
      + boundaryObj.drywall + boundaryObj.inside_air
    base.points = getWallPoints(base.totalRsi)
    return base
  }

  // --- Wood / Steel common: resolve main wall entry ---
  const wt = wallData[wallType]
  if (!wt?.spacings?.[spacing]) return base
  const sp = wt.spacings[spacing]

  // --- Service wall path (wood only) ---
  if (hasServiceWall && wallType === 'wood') {
    // Primary wall
    let primaryPP, mainWallData, resolvedDoubleStud
    if (assemblyType === 'doubleStud') {
      const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
      const dsEntry = doubleStudData[spacing]?.[key]
      if (!dsEntry) return base

      primaryPP = dsEntry.totalPpRsi
      const outerDepthMm = wt.studs[dsEntry.outerStud]?.depth_mm || 89
      const innerDepthMm = wt.studs[dsEntry.innerStud]?.depth_mm || 89
      const plateDepthMm = wt.studs[dsEntry.plate]?.depth_mm || 235

      resolvedDoubleStud = {
        outerStud: dsEntry.outerStud, outerDepthMm,
        outerStudRsi: outerDepthMm * 0.0085,
        outerCavityRsi: outerDepthMm * dsEntry.rsiPerMm,
        outerPpRsi: dsEntry.outerPpRsi,
        innerStud: dsEntry.innerStud, innerDepthMm,
        innerStudRsi: innerDepthMm * 0.0085,
        innerCavityRsi: innerDepthMm * dsEntry.rsiPerMm,
        innerPpRsi: dsEntry.innerPpRsi,
        plate: dsEntry.plate, plateDepthMm,
        gapMm: dsEntry.gapMm, gapRsi: dsEntry.gapRsi,
        material: dsEntry.material, rsiPerMm: dsEntry.rsiPerMm,
        cavityPct: sp.cavity_pct,
      }
      // For double stud, mainWall holds the summary
      mainWallData = {
        studDepthMm: outerDepthMm, studRsi: outerDepthMm * 0.0085,
        cavityPct: sp.cavity_pct, cavityRsi: outerDepthMm * dsEntry.rsiPerMm,
        cavityMaterial: dsEntry.material, cavityType: null,
        ppRsi: dsEntry.outerPpRsi,
      }
    } else {
      const entry = sp.materials[cavityMaterial]?.[cavityType]
      if (!entry) return base
      const studRsi = wt.studs[entry.stud].depth_mm * 0.0085
      primaryPP = parallelPath(studRsi, entry.cavityRsi, sp.cavity_pct)
      mainWallData = {
        studDepthMm: wt.studs[entry.stud].depth_mm,
        studRsi,
        cavityPct: sp.cavity_pct,
        cavityRsi: entry.cavityRsi,
        cavityMaterial,
        cavityType,
        ppRsi: primaryPP,
      }
    }

    // Service wall
    const svcSpacing = serviceSpacing?.replace('"', '') || ''
    if (!wt.spacings?.[svcSpacing]) return base
    const svcSp = wt.spacings[svcSpacing]
    const svcEntry = svcSp.materials[serviceCavityMaterial]?.[serviceCavityType]
    if (!svcEntry) return base
    const svcStudRsi = wt.studs[svcEntry.stud].depth_mm * 0.0085
    const servicePP = parallelPath(svcStudRsi, svcEntry.cavityRsi, svcSp.cavity_pct)

    // Interior layer
    const intLayerRsi = getInteriorLayerRsi(interiorLayerMaterial, interiorLayerThickness)
    let intLayerLabel = null
    if (interiorLayerMaterial) {
      const shOpt = boundaryOptions.sheathing.options.find(o => o.id === interiorLayerMaterial)
      intLayerLabel = shOpt ? shOpt.label : `${interiorLayerThickness || ''} ${interiorLayerMaterial}`.trim()
    }

    base.mainWall = mainWallData
    base.doubleStud = resolvedDoubleStud || null
    base.serviceWall = {
      studSpacing: serviceSpacing,
      studDepthMm: wt.studs[svcEntry.stud].depth_mm,
      studRsi: svcStudRsi,
      cavityPct: svcSp.cavity_pct,
      cavityRsi: svcEntry.cavityRsi,
      cavityMaterial: serviceCavityMaterial,
      cavityType: serviceCavityType,
      ppRsi: servicePP,
    }
    base.interiorLayer = interiorLayerMaterial
      ? { material: intLayerLabel, rsi: intLayerRsi }
      : null
    base.contIns = null  // no cont ins with service wall

    base.totalRsi = boundarySum(boundaryObj) + primaryPP + intLayerRsi + servicePP
    base.points = getWallPoints(base.totalRsi)
    return base
  }

  // --- Single stud path (wood or steel) ---
  if (assemblyType === 'single' || wallType === 'steel') {
    const entry = sp.materials[cavityMaterial]?.[cavityType]
    if (!entry) return base

    const studDepthMm = wt.studs[entry.stud].depth_mm
    const studRsi = wallType === 'wood'
      ? studDepthMm * 0.0085
      : studDepthMm * 0.0000161

    base.mainWall = {
      studDepthMm,
      studRsi,
      cavityPct: sp.cavity_pct,
      cavityRsi: entry.cavityRsi,
      cavityMaterial,
      cavityType,
      ppRsi: parallelPath(studRsi, entry.cavityRsi, sp.cavity_pct),
    }

    if (wallType === 'steel') {
      const spacingInches = parseInt(spacing)
      const hasInsSheathing = contInsRsi > 0
      const { k1, k2 } = steelKValues(spacingInches, hasInsSheathing)

      // Use steelCavityPct() for consistency with compute.js (not the JSON value)
      base.mainWall.cavityPct = steelCavityPct(spacingInches)

      // Boundary sum for steel (no sheathing)
      const bSum = boundaryObj.outside_air + boundaryObj.cladding
        + (boundaryObj.air_space || 0) + contInsRsi
        + boundaryObj.drywall + boundaryObj.inside_air

      const cavityPct = base.mainWall.cavityPct
      const framingPct = 100 - cavityPct
      const tStud = bSum + studRsi
      const tCavity = bSum + entry.cavityRsi
      const rsiT1 = 100 / (framingPct / tStud + cavityPct / tCavity)
      const rsiT2 = parallelPath(studRsi, entry.cavityRsi, cavityPct)
      const rsiT3 = bSum + rsiT2

      base.steel = { k1, k2, boundarySum: bSum, rsiT1, rsiT2, rsiT3 }
      base.totalRsi = k1 * rsiT1 + k2 * rsiT3
    } else {
      base.totalRsi = boundarySum(boundaryObj, { contInsRsi }) + base.mainWall.ppRsi
    }

    base.points = getWallPoints(base.totalRsi)
    return base
  }

  // --- Double stud path (wood only, no service wall) ---
  if (assemblyType === 'doubleStud') {
    const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
    const dsEntry = doubleStudData[spacing]?.[key]
    if (!dsEntry) return base

    const outerDepthMm = wt.studs[dsEntry.outerStud]?.depth_mm || 89
    const innerDepthMm = wt.studs[dsEntry.innerStud]?.depth_mm || 89
    const plateDepthMm = wt.studs[dsEntry.plate]?.depth_mm || 235

    base.mainWall = {
      studDepthMm: outerDepthMm,
      studRsi: outerDepthMm * 0.0085,
      cavityPct: sp.cavity_pct,
      cavityRsi: outerDepthMm * dsEntry.rsiPerMm,
      cavityMaterial: dsEntry.material,
      cavityType: null,
      ppRsi: dsEntry.outerPpRsi,
    }

    base.doubleStud = {
      outerStud: dsEntry.outerStud, outerDepthMm,
      outerStudRsi: outerDepthMm * 0.0085,
      outerCavityRsi: outerDepthMm * dsEntry.rsiPerMm,
      outerPpRsi: dsEntry.outerPpRsi,
      innerStud: dsEntry.innerStud, innerDepthMm,
      innerStudRsi: innerDepthMm * 0.0085,
      innerCavityRsi: innerDepthMm * dsEntry.rsiPerMm,
      innerPpRsi: dsEntry.innerPpRsi,
      plate: dsEntry.plate, plateDepthMm,
      gapMm: dsEntry.gapMm, gapRsi: dsEntry.gapRsi,
      material: dsEntry.material, rsiPerMm: dsEntry.rsiPerMm,
      cavityPct: sp.cavity_pct,
    }

    base.totalRsi = boundarySum(boundaryObj, { contInsRsi })
      + dsEntry.outerPpRsi + dsEntry.gapRsi + dsEntry.innerPpRsi
    base.points = getWallPoints(base.totalRsi)
    return base
  }

  return base
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/resolveWallData.test.js
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Add tests for remaining wall types**

Append to `src/utils/resolveWallData.test.js`:

```js
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

    it('has air space instead of sheathing', () => {
      const result = resolveWallData(selection)
      expect(result.boundary.sheathing).toBeNull()
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
    const { calculateWallRsi } = await import('../data/ecpData')

    const cases = [
      { name: 'wood single', sel: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', sheathingId: 'osb_11', claddingId: 'vinyl_siding' } },
      { name: 'wood + XPS', sel: { wallType: 'wood', assemblyType: 'single', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsType: 'XPS', contInsThickness: '2"', sheathingId: 'osb_11', claddingId: 'vinyl_siding' } },
      { name: 'steel', sel: { wallType: 'steel', studSpacing: '16"', cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20', contInsType: 'XPS', contInsThickness: '2"', claddingId: 'metal_siding' } },
      { name: 'ICF', sel: { wallType: 'icf', icfFormThickness: '2-1/2"', claddingId: 'stucco_19' } },
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
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run src/utils/resolveWallData.test.js
```

Expected: All tests PASS. If any values are off, adjust expected values to match the actual calculation (the generated JSON data files are the source of truth for intermediate values).

- [ ] **Step 7: Commit**

```bash
git add src/utils/resolveWallData.js src/utils/resolveWallData.test.js
git commit -m "feat: add resolveWallData utility for wall assembly export"
```

---

## Chunk 2: Excel Sheet Builder

### Task 2: buildWallSheet — Excel template with live formulas

This function takes an ExcelJS workbook and a resolved data object (from Task 1) and builds the appropriate sheet layout with live Excel formulas.

**Files:**
- Create: `src/utils/buildWallSheet.js`
- Create: `src/utils/buildWallSheet.test.js`
- Read (reference): `docs/superpowers/specs/2026-03-25-wall-export-design.md` — sheet layout spec

**Context:** ExcelJS API basics:
```js
const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('Name')
sheet.getCell('A1').value = 'text'
sheet.getCell('D12').value = { formula: '100/((100-D14)/D13+D14/D15)' }
sheet.getColumn('A').width = 30
sheet.getRow(1).font = { bold: true, size: 14 }
```

The wood template uses a universal layer stack (rows 7–30) where unused rows have value 0. Steel and ICF have dedicated layouts. All formulas reference cells by row/column so they're live — changing an input recalculates the total.

- [ ] **Step 1: Write tests for wood single stud sheet**

Create `src/utils/buildWallSheet.test.js`:

```js
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/buildWallSheet.test.js
```

Expected: FAIL — `buildWallSheet` module not found.

- [ ] **Step 3: Implement buildWallSheet**

Create `src/utils/buildWallSheet.js`:

```js
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
  sheet.getCell(`D${row}`).value = parseInt(data.studSpacing?.replace('"','') || '16')
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/utils/buildWallSheet.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Add tests for steel and ICF sheets**

Append to `src/utils/buildWallSheet.test.js`:

```js
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
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run src/utils/buildWallSheet.test.js
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/buildWallSheet.js src/utils/buildWallSheet.test.js
git commit -m "feat: add buildWallSheet Excel template builder with live formulas"
```

---

## Chunk 3: SVG-to-PNG, Orchestrator, and UI Integration

**Prerequisite:** Move ExcelJS from devDependencies to dependencies since it will be dynamically imported in the client bundle. Railway deployment may use `npm install --production` which excludes devDependencies.

```bash
cd /srv/clients/BTZx/job-aids/20_Endorsed/D06_Job_Aid_v0.5_Alpha/ECPTool/ecp-calculator
npm install exceljs --save
```

### Task 3: svgToPng utility

Small utility to convert an SVG DOM element to a base64 PNG string.

**Files:**
- Create: `src/utils/svgToPng.js`

**Note:** This utility relies on browser APIs (XMLSerializer, Canvas, Image) that don't exist in jsdom. Testing is deferred to the browser integration test. The function is simple and isolated enough that manual verification via the export button is sufficient.

- [ ] **Step 1: Create svgToPng.js**

```js
/**
 * Convert an SVG DOM element to a base64 PNG string.
 *
 * Uses native browser APIs: XMLSerializer, Canvas, Image.
 * Returns a Promise that resolves to a base64 string (without data URL prefix).
 */
export function svgToPng(svgElement, scale = 2) {
  return new Promise((resolve, reject) => {
    try {
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svgElement)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)

        // Extract base64 without the data URL prefix
        const dataUrl = canvas.toDataURL('image/png')
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
        resolve(base64)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load SVG as image'))
      }
      img.src = url
    } catch (err) {
      reject(err)
    }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/svgToPng.js
git commit -m "feat: add svgToPng utility for SVG-to-PNG conversion"
```

### Task 4: exportWallAssembly orchestrator

Ties everything together: resolve data, build sheet, convert SVG, embed image, trigger download.

**Files:**
- Create: `src/utils/exportWallAssembly.js`

- [ ] **Step 1: Create exportWallAssembly.js**

```js
/**
 * Export the current wall assembly as an Excel workbook.
 *
 * Orchestrates: resolveWallData → buildWallSheet → svgToPng → download.
 * ExcelJS is dynamically imported to avoid bundling it upfront.
 */

import { resolveWallData } from './resolveWallData'
import { buildWallSheet } from './buildWallSheet'
import { svgToPng } from './svgToPng'

/**
 * Generate and download an Excel workbook for the current wall assembly.
 *
 * @param {object} selection - The wall builder selection object from App.jsx state
 * @param {SVGElement|null} svgElement - The wall section SVG DOM element (optional)
 */
export async function exportWallAssembly(selection, svgElement) {
  // Dynamically import ExcelJS (keeps it out of the main bundle)
  const ExcelJS = (await import('exceljs')).default

  // Resolve all intermediate calculation values
  const data = resolveWallData(selection)
  if (!data || data.totalRsi === null) {
    throw new Error('Cannot export: incomplete wall configuration')
  }

  // Build the workbook and sheet
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ECP Calculator'
  workbook.created = new Date()

  const sheet = buildWallSheet(workbook, data)

  // Embed wall section image (graceful degradation: skip on failure)
  if (svgElement) {
    try {
      const pngBase64 = await svgToPng(svgElement)
      const imageId = workbook.addImage({
        base64: pngBase64,
        extension: 'png',
      })

      // Find the last used row to place image below
      const lastRow = sheet.lastRow?.number || 30
      const imageRow = lastRow + 2

      sheet.addImage(imageId, {
        tl: { col: 0, row: imageRow },
        ext: { width: 500, height: 300 },
      })
    } catch (err) {
      console.warn('SVG-to-PNG conversion failed, exporting without image:', err.message)
    }
  }

  // Generate and download the file
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const date = new Date().toISOString().slice(0, 10)
  const filename = `Wall-Assembly-RSI-${data.wallTypeLabel.replace(/\s+/g, '-')}-${date}.xlsx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/exportWallAssembly.js
git commit -m "feat: add exportWallAssembly orchestrator with dynamic ExcelJS import"
```

### Task 5: WallBuilder integration — button and ref

**Files:**
- Modify: `src/components/WallBuilder.jsx` — add export button and container ref
- Modify: `src/App.css` — export button styling

- [ ] **Step 1: Add ref and export button to WallBuilder.jsx**

At the top of WallBuilder.jsx, add `useRef` to the React import:

```js
// Change line 1:
import React, { useState, useRef } from 'react'
```

Add import for exportWallAssembly after line 21:

```js
import { exportWallAssembly } from '../utils/exportWallAssembly'
```

Inside the WallBuilder component function, add ref and export state. Find the line `export default function WallBuilder(` and add after the existing destructuring/variables at the top of the function body:

```js
  const wallSectionRef = useRef(null)
  const [exporting, setExporting] = useState(false)
```

Add the export handler function (inside the component, after the state declarations):

```js
  const handleExport = async () => {
    setExporting(true)
    try {
      const svgEl = wallSectionRef.current?.querySelector('svg')
      await exportWallAssembly(selection, svgEl)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }
```

Now modify the three wall section container `<div>`s to attach the ref. There are three `<div className="wall-section-container">` elements (wood at ~line 730, steel at ~line 757, ICF at ~line 771). Add `ref={wallSectionRef}` to each:

```jsx
// Wood (line ~730):
<div className="wall-section-container" ref={wallSectionRef}>

// Steel (line ~757):
<div className="wall-section-container" ref={wallSectionRef}>

// ICF (line ~771):
<div className="wall-section-container" ref={wallSectionRef}>
```

Add the export button after each wall section closing `</div>` and before the clear button. The button should appear once, after the last wall section container. The cleanest approach: add it just before the Clear button (line ~779), and conditionally show it when RSI is valid:

```jsx
          {/* Export to Excel button */}
          {rsi !== null && (
            <button
              className="option-button export-button"
              onClick={handleExport}
              disabled={exporting}
              type="button"
            >
              {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          )}

          {/* Clear button */}
```

Note: `rsi` is computed at ~line 106 of WallBuilder.jsx: `const rsi = calculateWallRsi(selection)`. It's already in scope.

- [ ] **Step 2: Add export button CSS to App.css**

Append to `src/App.css` (after the existing `.clear-button` styles):

```css
/* Export button */
.export-button {
  background: var(--primary);
  color: white;
  border: 1px solid var(--primary);
  margin-bottom: 0.5rem;
}

.export-button:hover:not(:disabled) {
  opacity: 0.9;
}

.export-button:disabled {
  opacity: 0.6;
  cursor: wait;
}
```

- [ ] **Step 3: Run the dev server and verify manually**

```bash
npm run dev
```

Open the app in the browser. Build a wall assembly (e.g., Wood Frame, Single Stud, 16" o.c., Fiberglass Batt, 2x6 R20). Verify:
1. "Export to Excel" button appears below the wall section diagram
2. Clicking it downloads a `.xlsx` file
3. Opening the file shows the header, layer stack with live formulas, and the wall section image
4. Changing a value in the RSI column recalculates the total
5. Button shows "Exporting..." while working

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: All existing tests plus new resolveWallData and buildWallSheet tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/WallBuilder.jsx src/App.css src/utils/exportWallAssembly.js package.json package-lock.json
git commit -m "feat: add Export to Excel button to wall builder"
```

---

## Post-Implementation

After all tasks are complete:
1. Run `npm run build` to verify production build succeeds
2. Run `npx vitest run` to verify all tests pass
3. Test all wall types manually: wood single, wood double, wood+service, wood double+service, steel, ICF
4. Verify Excel formulas are live (change a cell, total updates)
5. Verify image is embedded
