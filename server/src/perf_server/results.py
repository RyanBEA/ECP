"""Parse the <Annual> consumption block from a post-HOT2000 .h2k file."""
from __future__ import annotations

from pathlib import Path

from lxml import etree


def _get_float(el, attr: str, context: str) -> float:
    """Read a required XML attribute and return it as float.

    Raises ValueError (not TypeError) when the attribute is absent, so callers
    that catch ValueError get a descriptive message.
    """
    raw = el.get(attr)
    if raw is None:
        raise ValueError(f"Missing attribute {attr!r} on {context}")
    return float(raw)


def parse(h2k_path: Path) -> dict:
    """Extract annual energy results from a post-HOT2000 file.

    Returns a dict with:
      - annual_energy_gj:  total annual energy consumption (GJ)
      - breakdown_gj:      dict with space_heating, space_cooling, dhw,
                           lights_appliances, other (all GJ).
                           `other` aggregates HOT2000's `baseload` and `ventilation`
                           electrical categories. The breakdown sub-categories do not
                           sum to `annual_energy_gj` because HOT2000's reporting
                           categories overlap (e.g., baseload partially includes
                           appliance/lighting/dhw).
      - peak_heating_kw:   design heat loss rate (kW), from <Other designHeatLossRate>

    HOT2000 produces multiple <Results> blocks per file inside <AllResults>:
      - (no houseCode)   "House"                         — as-built raw output
      - SOC              "House with standard operating conditions"
      - HOC              "House with occupant operating conditions"
      - HCV              "House with code-compliant ventilation"
      - ROC              "Reference house with occupant operating conditions"
      - Reference        "Reference house"
      - UserHouse        "General mode"  ← CANONICAL (user-facing simulation result)

    This parser targets houseCode="UserHouse" ("General mode"), which is the
    primary simulation result HOT2000 displays in its UI.  The Reference and SOC/HOC
    blocks represent comparison scenarios used by the EnerGuide rating algorithm.

    Schema note: GHG emissions are not directly encoded in the <Annual> block.
    They can be estimated post-hoc from electrical consumption × a grid emission
    factor (e.g. NS grid ≈ 0.20 kg CO2e/kWh), but are omitted here to avoid
    hard-coding a factor that changes over time.

    Raises ValueError if the canonical block or required sub-elements are missing.
    """
    tree = etree.parse(str(h2k_path))
    root = tree.getroot()

    # Locate the canonical <Results houseCode="UserHouse"> inside <AllResults>.
    user_house = root.find('.//AllResults/Results[@houseCode="UserHouse"]')
    if user_house is None:
        raise ValueError(
            f'No <Results houseCode="UserHouse"> block found in {h2k_path}'
        )

    annual = user_house.find("Annual")
    if annual is None:
        raise ValueError(
            f'No <Annual> child in UserHouse <Results> block of {h2k_path}'
        )

    consumption = annual.find("Consumption")
    if consumption is None:
        raise ValueError(
            f'No <Consumption> in <Annual> block of {h2k_path}'
        )

    # All energy is electrical for this all-electric archetype, but we pull from
    # the fuel-agnostic <SpaceHeating> and <HotWater> rollup elements when possible,
    # falling back to <Electrical> attributes.  For lights/appliances there is no
    # rollup — use <Electrical> attributes directly.
    electrical = consumption.find("Electrical")
    if electrical is None:
        raise ValueError(f'No <Electrical> in <Consumption> block of {h2k_path}')

    hot_water_el = electrical.find("HotWater")
    if hot_water_el is None:
        raise ValueError(f'No <HotWater> child of <Electrical> in {h2k_path}')

    # Peak heating load is stored on <Other> as designHeatLossRate (Watts).
    other = user_house.find("Other")
    if other is None:
        raise ValueError(f'No <Other> in UserHouse <Results> block of {h2k_path}')

    design_heat_loss_w = _get_float(other, "designHeatLossRate", "Other in <UserHouse>")

    return {
        "annual_energy_gj": _get_float(consumption, "total", "Consumption block"),
        "breakdown_gj": {
            # Use <Electrical spaceHeating=…> — matches the fuel-rollup <SpaceHeating>
            # total for all-electric houses; for mixed-fuel houses use
            # consumption.find("SpaceHeating").get("total") instead.
            "space_heating": _get_float(electrical, "spaceHeating", "Electrical block"),
            "space_cooling": _get_float(electrical, "spaceCooling", "Electrical block"),
            "dhw": _get_float(hot_water_el, "dhw", "HotWater under Electrical"),
            # HOT2000 breaks lights/appliances into separate attributes; sum them.
            "lights_appliances": (
                _get_float(electrical, "appliance", "Electrical block")
                + _get_float(electrical, "lighting", "Electrical block")
            ),
            # `other` aggregates HOT2000's baseload and ventilation electrical
            # categories (see docstring note on overlap with annual_energy_gj).
            "other": (
                _get_float(electrical, "baseload", "Electrical block")
                + _get_float(electrical, "ventilation", "Electrical block")
            ),
        },
        # designHeatLossRate is in Watts — convert to kW for API consumers.
        "peak_heating_kw": design_heat_loss_w / 1000.0,
    }
