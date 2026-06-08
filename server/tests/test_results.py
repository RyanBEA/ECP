"""Test the <Results> block parser against a committed fixture.

The fixture is sample_result.h2k (2-storey 7.65x7.65 finished basement, Shearwater NS
CZ6, electric baseboard heating, populated by HOT2000 GUI saves). Expected values
come from the houseCode="UserHouse" ("General mode") <Results> block in that file.
"""
import pytest

from perf_server import results

# Constants captured from sample_result.h2k, houseCode="UserHouse" block (line ~1920).
# Consumption/@total from <Consumption total="69.578605652">
EXPECTED_ANNUAL_GJ = 69.578605652
# Electrical/@spaceHeating from <Electrical ... spaceHeating="26.604010357" ...>
EXPECTED_HEATING_GJ = 26.604010357
# Electrical/HotWater/@dhw from <HotWater dhw="16.723345410" ...>
EXPECTED_DHW_GJ = 16.723345410
# Electrical/@appliance + Electrical/@lighting = 8.277837113 + 3.416397142
EXPECTED_LIGHTS_APPLIANCES_GJ = 8.277837113 + 3.416397142
# Other/@designHeatLossRate = 6753.289062500 W → 6.753289062500 kW
EXPECTED_PEAK_HEATING_KW = 6753.289062500 / 1000.0


def test_parse_returns_required_fields(sample_result_path):
    parsed = results.parse(sample_result_path)
    assert "annual_energy_gj" in parsed
    assert "breakdown_gj" in parsed
    assert "peak_heating_kw" in parsed


def test_parse_breakdown_has_known_keys(sample_result_path):
    parsed = results.parse(sample_result_path)
    breakdown = parsed["breakdown_gj"]
    assert "space_heating" in breakdown
    assert "space_cooling" in breakdown
    assert "dhw" in breakdown
    assert "lights_appliances" in breakdown


def test_parse_values_match_fixture(sample_result_path):
    parsed = results.parse(sample_result_path)
    assert parsed["annual_energy_gj"] == pytest.approx(EXPECTED_ANNUAL_GJ, rel=0.001)
    assert parsed["breakdown_gj"]["space_heating"] == pytest.approx(EXPECTED_HEATING_GJ, rel=0.001)
    assert parsed["breakdown_gj"]["dhw"] == pytest.approx(EXPECTED_DHW_GJ, rel=0.001)
    assert parsed["breakdown_gj"]["lights_appliances"] == pytest.approx(EXPECTED_LIGHTS_APPLIANCES_GJ, rel=0.001)
    assert parsed["peak_heating_kw"] == pytest.approx(EXPECTED_PEAK_HEATING_KW, rel=0.001)
