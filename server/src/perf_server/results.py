"""Parse the <Annual> consumption block from a post-HOT2000 .h2k file."""
from __future__ import annotations

from pathlib import Path

from lxml import etree


def parse(h2k_path: Path) -> dict:
    """Extract annual energy results from a post-HOT2000 file.

    Returns a dict with:
      - annual_energy_gj:  total annual energy consumption (GJ)
      - breakdown_gj:      dict with space_heating, space_cooling, dhw,
                           lights_appliances (all GJ)
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

    design_heat_loss_w = float(other.get("designHeatLossRate"))

    return {
        "annual_energy_gj": float(consumption.get("total")),
        "breakdown_gj": {
            # Use <Electrical spaceHeating=…> — matches the fuel-rollup <SpaceHeating>
            # total for all-electric houses; for mixed-fuel houses use
            # consumption.find("SpaceHeating").get("total") instead.
            "space_heating": float(electrical.get("spaceHeating")),
            "space_cooling": float(electrical.get("spaceCooling")),
            "dhw": float(hot_water_el.get("dhw")),
            # HOT2000 breaks lights/appliances into separate attributes; sum them.
            "lights_appliances": (
                float(electrical.get("appliance"))
                + float(electrical.get("lighting"))
            ),
        },
        # designHeatLossRate is in Watts — convert to kW for API consumers.
        "peak_heating_kw": design_heat_loss_w / 1000.0,
    }
