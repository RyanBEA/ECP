# Data Pipeline

## Overview

The ECP Calculator uses a build-time data pipeline to turn human-editable YAML files into pre-computed JSON lookup tables. The pipeline reads six YAML material files from `data/materials/`, runs thermal calculations (parallel-path RSI, series sums), and writes seven JSON files to `src/data/generated/`. The React app imports those JSON files at bundle time — it never reads the YAML directly.

**When to run it:** Any time you change a YAML source file (add a material, update an RSI value, change a threshold). The command is `npm run generate`. If you don't run it after editing YAML, the app will still use the old JSON values.

## YAML Source Files

All source files live in `data/materials/`. Each file controls a different part of the wall assembly calculation.

| File | What it controls |
|------|-----------------|
| `framing.yaml` | Wood and steel stud dimensions, thermal resistivity, cavity area percentages, steel K-values |
| `cavity-insulation.yaml` | Insulation materials that go between studs (batts and blown-in), with RSI values per cavity size |
| `continuous-insulation.yaml` | Rigid insulation boards (EPS, XPS, Polyiso, Mineral Wool), with RSI per thickness from 1" to 4". The above-ground wall builder offers up to 3"; the 3-1/2" and 4" entries serve the below-grade builder |
| `sheathing-cladding.yaml` | Boundary layers: air films, drywall, structural sheathing options, cladding options, steel air space |
| `icf.yaml` | Insulating Concrete Form properties: EPS foam thickness, concrete core, form sizes (also used by the below-grade ICF option) |
| `foundation.yaml` | Below-grade (foundation) walls: interior air film, concrete, concrete block, basement stud wall and PWF framing, spray foam, insulation type and thickness lists, finish |

### `foundation.yaml` (below-grade walls)

Values from NBC 2020 Table A-9.36.2.4.(1)-A (basement framing row), Table A-9.36.2.4.(1)-D, Table A-9.36.2.8.(1)-A Note (3) and Table A-9.36.2.8.(1)-B. Top-level keys:

| Key | Content |
|-----|---------|
| `inside_air_film` | 0.12. There is no exterior film below grade |
| `concrete` | `rsi_per_mm` 0.0004 and `thicknesses`: `{ id: "200", label: '200 mm (8")', mm: 200 }`, `{ id: "250", ... mm: 250 }` |
| `block` | `thickness_mm` 190, `source`, and `options`: 14 `{ id, label, rsi }` entries (e.g. `{ id: normal_empty, label: "Normal-weight, cores empty", rsi: 0.21 }`) |
| `interior_stud_wall` | `cavity_pct` `{ 16: 84, 19: 85.5, 24: 87 }`, `studs` `["2x4", "2x6"]`, `empty_cavity_rsi` 0.18, `offset_cavity_rsi` `{ "2x6 R20": 3.52 }` |
| `pwf` | `cavity_pct` `{ 8: 76, 12: 81, 16: 84 }`, `studs` `["2x6", "2x8", "2x10"]`, `sheathing` `{ id: pwf_sheathing, label: "12.5 mm plywood sheathing", rsi: 0.109 }` |
| `spray_foam` | `label` "Closed-Cell Spray Foam", `rsi_per_mm` 0.036, `thicknesses` as `{ label, mm }` from 1" to 4" |
| `exterior_ins_types` | XPS, EPS, Mineral Wool (Rock Wool), Mineral Wool (Glass Fibre) |
| `interior_ins_types` | XPS, EPS, Polyiso, Closed-Cell Spray Foam |
| `ins_thicknesses` | None, 1", 1-1/2", 2", 2-1/2", 3", 3-1/2", 4" |
| `finish` | `gypsum: { label: '1/2" gypsum board', rsi: 0.08 }` |

Cavity RSI for the batts and blown-in materials is not repeated here; the below-grade builder reads it from the 16" wood entries of `wall-data.json` (cavity RSI does not depend on spacing), and stud depths come from `framing.yaml` (2x6 140, 2x8 184, 2x10 235 mm). The PWF `cavity_pct` values reproduce Table A-9.36.2.8.(1)-B with those depths.

`generateFoundationData()` in `scripts/generate.js` writes `foundation-data.json` with the same top-level keys. It copies `inside_air_film`, `block`, `interior_stud_wall`, `pwf`, the three lists and `finish` as they are, and computes two things:

- `concrete.thicknesses[].rsi` = `mm * rsi_per_mm` (0.08 and 0.1), rounded to 6 decimals
- `spray_foam.thicknesses` becomes a label-to-RSI map (`{ '1"': 0.9144, ..., '4"': 3.6576 }`), the same shape as the `thicknesses` of `continuous-ins.json`

### Key terms

- **RSI** — Thermal resistance in metric units ((m2-K)/W). Higher RSI = better insulation. The imperial equivalent is R-value; RSI 1.0 = approximately R-5.68.
- **Parallel-path** — A calculation method that accounts for thermal bridging through studs. A wall isn't uniformly insulated — heat flows through both the cavity insulation and the wood/steel studs. The parallel-path formula produces a single effective RSI for the combined stud+cavity layer.
- **Boundary layers** — The non-structural layers that every wall includes: outside air film, cladding, sheathing (wood only), drywall, and inside air film. These are added in series (simply summed).

### Annotated example: a cavity insulation entry

From `cavity-insulation.yaml`:

```yaml
fiberglass_batt:                    # Internal key (not shown to users)
  label: "Fiberglass Batt"         # Display name in the app
  type: batt                       # "batt" or "blown" — controls how RSI is calculated
  source: "NBC 2020 Table ..."     # Where the values come from (documentation only)
  cavities:                        # List of cavity size options
    - id: "2x4 R12"               # Unique cavity ID (shown in dropdowns)
      rsi: 2.11                    # RSI of the insulation in this cavity
      wood_studs: ["2x4"]         # Which wood stud sizes this fits
      steel_studs: ["2x3-5/8"]   # Which steel stud sizes this fits
    - id: "2x6 R20"
      wood_rsi: 3.34              # Wood-specific RSI (batt compressed in shallower wood cavity)
      steel_rsi: 3.52             # Steel-specific RSI (batt uncompressed in deeper steel cavity)
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
```

**Batt materials** list specific cavity sizes with fixed RSI values. Each cavity entry declares which stud sizes it's compatible with.

**Blown-in materials** are simpler — they fill any cavity, so RSI is calculated from `stud_depth_mm * rsi_per_mm`:

```yaml
loose_fill_cellulose:
  label: "Loose Fill Cellulose"
  type: blown
  rsi_per_mm: 0.025               # RSI per millimetre of depth
  source: "NBC 2020 Table ..."
```

## Running the Pipeline

### `npm run generate`

Reads all YAML files, computes RSI values, and writes seven JSON files plus an Excel audit workbook.

```
$ npm run generate

Generating ECP data...
  Excel workbook: /path/to/ecp-calculator/dist/ECP-Wall-RSI-Calculator.xlsx
  Wood single wall combos: 81
  Steel single wall combos: 42
  Double stud combos: 72
Done.
```

This is the command you'll run most often. It overwrites the JSON files in `src/data/generated/` and the Excel workbook in `dist/`.

### `npm run generate:audit`

Same as `generate`, but also compares each JSON file against its previous version and reports whether it changed.

```
$ npm run generate:audit

Generating ECP data...
  wall-data.json: unchanged
  continuous-ins.json: unchanged
  icf-data.json: unchanged
  boundary-options.json: unchanged
  thresholds.json: unchanged
  double-stud-data.json: unchanged
  foundation-data.json: unchanged
  Excel workbook: /path/to/ecp-calculator/dist/ECP-Wall-RSI-Calculator.xlsx
  Wood single wall combos: 81
  Steel single wall combos: 42
  Double stud combos: 72
Done.
```

Use this after a change to confirm which output files were affected. If a file you expected to change shows "unchanged," your YAML edit may not be in the right place.

### `npm run generate:validate`

Currently produces the same output as `generate`. Reserved for future use.

## Generated Outputs

All JSON files are written to `src/data/generated/`. They are committed to version control so that the React app can import them without running the pipeline.

| File | Entries | What it contains |
|------|---------|-----------------|
| `wall-data.json` | 81 wood + 42 steel combos | Pre-computed parallel-path RSI for every combination of wall type, stud spacing, insulation material, and cavity size. This is the main lookup table. |
| `continuous-ins.json` | 5 materials x 7 thicknesses | RSI values for rigid insulation boards, 1" to 4" (EPS, XPS, Polyiso, Mineral Wool Rock Wool, Mineral Wool Glass Fibre). |
| `icf-data.json` | 4 form sizes | ICF form RSI and concrete core RSI for 2-1/2", 2-3/4", 3-1/8", and 4-1/4" forms. |
| `boundary-options.json` | 7 sheathing + 8 cladding options | Selectable cladding and sheathing choices with RSI values, plus fixed values for air films, drywall, and steel air space. |
| `thresholds.json` | 11 wall thresholds + minimum RSI, 3 below-grade thresholds + minimum RSI | ECP point thresholds: the RSI values required to earn each point level, plus the 2.97 RSI above-ground code minimum (`walls`, `minWallRsi`) and the below-grade levels and 2.98 minimum (`belowGrade`, `minBelowGradeRsi`). |
| `double-stud-data.json` | 72 presets | Pre-computed RSI for double stud wall configurations (two stud rows on a wider plate with blown insulation). |
| `foundation-data.json` | 1 object | Below-grade materials from `foundation.yaml`, with concrete and spray foam RSI computed (see below). Nothing is pre-combined: `ecpData.js` builds each assembly at runtime with `foundationWallRsi()`. |

The pipeline also writes an **Excel audit workbook** to `dist/ECP-Wall-RSI-Calculator.xlsx`. This workbook has four sheets (Materials, Wood Frame, Steel Frame, ICF) and shows every calculated RSI value in a spreadsheet format for manual review. It is gitignored and regenerated each time. Below-grade walls have no sheet in this workbook; their working is in the per-assembly foundation export ("Export to Excel" in the Below Grade Walls builder).

## How to Add a New Insulation Material

This example adds a hypothetical "Spray Foam (Open Cell)" blown-in cavity insulation.

### Step 1: Edit the YAML file

Open `data/materials/cavity-insulation.yaml` and add a new entry at the end:

```yaml
spray_foam_open_cell:
  label: "Spray Foam (Open Cell)"
  type: blown
  rsi_per_mm: 0.026
  source: "Manufacturer data sheet"
```

For a **blown-in material**, you only need `label`, `type: blown`, and `rsi_per_mm`. The pipeline will automatically compute RSI for every stud depth.

For a **batt material**, you'd instead list specific cavities:

```yaml
new_batt_material:
  label: "New Batt Material"
  type: batt
  source: "Source reference"
  cavities:
    - id: "2x4 R15"
      rsi: 2.64
      wood_studs: ["2x4"]
      steel_studs: ["2x3-5/8"]
    - id: "2x6 R21"
      rsi: 3.70
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
```

### Step 2: Regenerate the JSON

```
npm run generate
```

You should see the combo counts increase (the new material adds entries for each spacing and stud size).

### Step 3: Verify

1. **Check the JSON.** Open `src/data/generated/wall-data.json` and search for your new material's label (e.g., "Spray Foam (Open Cell)"). It should appear under `wood > spacings > 16 > materials` and similar paths.

2. **Run tests.** The test suite validates that all generated JSON is internally consistent:

   ```
   npm test
   ```

   All 619 tests should pass.

3. **Check the audit workbook.** Open `dist/ECP-Wall-RSI-Calculator.xlsx` in Excel or LibreOffice. The "Wood Frame" sheet should include rows for your new material.

### Step 4: Commit both files

Commit the YAML change **and** the regenerated JSON together. The app reads the JSON at build time, so if you commit YAML without regenerating, the app won't reflect your change.

## How to Update ECP Point Thresholds

Wall point thresholds live in `scripts/generate.js` inside the `generateThresholds()` function (not in a YAML file). This is because thresholds are unlikely to change and are tightly coupled to the NBC code tables.

The current thresholds:

```javascript
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
    // Below-grade (foundation) walls, Table 9.36.8.7 Zone 6; minimum Table 9.36.2.8.-B
    belowGrade: [
      { minRsi: 3.09, points: 0.2 },
      { minRsi: 3.46, points: 0.8 },
      { minRsi: 3.9, points: 1.4 },
    ],
    minBelowGradeRsi: 2.98,
  }
}
```

Each entry means: "If the wall's total RSI is at least `minRsi`, the builder earns `points` Energy Conservation Points for the wall category."

`belowGrade` and `minBelowGradeRsi` work the same way for the Below Grade Walls category. `ecpData.js` also builds that category's Select RSI options from them: a 2.98 / 0-point floor first, then one option per `belowGrade` entry. Changing a below-grade level therefore changes both the builder's points and the option list.

### To change a threshold value

1. Open `scripts/generate.js`
2. Find the `generateThresholds()` function (search for "minRsi")
3. Change the value. For example, to update the first tier from 3.08 to 3.10:
   ```javascript
   { minRsi: 3.10, points: 1.6 },
   ```
4. Regenerate: `npm run generate`
5. Verify the change in `src/data/generated/thresholds.json`
6. Run tests: `npm test`

### To add a new threshold tier

Add a new object to the `walls` array in the correct RSI order (lowest to highest). Each entry must have both `minRsi` and `points`.

## How to Verify Changes

After any pipeline change, run these three checks:

### 1. Run the test suite

```
$ npm test

 ✓ scripts/compute.test.js (43 tests)
 ✓ scripts/loadMaterials.test.js (10 tests)
 ✓ scripts/validate.test.js (301 tests)
 ✓ server/validate.test.js (29 tests)
 ✓ src/data/ecpData.test.js (66 tests)
 ✓ src/utils/resolveWallData.test.js (24 tests)
 ✓ src/utils/buildWallSheet.test.js (16 tests)
 ✓ src/utils/resolveFoundationData.test.js (30 tests)
 ✓ src/utils/buildFoundationSheet.test.js (20 tests)
 ✓ src/utils/printEvent.test.js (15 tests)
 ✓ src/components/FieldGroup.test.jsx (4 tests)
 ✓ src/components/PrintSummary.test.jsx (15 tests)
 ✓ src/components/WallSection.test.jsx (9 tests)
 ✓ src/components/BelowGradeWallBuilder.test.jsx (25 tests)
 ✓ src/App.test.jsx (6 tests)

 Test Files  15 passed (15)
       Tests  619 passed (619)
```

The `validate.test.js` suite (301 tests) validates every entry in the generated JSON by re-computing from the YAML sources using `compute.js`. It covers all wood, steel, and double stud wall combos, plus continuous insulation, ICF, boundary options, threshold entries, the below-grade thresholds and `foundation-data.json`. If you add a new material to YAML and regenerate, this suite automatically picks it up.

### 2. Inspect the generated JSON

Open the relevant file in `src/data/generated/` and spot-check your changes. For wall materials, search for the material label in `wall-data.json`. For thresholds, check `thresholds.json`.

### 3. Check the audit workbook

Run `npm run generate` (it always writes the workbook) and open `dist/ECP-Wall-RSI-Calculator.xlsx`. The workbook has four sheets:

| Sheet | Content |
|-------|---------|
| Materials | Reference properties: wood/steel RSI per mm, continuous insulation RSI per mm, steel K-values |
| Wood Frame | Every wood wall combo with spacing, material, cavity type, stud RSI, cavity RSI, cavity %, parallel-path RSI, boundary RSI, and total RSI |
| Steel Frame | Every steel wall combo with K1/K2 values and total RSI |
| ICF | ICF form sizes with form RSI, concrete RSI, boundary RSI, and total RSI |

The workbook is useful for manual comparison against NBC tables or previous versions.

### 4. Run the audit comparison

If you want to confirm exactly which files changed:

```
npm run generate:audit
```

Files marked "CHANGED" were affected by your edit. Files marked "unchanged" were not.
