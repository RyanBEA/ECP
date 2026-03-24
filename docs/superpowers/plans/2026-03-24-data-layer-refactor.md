# Data Layer Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded wall RSI lookup tables in ecpData.js with a YAML-driven build pipeline that supports variable boundary layers, deep cavity walls, staggered double stud, and double wall assemblies.

**Architecture:** YAML material files are the single source of truth. A Node.js build script reads YAML, computes wall data, and writes JSON lookups + an auditable Excel workbook. The React app imports the JSON and a lightweight compute module (~30 lines) that assembles total RSI at runtime from stud-cavity lookup data + user-selected boundary layers + continuous insulation.

**Tech Stack:** Node.js (ESM), js-yaml, exceljs, Vitest, React 18, Vite 5

**Design spec:** `docs/specs/2026-03-24-data-layer-refactor-design.md`

**Key deviation from design spec:** The design spec proposed "pure lookups, no RSI math" in the React app. Variable cladding/sheathing requires runtime computation because steel's weighted formula couples boundary layers into the calculation. The compromise: JSON stores the _hard_ lookups (which cavity RSI, framing factors), and a thin compute module does the _easy_ math (series addition, parallel-path formula). This keeps the app's calculation transparent and auditable while supporting variable boundary layers.

---

## NBC 2020 Table Verification

All material RSI values in the YAML files are sourced from **NBC 2020 Table A-9.36.2.4.(1)-D** (pp. 1450-1454) and **Table A-9.36.2.4.(1)-A** (pp. 1446-1447). A full extraction is at `25_Working/nbc-table-D-material-properties.md`.

Key findings from NBC verification:
- **Fibre cement cladding**: RSI 0.026 at 8mm (NBC), not 0.04
- **Stucco**: RSI 0.0009/mm — at 19mm = 0.017 (EIFS is different; it includes insulation)
- **Plywood 12.5mm softwood**: RSI 0.109 (NBC), not 0.110
- **Gypsum sheathing**: RSI 0.08 at 12.7mm — valid option for steel frames
- **Deep cavity batts exist in NBC**: R-28 (4.93), R-31 (5.46), R-35 (6.16), R-40 (7.04)
- **Fiberglass loose fill RSI/mm varies by cavity depth**: 0.02865 at 89mm, 0.0289 at 140mm, 0.030 at 152mm
- **Polyiso RSI/mm is thickness-dependent**: 0.03818 at 25mm, 0.036 at 50mm
- **Dense pack cellulose not in NBC**: 0.024 from sprayed cellulose listing (CAN/ULC-S703)
- **Two mineral wool board types**: glass fibre (0.0298/mm) vs rock wool (0.0277/mm)
- **R-20 compressed to 140mm = R-19 (RSI 3.34)**; uncompressed in 152mm = R-20 (RSI 3.52) — explains wood vs steel cavity RSI difference

---

## Calculation Formulas (from RSI-calc.xlsx)

These formulas are the ground truth. Every value the pipeline generates must match these.

### Wood Frame

```
stud_rsi = stud_depth_mm * 0.0085
W_pp = 100 / ((100 - cavity_pct) / stud_rsi + cavity_pct / cavity_rsi)
RSI_total = outside_air + cladding + sheathing + cont_ins + W_pp + drywall + inside_air
```

Cavity percentages (from NRCan Table A-9.36.2.4.(1)-A):
- 16" OC: 77%
- 19.2" OC: 78.5%
- 24" OC: 80%

Stud depths: 2x4=89mm, 2x6=140mm, 2x8=184mm, 2x10=235mm, 2x12=286mm

### Steel Frame (Modified Zone Method)

```
stud_rsi = stud_depth_mm * 0.0000161
cavity_pct = (spacing_inches - 0.125) * 100 / spacing_inches
T_stud = sum(boundary_layers) + stud_rsi       # stud path (series)
T_cavity = sum(boundary_layers) + cavity_rsi     # cavity path (series)
V_iso = 100 / ((100 - cavity_pct) / T_stud + cavity_pct / T_cavity)
W_pp = 100 / ((100 - cavity_pct) / stud_rsi + cavity_pct / cavity_rsi)
T_pp = sum(boundary_layers) + W_pp              # parallel-path total
RSI_total = 0.4 * V_iso + 0.6 * T_pp
```

Steel stud depths: 2x3-5/8=92.075mm, 2x6=152mm
Steel web thickness: 1/8" (3.175mm)
Weighting: k_iso=0.4, k_pp=0.6

Steel uses different default boundary layers than wood:
- Cladding: 0.07 (vs wood 0.11)
- Air space: 0.18 (wood has none)
- No sheathing (wood has 0.108)

### ICF

```
form_rsi = form_thickness_mm * 2 * 0.026
concrete_rsi = 152.4 * 0.0004
RSI_total = outside_air + cladding + form_rsi + concrete_rsi + drywall + inside_air
```

### Cavity RSI Reference Values (from ref sheet)

**Batt materials** (RSI per product, from NBC 2020 Table A-9.36.2.4.(1)-D):
| Material | Cavity | RSI (wood) | RSI (steel) | Note |
|----------|--------|------------|-------------|------|
| FG/MW Batt | 2x4 R12 | 2.11 | 2.11 | 89/92 mm |
| FG/MW Batt | 2x4 R14 | 2.46 | 2.46 | 89/92 mm |
| FG/MW Batt | 2x6 R20 | 3.34 | 3.52 | R20 compressed to 140mm = R19; full R20 in 152mm |
| FG/MW Batt | 2x6 R22 | 3.87 | 3.87 | 140/152 mm |
| FG/MW Batt | 2x6 R24 | 4.23 | 4.23 | 140/152 mm |
| FG/MW Batt | 2x8 R28 | 4.93 | — | 178/216 mm (deep cavity, wood only) |
| FG/MW Batt | 2x10 R31 | 5.46 | — | 241 mm |
| FG/MW Batt | 2x10 R35 | 6.16 | — | 267 mm |
| FG/MW Batt | 2x12 R40 | 7.04 | — | 279/300 mm |

**Blown-in materials** (RSI per mm, from NBC Table D and ref sheet):
| Material | RSI/mm | Source | Note |
|----------|--------|--------|------|
| Loose Fill Cellulose | 0.025 | NBC Table D, CAN/ULC-S703 | Constant across depths |
| Dense Pack Cellulose | 0.024 | Sprayed cellulosic fibre, CAN/ULC-S703 | Not in NBC Table D separately |
| Loose Fill Fiberglass | varies | NBC Table D, CAN/ULC-S702.1 | 0.02865 at 89mm, 0.0289 at 140mm, 0.030 at 152mm |

Wood cavity depths: 2x4=89mm, 2x6=140mm, 2x8=184mm, 2x10=235mm, 2x12=286mm
Steel cavity depths: 2x3-5/8=92.075mm, 2x6=152mm

---

## Chunk 1: Data Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `ecp-calculator/data/materials/` (directory)
- Create: `ecp-calculator/scripts/` (directory)
- Create: `ecp-calculator/src/data/generated/` (directory)
- Modify: `ecp-calculator/package.json`
- Modify: `ecp-calculator/.gitignore`

- [ ] **Step 1: Create directory structure**

```bash
cd ecp-calculator
mkdir -p data/materials scripts src/data/generated
```

- [ ] **Step 2: Install pipeline dependencies**

```bash
cd ecp-calculator
npm install --save-dev js-yaml exceljs
```

- [ ] **Step 3: Add npm scripts to package.json**

Add these scripts to the existing `scripts` block in `ecp-calculator/package.json`:

```json
"generate": "node scripts/generate.js",
"generate:audit": "node scripts/generate.js --audit",
"generate:validate": "node scripts/generate.js --validate"
```

Modify the existing `build` script to run generate first:

```json
"build": "npm run generate && vite build"
```

- [ ] **Step 4: Update .gitignore**

Add to `ecp-calculator/.gitignore`:

```
# Generated Excel workbook (build artifact, regenerated by pipeline)
dist/ECP-Wall-RSI-Calculator.xlsx
```

Do NOT ignore `src/data/generated/` — those JSON files are committed so Railway builds without running generate.

- [ ] **Step 5: Commit scaffolding**

```bash
git add data/materials/.gitkeep scripts/.gitkeep src/data/generated/.gitkeep package.json package-lock.json .gitignore
git commit -m "chore: scaffold data pipeline directories and dependencies"
```

---

### Task 2: YAML Material Files — Framing and Boundary Layers

**Files:**
- Create: `ecp-calculator/data/materials/framing.yaml`
- Create: `ecp-calculator/data/materials/boundary-layers.yaml`

- [ ] **Step 1: Create framing.yaml**

Write `ecp-calculator/data/materials/framing.yaml` with the exact values from RSI-calc.xlsx:

```yaml
# Framing material properties
# Source: RSI-calc.xlsx, NRCan Table A-9.36.2.4.(1)

wood:
  rsi_per_mm: 0.0085    # thermal resistivity of softwood lumber

  studs:
    "2x4":   { depth_mm: 89 }
    "2x6":   { depth_mm: 140 }
    "2x8":   { depth_mm: 184 }
    "2x10":  { depth_mm: 235 }
    "2x12":  { depth_mm: 286 }

  # Cavity area percentage (= 100 - framing_fraction)
  # Source: NRCan Table A-9.36.2.4.(1)-A
  cavity_pct:
    16:   77      # 16" OC → 23% framing
    19:   78.5    # 19.2" OC → 21.5% framing
    24:   80      # 24" OC → 20% framing

steel:
  rsi_per_mm: 0.0000161  # thermal resistivity of steel
  web_thickness_in: 0.125  # 1/8 inch

  # Modified zone method weighting factors
  k_iso: 0.4      # isothermal planes weight
  k_pp:  0.6      # parallel-path weight

  studs:
    "2x3-5/8": { depth_mm: 92.075 }
    "2x6":     { depth_mm: 152 }

  # Steel cavity_pct is computed: (spacing - web_thickness) * 100 / spacing
  # Not stored — derived at build time from stud spacing and web thickness
```

- [ ] **Step 2: Create boundary-layers.yaml**

Write `ecp-calculator/data/materials/boundary-layers.yaml`. These are user-selectable where noted:

```yaml
# Boundary layer options (non-cavity, non-stud layers)
# "selectable: true" means the user picks from options in the WallBuilder UI
# "selectable: false" means fixed (always included)

air_films:
  selectable: false
  outside: 0.03
  inside:  0.12

drywall:
  selectable: false
  default: 0.08    # 1/2" standard drywall

sheathing:
  selectable: true
  applies_to: [wood]   # steel and ICF do not use structural sheathing
  default: "osb_11"
  options:
    - id: "osb_11"
      label: '7/16" (11 mm) OSB'
      rsi: 0.108
      source: "Table D"
    - id: "osb_9_5"
      label: '3/8" (9.5 mm) OSB'
      rsi: 0.093
      source: "Table D"
    - id: "plywood_sw_9_5"
      label: '3/8" (9.5 mm) Plywood'
      rsi: 0.083
      source: "Table D, softwood"
    - id: "plywood_sw_12_5"
      label: '1/2" (12.5 mm) Plywood'
      rsi: 0.109
      source: "Table D, softwood"
    - id: "plywood_df_9_5"
      label: '3/8" (9.5 mm) Douglas Fir Plywood'
      rsi: 0.105
      source: "Table D"
    - id: "plywood_df_12_5"
      label: '1/2" (12.5 mm) Douglas Fir Plywood'
      rsi: 0.139
      source: "Table D"
    - id: "gypsum_12_7"
      label: '1/2" (12.7 mm) Gypsum Sheathing'
      rsi: 0.08
      source: "Table D"

cladding:
  selectable: true
  applies_to: [wood, steel, icf]
  defaults:
    wood: "vinyl_siding"
    steel: "metal_siding"
    icf: "stucco_19"
  options:
    - id: "vinyl_siding"
      label: "Vinyl/Metal Siding (hollow-backed)"
      rsi: 0.11
      source: "Table D"
    - id: "vinyl_insulated"
      label: "Vinyl/Metal Siding (insulating-board-backed)"
      rsi: 0.32
      source: "Table D, 9.5 mm nominal"
    - id: "wood_bevel_200"
      label: "Wood Bevel Siding (200 mm)"
      rsi: 0.14
      source: "Table D, 13 mm"
    - id: "wood_bevel_250"
      label: "Wood Bevel Siding (250 mm)"
      rsi: 0.18
      source: "Table D, 20 mm"
    - id: "fiber_cement"
      label: "Fibre Cement"
      rsi: 0.026
      source: "Table D, 8 mm"
    - id: "metal_siding"
      label: "Metal Siding (hollow-backed)"
      rsi: 0.11
      source: "Table D (same as vinyl)"
    - id: "brick_veneer"
      label: "Brick Veneer (100 mm fired clay)"
      rsi: 0.07
      source: "Table D, 2400 kg/m3"
    - id: "stucco_19"
      label: "Stucco (19 mm)"
      rsi: 0.017
      source: "Table D, 0.0009 RSI/mm x 19 mm"

steel_air_space:
  selectable: false
  applies_to: [steel]
  rsi: 0.18    # air space in steel frame assembly between web and cladding
```

- [ ] **Step 3: Verify YAML loads without parse errors**

```bash
cd ecp-calculator
node -e "import('js-yaml').then(y => { const fs = require('fs'); ['framing','boundary-layers'].forEach(f => { const d = y.load(fs.readFileSync('data/materials/'+f+'.yaml','utf8')); console.log(f+':', JSON.stringify(d).slice(0,80)+'...') }) })"
```

Expected: prints truncated JSON for each file, no errors.

- [ ] **Step 4: Commit**

```bash
git add data/materials/framing.yaml data/materials/boundary-layers.yaml
git commit -m "feat: add framing and boundary layer YAML material files"
```

---

### Task 3: YAML Material Files — Cavity and Continuous Insulation

**Files:**
- Create: `ecp-calculator/data/materials/cavity-insulation.yaml`
- Create: `ecp-calculator/data/materials/continuous-insulation.yaml`
- Create: `ecp-calculator/data/materials/icf.yaml`

- [ ] **Step 1: Create cavity-insulation.yaml**

Write `ecp-calculator/data/materials/cavity-insulation.yaml`. Values from RSI-calc.xlsx ref sheet:

```yaml
# Cavity insulation materials and RSI values
# Source: RSI-calc.xlsx ref sheet, NRCan Table A-9.36.2.4.(1)-D
#
# Batt materials: RSI per specific cavity type (manufacturer rated)
# Blown-in materials: RSI derived from cavity depth * rsi_per_mm
#
# stud_keys reference framing.yaml stud IDs within a wall type.
# For batts, wood and steel may have DIFFERENT cavity RSI for the
# same nominal product if the cavity depths differ.

fiberglass_batt:
  label: "Fiberglass Batt"
  type: batt
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, CAN/ULC-S702.1"
  cavities:
    - id: "2x4 R12"
      rsi: 2.11
      wood_studs: ["2x4"]
      steel_studs: ["2x3-5/8"]
    - id: "2x4 R14"
      rsi: 2.46
      wood_studs: ["2x4"]
      steel_studs: ["2x3-5/8"]
    - id: "2x6 R20"
      wood_rsi: 3.34       # R20 batt compressed into 140mm = R19 per Note (7)
      steel_rsi: 3.52      # R20 batt uncompressed in 152mm = full R20
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
    - id: "2x6 R22"
      rsi: 3.87
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
    - id: "2x6 R24"
      rsi: 4.23
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
    # Deep cavity batts (for 2x8, 2x10, 2x12)
    - id: "2x8 R28"
      rsi: 4.93
      wood_studs: ["2x8"]
      note: "178/216 mm cavity"
    - id: "2x10 R31"
      rsi: 5.46
      wood_studs: ["2x10"]
      note: "241 mm cavity"
    - id: "2x10 R35"
      rsi: 6.16
      wood_studs: ["2x10"]
      note: "267 mm cavity"
    - id: "2x12 R40"
      rsi: 7.04
      wood_studs: ["2x12"]
      note: "279/300 mm cavity"

mineral_wool_batt:
  label: "Mineral Wool Batt"
  type: batt
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, CAN/ULC-S702.1"
  note: "Rock or glass mineral fibre — same RSI designations as fiberglass per NBC"
  cavities:
    - id: "2x4 R14"
      rsi: 2.46
      wood_studs: ["2x4"]
      steel_studs: ["2x3-5/8"]
    - id: "2x6 R22"
      rsi: 3.87
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
    - id: "2x6 R24"
      rsi: 4.23
      wood_studs: ["2x6"]
      steel_studs: ["2x6"]
    # Deep cavity batts
    - id: "2x8 R28"
      rsi: 4.93
      wood_studs: ["2x8"]
    - id: "2x10 R31"
      rsi: 5.46
      wood_studs: ["2x10"]

loose_fill_cellulose:
  label: "Loose Fill Cellulose"
  type: blown
  rsi_per_mm: 0.025
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, CAN/ULC-S703"
  # Cavity RSI computed from: stud_depth_mm * rsi_per_mm
  # Available in ALL stud sizes (blown-in fills any cavity)

dense_pack_cellulose:
  label: "Dense Pack Cellulose"
  type: blown
  rsi_per_mm: 0.024
  source: "Sprayed cellulosic fibre settled value, CAN/ULC-S703"
  note: "Not separately listed in NBC Table D. 0.024 from spray-applied settled density."

loose_fill_fiberglass:
  label: "Loose Fill Fiberglass"
  type: blown
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, CAN/ULC-S702.1"
  note: |
    NBC lists depth-specific RSI/mm values:
      89 mm = 0.02865, 140 mm = 0.0289, 152 mm = 0.030
    For consistency, we use per-depth values for standard cavities
    and interpolate for deep cavities.
  # Per-depth RSI values from NBC table (more accurate than single RSI/mm)
  depth_specific:
    89:    { rsi_per_mm: 0.02865, rsi: 2.55 }     # 2x4 wood
    92.075: { rsi_per_mm: 0.02865, rsi: 2.638 }    # 2x3-5/8 steel (same as 89mm rate)
    140:   { rsi_per_mm: 0.02893, rsi: 4.05 }      # 2x6 wood
    152:   { rsi_per_mm: 0.02783, rsi: 4.23 }      # 2x6 steel
  # For deep cavities (2x8+), use interpolated RSI/mm = 0.029
  rsi_per_mm_deep: 0.029
```

- [ ] **Step 2: Create continuous-insulation.yaml**

Write `ecp-calculator/data/materials/continuous-insulation.yaml`. Values from RSI-calc.xlsx ref sheet:

```yaml
# Continuous (exterior rigid) insulation options
# Source: RSI-calc.xlsx ref sheet, NRCan Table A-9.36.2.4.(1)-D
# RSI values calculated from rsi_per_mm * thickness_mm where table values unavailable

eps:
  label: "EPS"
  rsi_per_mm: 0.026
  note: "Type 1 EPS (conservative)"
  thicknesses:
    - { label: '1"',     mm: 25.4,  rsi: 0.65 }      # table value
    - { label: '1-1/2"', mm: 38.1,  rsi: 0.9906 }    # 38.1 * 0.026
    - { label: '2"',     mm: 50.8,  rsi: 1.3 }        # table value
    - { label: '2-1/2"', mm: 63.5,  rsi: 1.651 }      # 63.5 * 0.026
    - { label: '3"',     mm: 76.2,  rsi: 1.9812 }     # 76.2 * 0.026

xps:
  label: "XPS"
  rsi_per_mm: 0.0336
  thicknesses:
    - { label: '1"',     mm: 25.4,  rsi: 0.88 }       # table value
    - { label: '1-1/2"', mm: 38.1,  rsi: 1.28 }       # average of 1" and 2"
    - { label: '2"',     mm: 50.8,  rsi: 1.68 }        # table value
    - { label: '2-1/2"', mm: 63.5,  rsi: 2.1336 }     # 63.5 * 0.0336
    - { label: '3"',     mm: 76.2,  rsi: 2.56032 }    # 76.2 * 0.0336

polyiso:
  label: "Polyiso"
  note: |
    Permeably faced (conservative). Renamed from PIC per reviewer feedback.
    NBC Table D shows thickness-dependent RSI/mm:
      25 mm = 0.03818/mm (RSI 0.97), 50 mm = 0.036/mm (RSI 1.80)
    We use the table values where available and 0.036/mm for interpolation.
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, CAN/ULC-S704.1"
  rsi_per_mm: 0.036          # conservative (50mm value, used for interpolation)
  thicknesses:
    - { label: '1"',     mm: 25.4,  rsi: 0.97 }       # NBC table value (25mm)
    - { label: '1-1/2"', mm: 38.1,  rsi: 1.385 }      # average of 1" and 2"
    - { label: '2"',     mm: 50.8,  rsi: 1.8 }         # NBC table value (50mm)
    - { label: '2-1/2"', mm: 63.5,  rsi: 2.286 }      # 63.5 * 0.036
    - { label: '3"',     mm: 76.2,  rsi: 2.7432 }     # 76.2 * 0.036

mineral_wool_rockwool:
  label: "Mineral Wool (Rock Wool)"
  rsi_per_mm: 0.0277
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, 56 kg/m3"
  thicknesses:
    - { label: '1"',     mm: 25.4,  rsi: 0.704 }      # NBC table value
    - { label: '1-1/2"', mm: 38.1,  rsi: 1.05537 }   # 38.1 * 0.0277
    - { label: '2"',     mm: 50.8,  rsi: 1.40716 }    # 50.8 * 0.0277
    - { label: '2-1/2"', mm: 63.5,  rsi: 1.75895 }   # 63.5 * 0.0277
    - { label: '3"',     mm: 76.2,  rsi: 2.11074 }    # 76.2 * 0.0277

mineral_wool_glassfibre:
  label: "Mineral Wool (Glass Fibre)"
  rsi_per_mm: 0.0298
  source: "NBC 2020 Table A-9.36.2.4.(1)-D, 48 kg/m3"
  thicknesses:
    - { label: '1"',     mm: 25.4,  rsi: 0.757 }      # NBC table value
    - { label: '1-1/2"', mm: 38.1,  rsi: 1.13538 }   # 38.1 * 0.0298
    - { label: '2"',     mm: 50.8,  rsi: 1.51384 }    # 50.8 * 0.0298
    - { label: '2-1/2"', mm: 63.5,  rsi: 1.8923 }    # 63.5 * 0.0298
    - { label: '3"',     mm: 76.2,  rsi: 2.27076 }    # 76.2 * 0.0298
```

- [ ] **Step 3: Create icf.yaml**

Write `ecp-calculator/data/materials/icf.yaml`:

```yaml
# ICF (Insulating Concrete Forms) properties
# Source: RSI-calc.xlsx ICF sheet
#
# ICF RSI is a simple series sum: 2 * form_rsi + concrete_rsi + boundary layers
# Form RSI = form_thickness_mm * eps_rsi_per_mm (EPS foam)
# Concrete RSI = core_thickness_mm * concrete_rsi_per_mm

eps_rsi_per_mm: 0.026           # same EPS as continuous insulation
concrete_core_mm: 152.4          # 6" standard core
concrete_rsi_per_mm: 0.0004      # mass concrete

forms:
  - label: '2-1/2"'
    thickness_mm: 63.5            # per side
  - label: '3-1/8"'
    thickness_mm: 79.375          # per side
  - label: '4-1/4"'
    thickness_mm: 107.95          # per side
```

- [ ] **Step 4: Verify all YAML files parse**

```bash
cd ecp-calculator
node -e "
const fs = require('fs');
const yaml = require('js-yaml');
const files = fs.readdirSync('data/materials').filter(f => f.endsWith('.yaml'));
files.forEach(f => {
  const data = yaml.load(fs.readFileSync('data/materials/' + f, 'utf8'));
  console.log(f + ': OK (' + Object.keys(data).length + ' top-level keys)');
});
"
```

Expected output:
```
boundary-layers.yaml: OK (5 top-level keys)
cavity-insulation.yaml: OK (5 top-level keys)
continuous-insulation.yaml: OK (4 top-level keys)
framing.yaml: OK (2 top-level keys)
icf.yaml: OK (4 top-level keys)
```

- [ ] **Step 5: Commit**

```bash
git add data/materials/
git commit -m "feat: add cavity, continuous insulation, and ICF YAML material files"
```

---

### Task 4: Material Loader Module

**Files:**
- Create: `ecp-calculator/scripts/loadMaterials.js`
- Create: `ecp-calculator/scripts/loadMaterials.test.js`

- [ ] **Step 1: Write failing tests for loadMaterials**

Write `ecp-calculator/scripts/loadMaterials.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { loadMaterials } from './loadMaterials.js'

const m = loadMaterials()

describe('loadMaterials', () => {
  it('loads all material groups', () => {
    expect(m.framing).toBeDefined()
    expect(m.cavity).toBeDefined()
    expect(m.continuous).toBeDefined()
    expect(m.boundary).toBeDefined()
    expect(m.icf).toBeDefined()
  })

  it('has correct wood stud dimensions', () => {
    expect(m.framing.wood.studs['2x4'].depth_mm).toBe(89)
    expect(m.framing.wood.studs['2x6'].depth_mm).toBe(140)
    expect(m.framing.wood.studs['2x8'].depth_mm).toBe(184)
    expect(m.framing.wood.studs['2x10'].depth_mm).toBe(235)
    expect(m.framing.wood.studs['2x12'].depth_mm).toBe(286)
  })

  it('has correct steel stud dimensions', () => {
    expect(m.framing.steel.studs['2x3-5/8'].depth_mm).toBe(92.075)
    expect(m.framing.steel.studs['2x6'].depth_mm).toBe(152)
  })

  it('has cavity RSI for fiberglass batt', () => {
    const fg = m.cavity.fiberglass_batt
    expect(fg.label).toBe('Fiberglass Batt')
    expect(fg.type).toBe('batt')
    const r20 = fg.cavities.find(c => c.id === '2x6 R20')
    expect(r20.wood_rsi).toBe(3.34)
    expect(r20.steel_rsi).toBe(3.52)
  })

  it('has RSI per mm for blown-in materials', () => {
    expect(m.cavity.dense_pack_cellulose.rsi_per_mm).toBe(0.024)
    expect(m.cavity.loose_fill_cellulose.rsi_per_mm).toBe(0.025)
    expect(m.cavity.loose_fill_fiberglass.rsi_per_mm).toBe(0.02865)
  })

  it('has continuous insulation thicknesses with RSI', () => {
    const eps = m.continuous.eps
    expect(eps.thicknesses[0].label).toBe('1"')
    expect(eps.thicknesses[0].rsi).toBe(0.65)
  })

  it('has boundary layer options for sheathing', () => {
    const sh = m.boundary.sheathing
    expect(sh.selectable).toBe(true)
    const osb = sh.options.find(o => o.id === 'osb_7_16')
    expect(osb.rsi).toBe(0.108)
  })

  it('has boundary layer options for cladding', () => {
    const cl = m.boundary.cladding
    expect(cl.selectable).toBe(true)
    const vinyl = cl.options.find(o => o.id === 'vinyl_siding')
    expect(vinyl.rsi).toBe(0.11)
  })

  it('has ICF properties', () => {
    expect(m.icf.eps_rsi_per_mm).toBe(0.026)
    expect(m.icf.concrete_core_mm).toBe(152.4)
    expect(m.icf.forms).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ecp-calculator && npx vitest run scripts/loadMaterials.test.js
```

Expected: FAIL — `loadMaterials` module does not exist.

- [ ] **Step 3: Implement loadMaterials.js**

Write `ecp-calculator/scripts/loadMaterials.js`:

```js
import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const materialsDir = join(__dirname, '..', 'data', 'materials')

function readYaml(filename) {
  return load(readFileSync(join(materialsDir, filename), 'utf8'))
}

export function loadMaterials() {
  return {
    framing: readYaml('framing.yaml'),
    cavity: readYaml('cavity-insulation.yaml'),
    continuous: readYaml('continuous-insulation.yaml'),
    boundary: readYaml('boundary-layers.yaml'),
    icf: readYaml('icf.yaml'),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ecp-calculator && npx vitest run scripts/loadMaterials.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/loadMaterials.js scripts/loadMaterials.test.js
git commit -m "feat: add YAML material loader module with tests"
```

---

### Task 5: Compute Module — Wood Frame Formula

**Files:**
- Create: `ecp-calculator/scripts/compute.js`
- Create: `ecp-calculator/scripts/compute.test.js`

This is the core calculation module. It implements the exact formulas from RSI-calc.xlsx. The same module will be used in the build pipeline AND compiled into the React bundle.

- [ ] **Step 1: Write failing tests for wood frame calculation**

Write `ecp-calculator/scripts/compute.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { woodWallRsi, parallelPath } from './compute.js'

describe('parallelPath', () => {
  it('computes parallel-path RSI for wood 2x4 R12 at 16" OC', () => {
    // stud_rsi = 89 * 0.0085 = 0.7565
    // cavity_rsi = 2.11
    // cavity_pct = 77
    // W = 100 / ((100-77)/0.7565 + 77/2.11) = 100/66.897 = 1.4948
    const result = parallelPath(0.7565, 2.11, 77)
    expect(result).toBeCloseTo(1.4948, 3)
  })
})

describe('woodWallRsi', () => {
  // Reference values from lookup-framed-wall-rsi.csv
  // These are total RSI with DEFAULT boundary layers:
  //   outside_air=0.03, cladding=0.11, sheathing=0.108, drywall=0.08, inside_air=0.12

  const defaultBoundary = {
    outside_air: 0.03,
    cladding: 0.11,
    sheathing: 0.108,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('wood/16"/Fiberglass Batt/2x4 R12 matches CSV', () => {
    const rsi = woodWallRsi({
      studDepthMm: 89,
      cavityRsi: 2.11,
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    expect(rsi).toBeCloseTo(1.942856, 4)
  })

  it('wood/16"/Fiberglass Batt/2x6 R20 matches CSV', () => {
    const rsi = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    expect(rsi).toBeCloseTo(2.807513, 4)
  })

  it('wood/24"/Fiberglass Batt/2x6 R24 matches CSV', () => {
    const rsi = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 4.23,
      cavityPct: 80,
      boundary: defaultBoundary,
    })
    expect(rsi).toBeCloseTo(3.247611, 4)
  })

  it('wood/16"/Dense Pack Cellulose/2x6 matches CSV', () => {
    // blown-in: cavity_rsi = 140mm * 0.024 = 3.36
    // CSV value = 2.812423
    // Note: ref sheet uses 3.3528 (=139.7*0.024), but formula uses depth_mm=140
    const rsi = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 140 * 0.024,  // 3.36
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    // Will be close to 2.812 but may differ slightly due to depth rounding
    expect(rsi).toBeCloseTo(2.812, 2)
  })

  it('adds continuous insulation in series', () => {
    const base = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: defaultBoundary,
    })
    const withContIns = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: defaultBoundary,
      contInsRsi: 1.68,  // 2" XPS
    })
    expect(withContIns - base).toBeCloseTo(1.68, 4)
  })

  it('uses different sheathing RSI', () => {
    const withOsb = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: { ...defaultBoundary, sheathing: 0.108 },
    })
    const withPlywood = woodWallRsi({
      studDepthMm: 140,
      cavityRsi: 3.34,
      cavityPct: 77,
      boundary: { ...defaultBoundary, sheathing: 0.110 },
    })
    expect(withPlywood - withOsb).toBeCloseTo(0.002, 4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ecp-calculator && npx vitest run scripts/compute.test.js
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement compute.js — wood formula**

Write `ecp-calculator/scripts/compute.js`:

```js
/**
 * Compute module — wall assembly RSI calculations.
 *
 * Implements the exact formulas from RSI-calc.xlsx.
 * Used by the build pipeline AND compiled into the React bundle.
 */

/**
 * Parallel-path effective RSI for a framed layer (stud + cavity).
 *
 * Formula: W = 100 / ((100 - cavity_pct) / stud_rsi + cavity_pct / cavity_rsi)
 *
 * @param {number} studRsi - RSI of the stud (wood: depth_mm * 0.0085)
 * @param {number} cavityRsi - RSI of the cavity insulation
 * @param {number} cavityPct - Cavity area percentage (e.g. 77 for 16" OC wood)
 * @returns {number} Effective RSI of the stud-cavity layer
 */
export function parallelPath(studRsi, cavityRsi, cavityPct) {
  const framingPct = 100 - cavityPct
  return 100 / (framingPct / studRsi + cavityPct / cavityRsi)
}

/**
 * Boundary layer series sum.
 *
 * @param {object} boundary - { outside_air, cladding, sheathing, drywall, inside_air }
 * @param {object} [options] - { air_space, contInsRsi }
 * @returns {number} Total boundary RSI
 */
export function boundarySum(boundary, options = {}) {
  return (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + (boundary.sheathing || 0)
    + (options.air_space || 0)
    + (options.contInsRsi || 0)
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)
}

/**
 * Total RSI for a wood-framed wall assembly.
 *
 * RSI = boundary_layers + parallel_path(stud, cavity) + sheathing + cont_ins
 *
 * @param {object} params
 * @param {number} params.studDepthMm - Stud depth in mm
 * @param {number} params.cavityRsi - Cavity insulation RSI
 * @param {number} params.cavityPct - Cavity area percentage
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} [params.contInsRsi=0] - Continuous insulation RSI
 * @returns {number} Total effective RSI
 */
export function woodWallRsi({ studDepthMm, cavityRsi, cavityPct, boundary, contInsRsi = 0 }) {
  const studRsi = studDepthMm * 0.0085
  const wPp = parallelPath(studRsi, cavityRsi, cavityPct)
  return boundarySum(boundary, { contInsRsi }) + wPp
}
```

- [ ] **Step 4: Run tests**

```bash
cd ecp-calculator && npx vitest run scripts/compute.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/compute.js scripts/compute.test.js
git commit -m "feat: add compute module with wood frame RSI formula"
```

---

### Task 6: Compute Module — Steel Frame and ICF Formulas

**Files:**
- Modify: `ecp-calculator/scripts/compute.js`
- Modify: `ecp-calculator/scripts/compute.test.js`

- [ ] **Step 1: Add failing tests for steel and ICF**

Append to `ecp-calculator/scripts/compute.test.js`:

```js
import { steelWallRsi, icfWallRsi } from './compute.js'

describe('steelWallRsi', () => {
  // Steel uses modified zone method: 0.4 * isothermal + 0.6 * parallel_path
  // Reference values from lookup-framed-wall-rsi.csv
  // Steel default boundary: outside_air=0.03, cladding=0.07, air_space=0.18,
  //   drywall=0.08, inside_air=0.12, NO sheathing

  const steelBoundary = {
    outside_air: 0.03,
    cladding: 0.07,
    sheathing: 0,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('steel/16"/Fiberglass Batt/2x3-5/8 R12 matches CSV', () => {
    const rsi = steelWallRsi({
      studDepthMm: 92.075,
      cavityRsi: 2.11,
      spacingInches: 16,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    expect(rsi).toBeCloseTo(1.394125, 3)
  })

  it('steel/16"/Fiberglass Batt/2x6 R20 matches CSV', () => {
    const rsi = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 3.52,
      spacingInches: 16,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    expect(rsi).toBeCloseTo(1.973997, 3)
  })

  it('steel/24"/Fiberglass Batt/2x6 R24 matches CSV', () => {
    const rsi = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 4.23,
      spacingInches: 24,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    expect(rsi).toBeCloseTo(2.703207, 3)
  })

  it('steel/16"/Dense Pack Cellulose/2x6 matches CSV', () => {
    // steel 2x6 depth = 152mm, DPC rsi/mm = 0.024
    // cavity_rsi = 152 * 0.024 = 3.648
    // ref sheet says: 3.6576 (uses 152.4mm)
    const rsi = steelWallRsi({
      studDepthMm: 152,
      cavityRsi: 152 * 0.024,
      spacingInches: 16,
      boundary: steelBoundary,
      airSpace: 0.18,
    })
    expect(rsi).toBeCloseTo(2.023, 2)
  })
})

describe('icfWallRsi', () => {
  const icfBoundary = {
    outside_air: 0.03,
    cladding: 0.07,
    sheathing: 0,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('ICF 2-1/2" matches RSI-calc.xlsx', () => {
    const rsi = icfWallRsi({
      formThicknessMm: 63.5,
      epsRsiPerMm: 0.026,
      concreteCoreMm: 152.4,
      concreteRsiPerMm: 0.0004,
      boundary: icfBoundary,
    })
    // 0.03 + 0.07 + 63.5*2*0.026 + 152.4*0.0004 + 0.08 + 0.12 = 3.6630
    expect(rsi).toBeCloseTo(3.663, 2)
  })

  it('ICF 3-1/8" matches RSI-calc.xlsx', () => {
    const rsi = icfWallRsi({
      formThicknessMm: 79.375,
      epsRsiPerMm: 0.026,
      concreteCoreMm: 152.4,
      concreteRsiPerMm: 0.0004,
      boundary: icfBoundary,
    })
    // = 0.03 + 0.07 + 79.375*2*0.026 + 0.06096 + 0.08 + 0.12 = 4.4985
    expect(rsi).toBeCloseTo(4.499, 2)
  })

  it('ICF 4-1/4" matches RSI-calc.xlsx', () => {
    const rsi = icfWallRsi({
      formThicknessMm: 107.95,
      epsRsiPerMm: 0.026,
      concreteCoreMm: 152.4,
      concreteRsiPerMm: 0.0004,
      boundary: icfBoundary,
    })
    expect(rsi).toBeCloseTo(5.974, 2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ecp-calculator && npx vitest run scripts/compute.test.js
```

Expected: New tests FAIL (functions not exported), wood tests still PASS.

- [ ] **Step 3: Implement steel and ICF formulas in compute.js**

Add to `ecp-calculator/scripts/compute.js`:

```js
/**
 * Total RSI for a steel-framed wall assembly.
 *
 * Uses modified zone method: RSI = k_iso * V_iso + k_pp * T_pp
 * where k_iso=0.4, k_pp=0.6 (from RSI-calc.xlsx)
 *
 * @param {object} params
 * @param {number} params.studDepthMm - Steel stud depth in mm
 * @param {number} params.cavityRsi - Cavity insulation RSI
 * @param {number} params.spacingInches - Stud spacing in inches
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} params.airSpace - Air space RSI (typically 0.18)
 * @param {number} [params.contInsRsi=0] - Continuous insulation RSI
 * @param {number} [params.kIso=0.4] - Isothermal planes weight
 * @param {number} [params.kPp=0.6] - Parallel-path weight
 * @returns {number} Total effective RSI
 */
export function steelWallRsi({
  studDepthMm,
  cavityRsi,
  spacingInches,
  boundary,
  airSpace,
  contInsRsi = 0,
  kIso = 0.4,
  kPp = 0.6,
}) {
  const studRsi = studDepthMm * 0.0000161
  const webThicknessIn = 0.125
  const cavityPct = (spacingInches - webThicknessIn) * 100 / spacingInches

  // Boundary sum for steel (includes air space, no sheathing typically)
  const bSum = (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + (airSpace || 0)
    + (contInsRsi || 0)
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)

  // Isothermal planes: full assembly as two parallel paths (stud path, cavity path)
  const tStud = bSum + studRsi
  const tCavity = bSum + cavityRsi
  const framingPct = 100 - cavityPct
  const vIso = 100 / (framingPct / tStud + cavityPct / tCavity)

  // Parallel-path: stud-cavity layer only, then add boundary in series
  const wPp = parallelPath(studRsi, cavityRsi, cavityPct)
  const tPp = bSum + wPp

  return kIso * vIso + kPp * tPp
}

/**
 * Total RSI for an ICF wall assembly.
 *
 * Simple series sum: boundary + 2 * form_rsi + concrete_rsi
 *
 * @param {object} params
 * @param {number} params.formThicknessMm - EPS form thickness per side (mm)
 * @param {number} params.epsRsiPerMm - EPS RSI per mm (typically 0.026)
 * @param {number} params.concreteCoreMm - Concrete core thickness (mm)
 * @param {number} params.concreteRsiPerMm - Concrete RSI per mm (typically 0.0004)
 * @param {object} params.boundary - Boundary layer RSI values
 * @returns {number} Total effective RSI
 */
export function icfWallRsi({
  formThicknessMm,
  epsRsiPerMm,
  concreteCoreMm,
  concreteRsiPerMm,
  boundary,
}) {
  const formRsi = formThicknessMm * 2 * epsRsiPerMm
  const concreteRsi = concreteCoreMm * concreteRsiPerMm
  return (boundary.outside_air || 0)
    + (boundary.cladding || 0)
    + formRsi
    + concreteRsi
    + (boundary.drywall || 0)
    + (boundary.inside_air || 0)
}
```

- [ ] **Step 4: Run all tests**

```bash
cd ecp-calculator && npx vitest run scripts/compute.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/compute.js scripts/compute.test.js
git commit -m "feat: add steel (modified zone method) and ICF RSI formulas"
```

---

### Task 7: Compute Module — Double Stud and Double Wall Formulas

**Files:**
- Modify: `ecp-calculator/scripts/compute.js`
- Modify: `ecp-calculator/scripts/compute.test.js`

- [ ] **Step 1: Add failing tests for double stud and double wall**

Append to `ecp-calculator/scripts/compute.test.js`:

```js
import { doubleStudWallRsi, doubleWallRsi } from './compute.js'

describe('doubleStudWallRsi', () => {
  // Double stud: two rows of studs on a wider plate, insulated gap between
  // Each stud row: parallel-path
  // Gap: isothermal plane (series RSI, no bridging)
  // Total = boundary + stud_row_1 + gap + stud_row_2

  const boundary = {
    outside_air: 0.03,
    cladding: 0.11,
    sheathing: 0.108,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('two 2x4 rows on 2x10 plate, dense pack cellulose, 16" OC', () => {
    // Outer stud row: 2x4 = 89mm, DPC 0.024 RSI/mm
    // Inner stud row: 2x4 = 89mm, DPC 0.024 RSI/mm
    // Plate width: 2x10 = 235mm
    // Gap = 235 - 89 - 89 = 57mm of continuous insulation
    // Gap RSI = 57 * 0.024 = 1.368
    // Each stud row pp: parallelPath(89*0.0085, 89*0.024, 77) = parallelPath(0.7565, 2.136, 77)
    const rsi = doubleStudWallRsi({
      outerStudDepthMm: 89,
      innerStudDepthMm: 89,
      plateDepthMm: 235,
      cavityRsiPerMm: 0.024,
      cavityPct: 77,
      boundary,
    })
    // Each stud-cavity pp ≈ 1.504
    // Gap RSI = 57 * 0.024 = 1.368
    // Total ≈ 0.448 + 1.504 + 1.368 + 1.504 = 4.824
    expect(rsi).toBeGreaterThan(4.5)
    expect(rsi).toBeLessThan(5.5)
  })

  it('gap RSI increases with wider plate', () => {
    const narrow = doubleStudWallRsi({
      outerStudDepthMm: 89,
      innerStudDepthMm: 89,
      plateDepthMm: 184, // 2x8
      cavityRsiPerMm: 0.024,
      cavityPct: 77,
      boundary,
    })
    const wide = doubleStudWallRsi({
      outerStudDepthMm: 89,
      innerStudDepthMm: 89,
      plateDepthMm: 286, // 2x12
      cavityRsiPerMm: 0.024,
      cavityPct: 77,
      boundary,
    })
    expect(wide).toBeGreaterThan(narrow)
    // Difference should be approximately (286-184)*0.024 = 2.448
    expect(wide - narrow).toBeCloseTo((286 - 184) * 0.024, 1)
  })
})

describe('doubleWallRsi', () => {
  // Double wall: exterior framed wall + insulated gap + interior framed wall
  // Each framed wall: parallel-path
  // Gap: isothermal plane (continuous insulation)

  const boundary = {
    outside_air: 0.03,
    cladding: 0.11,
    sheathing: 0.108,
    drywall: 0.08,
    inside_air: 0.12,
  }

  it('2x6 exterior + 3" gap + 2x4 interior, DPC', () => {
    const rsi = doubleWallRsi({
      outerStudDepthMm: 140,
      outerCavityRsi: 140 * 0.024,   // DPC in outer wall
      outerCavityPct: 77,
      innerStudDepthMm: 89,
      innerCavityRsi: 89 * 0.024,    // DPC in inner wall
      innerCavityPct: 77,
      gapMm: 76.2,                    // 3"
      gapRsiPerMm: 0.024,            // DPC blown in
      boundary,
    })
    // Outer pp ≈ 2.364, inner pp ≈ 1.504, gap = 76.2*0.024 = 1.829
    // Total ≈ 0.448 + 2.364 + 1.829 + 1.504 = 6.145
    expect(rsi).toBeGreaterThan(5.5)
    expect(rsi).toBeLessThan(7.0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ecp-calculator && npx vitest run scripts/compute.test.js
```

Expected: New tests FAIL, earlier tests still PASS.

- [ ] **Step 3: Implement double stud and double wall formulas**

Add to `ecp-calculator/scripts/compute.js`:

```js
/**
 * Total RSI for a staggered double stud wall.
 *
 * Two rows of studs on a wider plate, blown insulation fills everything.
 * Each stud row: parallel-path (penalizes bridging)
 * Gap between rows: isothermal plane (no bridging — continuous insulation)
 *
 * @param {object} params
 * @param {number} params.outerStudDepthMm - Outer stud row depth (mm)
 * @param {number} params.innerStudDepthMm - Inner stud row depth (mm)
 * @param {number} params.plateDepthMm - Total plate width (mm), determines gap
 * @param {number} params.cavityRsiPerMm - Blown insulation RSI per mm
 * @param {number} params.cavityPct - Cavity area percentage (same for both rows)
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} [params.contInsRsi=0] - Optional exterior continuous insulation
 * @returns {number} Total effective RSI
 */
export function doubleStudWallRsi({
  outerStudDepthMm,
  innerStudDepthMm,
  plateDepthMm,
  cavityRsiPerMm,
  cavityPct,
  boundary,
  contInsRsi = 0,
}) {
  const gapMm = plateDepthMm - outerStudDepthMm - innerStudDepthMm

  // Each stud row via parallel-path
  const outerStudRsi = outerStudDepthMm * 0.0085
  const outerCavityRsi = outerStudDepthMm * cavityRsiPerMm
  const outerPp = parallelPath(outerStudRsi, outerCavityRsi, cavityPct)

  const innerStudRsi = innerStudDepthMm * 0.0085
  const innerCavityRsi = innerStudDepthMm * cavityRsiPerMm
  const innerPp = parallelPath(innerStudRsi, innerCavityRsi, cavityPct)

  // Gap: continuous insulation (series, no bridging)
  const gapRsi = gapMm * cavityRsiPerMm

  return boundarySum(boundary, { contInsRsi }) + outerPp + gapRsi + innerPp
}

/**
 * Total RSI for a double wall (exterior wall + gap + interior wall).
 *
 * Each wall: parallel-path framed layer
 * Gap: isothermal plane (blown insulation, no bridging)
 *
 * @param {object} params
 * @param {number} params.outerStudDepthMm - Exterior wall stud depth (mm)
 * @param {number} params.outerCavityRsi - Exterior wall cavity insulation RSI
 * @param {number} params.outerCavityPct - Exterior wall cavity percentage
 * @param {number} params.innerStudDepthMm - Interior wall stud depth (mm)
 * @param {number} params.innerCavityRsi - Interior wall cavity insulation RSI
 * @param {number} params.innerCavityPct - Interior wall cavity percentage
 * @param {number} params.gapMm - Gap width in mm
 * @param {number} params.gapRsiPerMm - Gap insulation RSI per mm
 * @param {object} params.boundary - Boundary layer RSI values
 * @param {number} [params.contInsRsi=0] - Optional exterior continuous insulation
 * @returns {number} Total effective RSI
 */
export function doubleWallRsi({
  outerStudDepthMm,
  outerCavityRsi,
  outerCavityPct,
  innerStudDepthMm,
  innerCavityRsi,
  innerCavityPct,
  gapMm,
  gapRsiPerMm,
  boundary,
  contInsRsi = 0,
}) {
  const outerStudRsi = outerStudDepthMm * 0.0085
  const outerPp = parallelPath(outerStudRsi, outerCavityRsi, outerCavityPct)

  const innerStudRsi = innerStudDepthMm * 0.0085
  const innerPp = parallelPath(innerStudRsi, innerCavityRsi, innerCavityPct)

  const gapRsi = gapMm * gapRsiPerMm

  return boundarySum(boundary, { contInsRsi }) + outerPp + gapRsi + innerPp
}
```

- [ ] **Step 4: Run all tests**

```bash
cd ecp-calculator && npx vitest run scripts/compute.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/compute.js scripts/compute.test.js
git commit -m "feat: add double stud and double wall RSI formulas"
```

---

## Chunk 2: Build Pipeline and JSON Generation

### Task 8: Full CSV Validation

Before generating any JSON, validate that compute.js reproduces ALL 84 existing framed wall RSI values from `data/lookup-framed-wall-rsi.csv`.

**Files:**
- Create: `ecp-calculator/scripts/validate.test.js`

- [ ] **Step 1: Write validation test that reads the CSV and checks every row**

Write `ecp-calculator/scripts/validate.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadMaterials } from './loadMaterials.js'
import { woodWallRsi, steelWallRsi } from './compute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ecpToolDir = join(__dirname, '..', '..')  // ECPTool/

// Read existing CSV with pre-computed RSI values
const csvPath = join(ecpToolDir, 'data', 'lookup-framed-wall-rsi.csv')
const csvLines = readFileSync(csvPath, 'utf8').trim().split('\n').slice(1) // skip header

const m = loadMaterials()

// Default boundary layers matching RSI-calc.xlsx
const woodBoundary = { outside_air: 0.03, cladding: 0.11, sheathing: 0.108, drywall: 0.08, inside_air: 0.12 }
const steelBoundary = { outside_air: 0.03, cladding: 0.07, sheathing: 0, drywall: 0.08, inside_air: 0.12 }

function getCavityRsi(wallType, materialKey, cavityType) {
  const mat = m.cavity[materialKey]
  if (!mat) throw new Error(`Unknown material: ${materialKey}`)

  if (mat.type === 'batt') {
    const cav = mat.cavities.find(c => c.id === cavityType)
    if (!cav) throw new Error(`Unknown cavity: ${cavityType} for ${materialKey}`)
    if (wallType === 'steel' && cav.steel_rsi) return cav.steel_rsi
    if (wallType === 'wood' && cav.wood_rsi) return cav.wood_rsi
    return cav.rsi
  }

  // Blown-in: RSI = depth * rsi_per_mm
  const studSize = cavityType  // e.g. "2x4", "2x6", "2x3-5/8"
  const studs = m.framing[wallType].studs[studSize]
  if (!studs) throw new Error(`Unknown stud: ${studSize} for ${wallType}`)
  return studs.depth_mm * mat.rsi_per_mm
}

// Map CSV material names to YAML keys
const materialKeyMap = {
  'Fiberglass Batt': 'fiberglass_batt',
  'Mineral Wool Batt': 'mineral_wool_batt',
  'Loose Fill Cellulose': 'loose_fill_cellulose',
  'Dense Pack Cellulose': 'dense_pack_cellulose',
  'Loose Fill Fiberglass': 'loose_fill_fiberglass',
}

describe('CSV validation: all 84 framed wall RSI values', () => {
  csvLines.forEach(line => {
    // CSV format: wall_type,"spacing",cavity_material,cavity_type,rsi,,,,,
    const parts = line.split(',')
    const wallType = parts[0]
    const spacing = parseInt(parts[1].replace(/"/g, ''))
    const material = parts[2]
    const cavityType = parts[3]
    const expectedRsi = parseFloat(parts[4])

    const materialKey = materialKeyMap[material]

    it(`${wallType}/${spacing}"/${material}/${cavityType} = ${expectedRsi.toFixed(4)}`, () => {
      const cavityRsi = getCavityRsi(wallType, materialKey, cavityType)

      let computedRsi
      if (wallType === 'wood') {
        const studSize = cavityType.split(' ')[0] // "2x6 R20" -> "2x6", or "2x4" for blown-in
        const studDepthMm = m.framing.wood.studs[studSize].depth_mm
        const cavityPct = m.framing.wood.cavity_pct[spacing]
        computedRsi = woodWallRsi({
          studDepthMm,
          cavityRsi,
          cavityPct,
          boundary: woodBoundary,
        })
      } else {
        // Steel
        const studSize = cavityType.split(' ')[0]
        const studDepthMm = m.framing.steel.studs[studSize].depth_mm
        computedRsi = steelWallRsi({
          studDepthMm,
          cavityRsi,
          spacingInches: spacing,
          boundary: steelBoundary,
          airSpace: 0.18,
        })
      }

      // Allow 0.02 tolerance for blown-in materials (RSI/mm approximation)
      // Exact match (0.001) for batt materials
      const tolerance = m.cavity[materialKey].type === 'blown' ? 0.02 : 0.001
      expect(computedRsi).toBeCloseTo(expectedRsi, tolerance < 0.01 ? 4 : 1)
    })
  })
})
```

- [ ] **Step 2: Run validation**

```bash
cd ecp-calculator && npx vitest run scripts/validate.test.js
```

Expected: Most tests PASS. Some blown-in fiberglass values may be off by ~0.01 due to RSI/mm approximation. If any batt values fail, the YAML data is wrong — fix it before proceeding.

- [ ] **Step 3: Adjust YAML values if needed**

If any tests fail with tolerance > 0.02, investigate:
1. Check the ref sheet cavity RSI for that specific material/cavity combo
2. Update the YAML file with the correct value
3. Re-run until all 84 tests pass within tolerance

- [ ] **Step 4: Commit**

```bash
git add scripts/validate.test.js
git commit -m "test: add full CSV validation for all 84 framed wall RSI values"
```

---

### Task 9: JSON Generator — Wall Data

**Files:**
- Create: `ecp-calculator/scripts/generate.js`

The generator reads YAML, enumerates all valid wall combinations, and writes JSON lookup files.

- [ ] **Step 1: Write generate.js**

Write `ecp-calculator/scripts/generate.js`:

```js
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

import { writeFileSync, existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadMaterials } from './loadMaterials.js'
import { parallelPath } from './compute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'data', 'generated')
const audit = process.argv.includes('--audit')

const m = loadMaterials()

// --- Wall Data JSON ---
// Structure: { wallType: { spacing: { material: { cavityType: { studRsi, cavityRsi, cavityPct, ppRsi } } } } }
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
              // Check if this cavity type fits any wood stud
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
              const cavRsi = stud.depth_mm * mat.rsi_per_mm
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
      data[wallType].web_thickness_in = framing.web_thickness_in
      data[wallType].k_iso = framing.k_iso
      data[wallType].k_pp = framing.k_pp
      data[wallType].spacings = {}

      const spacings = [16, 19, 24]
      for (const spacing of spacings) {
        const cavityPct = (spacing - framing.web_thickness_in) * 100 / spacing
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
              const cavRsi = stud.depth_mm * mat.rsi_per_mm
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
  // ECP point thresholds — these rarely change, but centralizing here
  // means the YAML could own them in future
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
  // Pre-compute common double stud configurations
  // These use blown-in materials only (batt doesn't span a gap)
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
          if (gapMm <= 0) continue // plate too narrow for these studs

          for (const [matKey, mat] of blownMaterials) {
            const outerStudRsi = outerMm * 0.0085
            const outerCavRsi = outerMm * mat.rsi_per_mm
            const outerPp = parallelPath(outerStudRsi, outerCavRsi, cavPct)

            const innerStudRsi = innerMm * 0.0085
            const innerCavRsi = innerMm * mat.rsi_per_mm
            const innerPp = parallelPath(innerStudRsi, innerCavRsi, cavPct)

            const gapRsi = gapMm * mat.rsi_per_mm

            const key = `${outerStud}+${innerStud}|${plateId}|${mat.label}`
            data[spacingStr][key] = {
              outerStud, innerStud, plate: plateId,
              material: mat.label,
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
```

- [ ] **Step 2: Run the generator**

```bash
cd ecp-calculator && node scripts/generate.js
```

Expected output:
```
Generating ECP data...
  Wood single wall combos: <number>
  Steel single wall combos: <number>
  Double stud combos: <number>
Done.
```

Verify the generated files exist:
```bash
ls -la src/data/generated/
```

- [ ] **Step 3: Spot-check generated values**

```bash
cd ecp-calculator && node -e "
const d = JSON.parse(require('fs').readFileSync('src/data/generated/wall-data.json','utf8'))
// Wood/16/Fiberglass Batt/2x6 R20 ppRsi should be ~2.3596 (total was 2.8075 = 0.448 + ppRsi)
console.log('Wood 16 FG 2x6 R20:', d.wood.spacings['16'].materials['Fiberglass Batt']['2x6 R20'])
// Continuous ins EPS 1\" should be 0.65
const ci = JSON.parse(require('fs').readFileSync('src/data/generated/continuous-ins.json','utf8'))
console.log('EPS 1\":', ci['EPS'].thicknesses['1\"'])
"
```

- [ ] **Step 4: Commit generated JSON**

```bash
git add scripts/generate.js src/data/generated/
git commit -m "feat: add build pipeline and generated JSON wall data"
```

---

### Task 10: Excel Workbook Generation (Audit Artifact)

**Files:**
- Modify: `ecp-calculator/scripts/generate.js`

This is the downloadable spreadsheet with live formulas. Lower priority than JSON generation — can be deferred if needed. The ExcelJS library creates a `.xlsx` file where every RSI value is a formula referencing the material properties sheet.

- [ ] **Step 1: Add Excel generation function to generate.js**

Add to `ecp-calculator/scripts/generate.js` (after the JSON generation section):

```js
import ExcelJS from 'exceljs'

async function generateExcel(wallData) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ECP Calculator Pipeline'
  wb.created = new Date()

  // Ref sheet — material properties
  const ref = wb.addWorksheet('Materials')
  ref.columns = [
    { header: 'Property', key: 'prop', width: 30 },
    { header: 'Value', key: 'val', width: 15 },
    { header: 'Unit', key: 'unit', width: 15 },
    { header: 'Source', key: 'source', width: 40 },
  ]
  // Populate with all YAML material properties...
  // (Full implementation: iterate framing, cavity, continuous, boundary)

  // Wood sheet — one row per combo, formulas reference Materials sheet
  const wood = wb.addWorksheet('Wood Frame')
  wood.columns = [
    { header: 'Spacing', key: 'spacing' },
    { header: 'Material', key: 'material' },
    { header: 'Cavity', key: 'cavity' },
    { header: 'Stud RSI', key: 'studRsi' },
    { header: 'Cavity RSI', key: 'cavityRsi' },
    { header: 'Cavity %', key: 'cavityPct' },
    { header: 'PP RSI', key: 'ppRsi' },
    { header: 'Cladding', key: 'cladding' },
    { header: 'Sheathing', key: 'sheathing' },
    { header: 'Total RSI', key: 'totalRsi' },
  ]
  // Populate rows with formulas...

  const excelPath = join(__dirname, '..', 'dist', 'ECP-Wall-RSI-Calculator.xlsx')
  await wb.xlsx.writeFile(excelPath)
  console.log(`  Excel workbook: ${excelPath}`)
}
```

Note: The Excel generation is a detailed but mechanical task. The implementer should populate every row with ExcelJS cell formulas that reference the Materials sheet. The exact implementation follows the column layout of RSI-calc.xlsx.

- [ ] **Step 2: Run generate with Excel**

```bash
cd ecp-calculator && node scripts/generate.js
```

Verify: `dist/ECP-Wall-RSI-Calculator.xlsx` exists.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate.js
git commit -m "feat: add Excel workbook generation for audit trail"
```

---

## Chunk 3: React App Integration

### Task 11: Refactor ecpData.js to Use Generated JSON

**Files:**
- Modify: `ecp-calculator/src/data/ecpData.js`
- Modify: `ecp-calculator/src/data/ecpData.test.js`

The existing ecpData.js has 368 lines of hardcoded data. Refactor it to import generated JSON and expose the same API (plus new functions for variable boundary layers and new wall types).

- [ ] **Step 1: Update ecpData.test.js — keep existing tests, add new ones**

The existing tests must continue to pass (regression). Add tests for the new API surface.

Add to `ecp-calculator/src/data/ecpData.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  calculateWallRsi, getWallPoints, MIN_WALL_RSI, categories, tiers,
  // New exports:
  getBoundaryOptions, getDefaultBoundary, getContinuousInsRsi,
  wallTypes, studSpacingOptions, cavityMaterials,
} from './ecpData.js'

// ALL existing tests remain unchanged — they validate backward compatibility.

// New tests for variable boundary layers:
describe('variable boundary layers', () => {
  it('getBoundaryOptions returns cladding and sheathing options', () => {
    const opts = getBoundaryOptions()
    expect(opts.cladding.options.length).toBeGreaterThan(3)
    expect(opts.sheathing.options.length).toBeGreaterThan(2)
  })

  it('getDefaultBoundary returns wood defaults', () => {
    const b = getDefaultBoundary('wood')
    expect(b.cladding).toBe(0.11)   // vinyl siding
    expect(b.sheathing).toBe(0.108) // 7/16" OSB
  })

  it('getDefaultBoundary returns steel defaults', () => {
    const b = getDefaultBoundary('steel')
    expect(b.cladding).toBe(0.11)   // metal siding hollow-backed (same as vinyl per NBC)
    expect(b.sheathing).toBe(0)     // no sheathing for steel
    expect(b.air_space).toBe(0.18)
  })

  it('calculateWallRsi with custom sheathing', () => {
    const defaultRsi = calculateWallRsi({
      wallType: 'wood', studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
    })
    const withPlywood = calculateWallRsi({
      wallType: 'wood', studSpacing: '16"',
      cavityMaterial: 'Fiberglass Batt', cavityType: '2x6 R20',
      sheathingId: 'plywood_1_2',
    })
    // Plywood 1/2" (0.110) vs OSB 7/16" (0.108) = +0.002
    expect(withPlywood - defaultRsi).toBeCloseTo(0.002, 3)
  })
})
```

- [ ] **Step 2: Run tests to see current state**

```bash
cd ecp-calculator && npm test
```

Existing tests should pass. New tests will fail (new exports don't exist yet).

- [ ] **Step 3: Rewrite ecpData.js**

Replace `ecp-calculator/src/data/ecpData.js` with a new version that imports generated JSON and the compute module:

```js
// ECP Calculator — Data Layer
//
// Imports pre-computed wall data from the build pipeline (scripts/generate.js)
// and provides lookup functions for the React app.
//
// The compute module (scripts/compute.js) is imported for runtime calculations
// when boundary layers differ from defaults (variable cladding/sheathing).

import wallData from './generated/wall-data.json'
import continuousInsData from './generated/continuous-ins.json'
import icfData from './generated/icf-data.json'
import boundaryOptions from './generated/boundary-options.json'
import thresholdsData from './generated/thresholds.json'
import doubleStudData from './generated/double-stud-data.json'
import { woodWallRsi, steelWallRsi, icfWallRsi, parallelPath } from '../../scripts/compute.js'

// --- Exports matching existing API (backward compatible) ---

export const wallTypes = [
  { id: 'wood', label: 'Wood Frame' },
  { id: 'steel', label: 'Steel Frame' },
  { id: 'icf', label: 'ICF' },
]

export const studSpacingOptions = [
  { label: '16"' },
  { label: '19"' },
  { label: '24"' },
]

// Derive cavity materials from wall-data.json
export const cavityMaterials = (() => {
  const mats = new Set()
  for (const wt of Object.values(wallData)) {
    if (!wt.spacings) continue
    for (const sp of Object.values(wt.spacings)) {
      for (const label of Object.keys(sp.materials)) {
        mats.add(label)
      }
    }
  }
  return [...mats]
})()

// Derive available cavity types per material from wall-data.json
export const cavityTypesByMaterial = (() => {
  const result = {}
  // Use wood spacings as the canonical set (widest variety)
  const woodSpacings = wallData.wood?.spacings || {}
  const firstSpacing = Object.values(woodSpacings)[0]
  if (!firstSpacing) return result
  for (const [label, entries] of Object.entries(firstSpacing.materials)) {
    result[label] = Object.keys(entries)
  }
  return result
})()

export const continuousInsTypes = Object.keys(continuousInsData)
  .map(label => label === 'Polyiso' ? 'Polyiso' : label)

export const continuousInsThicknesses = ['None', '1"', '1-1/2"', '2"', '2-1/2"', '3"']

export const icfFormOptions = icfData.forms.map(f => f.label)

// PIC → Polyiso rename: continuousInsData already uses "Polyiso"
export const continuousInsRsi = (() => {
  const result = {}
  for (const [label, data] of Object.entries(continuousInsData)) {
    result[label] = { None: 0, ...data.thicknesses }
  }
  return result
})()

export const icfRsi = (() => {
  const result = {}
  for (const f of icfData.forms) {
    result[f.label] = f.total_form_rsi + f.concrete_rsi
      + boundaryOptions.air_films.outside
      + (boundaryOptions.cladding.options.find(
          o => o.id === boundaryOptions.cladding.defaults.icf)?.rsi || 0.07)
      + boundaryOptions.drywall.default
      + boundaryOptions.air_films.inside
  }
  return result
})()

export const wallPointsThresholds = thresholdsData.walls
export const MIN_WALL_RSI = thresholdsData.minWallRsi

// --- Boundary layer API ---

export function getBoundaryOptions() {
  return boundaryOptions
}

export function getDefaultBoundary(wallType) {
  const b = {
    outside_air: boundaryOptions.air_films.outside,
    inside_air: boundaryOptions.air_films.inside,
    drywall: boundaryOptions.drywall.default,
    cladding: 0,
    sheathing: 0,
    air_space: 0,
  }

  // Cladding default per wall type
  const claddingId = boundaryOptions.cladding.defaults[wallType]
  const cladding = boundaryOptions.cladding.options.find(o => o.id === claddingId)
  b.cladding = cladding?.rsi || 0

  // Sheathing (wood only)
  if (boundaryOptions.sheathing.applies_to.includes(wallType)) {
    const sheathingId = boundaryOptions.sheathing.default
    const sheathing = boundaryOptions.sheathing.options.find(o => o.id === sheathingId)
    b.sheathing = sheathing?.rsi || 0
  }

  // Steel air space
  if (wallType === 'steel') {
    b.air_space = boundaryOptions.steel_air_space.rsi
  }

  return b
}

export function getContinuousInsRsi(type, thickness) {
  if (!type || thickness === 'None') return 0
  return continuousInsData[type]?.thicknesses[thickness] ?? 0
}

// --- Main calculation function (backward compatible + extended) ---

export function calculateWallRsi({
  wallType, studSpacing, cavityMaterial, cavityType,
  contInsType, contInsThickness, icfFormThickness,
  sheathingId, claddingId,
  // New: assembly type for double stud / double wall
  assemblyType = 'single',
  // Double stud params
  outerStud, innerStud, plate, doubleStudMaterial,
} = {}) {
  // Build boundary layers (with optional custom cladding/sheathing)
  const boundary = getDefaultBoundary(wallType || 'wood')
  if (sheathingId) {
    const sh = boundaryOptions.sheathing.options.find(o => o.id === sheathingId)
    if (sh) boundary.sheathing = sh.rsi
  }
  if (claddingId) {
    const cl = boundaryOptions.cladding.options.find(o => o.id === claddingId)
    if (cl) boundary.cladding = cl.rsi
  }

  const contInsRsi = getContinuousInsRsi(contInsType, contInsThickness)

  // ICF path
  if (wallType === 'icf') {
    const form = icfData.forms.find(f => f.label === icfFormThickness)
    if (!form) return null
    return icfWallRsi({
      formThicknessMm: form.thickness_mm,
      epsRsiPerMm: icfData.eps_rsi_per_mm,
      concreteCoreMm: icfData.concrete_core_mm,
      concreteRsiPerMm: icfData.concrete_rsi_per_mm,
      boundary,
    })
  }

  // Single wall path (wood or steel)
  if (assemblyType === 'single') {
    const spacing = studSpacing?.replace('"', '') || ''
    const wt = wallData[wallType]
    if (!wt?.spacings?.[spacing]) return null
    const sp = wt.spacings[spacing]
    const entry = sp.materials[cavityMaterial]?.[cavityType]
    if (!entry) return null

    if (wallType === 'wood') {
      return woodWallRsi({
        studDepthMm: wt.studs[entry.stud].depth_mm,
        cavityRsi: entry.cavityRsi,
        cavityPct: sp.cavity_pct,
        boundary,
        contInsRsi,
      })
    }

    if (wallType === 'steel') {
      return steelWallRsi({
        studDepthMm: wt.studs[entry.stud].depth_mm,
        cavityRsi: entry.cavityRsi,
        spacingInches: parseInt(spacing),
        boundary,
        airSpace: boundary.air_space,
        contInsRsi,
        kIso: wt.k_iso,
        kPp: wt.k_pp,
      })
    }
  }

  // Double stud path (wood only)
  if (assemblyType === 'doubleStud') {
    const spacing = studSpacing?.replace('"', '') || ''
    const key = `${outerStud}+${innerStud}|${plate}|${doubleStudMaterial}`
    const entry = doubleStudData[spacing]?.[key]
    if (!entry) return null

    // Recompute with current boundary layers
    const outerMm = wallData.wood.studs[entry.outerStud]?.depth_mm
    const innerMm = wallData.wood.studs[entry.innerStud]?.depth_mm
    const plateMm = wallData.wood.studs[entry.plate]?.depth_mm
    if (!outerMm || !innerMm || !plateMm) return null

    // Find material RSI/mm from cavity data
    // (stored in wall-data.json per stud, but we need rsi_per_mm for the gap)
    const matEntry = wallData.wood.spacings[spacing]?.materials[entry.material]?.[entry.outerStud]
    if (!matEntry) return null
    const rsiPerMm = matEntry.cavityRsi / outerMm

    const { doubleStudWallRsi: dsRsi } = await import('../../scripts/compute.js')
    return dsRsi({
      outerStudDepthMm: outerMm,
      innerStudDepthMm: innerMm,
      plateDepthMm: plateMm,
      cavityRsiPerMm: rsiPerMm,
      cavityPct: wallData.wood.spacings[spacing].cavity_pct,
      boundary,
      contInsRsi,
    })
  }

  return null
}

// Get points for a given RSI value (finds highest threshold met)
export function getWallPoints(rsi) {
  if (!rsi) return 0
  const sorted = [...wallPointsThresholds].sort((a, b) => b.minRsi - a.minRsi)
  const threshold = sorted.find(t => rsi >= t.minRsi)
  return threshold ? threshold.points : 0
}

// Categories and tiers — unchanged from current version
export const categories = [
  {
    id: 'aboveGroundWalls',
    name: 'Above Ground Walls',
    metric: 'RSI',
    unit: 'm\u00B2\u00B7K/W',
    description: 'Thermal resistance of above-grade wall assemblies',
    direction: 'higher',
    type: 'wallBuilder',
    options: thresholdsData.walls.map(t => ({ value: t.minRsi, points: t.points })),
  },
  {
    id: 'airTightness',
    name: 'Air Tightness',
    metric: 'ACH',
    unit: 'ACH @ 50Pa',
    description: 'Air changes per hour at 50 pascals pressure',
    direction: 'lower',
    options: [
      { value: 2.5, points: 0 },
      { value: 2.0, points: 3.5 },
      { value: 1.5, points: 6.9 },
      { value: 1.0, points: 10.4 },
      { value: 0.6, points: 13.3 },
    ],
  },
  {
    id: 'belowGradeWalls',
    name: 'Below Grade Walls',
    metric: 'RSI',
    unit: 'm\u00B2\u00B7K/W',
    description: 'Thermal resistance of below-grade wall assemblies',
    direction: 'higher',
    options: [
      { value: 3.09, points: 0.2 },
      { value: 3.46, points: 0.8 },
      { value: 3.9, points: 1.4 },
    ],
  },
  {
    id: 'dhwElectric',
    name: 'DHW (Electric)',
    metric: 'EF',
    unit: 'Energy Factor',
    description: 'Electric water heater efficiency. This energy factor can only be achieved with a heat pump water heater (HPWH)',
    direction: 'higher',
    exclusiveGroup: 'dhw',
    options: [{ value: 2.35, points: 3.8 }],
  },
  {
    id: 'dhwGas',
    name: 'DHW (Gas- or oil-fired)',
    metric: 'UEF',
    unit: 'Uniform Energy Factor',
    description: 'Gas- or oil-fired water heater efficiency',
    direction: 'higher',
    exclusiveGroup: 'dhw',
    options: [
      { value: 0.79, points: 2.4, label: 'Commercial Storage-type' },
      { value: 0.83, points: 4.9, label: 'Residential Storage-type' },
      { value: 0.85, points: 3.2, label: 'Commercial Storage-type' },
      { value: 0.92, points: 4.9, label: 'Tankless Condensing' },
    ],
  },
  {
    id: 'hrv',
    name: 'Ventilation',
    metric: 'SRE',
    unit: '%',
    description: 'Sensible heat recovery efficiency for heat recovery ventilator (HRV) or energy recovery ventilator (ERV)',
    direction: 'higher',
    options: [
      { value: 60, points: 0.7 },
      { value: 65, points: 2.2 },
      { value: 75, points: 3.5 },
    ],
  },
  {
    id: 'volume',
    name: 'Heated Volume',
    metric: 'Volume',
    unit: 'm\u00B3',
    description: 'Total heated volume of the building',
    direction: 'lower',
    options: [
      { value: 390, points: 1 },
      { value: 380, points: 2 },
      { value: 370, points: 3 },
      { value: 360, points: 4 },
      { value: 350, points: 5 },
      { value: 340, points: 6 },
      { value: 330, points: 7 },
      { value: 320, points: 8 },
      { value: 310, points: 9 },
      { value: 300, points: 10 },
    ],
  },
  {
    id: 'windowsDoors',
    name: 'Windows & Doors',
    metric: 'U-value',
    unit: 'W/m\u00B2\u00B7K',
    description: 'Maximum thermal transmittance',
    direction: 'lower',
    options: [
      { value: 1.44, points: 1.6 },
      { value: 1.22, points: 4.6 },
    ],
  },
]

export const tiers = [
  { id: 2, label: 'Tier 2', points: 10 },
  { id: 3, label: 'Tier 3', points: 20 },
]
```

**Important:** The `framedWallRsi` and `continuousInsRsi` named exports are REMOVED. They were internal lookup tables. If anything in the app referenced them directly, update those references to use `calculateWallRsi()` instead. The `WallBuilder` component already uses `calculateWallRsi()`.

- [ ] **Step 4: Run tests**

```bash
cd ecp-calculator && npm test
```

Expected: All existing tests pass. The test for `calculateWallRsi` with wood/16"/FG Batt/2x6 R20 should still return ~2.81 (with default boundary = OSB sheathing + vinyl cladding, this matches the original hardcoded value).

If the compute module path import (`../../scripts/compute.js`) doesn't work in Vite, add a Vite alias:

In `vite.config.js`:
```js
resolve: {
  alias: {
    '@scripts': path.resolve(__dirname, 'scripts'),
  }
}
```

And change the import in ecpData.js to `import { ... } from '@scripts/compute.js'`.

- [ ] **Step 5: Commit**

```bash
git add src/data/ecpData.js src/data/ecpData.test.js vite.config.js
git commit -m "refactor: ecpData.js imports generated JSON + compute module

Replaces 368 lines of hardcoded lookup tables with:
- Generated JSON from YAML material files
- Lightweight compute module for runtime RSI assembly
- Variable cladding/sheathing support
- Backward-compatible API (all existing tests pass)"
```

---

### Task 12: WallBuilder — Assembly Type Selector and Boundary Layer Dropdowns

**Files:**
- Modify: `ecp-calculator/src/components/WallBuilder.jsx`
- Modify: `ecp-calculator/src/App.jsx`

- [ ] **Step 1: Add assembly type selector to WallBuilder**

In `WallBuilder.jsx`, add a top-level toggle above the wall type selector:

```jsx
// At the top of the builder mode section, before wall type buttons:
<div className="assembly-type-selector">
  <label>Assembly Type</label>
  <div className="option-group">
    {['single', 'doubleStud', 'doubleWall'].map(type => (
      <button
        key={type}
        className={`option-btn ${selection.assemblyType === type ? 'selected' : ''}`}
        onClick={() => onSelect({ assemblyType: type })}
      >
        {type === 'single' ? 'Single Wall' :
         type === 'doubleStud' ? 'Double Stud' : 'Double Wall'}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Add cladding and sheathing dropdowns**

Below the assembly type selector, add boundary layer selection:

```jsx
import { getBoundaryOptions } from '../data/ecpData.js'

const boundaryOpts = getBoundaryOptions()

// In the render, after assembly type and before stud/cavity fields:
{selection.wallType !== 'icf' && (
  <div className="boundary-layers-group">
    <div className="field-row">
      <label>Cladding</label>
      <select
        value={selection.claddingId || boundaryOpts.cladding.defaults[selection.wallType || 'wood']}
        onChange={e => onSelect({ ...selection, claddingId: e.target.value })}
      >
        {boundaryOpts.cladding.options.map(o => (
          <option key={o.id} value={o.id}>{o.label} (RSI {o.rsi})</option>
        ))}
      </select>
    </div>
    {boundaryOpts.sheathing.applies_to.includes(selection.wallType) && (
      <div className="field-row">
        <label>Sheathing</label>
        <select
          value={selection.sheathingId || boundaryOpts.sheathing.default}
          onChange={e => onSelect({ ...selection, sheathingId: e.target.value })}
        >
          {boundaryOpts.sheathing.options.map(o => (
            <option key={o.id} value={o.id}>{o.label} (RSI {o.rsi})</option>
          ))}
        </select>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Pass new params through calculateWallRsi**

In the WallBuilder's RSI calculation section, pass the new fields:

```js
const rsi = calculateWallRsi({
  ...selection,
  sheathingId: selection.sheathingId,
  claddingId: selection.claddingId,
  assemblyType: selection.assemblyType || 'single',
})
```

- [ ] **Step 4: Update App.jsx wallSelection state**

In `App.jsx`, update the initial `wallSelection` state to include `assemblyType`:

```js
const [wallSelection, setWallSelection] = useState({ assemblyType: 'single' })
```

- [ ] **Step 5: Add deep cavity stud options**

In `WallBuilder.jsx`, the cavity type filter function (`getAvailableCavityTypes`) already uses `cavityTypesByMaterial` from ecpData. Since the generated JSON now includes 2x8/2x10/2x12 for blown-in materials, these will automatically appear in the dropdown.

Verify by running the dev server:
```bash
cd ecp-calculator && npm run dev
```

Select "Dense Pack Cellulose" → cavity types should show 2x4, 2x6, 2x8, 2x10, 2x12.

- [ ] **Step 6: Commit**

```bash
git add src/components/WallBuilder.jsx src/App.jsx
git commit -m "feat: add assembly type selector, cladding/sheathing dropdowns, deep cavity support"
```

---

### Task 13: WallBuilder — Double Stud Mode

**Files:**
- Modify: `ecp-calculator/src/components/WallBuilder.jsx`

- [ ] **Step 1: Add double stud fields**

When `assemblyType === 'doubleStud'`, show:
- Stud spacing (16", 19", 24")
- Outer stud size (2x4, 2x6)
- Inner stud size (2x4, 2x6)
- Plate width (2x8, 2x10, 2x12) — must be wider than outer + inner
- Insulation material (blown-in only: Dense Pack Cellulose, Loose Fill Cellulose, Loose Fill Fiberglass)

```jsx
{selection.assemblyType === 'doubleStud' && (
  <div className="double-stud-fields">
    <div className="field-row">
      <label>Stud Spacing</label>
      <div className="option-group">
        {studSpacingOptions.map(s => (
          <button key={s.label} className={`option-btn ${selection.studSpacing === s.label ? 'selected' : ''}`}
            onClick={() => onSelect({ ...selection, studSpacing: s.label })}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
    <div className="field-row">
      <label>Outer Studs</label>
      <div className="option-group">
        {['2x4', '2x6'].map(s => (
          <button key={s} className={`option-btn ${selection.outerStud === s ? 'selected' : ''}`}
            onClick={() => onSelect({ ...selection, outerStud: s })}>
            {s}
          </button>
        ))}
      </div>
    </div>
    <div className="field-row">
      <label>Inner Studs</label>
      <div className="option-group">
        {['2x4', '2x6'].map(s => (
          <button key={s} className={`option-btn ${selection.innerStud === s ? 'selected' : ''}`}
            onClick={() => onSelect({ ...selection, innerStud: s })}>
            {s}
          </button>
        ))}
      </div>
    </div>
    <div className="field-row">
      <label>Plate Width</label>
      <div className="option-group">
        {['2x8', '2x10', '2x12'].filter(p => {
          // Filter: plate must be wider than outer + inner studs
          // (validation happens here)
          const outerMm = { '2x4': 89, '2x6': 140 }[selection.outerStud] || 89
          const innerMm = { '2x4': 89, '2x6': 140 }[selection.innerStud] || 89
          const plateMm = { '2x8': 184, '2x10': 235, '2x12': 286 }[p]
          return plateMm > outerMm + innerMm
        }).map(p => (
          <button key={p} className={`option-btn ${selection.plate === p ? 'selected' : ''}`}
            onClick={() => onSelect({ ...selection, plate: p })}>
            {p}
          </button>
        ))}
      </div>
    </div>
    <div className="field-row">
      <label>Insulation</label>
      <div className="option-group">
        {['Dense Pack Cellulose', 'Loose Fill Cellulose', 'Loose Fill Fiberglass'].map(mat => (
          <button key={mat} className={`option-btn ${selection.doubleStudMaterial === mat ? 'selected' : ''}`}
            onClick={() => onSelect({ ...selection, doubleStudMaterial: mat })}>
            {mat}
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify double stud RSI calculation**

Run dev server, select Double Stud mode:
- 16" OC, 2x4 + 2x4, 2x10 plate, Dense Pack Cellulose
- Expected RSI: ~4.8 (based on test in Task 7)
- This should earn ~11.6 ECP points

- [ ] **Step 3: Commit**

```bash
git add src/components/WallBuilder.jsx
git commit -m "feat: add double stud wall builder mode"
```

---

### Task 14: PIC → Polyiso Rename and Doc Updates

**Files:**
- Modify: `ecp-calculator/docs/data-layer.md`
- Modify: `ecp-calculator/docs/components.md`
- Modify: `ecp-calculator/docs/architecture.md`

- [ ] **Step 1: Verify PIC → Polyiso is handled**

The continuous-insulation.yaml already uses "Polyiso" as the label. The old ecpData.js used "PIC". Check that nothing in the codebase still references "PIC":

```bash
cd ecp-calculator && grep -r "PIC" src/ --include='*.jsx' --include='*.js'
```

If any references found, update them to "Polyiso".

- [ ] **Step 2: Update docs**

Update `docs/data-layer.md` to describe the new architecture:
- YAML source of truth
- Generated JSON
- Compute module
- Variable boundary layers
- New assembly types

Update `docs/components.md` to describe WallBuilder changes:
- Assembly type selector
- Cladding/sheathing dropdowns
- Double stud mode

- [ ] **Step 3: Commit**

```bash
git add docs/ src/
git commit -m "docs: update data layer and component documentation for refactor"
```

---

## Open Questions (Decisions for Implementer / Ryan)

1. **Blown-in fiberglass RSI/mm accuracy**: The ref sheet shows slight inconsistency (0.02865 RSI/mm ± 0.001). The validation test (Task 8) will flag any values that exceed tolerance. If tolerance violations are unacceptable, store per-stud-size RSI for fiberglass instead of using RSI/mm.

2. **Double wall UI**: Task 13 covers double stud. Double wall is more complex (two independent wall configs + gap). Consider implementing as a separate follow-up task after the core refactor is deployed and field-tested.

3. **WallSection SVG**: The SVG visualization needs new renderings for double stud and double wall cross-sections. Per the design spec, scope this as a separate visual task. The calculator works without the SVG update — it just won't show the cross-section diagram for new wall types.

4. **Vite import path**: The compute module lives in `scripts/` (outside `src/`). Vite may need a config alias or the module may need to be duplicated into `src/`. Test the import path early (Task 11, Step 4).

5. **ExcelJS bundle size**: ExcelJS is a devDependency only (used by generate.js, not bundled into the React app). Verify it doesn't leak into the Vite bundle.

6. **Framing fraction for double stud interior walls**: Both stud rows use the same framing fraction. This is conservative (interior walls typically have simpler framing). Can be refined later with a separate interior framing factor.

7. **Double stud gap insulation options**: Currently limited to blown-in materials. Batt materials could technically be used in gaps but require specific product sizing. Add only if field reviewers request it.

8. **Steel default cladding**: RSI-calc.xlsx used cladding=0.07 for steel (brick veneer). The YAML defaults to metal_siding (0.11 per NBC). This means the new code with default options will produce *higher* steel RSI values than the old hardcoded lookup. The validation test (Task 8) uses the spreadsheet's original boundary layers (0.07) explicitly, so validation passes. But the UI default for steel walls will show slightly different RSI values than before. This is correct behavior — the old 0.07 was specific to brick veneer cladding, and the variable cladding system now lets users pick.

9. **Fiberglass loose fill depth dependence**: NBC shows RSI/mm varies from 0.02865 (89mm) to 0.030 (152mm). The YAML uses per-depth values for standard cavities and 0.029 for deep cavities. The validation test may show ~0.01 RSI discrepancy for some existing values. Accept this or store per-stud explicit RSI values for fiberglass.

10. **Advanced framing option**: NBC Table A shows reduced framing percentages for advanced framing (19%/81% at 16" OC vs standard 23%/77%). Could add as a toggle in the WallBuilder. Lower framing fraction = higher effective RSI. Defer to future phase unless field reviewers request it.
