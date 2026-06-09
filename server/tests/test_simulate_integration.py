"""End-to-end pipeline test against real HOT2000.exe.

Gated by `requires_hot2000` marker -- skip unless explicitly run with:
    uv run pytest -m requires_hot2000
"""
import asyncio

import pytest

from perf_server.mutations import EnvelopeInputs, GeometryInputs
from perf_server import simulate
from perf_server.runner import Superseded


@pytest.mark.requires_hot2000
@pytest.mark.asyncio
async def test_box_simulation_returns_results():
    envelope = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=2.5,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )
    geometry = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.17)

    result = await simulate.run(envelope, geometry)

    assert result["annual_energy_gj"] > 0
    assert result["breakdown_gj"]["space_heating"] > 0
    assert result["job_duration_seconds"] > 0
    assert result["job_duration_seconds"] < 60  # within HOT2000's normal envelope
    # Should differ from the fixture/base value of 69.58 GJ because envelope changed
    assert abs(result["annual_energy_gj"] - 69.58) > 1.0, (
        f"Expected mutations to change energy result from base 69.58 GJ, "
        f"got {result['annual_energy_gj']:.2f} GJ — possibly a stale-result leak"
    )


@pytest.mark.requires_hot2000
@pytest.mark.asyncio
async def test_hpwh_simulation_returns_results():
    envelope = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=2.5,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=2.3,  # HPWH territory
    )
    geometry = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.17)
    result = await simulate.run(envelope, geometry)
    assert result["annual_energy_gj"] > 0
    # HPWH with improved envelope should use less energy than base.h2k (69.58 GJ)
    assert result["annual_energy_gj"] < 69.58, (
        f"Expected HPWH result to be under base 69.58 GJ, "
        f"got {result['annual_energy_gj']:.2f} GJ — mutations may not be applying"
    )


@pytest.mark.requires_hot2000
@pytest.mark.asyncio
async def test_real_supersede_cancels_in_flight():
    env_a = EnvelopeInputs(above_grade_wall_rsi=4.5, below_grade_wall_rsi=2.5, window_rsi=0.5,
                           window_shgc=0.4, airtightness_ach50=2.5, hrv_sre=0.75, dhw_ef=0.92)
    env_b = EnvelopeInputs(above_grade_wall_rsi=6.0, below_grade_wall_rsi=3.0, window_rsi=0.6,
                           window_shgc=0.4,
                           airtightness_ach50=2.0,  # plan spec used 1.5, but that triggers a HOT2000 silent failure (exit 0, no UserHouse results) on this geometry; 2.0 is the minimum that computes. Supersede behavior is unaffected.
                           hrv_sre=0.80, dhw_ef=0.92)
    geo = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.17)

    a = asyncio.create_task(simulate.run(env_a, geo))
    await asyncio.sleep(0.3)            # let A start its HOT2000 process (real runs take ~2-4s)
    b = asyncio.create_task(simulate.run(env_b, geo))
    try:
        # Note: with HOT2000 taking ~2-4s and a 0.3s lead, A is virtually always
        # cancelled mid-process; in the unlikely event A is still queued, this still
        # asserts supersession (B wins), just not the subprocess-kill path specifically.
        with pytest.raises(Superseded):
            await a
        result_b = await b
        assert result_b["annual_energy_gj"] > 0
        assert "compliance" in result_b
    finally:
        a.cancel()
        b.cancel()


def test_compliance_merged_into_parse_output(sample_result_path):
    """simulate.run merges compliance under a 'compliance' key; verify the shape
    by combining the two parsers the way run() does (no HOT2000 needed)."""
    from perf_server import compliance, results
    parsed = results.parse(sample_result_path)
    parsed["compliance"] = compliance.parse(sample_result_path)
    assert parsed["compliance"]["tier"] == 2
    assert "annual_energy_gj" in parsed
