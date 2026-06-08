"""Build a list of MutationSpec objects from ECP state + geometry inputs.

This is the only module that knows both ECP semantics and H2K xpaths.

XPath constants below are verified against the canonical base.h2k at
server/src/perf_server/base.h2k (ECP2 branch).  If the base file is
regenerated, re-verify each constant before trusting this module.

apply_mutations (sim_harness) strips the leading "/HouseFile/" and calls
lxml root.find() on the relative path, so every xpath here must begin with
"/HouseFile/House/..." to match that contract.
"""
from __future__ import annotations

from dataclasses import dataclass

from perf_server.sim_harness import MutationSpec


# ---------------------------------------------------------------------------
# Envelope xpaths — verified against base.h2k
# ---------------------------------------------------------------------------

# Above-grade walls: two instances (main floor id=2, second floor id=4).
# ECP user picks one RSI value; we apply it to both.
ABOVE_GRADE_WALL_RSI_XPATHS: list[str] = [
    "/HouseFile/House/Components/Wall[@id='2']/Construction/Type",
    "/HouseFile/House/Components/Wall[@id='4']/Construction/Type",
]

# Below-grade wall: rsi attribute on the Composite Section element.
XPATH_BELOW_GRADE_WALL_RSI = (
    "/HouseFile/House/Components/Basement[@id='1']"
    "/Wall/Construction/InteriorAddedInsulation/Composite/Section[@rank='1']"
)

# 12 windows: 4 per above-grade wall (id=2, id=4) + 4 in basement (id=1).
# Each entry is (parent_xpath_prefix, window_id).
# rValue lives on Construction/Type; shgc lives on the Window element itself.
_WINDOW_DEFS: list[tuple[str, int]] = [
    # Wall id=2 — main floor
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='11']", 11),
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='13']", 13),
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='9']",   9),
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='15']", 15),
    # Wall id=4 — second level
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='24']", 24),
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='25']", 25),
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='30']", 30),
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='31']", 31),
    # Basement id=1
    ("/HouseFile/House/Components/Basement[@id='1']/Components/Window[@id='12']", 12),
    ("/HouseFile/House/Components/Basement[@id='1']/Components/Window[@id='14']", 14),
    ("/HouseFile/House/Components/Basement[@id='1']/Components/Window[@id='10']", 10),
    ("/HouseFile/House/Components/Basement[@id='1']/Components/Window[@id='16']", 16),
]

# Airtightness: airChangeRate attribute on BlowerTest under NaturalAirInfiltration.
XPATH_AIRTIGHTNESS_ACH50 = (
    "/HouseFile/House/NaturalAirInfiltration/Specifications/BlowerTest"
)

# HRV: efficiency1 attribute (stored as integer percent in HOT2000).
# efficiency2 (SRE @ -25°C) is left at its base.h2k value (45).
XPATH_HRV = "/HouseFile/House/Ventilation/WholeHouseVentilatorList/Hrv"

# DHW: value attribute on EnergyFactor under HotWater/Primary.
XPATH_DHW_EF = "/HouseFile/House/Components/HotWater/Primary/EnergyFactor"


# ---------------------------------------------------------------------------
# Input dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EnvelopeInputs:
    """ECP envelope parameters.

    All RSI values are in m²·K/W (HOT2000 SI convention).
    window_rsi — HOT2000 stores window thermal resistance as RSI (not U-value);
        the ECP UI label may say "U-value" but the underlying field is RSI.
    hrv_sre — sensible recovery efficiency as a fraction (0–1); HOT2000
        stores efficiency1 as an integer percent, so this is multiplied by 100
        before writing.  efficiency2 (SRE @ −25°C) is NOT mutated; it retains
        its base.h2k value (~45%).
    """
    above_grade_wall_rsi: float
    below_grade_wall_rsi: float
    window_rsi: float        # NOT u_value — base.h2k stores RSI on glass
    window_shgc: float
    airtightness_ach50: float
    hrv_sre: float           # fraction 0–1; HOT2000 stores as integer percent
    dhw_ef: float


# ---------------------------------------------------------------------------
# Mutation builder
# ---------------------------------------------------------------------------

def envelope_mutations(inputs: EnvelopeInputs) -> list[MutationSpec]:
    """Return one MutationSpec per envelope attribute from ECP state.

    Returned list length: 2 (above-grade walls) + 1 (below-grade wall)
                        + 24 (12 windows × 2 attrs) + 1 (ACH50)
                        + 1 (HRV) + 1 (DHW) = 2 + 1 + 24 + 1 + 1 + 1 = 30 mutations.
    """
    muts: list[MutationSpec] = []

    # Above-grade walls: same RSI applied to both main floor and second level.
    for xp in ABOVE_GRADE_WALL_RSI_XPATHS:
        muts.append(MutationSpec(xp, "rValue", str(inputs.above_grade_wall_rsi)))

    # Below-grade wall: rsi attribute on the Composite Section.
    muts.append(MutationSpec(
        XPATH_BELOW_GRADE_WALL_RSI, "rsi", str(inputs.below_grade_wall_rsi)
    ))

    # All 12 windows: uniform RSI (on Construction/Type) and SHGC (on Window).
    # This overrides per-orientation tuning baked into base.h2k; acceptable for MVP
    # since ECP window selection is a single monolithic tier.
    for window_xpath, _wid in _WINDOW_DEFS:
        muts.append(MutationSpec(
            window_xpath + "/Construction/Type", "rValue", str(inputs.window_rsi)
        ))
        muts.append(MutationSpec(
            window_xpath, "shgc", str(inputs.window_shgc)
        ))

    # Airtightness: ACH50 at 50 Pa.
    muts.append(MutationSpec(
        XPATH_AIRTIGHTNESS_ACH50, "airChangeRate", str(inputs.airtightness_ach50)
    ))

    # HRV: SRE fraction → integer percent.  Only efficiency1 (@ 0°C) is mutated.
    muts.append(MutationSpec(
        XPATH_HRV, "efficiency1", str(int(round(inputs.hrv_sre * 100)))
    ))

    # DHW energy factor.
    muts.append(MutationSpec(XPATH_DHW_EF, "value", str(inputs.dhw_ef)))

    return muts


# ---------------------------------------------------------------------------
# Geometry + fenestration xpaths (from GEOMETRY_XPATHS.md)
# Verified against base.h2k 2026-06-08.
# ---------------------------------------------------------------------------

BASE_FLOOR_AREA_M2 = 58.4
BASE_PERIMETER_M = 30.58
DOOR_AREA_M2 = 3.528
MAIN_FLOOR_HEIGHT_M = 2.6
SECOND_FLOOR_HEIGHT_M = 2.45
WALL_HEIGHT_SUM_M = MAIN_FLOOR_HEIGHT_M + SECOND_FLOOR_HEIGHT_M  # 5.05

# Sum of the 8 above-grade window areas in base.h2k, in m²
# 2 × (0.993 + 3.448 + 2.629 + 0.993) = 16.126 ≈ 16.13
BASE_ABOVE_GRADE_WINDOW_AREA_M2 = 16.13

# Perimeter xpaths: (xpath, attr, base_value)
# All base perimeter values confirmed as 30.58 in base.h2k.
# Note: GEOMETRY_XPATHS.md lists FloorHeader[@id='3'] as 30.576 but actual XML is 30.58.
_PERIMETER_XPATHS: list[tuple[str, str, float]] = [
    ("/HouseFile/House/Components/Wall[@id='2']/Measurements",                                          "perimeter",               30.58),
    ("/HouseFile/House/Components/Wall[@id='4']/Measurements",                                          "perimeter",               30.58),
    ("/HouseFile/House/Components/Wall[@id='4']/Components/FloorHeader[@id='3']/Measurements",          "perimeter",               30.58),
    ("/HouseFile/House/Components/Basement[@id='1']",                                                   "exposedSurfacePerimeter", 30.58),
    ("/HouseFile/House/Components/Basement[@id='1']/Floor/Measurements",                                "perimeter",               30.58),
    ("/HouseFile/House/Components/Basement[@id='1']/Components/FloorHeader[@id='5']/Measurements",      "perimeter",               30.58),
]

# Note: RoofCavity attributes (GableEnds @area, SlopedRoof @area, RoofCavity
# @volume) are intentionally omitted from this list. Their scaling laws
# aren't a uniform s_area multiplication for a rectangular box: GableEnds
# scales with one linear dimension (s_perim), SlopedRoof with both
# (s_perim²), and volume with floor area (s_area). Applying the wrong
# scale would produce inconsistent geometry. HOT2000 either recomputes
# these from the ceiling area we DO mutate, or uses base.h2k values — the
# error is small at modest scale-factor deviations from base footprint.
# If perf accuracy at large footprint deviations becomes a concern, add
# a separate `_ROOF_CAVITY_*` table with the correct per-attribute scale.

# Area xpaths: (xpath, attr, base_value)
_AREA_XPATHS: list[tuple[str, str, float]] = [
    ("/HouseFile/House/Components/Ceiling[@id='6']/Measurements",   "area",       58.4),
    ("/HouseFile/House/Components/Basement[@id='1']/Floor/Measurements", "area",  58.4),
    ("/HouseFile/House/Specifications/HeatedFloorArea",             "aboveGrade", 128.0),
    ("/HouseFile/House/Specifications/HeatedFloorArea",             "belowGrade",  64.0),
]

# Ceiling length scales with perimeter (s_perim), not area.
_CEILING_LENGTH_XPATH = "/HouseFile/House/Components/Ceiling[@id='6']/Measurements"
_BASE_CEILING_LENGTH_M = 15.29

# Above-grade windows: (xpath_to_Measurements, base_height_mm, base_width_mm)
# IDs verified against base.h2k — HOT2000 renumbers on re-save, so re-verify if
# base.h2k is ever regenerated.
_ABOVE_GRADE_WINDOWS: list[tuple[str, float, float]] = [
    # Main floor (Wall id=2)
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='11']/Measurements", 1061.86, 935.45),   # East main
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='13']/Measurements", 1978.20, 1742.70),  # North main
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='9']/Measurements",  1727.63, 1521.96),  # South main
    ("/HouseFile/House/Components/Wall[@id='2']/Components/Window[@id='15']/Measurements", 1061.86, 935.45),   # West main
    # Second floor (Wall id=4)
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='24']/Measurements", 1061.86, 935.45),   # East second
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='25']/Measurements", 1978.20, 1742.70),  # North second
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='30']/Measurements", 1727.63, 1521.96),  # South second
    ("/HouseFile/House/Components/Wall[@id='4']/Components/Window[@id='31']/Measurements", 1061.86, 935.45),   # West second
]


@dataclass(frozen=True)
class GeometryInputs:
    """User-supplied geometry inputs for footprint + FDWR-driven scaling.

    length_m, width_m — building footprint dimensions in metres.
    fdwr — fenestration + door area / above-grade wall area (fraction, e.g. 0.15).
    """
    length_m: float
    width_m: float
    fdwr: float


def geometry_mutations(g: GeometryInputs) -> list[MutationSpec]:
    """Produce MutationSpec list for footprint + FDWR-driven window scaling.

    HOT2000 doesn't enforce area = (perimeter/4)² for the building footprint,
    so we use two independent scale factors:
      s_area  = (L × W) / BASE_FLOOR_AREA_M2          — for area attributes
      s_perim = 2(L + W) / BASE_PERIMETER_M            — for perimeter and length attributes

    Areas are multiplied by s_area, perimeters and lengths by s_perim.

    For FDWR-driven window scaling:
      above_grade_wall_area = target_perimeter × (main_height + second_height)
      target_fda            = fdwr × above_grade_wall_area
      target_window_area    = target_fda − DOOR_AREA_M2

    Each of the 8 above-grade windows has its height and width scaled by
    sqrt(target_window_area / BASE_ABOVE_GRADE_WINDOW_AREA_M2), which scales
    each window's area by the same factor while preserving aspect ratio.

    Window dimensions are in millimetres in the XML (HOT2000 convention).

    Returns 6 perimeter + 4 area + 1 length + 16 window = 27 MutationSpec objects.

    Raises ValueError if fdwr is too low to accommodate the door area.
    """
    target_floor_area = g.length_m * g.width_m
    target_perimeter  = 2.0 * (g.length_m + g.width_m)

    s_area  = target_floor_area / BASE_FLOOR_AREA_M2
    s_perim = target_perimeter  / BASE_PERIMETER_M

    muts: list[MutationSpec] = []

    # Perimeter mutations (multiply each base value by s_perim)
    for xp, attr, base in _PERIMETER_XPATHS:
        muts.append(MutationSpec(xp, attr, str(base * s_perim)))

    # Area mutations (multiply each base value by s_area)
    for xp, attr, base in _AREA_XPATHS:
        muts.append(MutationSpec(xp, attr, str(base * s_area)))

    # Ceiling length scales with perimeter, not area
    muts.append(MutationSpec(
        _CEILING_LENGTH_XPATH, "length", str(_BASE_CEILING_LENGTH_M * s_perim)
    ))

    # FDWR → window area scaling
    above_grade_wall_area = target_perimeter * WALL_HEIGHT_SUM_M
    target_fda = g.fdwr * above_grade_wall_area
    target_window_area = target_fda - DOOR_AREA_M2

    if target_window_area <= 0:
        raise ValueError(
            f"fdwr={g.fdwr} too low: target FDA ({target_fda:.3f} m²) does not exceed "
            f"door area ({DOOR_AREA_M2} m²) for L={g.length_m}, W={g.width_m}"
        )

    # Apply sqrt to both height and width so each window's area scales by window_area_scale
    window_area_scale = target_window_area / BASE_ABOVE_GRADE_WINDOW_AREA_M2
    dim_scale = window_area_scale ** 0.5

    for xp_measurements, base_h_mm, base_w_mm in _ABOVE_GRADE_WINDOWS:
        muts.append(MutationSpec(xp_measurements, "height", str(base_h_mm * dim_scale)))
        muts.append(MutationSpec(xp_measurements, "width",  str(base_w_mm * dim_scale)))

    return muts
