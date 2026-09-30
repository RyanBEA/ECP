# ECP Calculator — Data Layer Reference

## Architecture

```
data/materials/*.yaml          <- Source of truth (NBC-verified values)
        |
scripts/generate.js            <- Build pipeline (Node.js, runs at build time)
        |
        +---> src/data/generated/*.json    <- Pre-computed lookups (committed)
        +---> dist/ECP-Wall-RSI-Calculator.xlsx  <- Audit workbook (gitignored)

scripts/compute.js             <- Runtime RSI formulas (bundled into React app)
src/data/ecpData.js            <- API layer (imports JSON + compute module)
```

**Key principle:** YAML material files are the single source of truth. The build pipeline generates JSON lookups. The compute module handles runtime RSI assembly when boundary layers differ from defaults.

## YAML Material Files

| File | Content |
|------|---------|
| `framing.yaml` | Wood/steel stud properties, NBC Table A/B/C values |
| `sheathing-cladding.yaml` | Air films, drywall, sheathing options, cladding options |
| `cavity-insulation.yaml` | Batt and blown-in materials with cavity RSI values |
| `continuous-insulation.yaml` | Rigid insulation (EPS, XPS, Polyiso, Mineral Wool), 1" to 4" |
| `icf.yaml` | ICF form properties |
| `foundation.yaml` | Below-grade walls: concrete, block, basement stud wall and PWF framing %, spray foam, finish |

All RSI values sourced from NBC 2020 Table A-9.36.2.4.(1)-D.

## Generated JSON Files

| File | Content |
|------|---------|
| `wall-data.json` | Stud-cavity parallel-path RSI for all wood (81) and steel (42) combos |
| `continuous-ins.json` | 5 materials x 7 thicknesses (1" to 4") |
| `icf-data.json` | 4 ICF form configurations |
| `boundary-options.json` | Selectable cladding/sheathing with RSI values |
| `thresholds.json` | ECP point thresholds and minimum RSI, above-ground (`walls`, `minWallRsi`) and below-grade (`belowGrade`, `minBelowGradeRsi`) |
| `double-stud-data.json` | 72 double stud presets |
| `foundation-data.json` | Below-grade materials from `foundation.yaml` (see [Data Pipeline](data-pipeline.md#foundationyaml-below-grade-walls)) |

Regenerate with: `npm run generate`

## Compute Module (`scripts/compute.js`)

Runtime RSI calculation functions, bundled into the React app via `@scripts` Vite alias.

| Function | Wall Type | Method |
|----------|-----------|--------|
| `parallelPath()` | All framed | Stud-cavity parallel-path effective RSI |
| `boundarySum()` | All | Series sum of boundary layer RSI values |
| `woodWallRsi()` | Wood | Parallel-path + boundary series |
| `steelWallRsi()` | Steel | NBC modified zone: K1 x RSI_T1 + K2 x RSI_T3 |
| `steelKValues()` | Steel | NBC Table B K1/K2 lookup (spacing + insulating sheathing) |
| `steelCavityPct()` | Steel | Cavity percentage from stud spacing and web thickness |
| `icfWallRsi()` | ICF | Series sum |
| `doubleStudWallRsi()` | Double stud | Two parallel-path layers + isothermal gap |
| `doubleWallRsi()` | Double wall | Two independent parallel-path walls + gap |
| `foundationWallRsi()` | Below-grade | Series sum of layers; a framed layer by parallel path (softwood 0.0085 RSI/mm); appends the interior air film |

### Steel K-Values (NBC Table A-9.36.2.4.(1)-B)

| Spacing | Without insulating sheathing | With insulating sheathing |
|---------|------------------------------|--------------------------|
| < 500mm (16", 19") | K1=0.33, K2=0.67 | K1=0.40, K2=0.60 |
| >= 500mm (24") | K1=0.50, K2=0.50 | K1=0.50, K2=0.50 |

"Insulating sheathing" = continuous exterior insulation present (`contInsRsi > 0`).

## ecpData.js API

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `categories` | Array | 8 ECP categories with point thresholds (Below Grade Walls has 4 options, see below) |
| `tiers` | Array | Tier 2 (10 pts), Tier 3 (20 pts) |
| `wallTypes` | Array | Wood, Steel, ICF |
| `studSpacingOptions` | Array | 16", 19", 24" |
| `cavityMaterials` | Array | 5 materials (derived from JSON) |
| `cavityTypesByMaterial` | Object | Cavity sizes per material (includes deep cavities) |
| `continuousInsTypes` | Array | EPS, XPS, Polyiso, Mineral Wool (Rock Wool), Mineral Wool (Glass Fibre) |
| `continuousInsThicknesses` | Array | None, 1", 1-1/2", 2", 2-1/2", 3" (above-ground list; stops at 3" although the JSON goes to 4") |
| `icfFormOptions` | Array | 2-1/2", 2-3/4", 3-1/8", 4-1/4" |
| `framedWallRsi` | Object | Pre-computed RSI lookup (backward compat) |
| `continuousInsRsi` | Object | Continuous insulation RSI lookup |
| `icfRsi` | Object | ICF total RSI lookup |
| `MIN_WALL_RSI` | number | 2.97 (NBC minimum) |
| `wallPointsThresholds` | Array | 11 RSI-to-points thresholds |
| `calculateWallRsi()` | Function | Runtime RSI calculation |
| `getWallPoints()` | Function | RSI-to-points lookup |
| `getBoundaryOptions()` | Function | Cladding/sheathing options |
| `getDefaultBoundary()` | Function | Default boundary layers per wall type |
| `getContinuousInsRsi()` | Function | Continuous insulation RSI lookup |
| `getInteriorLayerRsi()` | Function | Interior layer RSI (sheathing or rigid insulation) |

### `calculateWallRsi(params)`

Accepts: `{ wallType, studSpacing, cavityMaterial, cavityType, contInsType, contInsThickness, icfFormThickness, sheathingId, claddingId, assemblyType, outerStud, innerStud, plate, doubleStudMaterial, hasServiceWall, serviceSpacing, serviceCavityMaterial, serviceCavityType, interiorLayerMaterial, interiorLayerThickness }`

Returns: `number` (RSI) or `null`.

**Assembly types:**
- `'single'` (default): Standard single-wall calculation
- `'doubleStud'`: Two stud rows on wider plate, blown-in insulation

**Service wall path:** When `hasServiceWall` is true (wood only), the calculation sums the primary wall parallel-path + interior layer + service wall parallel-path, without continuous insulation. Works with both single and double stud primary walls.

**Backward compatibility:** `PIC` is aliased to `Polyiso` for continuous insulation lookups.

### `getInteriorLayerRsi(material, thickness)`

Resolves RSI for the interior layer between primary and service walls. Accepts either a sheathing ID (from `boundary-options.json`, e.g., `'osb_11'`) or a continuous insulation type (e.g., `'XPS'`) with a thickness. Tries sheathing lookup first, falls back to continuous insulation.

## Below-Grade (Foundation) Walls

Used by `BelowGradeWallBuilder`, `PrintSummary`, the print telemetry and the foundation Excel export. Layers counted are the materials plus the interior air film (0.12); no exterior air film and no soil (NBC 2020 Note A-9.36.2.8.(1)).

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `foundationTypes` | Array | `{ id, label }` for `concrete` Poured Concrete, `block` Concrete Block, `icf` ICF, `pwf` Permanent Wood Foundation |
| `concreteThicknessOptions` | Array | `{ id, label, mm, rsi }`: `'200'` 200 mm (8") 0.08, `'250'` 250 mm (10") 0.10 |
| `blockOptions` | Array | `{ id, label, rsi }`, the 14 190 mm block options of Table A-9.36.2.4.(1)-D (e.g. `normal_empty` 0.21) |
| `extInsTypes` | Array | XPS, EPS, Mineral Wool (Rock Wool), Mineral Wool (Glass Fibre); no polyiso or spray foam outside |
| `intInsTypes` | Array | XPS, EPS, Polyiso, Closed-Cell Spray Foam |
| `insThicknesses` | Array | None, 1", 1-1/2", 2", 2-1/2", 3", 3-1/2", 4" (both exterior and interior) |
| `pwfStudOptions` | Array | 2x6, 2x8, 2x10 |
| `pwfSpacingOptions` | Array | 8", 12", 16" |
| `basementStudOptions` | Array | 2x4, 2x6 |
| `finishOptions` | Array | `{ id: 'gypsum', label: '1/2" gypsum board' }`, `{ id: 'none', label: 'None (unfinished)' }` |
| `EMPTY_CAVITY` | string | `'None (empty)'`, the extra cavity choice for the basement stud wall (RSI 0.18) |
| `belowGradePointsThresholds` | Array | `thresholds.json` `belowGrade`: 3.09 -> 0.2, 3.46 -> 0.8, 3.90 -> 1.4 |
| `MIN_BELOW_GRADE_RSI` | number | 2.98 (Table 9.36.2.8.-B), from `minBelowGradeRsi` |
| `BELOW_GRADE_GYPSUM_RSI` | number | 0.0775, the 1/2" gypsum finish from `foundation.yaml` (12.7 mm at 0.0061 RSI/mm, the value Note A-9.36.2.8.(1) gives; the above-ground builder's drywall is 0.08) |
| `getBasementCavityTypes(material)` | Function | Batt cavity ids of that material for 2x4 and 2x6 (e.g. `'2x6 R22'`). `[]` for no material, `EMPTY_CAVITY`, or a blown-in material (those take their stud from `studDepth`) |
| `getPwfCavityTypes(material, pwfStud)` | Function | Keys of that material's wood cavity entries whose stud is `pwfStud` (e.g. `'2x8 R28'`; for blown-in, the stud name itself, e.g. `'2x8'`). `[]` when either argument is missing or the material is unknown |
| `getInteriorInsRsi(type, thickness)` | Function | Spray foam from `foundation-data.json` (0.036 RSI/mm), boards via `getContinuousInsRsi()`. `0` for no type, no thickness or `'None'` |
| `isBlownInMaterial(material)` | Function | `true` when every cavity key of the material has no space (`'2x6'` rather than `'2x6 R22'`) |
| `calculateBelowGradeAssembly(selection)` | Function | `{ total, layers }` or `null` (see below) |
| `calculateBelowGradeRsi(selection)` | Function | `calculateBelowGradeAssembly(selection)?.total`, or `null` |
| `getBelowGradePoints(rsi)` | Function | RSI-to-points lookup (see below) |

The selection object shape is documented under [BelowGradeWallBuilder](components.md#belowgradewallbuilder-srccomponentsbelowgradewallbuilderjsx).

### `calculateBelowGradeAssembly(selection)`

Returns `{ total, layers: [{ id, label, rsi }, ...] }`, layers ordered outside to inside, from `foundationWallRsi()`. Layer ids by foundation type:

| Foundation type | Layer ids, outside to inside |
|---|---|
| `concrete` | `ext_ins` (if a thickness is set), `concrete`, `int_ins` (if set), `frame` (if `hasStudWall`, default true), `finish` (if gypsum), `inside_air` |
| `block` | as `concrete` with `block` in place of `concrete` |
| `icf` | `icf_forms` (both forms, `2 * form mm * 0.026`), `icf_core` (152.4 mm x 0.0004), `finish`, `inside_air` |
| `pwf` | `pwf_sheathing` (12.5 mm plywood, 0.109), `frame`, `finish` (if gypsum), `inside_air` |

The `frame` layer is a parallel path of the stud (`depth_mm * 0.0085`) and the cavity RSI at the cavity % for the spacing: basement stud wall 16" 84, 19" 85.5, 24" 87; PWF 8" 76, 12" 81, 16" 84. Its label names the stud once: `<stud> @ <spacing> <material> <R-value>` for batts (e.g. `2x6 @ 16" Fiberglass Batt R22`), `<stud> @ <spacing> <material>` for blown-in, and `<stud> @ <spacing> empty cavity` for `EMPTY_CAVITY`. The `block` layer label adds the block thickness, e.g. `Normal-weight block (190 mm), cores empty`. With `studOffset` and cavity `2x6 R20` the cavity RSI is 3.52 instead of 3.34 and the label ends `, held off the concrete`; the offset changes no other cavity. Blown-in materials look up their entry by `pwfStud` (PWF), else `studDepth`, else `cavityType`.

Finish defaults to gypsum when `finish` is unset. It is forced to gypsum for ICF and whenever an interior insulation thickness is set (9.10.17.10), whatever `finish` says.

Returns `null`, never 0 or NaN, when:

- `foundationType` is missing or not one of the four ids
- the concrete thickness id, block id or ICF form label is not found
- an exterior thickness is set with a type outside `extInsTypes`, or an interior thickness with a type outside `intInsTypes`, or the insulation RSI lookup fails
- the stud wall is on (or the type is PWF) and the frame cannot be resolved: spacing not in the cavity % table, unknown material, missing or unknown cavity type, a stud outside `basementStudOptions` / `pwfStudOptions`, or (PWF) a cavity whose stud is not `pwfStud`
- `finish` is something other than `'gypsum'` or `'none'` when it is not forced

### `getBelowGradePoints(rsi)`

Returns `0` for a falsy `rsi`. Otherwise rounds to 2 decimals and returns the points of the highest `belowGrade` level met, `0` below 3.09. It does not check the 2.98 minimum; the builder and the export compare the rounded RSI with `MIN_BELOW_GRADE_RSI` themselves.

### Below Grade Walls category options

`categories` entry `belowGradeWalls` has `type: 'belowGradeBuilder'` and four options built from `thresholds.json`: index 0 is the floor `{ value: 2.98, points: 0 }` (meets code, no points), then 3.09 / 0.2, 3.46 / 0.8, 3.90 / 1.4. A `simpleIndex` counts from this list. Before v1.3.0 the list had only the three point levels, so old telemetry indices are shifted by one (see the ecp-telemetry skill).

## Deep Cavity Support

Blown-in materials now support 2x8, 2x10, 2x12 stud sizes (in addition to 2x4/2x6). Batt materials include deep cavity designations: R28 (2x8), R31/R35 (2x10), R40 (2x12).

## Updating Data

1. Edit the relevant YAML file in `data/materials/`
2. Run `npm run generate` to regenerate JSON
3. Run `npm test` to validate
4. Commit both YAML and generated JSON
