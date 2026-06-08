"""End-to-end pipeline test against real HOT2000.exe.

Gated by `requires_hot2000` marker -- skip unless explicitly run with:
    uv run pytest -m requires_hot2000
"""
import pytest

from perf_server.mutations import EnvelopeInputs, GeometryInputs
from perf_server import simulate


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
        dhw_ef=3.0,
    )
    geometry = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.17)

    result = await simulate.run(envelope, geometry)

    assert result["annual_energy_gj"] > 0
    assert result["breakdown_gj"]["space_heating"] > 0
    assert result["job_duration_seconds"] > 0
    assert result["job_duration_seconds"] < 60  # within HOT2000's normal envelope
