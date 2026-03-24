# ECP Calculator — Data Layer Refactor Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Wall assembly data layer refactor to support three new wall types via an Excel-first build pipeline

---

## Problem

The ECP Calculator's data layer (`ecpData.js`) hardcodes all wall RSI lookup tables, cavity insulation mappings, and continuous insulation values in a single 368-line JavaScript file. This approach:

- Cannot scale to new wall assembly types (double stud, double wall) without combinatorial explosion
- Requires manual synchronization between CSV reference files and JS code
- Provides no auditable calculation artifact for code users (builders, building officials)
- Mixes data, calculation logic, and UI concerns in one file

Feedback from field reviewers requests support for deeper cavity walls (2x8, 2x10, 2x12), staggered double stud walls, and double walls with service cavities (LEEP Assembly #4 pattern). These cannot be reasonably accommodated in the current structure.

## Approach: Excel-First Pipeline

A build pipeline that uses structured material property files as the single source of truth, generates an auditable Excel workbook with live formulas, evaluates it, and extracts the computed values as JSON for the React app.

```
Material Properties (YAML)
        |
        v
   Build Script (Node.js)
        |
        +---> Excel Workbook (with live formulas, downloadable)
        |         |
        |         v
        |    LibreOffice evaluates
        |         |
        |         v
        +---> JSON lookups (extracted computed values)
                  |
                  v
           React App (pure lookups, no RSI math)
```

**Key guarantee:** The JSON values are extracted from the Excel workbook's evaluated formulas — not calculated independently. The app values match the spreadsheet by construction.

## Wall Assembly Types in Scope

### 1. Deep Cavity Single Wall

Same calculation model as today (parallel-path), extended with deeper stud sizes.

- Stud sizes: 2x4, 2x6 (existing) + 2x8, 2x10, 2x12 (new)
- Wall types: wood, steel (existing)
- Optional continuous insulation (existing)
- Parallel-path method per NBC A-9.36.2.4

### 2. Staggered Double Stud

Two rows of studs (e.g., two 2x4s) on a wider plate (2x8 through 2x12), with insulation filling the full depth including the gap between stud rows.

- Plate width determines total cavity depth
- Each stud row calculated via parallel-path
- Gap between stud rows treated as isothermal planes (continuous insulation — no bridging)
- Typically blown-in insulation (dense-pack cellulose, fiberglass)
- No continuous exterior insulation (the deep cavity provides sufficient RSI)

### 3. Double Wall with Service Cavity (LEEP Assembly #4)

Structural exterior wall + interior service wall separated by an insulated gap. The service cavity houses services without penetrating the air barrier.

- Exterior wall: standard framed wall (parallel-path calculation)
- Interior wall: usually 2x4 framed (parallel-path calculation)
- Gap: variable width, filled with blown-in insulation (isothermal planes)
- Service cavity: 2x4 framed, empty or insulated
- Optional continuous insulation on exterior

### Thermal Calculation Method

The hybrid parallel-path + isothermal-planes approach is confirmed conservative per research (see `docs/research/double-stud-thermal-calc.md`):

- Each framed layer uses parallel-path method (penalizes thermal bridging at studs)
- Gap and continuous layers use isothermal planes (series resistance, no bridging)
- This underestimates actual performance by approximately RSI 0.18-0.53 vs. 2D THERM simulation
- Consistent with NBC 2020 Appendix A-9.36.2.4 methodology
- Validated against LEEP Assembly Guide #4 R-value tables and published CARB/DOE research

**Critical implementation detail:** The current `framedWallRsi` lookup values include boundary layers (air films, sheathing, drywall). For double walls, the material properties must store stud-cavity-only RSI per framed layer, with boundary layers added once to the total assembly.

## Section 1: Material Properties (Source of Truth)

Structured YAML files in `data/materials/`:

```
data/materials/
  framing.yaml              # stud types, dimensions, RSI, framing fractions
  cavity-insulation.yaml    # batt/blown materials, R-values per cavity type
  continuous-insulation.yaml  # board insulation RSI by type and thickness
  fixed-layers.yaml         # air films, cladding, sheathing, drywall, concrete
  icf.yaml                  # ICF form options
```

### framing.yaml

```yaml
wood:
  stud_rsi:
    2x4: 0.7565     # 88.9mm
    2x6: 1.19       # 139.7mm
    2x8: 1.624      # 184.2mm
    2x10: 2.057     # 235.0mm
    2x12: 2.491     # 285.8mm
  framing_fraction:
    16: 23           # percent, 16" OC
    19: 21.5         # 19.2" OC
    24: 20           # 24" OC

steel:
  stud_rsi:
    2x3-5/8: 0.001482
    2x6: 0.002447
  framing_fraction:
    16: 0.78125
    19: 0.657895
    24: 0.520833
```

### cavity-insulation.yaml

```yaml
fiberglass_batt:
  label: "Fiberglass Batt"
  cavities:
    - id: "2x4 R12"
      stud_types: [wood_2x4, steel_2x3-5/8]
      rsi: 2.11
      source: "Table A-9.36.2.4.(1)-D"
    - id: "2x6 R20"
      stud_types: [wood_2x6, steel_2x6]
      rsi: 3.34
      source: "Table A-9.36.2.4.(1)-D"
    # ...

dense_pack_cellulose:
  label: "Dense Pack Cellulose"
  rsi_per_mm: 0.024
  # For standard cavities, RSI derived from stud depth
  # For double-stud gaps, RSI derived from gap width
```

### continuous-insulation.yaml

```yaml
eps:
  label: "EPS"
  rsi_per_mm: 0.026
  source: "Type 1 EPS (conservative)"
  thicknesses:
    - { label: '1"', mm: 25.4 }
    - { label: '1-1/2"', mm: 38.1 }
    - { label: '2"', mm: 50.8 }
    - { label: '2-1/2"', mm: 63.5 }
    - { label: '3"', mm: 76.2 }

xps:
  label: "XPS"
  rsi_per_mm: 0.0336
  # ...

polyiso:
  label: "Polyiso"       # renamed from PIC per reviewer feedback
  rsi_per_mm: 0.036
  note: "Assumes permeably faced (conservative)"
  # ...

mineral_wool:
  label: "Mineral Wool"
  rsi_per_mm: 0.0277
  note: "Assumes 56 kg/m3 density (conservative)"
  # ...
```

### fixed-layers.yaml

```yaml
air_films:
  outside: 0.03
  inside: 0.12

cladding:
  default: 0.11

sheathing:
  osb: 0.108

drywall:
  default: 0.08

concrete:
  icf_core: 0.06096    # 150mm concrete core

air_space:
  steel_frame: 0.18    # air space in steel frame assembly
```

## Section 2: Build Pipeline

A single Node.js script (`scripts/generate.js`) run via `npm run generate`.

### Step 1: Read Material Properties

Load all YAML files from `data/materials/`. Enumerate every valid wall combination:

- **Single wall**: wall type x spacing x cavity material x cavity type x (optional) continuous insulation type x thickness
- **Staggered double stud**: exterior stud size x interior stud size x plate width x spacing x gap insulation material
- **Double wall + service cavity**: exterior wall config x interior wall config x gap width x gap insulation x service cavity option

### Step 2: Generate Excel Workbook

Using `exceljs` (Node library, no binary dependencies):

- One sheet per wall assembly type, plus a `ref` sheet for material properties
- Mirrors the column layout of the existing `RSI-calc.xlsx`: individual columns for each thermal layer (outside air film, cladding, sheathing, continuous insulation, cavity, drywall, inside air film)
- Every RSI-eff value is a cell formula referencing the layer columns and applying parallel-path or isothermal-planes as appropriate
- Material properties on the `ref` sheet are referenced by the calculation sheets — change a property, and all dependent RSI values update

### Step 3: Evaluate and Extract

- Shell out to LibreOffice to recalculate the workbook (headless, using the existing `recalc.py` pattern)
- Read back computed RSI-eff values from each sheet
- Write JSON lookup files to `ecp-calculator/src/data/generated/`:
  - `single-walls.json` — keyed by wall type + spacing + material + cavity + cont. ins.
  - `double-stud-walls.json` — keyed by stud sizes + plate + spacing + insulation
  - `double-walls.json` — keyed by exterior config + interior config + gap + service cavity
  - `thresholds.json` — ECP point thresholds per category

### Step 4: Audit Report

- Print summary: number of combinations per wall type, RSI range, flagged anomalies (RSI below code minimum 2.97)
- Optional `--audit` flag: compare against previous JSON and report what changed

### npm Scripts

```json
{
  "generate": "node scripts/generate.js",
  "generate:audit": "node scripts/generate.js --audit",
  "dev": "cd ecp-calculator && npm run dev",
  "build": "npm run generate && cd ecp-calculator && npm run build"
}
```

## Section 3: React App Changes

### Data Loading

`ecpData.js` becomes a thin wrapper that imports generated JSON:

```js
import singleWalls from './generated/single-walls.json'
import doubleStudWalls from './generated/double-stud-walls.json'
import doubleWalls from './generated/double-walls.json'
import thresholds from './generated/thresholds.json'

export function getWallRsi(config) {
  // Route to correct JSON based on assemblyType
}

export function getWallPoints(rsi) {
  // Same threshold logic, reads from thresholds.json
}
```

### WallBuilder Component

Top-level assembly type selector added above the existing builder fields:

- **Single Wall**: Same as today's Build Assembly mode, plus 2x8/2x10/2x12 stud options
- **Double Stud**: Plate width, stud sizes, spacing, gap insulation material
- **Double Wall**: Exterior wall config, interior wall config, gap width, gap insulation, service cavity toggle

Each mode shows only relevant fields. The "Select RSI" direct-entry mode remains as a fallback.

### State Shape

`wallSelection` in `App.jsx` gets an `assemblyType` discriminator:

```js
wallSelection = {
  assemblyType: 'single',  // 'single' | 'doubleStud' | 'doubleWall'
  // ...fields vary by assemblyType
}
```

### What Doesn't Change

- `categories` array for non-wall components (air tightness, DHW, HRV, volume, windows, below-grade walls)
- `PointsCounter`, `CategoryCard`, `OptionButton` components
- Tier selection, dark mode, exclusive groups
- Overall app architecture (single-root state in App.jsx)

## Section 4: Directory Layout

Everything lives inside the ECP repo (`ecp-calculator/`, deployed via Railway from `RyanBEA/ECP.git`):

```
ecp-calculator/
  data/
    materials/                  # Source of truth (YAML)
      framing.yaml
      cavity-insulation.yaml
      continuous-insulation.yaml
      fixed-layers.yaml
      icf.yaml

  scripts/
    generate.js                 # Build pipeline

  dist/
    ECP-Wall-RSI-Calculator.xlsx  # Generated workbook (downloadable)

  src/
    data/
      ecpData.js                # Thin wrapper + lookup functions
      generated/                # JSON from pipeline (committed to git)
        single-walls.json
        double-stud-walls.json
        double-walls.json
        thresholds.json

  docs/
    research/
      double-stud-thermal-calc.md
    specs/
      2026-03-24-data-layer-refactor-design.md  (this file)
```

**Key decisions:**

- Self-contained: anyone who clones the ECP repo can run the full pipeline
- Generated JSON is committed to git so Railway builds without LibreOffice
- Excel workbook in `dist/` — build artifact, not source
- Existing CSV files in `data/` can be archived once YAML files replace them

## Open Questions (to resolve during implementation)

1. **Framing fraction for interior walls**: Should both walls in a double-wall assembly use the same framing percentage, or should the interior wall use a lower factor (no headers, simpler framing)?
2. **Gap insulation options for double stud/double wall**: Dense-pack cellulose only, or also fiberglass/mineral wool?
3. **Service cavity RSI**: LEEP shows ~R-3 to R-4 for an empty service cavity. Include insulated option (R-12 batt = +R-8.7 per LEEP)?
4. **Gusset/tie plates**: Treat as thermally negligible per LEEP and CARB research?
5. **Validation**: Compare generated values against CWC effectiver.ca and LEEP Assembly #4 tables before deployment.
6. **WallSection SVG**: New cross-section renderings needed for double stud and double wall types — scope as separate visual task?
