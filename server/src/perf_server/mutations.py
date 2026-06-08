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
