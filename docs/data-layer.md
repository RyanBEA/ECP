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
| `continuous-insulation.yaml` | Rigid insulation (EPS, XPS, Polyiso, Mineral Wool) |
| `icf.yaml` | ICF form properties |

All RSI values sourced from NBC 2020 Table A-9.36.2.4.(1)-D.

## Generated JSON Files

| File | Content |
|------|---------|
| `wall-data.json` | Stud-cavity parallel-path RSI for all wood (87) and steel (42) combos |
| `continuous-ins.json` | 5 materials x 5 thicknesses |
| `icf-data.json` | 3 ICF form configurations |
| `boundary-options.json` | Selectable cladding/sheathing with RSI values |
| `thresholds.json` | ECP point thresholds and minimum RSI |
| `double-stud-data.json` | 72 double stud presets |

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
| `categories` | Array | 8 ECP categories with point thresholds |
| `tiers` | Array | Tier 2 (10 pts), Tier 3 (20 pts) |
| `wallTypes` | Array | Wood, Steel, ICF |
| `studSpacingOptions` | Array | 16", 19", 24" |
| `cavityMaterials` | Array | 5 materials (derived from JSON) |
| `cavityTypesByMaterial` | Object | Cavity sizes per material (includes deep cavities) |
| `continuousInsTypes` | Array | EPS, XPS, Polyiso, Mineral Wool (Rock Wool), Mineral Wool (Glass Fibre) |
| `continuousInsThicknesses` | Array | None, 1", 1-1/2", 2", 2-1/2", 3" |
| `icfFormOptions` | Array | 2-1/2", 3-1/8", 4-1/4" |
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

## Deep Cavity Support

Blown-in materials now support 2x8, 2x10, 2x12 stud sizes (in addition to 2x4/2x6). Batt materials include deep cavity designations: R28 (2x8), R31/R35 (2x10), R40 (2x12).

## Updating Data

1. Edit the relevant YAML file in `data/materials/`
2. Run `npm run generate` to regenerate JSON
3. Run `npm test` to validate
4. Commit both YAML and generated JSON
