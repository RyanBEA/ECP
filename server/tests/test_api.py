"""FastAPI-level tests using TestClient.

These tests mock simulate.run so they don't touch HOT2000.
Integration with HOT2000 is covered by test_simulate_integration.py.
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from perf_server.api import app

client = TestClient(app)


VALID_REQUEST = {
    "ecp_state": {
        "above_grade_wall": {"rsi": 4.5},
        "below_grade_wall": {"rsi": 2.5},
        "windows": {"rsi": 0.5, "shgc": 0.4},
        "airtightness_ach50": 2.5,
        "hrv": {"sre": 0.75},
        "dhw": {"ef": 0.92},
    },
    "geometry": {
        "footprint": {"length_m": 10.0, "width_m": 8.0},
        "fdwr": 0.17,
    },
    "perf_extras": {
        "heating": {"type": "electric_baseboard", "efficiency": 1.0},
    },
}


def test_simulate_endpoint_validates_request_shape():
    bad = {"ecp_state": {}}
    response = client.post("/api/simulate", json=bad)
    assert response.status_code == 422


def test_simulate_endpoint_returns_results():
    fake_result = {
        "annual_energy_gj": 67.2,
        "breakdown_gj": {"space_heating": 32.1, "space_cooling": 0.8, "dhw": 11.5, "lights_appliances": 18.6, "other": 4.2},
        "peak_heating_kw": 7.8,
        "job_duration_seconds": 8.4,
    }
    with patch("perf_server.api.simulate.run", new=AsyncMock(return_value=fake_result)):
        response = client.post("/api/simulate", json=VALID_REQUEST)
    assert response.status_code == 200, response.text
    assert response.json() == fake_result


def test_bounds_error_returns_422():
    """fdwr=0.99 is outside MVP range [0.05, 0.40]; bounds check rejects."""
    bad = {**VALID_REQUEST}
    bad = {**bad, "geometry": {**bad["geometry"], "fdwr": 0.99}}
    response = client.post("/api/simulate", json=bad)
    # 422 from pydantic (Field(le=1.0) would catch 0.99 if we cap there) OR
    # from BoundsError mapped to 422 in the handler. Either path is fine.
    assert response.status_code == 422


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "queue_depth" in body


def test_simulate_endpoint_passes_through_compliance():
    fake_result = {
        "annual_energy_gj": 67.2,
        "breakdown_gj": {"space_heating": 32.1, "space_cooling": 0.0, "dhw": 11.5, "lights_appliances": 18.6, "other": 4.2},
        "peak_heating_kw": 7.8,
        "job_duration_seconds": 8.4,
        "compliance": {
            "tier": 2, "overall_improvement_pct": 14.03, "envelope_improvement_pct": 10.71,
            "peak_cooling_improvement_pct": 7.14, "peak_cooling_validation": True,
            "tedi": 38.88, "meui": 61.06, "ghgi": 44,
            "nbc_proposed_kwh_m2": 42.2, "nbc_target_kwh_m2": 49.09,
        },
    }
    with patch("perf_server.api.simulate.run", new=AsyncMock(return_value=fake_result)):
        response = client.post("/api/simulate", json=VALID_REQUEST)
    assert response.status_code == 200, response.text
    assert response.json()["compliance"]["tier"] == 2


def test_superseded_run_returns_409():
    from perf_server.runner import Superseded
    with patch("perf_server.api.simulate.run", new=AsyncMock(side_effect=Superseded())):
        response = client.post("/api/simulate", json=VALID_REQUEST)
    assert response.status_code == 409
    assert "supersed" in response.json()["detail"].lower()
