# Data Pipeline

## Overview

The ECP Calculator uses a build-time data pipeline to turn human-editable YAML files into pre-computed JSON lookup tables. The pipeline reads five YAML material files from `data/materials/`, runs thermal calculations (parallel-path RSI, series sums), and writes six JSON files to `src/data/generated/`. The React app imports those JSON files at bundle time — it never reads the YAML directly.

**When to run it:** Any time you change a YAML source file (add a material, update an RSI value, change a threshold). The command is `npm run generate`. If you don't run it after editing YAML, the app will still use the old JSON values.

## YAML Source Files

All source files live in `data/materials/`. Each file controls a different part of the wall assembly calculation.

| File | What it controls |
|------|-----------------|
| `framing.yaml` | Wood and steel stud dimensions, thermal resistivity, cavity area percentages, steel K-values |
| `cavity-insulation.yaml` | Insulation materials that go between studs (batts and blown-in), with RSI values per cavity size |
| `continuous-insulation.yaml` | Rigid insulation boards applied to the exterior (EPS, XPS, Polyiso, Mineral Wool), with RSI per thickness |
| `sheathing-cladding.yaml` | Boundary layers: air films, drywall, structural sheathing options, cladding options, steel air space |
| `icf.yaml` | Insulating Concrete Form properties: EPS foam thickness, concrete core, form sizes |

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

Reads all YAML files, computes RSI values, and writes six JSON files plus an Excel audit workbook.

```
$ npm run generate

Generating ECP data...
  Excel workbook: /path/to/ecp-calculator/dist/ECP-Wall-RSI-Calculator.xlsx
  Wood single wall combos: 87
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
  Excel workbook: /path/to/ecp-calculator/dist/ECP-Wall-RSI-Calculator.xlsx
  Wood single wall combos: 87
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
| `wall-data.json` | 87 wood + 42 steel combos | Pre-computed parallel-path RSI for every combination of wall type, stud spacing, insulation material, and cavity size. This is the main lookup table. |
| `continuous-ins.json` | 5 materials x 5 thicknesses | RSI values for rigid exterior insulation boards (EPS, XPS, Polyiso, Mineral Wool Rock Wool, Mineral Wool Glass Fibre). |
| `icf-data.json` | 3 form sizes | ICF form RSI and concrete core RSI for 2-1/2", 3-1/8", and 4-1/4" forms. |
| `boundary-options.json` | 7 sheathing + 8 cladding options | Selectable cladding and sheathing choices with RSI values, plus fixed values for air films, drywall, and steel air space. |
| `thresholds.json` | 11 wall thresholds + minimum RSI | ECP point thresholds: the RSI values required to earn each point level, plus the 2.97 RSI code minimum. |
| `double-stud-data.json` | 72 presets | Pre-computed RSI for double stud wall configurations (two stud rows on a wider plate with blown insulation). |

The pipeline also writes an **Excel audit workbook** to `dist/ECP-Wall-RSI-Calculator.xlsx`. This workbook has four sheets (Materials, Wood Frame, Steel Frame, ICF) and shows every calculated RSI value in a spreadsheet format for manual review. It is gitignored and regenerated each time.

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

   All 391 tests should pass.

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
  }
}
```

Each entry means: "If the wall's total RSI is at least `minRsi`, the builder earns `points` Energy Conservation Points for the wall category."

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

 ✓ scripts/loadMaterials.test.js (9 tests)
 ✓ scripts/compute.test.js (22 tests)
 ✓ scripts/validate.test.js (274 tests)
 ✓ src/data/ecpData.test.js (35 tests)
 ✓ src/utils/resolveWallData.test.js (24 tests)
 ✓ src/utils/buildWallSheet.test.js (16 tests)
 ✓ src/components/FieldGroup.test.jsx (4 tests)
 ✓ src/components/PrintSummary.test.jsx (7 tests)

 Test Files  8 passed (8)
       Tests  391 passed (391)
```

The `validate.test.js` suite (274 tests) validates every entry in the generated JSON by re-computing from the YAML sources using `compute.js`. It covers all wood, steel, and double stud wall combos, plus continuous insulation, ICF, boundary options, and threshold entries. If you add a new material to YAML and regenerate, this suite automatically picks it up.

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
