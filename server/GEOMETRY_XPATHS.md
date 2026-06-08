# Geometry-dependent xpaths in base.h2k

Output of the geometry inventory (originally Task 5 — done by XML inspection rather than GUI diffing because HOT2000 does not auto-cascade between sections, so a diff would have shown nothing useful).

Locked-in hidden defaults (not mutated): stories=2, foundation=finished basement, wall heights (main=2.6m, second=2.45m), door count and area, basement window areas, weather, occupants.

User-set inputs that drive these mutations:
1. **target_floor_area_m2** — the building footprint per storey (m²). Drives a single scale factor applied across all geometry.
2. **fdwr** — fenestration + door area / above-grade wall area. Drives proportional scaling of the 8 above-grade window areas.

---

## Constants from base.h2k

| Constant | Value | Source |
|---|---|---|
| `BASE_FLOOR_AREA_M2` | 58.4 | Ceiling and basement floor area (line 424, 641) |
| `BASE_PERIMETER_M` | 30.58 | Wall perimeters (lines 437, 539, 626, 641, 735) |
| `MAIN_FLOOR_HEIGHT_M` | 2.6 | line 437 |
| `SECOND_FLOOR_HEIGHT_M` | 2.45 | line 539 |
| `DOOR_AREA_M2` | 3.528 | 2 doors × (1.96 × 0.9) m, lines 444, 454 |
| `BASE_ABOVE_GRADE_WALL_AREA_M2` | 154.4 | perimeter × (main_height + second_height) |
| `BASE_ABOVE_GRADE_WINDOW_AREA_M2` | 16.13 | sum of 8 above-grade window areas (see window table below) |

Scale factor: `s = sqrt(target_floor_area_m2 / BASE_FLOOR_AREA_M2)`

---

## Footprint-scaling xpaths

### Perimeter attributes — multiply by `s`

| Component | XPath | Attribute | Base value | Line |
|---|---|---|---|---|
| Main floor wall | `/HouseFile/House/Components/Wall[@id='2']/Measurements` | `perimeter` | 30.58 | 437 |
| Second floor wall | `/HouseFile/House/Components/Wall[@id='4']/Measurements` | `perimeter` | 30.58 | 539 |
| Second-floor FloorHeader (rim joist between main and second) | `/HouseFile/House/Components/Wall[@id='4']/Components/FloorHeader[@id='3']/Measurements` | `perimeter` | 30.576 | 618 |
| Basement | `/HouseFile/House/Components/Basement[@id='1']` | `exposedSurfacePerimeter` | 30.58 | 626 |
| Basement floor | `/HouseFile/House/Components/Basement[@id='1']/Floor/Measurements` | `perimeter` | 30.58 | 641 |
| Basement FloorHeader (rim joist around basement) | `/HouseFile/House/Components/Basement[@id='1']/Components/FloorHeader[@id='5']/Measurements` | `perimeter` | 30.58 | 735 |

### Area attributes — multiply by `s²`

| Component | XPath | Attribute | Base value | Line |
|---|---|---|---|---|
| Ceiling | `/HouseFile/House/Components/Ceiling[@id='6']/Measurements` | `area` | 58.4 | 424 |
| Roof cavity gable ends | `/HouseFile/House/Components/Ceiling[@id='6']/Construction/CeilingType/.../RoofCavity/GableEnds` | `area` | 9.7272 | 130 |
| Roof cavity sloped roof | `/HouseFile/House/Components/Ceiling[@id='6']/Construction/CeilingType/.../RoofCavity/SlopedRoof` | `area` | 61.5584 | 140 |
| Basement floor | `/HouseFile/House/Components/Basement[@id='1']/Floor/Measurements` | `area` | 58.4 | 641 |
| HeatedFloorArea above-grade | `/HouseFile/House/Specifications/HeatedFloorArea` | `aboveGrade` | 128 | 151 |
| HeatedFloorArea below-grade | `/HouseFile/House/Specifications/HeatedFloorArea` | `belowGrade` | 64 | 151 |
| Roof cavity volume | `/HouseFile/House/Components/Ceiling[@id='6']/Construction/CeilingType/.../RoofCavity` | `volume` | 37.1775 | 129 |

### Length attributes — multiply by `s`

| Component | XPath | Attribute | Base value | Line |
|---|---|---|---|---|
| Ceiling | `/HouseFile/House/Components/Ceiling[@id='6']/Measurements` | `length` | 15.29 | 424 |

### Note on `<GrossArea>` blocks (lines 1122, 1273, 1424, 1575, 1726, 1877)

These are HOT2000-computed output values stored in result/summary sections (e.g., `ceiling="58.400001526"`, `buildingSurfaceArea="355.629791260"`). **Do not mutate** — HOT2000 will recompute them on the next simulation run from the primary inputs above.

### Note on `<HeatLoss>`, `<HeatGain>` and similar output blocks

Anything in the `<HeatLoss>`, `<HeatGain>`, `<Annual>`, etc. blocks downstream of the components are HOT2000-computed and re-derived per run. Don't mutate.

---

## FDWR-driven window-area scaling

### Above-grade windows — 8 windows scale proportionally to user FDWR input

`target_fda = fdwr × BASE_ABOVE_GRADE_WALL_AREA_M2 × s²`
`target_window_area_total = target_fda - DOOR_AREA_M2`
`window_scale = sqrt(target_window_area_total / BASE_ABOVE_GRADE_WINDOW_AREA_M2)`

Each window's height AND width is multiplied by `window_scale` (preserves aspect ratio, scales area by `window_scale²`).

Window dimensions are in **millimeters** in the XML.

| ID | Label | Floor | Orientation | Height (mm) | Width (mm) | Area (m²) | Line |
|---|---|---|---|---|---|---|---|
| 11 | East0001 | Main | East | 1061.86 | 935.45 | 0.993 | 468 |
| 13 | North0001 | Main | North | 1978.20 | 1742.70 | 3.448 | 485 |
| 9 | South0001 | Main | South | 1727.63 | 1521.96 | 2.629 | 502 |
| 15 | West0001 | Main | West | 1061.86 | 935.45 | 0.993 | 519 |
| 24 | East0003 | Second | East | 1061.86 | 935.45 | 0.993 | 550 |
| 25 | North0003 | Second | North | 1978.20 | 1742.70 | 3.448 | 567 |
| 30 | South0003 | Second | South | 1727.63 | 1521.96 | 2.629 | 584 |
| 31 | West0003 | Second | West | 1061.86 | 935.45 | 0.993 | 601 |

**Total above-grade window area: 16.13 m²** → base FDWR ≈ (16.13 + 3.528) / 154.4 = **12.7%**.

XPaths (one per window):
```
/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='11']/Measurements   # East main
/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='13']/Measurements   # North main
/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='9']/Measurements    # South main
/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='15']/Measurements   # West main
/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='24']/Measurements   # East second
/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='25']/Measurements   # North second
/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='30']/Measurements   # South second
/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='31']/Measurements   # West second
```

For each, mutate both `height` and `width` attributes by `window_scale`.

### Basement windows — NOT mutated

| ID | Label | Orientation | Line |
|---|---|---|---|
| 12 | East0002 | East | 667 |
| 14 | North0002 | North | 684 |
| 10 | South0002 | South | 701 |
| 16 | West0002 | West | 718 |

All 4 basement windows have identical dimensions (336.9176 mm × 296.8084 mm = 0.1 m² each, 0.4 m² total). FDWR by NBC convention applies only to above-grade walls, so these stay at their base values.

---

## Gotchas

1. **Window dimensions are in millimeters**, perimeter/area in meters. Don't mix.
2. **Wall heights are storey-specific** (main 2.6, second 2.45) — base above-grade wall area uses both.
3. **Two slight rounding inconsistencies in base.h2k** that don't matter for scaling: main-floor `FloorHeader` at line 618 has `perimeter="30.576"` (4mm off from the 30.58 used everywhere else). Within HOT2000's precision tolerance.
4. **Door area (3.528 m²) is a fixed default** — not scaled. If FDWR × wall_area < door_area, the bounds check should reject. See `MIN_FDWR` in mutations.py.
5. **Don't mutate `<GrossArea>`, `<HeatLoss>`, etc. blocks downstream** — they're outputs HOT2000 recomputes.
6. **HOT2000 reassigns Window IDs** when re-saving — Ryan's edit in HOT2000 GUI changed the new IDs from my proposed 24-27 to the actual 24, 25, 30, 31 above. If base.h2k is ever regenerated, re-verify IDs against the actual file.
