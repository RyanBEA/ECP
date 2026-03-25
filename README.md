# ECP Calculator

Energy Conservation Points calculator for NBC 2020 Tier 2/3 building code compliance in Nova Scotia. Helps builders and building officials determine if a residential design meets prescriptive energy performance thresholds.

**Live:** Deployed on Railway (auto-deploys from `main`)
**Stack:** React 18 + Vite 5 + Vitest, plain CSS

## Quick Start

```bash
npm install
npm run dev          # Dev server at localhost:5173
npm run build        # Production build to dist/
npm test             # Unit tests (Vitest)
npm run generate     # Rebuild data from YAML sources
```

## Architecture

```
YAML materials        Build pipeline         Outputs              App
data/materials/  -->  scripts/generate.js  -->  *.json + audit  -->  React frontend
                                                  |
                                            src/data/generated/
```

### Data Pipeline

Material properties are defined in human-editable YAML files (`data/materials/`). A Node.js build script enumerates all valid wall combinations, computes RSI values using the formulas in `scripts/compute.js`, and writes JSON lookup tables to `src/data/generated/`. The React app imports these JSON files — no thermal math happens at runtime except when boundary layers differ from defaults.

```
data/materials/
  cavity-insulation.yaml    # Batt and blown-in RSI values (NBC Table D)
  continuous-insulation.yaml # Rigid foam RSI values
  framing.yaml              # Stud depths, cavity %, K-values
  icf.yaml                  # ICF form/core properties
  sheathing-cladding.yaml   # Boundary layer RSI values

scripts/
  generate.js               # Build pipeline: YAML -> JSON
  compute.js                # Shared formulas (parallel path, steel K-factor, ICF)
  loadMaterials.js           # YAML loader
  validate.js               # Data validation

src/data/generated/          # Committed JSON outputs
  wall-data.json             # Framed wall lookup (wood + steel)
  double-stud-data.json      # Double stud pre-computed values
  continuous-ins.json         # Continuous insulation RSI by type/thickness
  icf-data.json              # ICF form data
  boundary-options.json       # Cladding, sheathing, air films
  thresholds.json            # ECP point thresholds
```

### Wall Types

| Type | Description | Calculation |
|------|-------------|-------------|
| **Single stud** | Traditional 2x4 through 2x12. Optional continuous exterior insulation. | Parallel path + series boundary layers |
| **Double stud** | Two stud rows on wider plate (2x4/2x6 studs, 2x8–2x12 plate). Blown-in insulation fills everything. | Parallel path per stud layer + isothermal gap |
| **Interior service wall** | Toggle on single or double stud. Adds interior 2x4 service cavity + optional partition material (sheathing or rigid foam). | Primary wall PP + interior layer + service wall PP |
| **Steel frame** | Steel studs with K-factor weighted method per NBC Table A-9.36.2.4.(1)-B. | K1 x RSI_T1 + K2 x RSI_T3 |
| **ICF** | Insulated concrete forms. Pure series sum. | EPS form (x2) + concrete core + boundary |

## Project Structure

```
ecp-calculator/
  src/
    App.jsx                 # Root component, all state management
    App.css                 # Styles, CSS variables, dark/light theming
    data/
      ecpData.js            # API layer: imports JSON + compute module
      generated/            # JSON from build pipeline (committed)
    components/
      WallBuilder.jsx       # Wall assembly builder (simple + builder modes)
      WallSection.jsx       # SVG wall cross-section diagram
      CategoryCard.jsx      # Standard category selection UI
      OptionButton.jsx      # Individual option button
      PointsCounter.jsx     # ECP points progress display
  scripts/                  # Build pipeline + shared compute module
  data/materials/           # YAML source of truth
  docs/                     # Developer documentation
```

## ECP Points System

Each building component earns points based on performance thresholds. Points are summed to meet tier targets:

| Tier | Points Required |
|------|----------------|
| Tier 2 | 10 points |
| Tier 3 | 20 points |

Categories: Above-Ground Walls, Windows/Doors, Airtightness, Hot Water (Electric), Hot Water (Non-Electric), HRV, Space Heating/Cooling, House Volume Penalty.

## Development

```bash
npm run dev              # Dev server with HMR
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run generate         # Rebuild JSON from YAML sources
npm run generate:audit   # Generate + write audit workbook
npm run generate:validate # Validate generated data
npm run build            # Production build
```

### Key Design Decisions

- **All state in App.jsx** — no context providers, no external state libraries
- **YAML-driven pipeline** — material properties version-controlled, JSON derived
- **Progressive disclosure** — wall builder shows only relevant fields per wall type
- **CSS variables for theming** — dark mode via custom properties
- **Dual wall input modes** — direct RSI selection or assembly-based calculation

## Documentation

| Doc | Content |
|-----|---------|
| [architecture.md](docs/architecture.md) | Project overview, data flow, component tree, state management |
| [data-layer.md](docs/data-layer.md) | ecpData.js reference, lookup tables, calculation formulas |
| [components.md](docs/components.md) | All React components — props, state, behaviors |
| [styling.md](docs/styling.md) | CSS variables, theming, responsive breakpoints |
| [infrastructure.md](docs/infrastructure.md) | Vite config, PWA, Railway deployment |

## License

Proprietary. Developed by [Baseline Energy Analytics](https://baselineenergy.ca) for Building to Zero Exchange (BTZx).
