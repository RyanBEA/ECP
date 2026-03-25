# Interior Service Wall — Design Spec

## Overview

Add an "Interior Service Wall" toggle to the ECP Calculator's WallBuilder component. When enabled, users configure an independent interior framed wall (service cavity) behind the primary wall assembly. This implements the LEEP NZE Wall Assembly #4 pattern (double stud + interior service wall) and also supports a simpler single wall + service wall configuration.

## Assembly Patterns

| Config | Structure (exterior → interior) |
|--------|-------------------------------|
| Single wall (existing) | cladding · sheathing · studs+cavity · drywall |
| Double stud (existing) | cladding · sheathing · outer studs · gap · inner studs · drywall |
| Single + service wall | cladding · sheathing · studs+cavity · **interior layer** · **service wall** · drywall |
| Double stud + service wall | cladding · sheathing · outer studs · gap · inner studs · **interior layer** · **service wall** · drywall |

## Calculation

Total RSI with service wall:

```
outside_air + cladding + [ext_sheathing] + primary_PP + interior_layer_RSI + service_PP + drywall + inside_air
```

- **primary_PP**: single wall `parallelPath()` or double stud `outerPP + gapRsi + innerPP`
- **interior_layer_RSI**: one material — either a sheathing option (e.g., OSB 0.108 RSI) OR a rigid foam option (e.g., 2" XPS 1.68 RSI). Not both.
- **service_PP**: independent `parallelPath(serviceStudRsi, serviceCavityRsi, serviceCavityPct)`

No new compute.js functions needed. Composition happens in `calculateWallRsi()` in ecpData.js.

### Continuous Insulation Rules

| Assembly | Exterior cont. ins. available? |
|----------|-------------------------------|
| Single wall, no service wall | Yes |
| Single wall + service wall | No |
| Double stud, no service wall | No |
| Double stud + service wall | No |

## UI Design

### Service Wall Toggle

Appears for wood walls, below the Assembly Type selector:

```
☐ Add Interior Service Wall
```

When enabled, hides Continuous Insulation section and reveals two new sections:

### Interior Layer Section

Single dropdown combining sheathing and rigid foam options, with grouped optgroups:

```
┌─ Interior Layer ──────────────────────────┐
│ Material:   [Select...              ▾]    │
│             ┌─ Sheathing ──────────┐      │
│             │ 7/16" OSB            │      │
│             │ 3/8" OSB             │      │
│             │ ...                  │      │
│             ├─ Rigid Insulation ───┤      │
│             │ EPS                  │      │
│             │ XPS                  │      │
│             │ Polyiso              │      │
│             │ Mineral Wool (Rock)  │      │
│             │ Mineral Wool (Glass) │      │
│             └──────────────────────┘      │
│ Thickness:  [2" ▾]  ← only for foam      │
└───────────────────────────────────────────┘
```

Sheathing options have fixed RSI (material determines thickness). Rigid foam options require a thickness sub-selector. **Default: 7/16" OSB (`osb_11`)** when service wall is enabled.

### Service Wall Section

Independent framing configuration:

```
┌─ Service Wall ────────────────────────────┐
│ Stud Spacing:     [16" ▾]                │
│ Cavity Material:  [Fiberglass Batt ▾]    │
│ Cavity Size:      [2x4 R14 ▾]           │
└───────────────────────────────────────────┘
```

Stud size derived from cavity type via `getStudDepth()` (no separate field).

### Visibility Rules

| State | Cont. Ins. | Service toggle | Interior Layer | Service Wall fields |
|---|---|---|---|---|
| Single wall, no service | visible | visible | hidden | hidden |
| Single wall + service | hidden | visible | visible | visible |
| Double stud, no service | hidden | visible | hidden | hidden |
| Double stud + service | hidden | visible | visible | visible |

## WallSection SVG Changes

### New Props

```js
assemblyType = 'single',        // 'single' | 'doubleStud'
hasServiceWall = false,
serviceStudDepth = '2x4',
serviceSpacing = 16,
serviceCavityLabel = null,
interiorLayerLabel = null,       // e.g., "7/16\" OSB" or "2\" XPS"
interiorLayerThickness = 0,      // inches (for rendering width)
outerStudDepth = '2x4',          // double stud outer row
innerStudDepth = '2x4',          // double stud inner row
claddingLabel = null,            // selected cladding name from dropdown
sheathingLabel = null,           // selected sheathing name from dropdown
```

### Bug Fix: Dynamic Boundary Labels

The existing SVG hardcodes `'7/16" sheathing'` and `'½" cladding'` labels regardless of user selection. New `claddingLabel` and `sheathingLabel` props replace these, passed from WallBuilder based on the selected boundary layer dropdowns. Falls back to the hardcoded defaults when not provided.

### Deep Stud Dimension Fix

Replace the binary 2x4/2x6 lookup:

```js
// Before
const studDepthInches = studDepth === '2x4' ? 3.5 : 5.5

// After
const studDepthMap = {
  '2x4': 3.5, '2x6': 5.5, '2x8': 7.25, '2x10': 9.25, '2x12': 11.25,
}
const studDepthInches = studDepthMap[studDepth] || 5.5
```

Applies to every stud section: primary wall, double stud inner/outer rows, service wall.

### Rendering Layers (interior → exterior, top → bottom)

**Single + service wall:**
```
drywall | service wall studs+cavity | interior layer | primary studs+cavity | sheathing | cladding
```

**Double stud + service wall:**
```
drywall | service wall studs+cavity | interior layer | inner studs+cavity | gap | outer studs+cavity | sheathing | cladding
```

**Double stud (no service wall):**
```
drywall | inner studs+cavity | gap (blown-in) | outer studs+cavity | sheathing | cladding
```

Interior layer renders as a sheathing band (for sheathing materials) or with the staggered vertical line pattern (for rigid foam).

## Data Layer Changes

### ecpData.js

New parameters for `calculateWallRsi()`:

```js
{
  hasServiceWall: false,
  serviceSpacing: null,            // e.g., '16"'
  serviceCavityMaterial: null,     // e.g., 'Fiberglass Batt'
  serviceCavityType: null,         // e.g., '2x4 R14'
  interiorLayerMaterial: null,     // sheathing ID or cont ins type
  interiorLayerThickness: null,    // only for rigid foam
}
```

New helper: `getInteriorLayerRsi(material, thickness)` — resolves sheathing ID (from boundary-options.json) or continuous insulation type+thickness (from continuous-ins.json) to RSI value.

**Service wall data lookup:** The service wall uses the same `wallData.wood.spacings[serviceSpacing].materials[serviceCavityMaterial][serviceCavityType]` lookup as the primary wall, with its own independent spacing. The `cavity_pct` comes from the service wall's spacing entry.

**Calculation note:** `boundarySum(boundary)` includes all boundary layers (outside air, cladding, sheathing, drywall, inside air). Since all layers are series resistances summed together, the physical layer order doesn't affect the total — addition is commutative. The service wall path computes: `boundarySum(boundary) + primaryPP + interiorLayerRsi + servicePP`.

### State Transitions

- **Enabling service wall:** clears `contInsType` and `contInsThickness` from state (not just hidden)
- **Disabling service wall:** clears all service wall fields (`serviceSpacing`, `serviceCavityMaterial`, `serviceCavityType`, `interiorLayerMaterial`, `interiorLayerThickness`)
- **Changing wall type from wood:** clears entire selection (existing behavior in `handleFieldChange`), which removes service wall state
- **Changing assembly type (single ↔ double stud):** preserves `hasServiceWall` and service wall fields; clears primary wall fields (existing behavior)
- **Changing `interiorLayerMaterial`:** clears `interiorLayerThickness` (foam needs thickness, sheathing doesn't)
- **Changing `serviceCavityMaterial`:** clears `serviceCavityType` (available types differ per material)

### No Changes Required

- compute.js — existing functions sufficient
- generate.js — no new generated data
- YAML material files — no changes
- Generated JSON files — no changes

## Scope

### In Scope

1. Service wall toggle + UI fields in WallBuilder
2. Interior layer dropdown (sheathing or rigid foam) with conditional thickness
3. `calculateWallRsi()` service wall code path in ecpData.js
4. `getInteriorLayerRsi()` helper
5. WallSection SVG: double stud rendering, service wall rendering, deep stud dimension fix
6. Continuous insulation visibility rules
7. Tests for new calculation paths

### Not In Scope

- Steel or ICF service walls (wood only)
- Pre-computed service wall lookups in generate.js
- Double wall presets in double-stud-data.json
- Excel workbook updates for service wall combos
- Exterior continuous insulation for double stud or service wall configs
- Polyethylene / vapor barrier modelling

## Reference

- LEEP NZE Wall Assembly #4: `reference/LEEP_Assembly_04_-_Dbl_Stud_w_Service_Wall-EN_WEB-REV.md`
- Existing double stud implementation: `scripts/compute.js` (`doubleStudWallRsi()`)
- Boundary options: `src/data/generated/boundary-options.json`
- Continuous insulation data: `src/data/generated/continuous-ins.json`
