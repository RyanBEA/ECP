"""Parse NBC tiered-performance compliance metrics from /HouseFile/Program/Results.

Expected values come from sample_result.h2k (Shearwater NS, 2-storey, finished
basement, electric baseboard) — the same fixture used by test_results.py.
"""
import pytest

from perf_server import compliance


def test_parse_returns_required_fields(sample_result_path):
    c = compliance.parse(sample_result_path)
    for key in (
        "tier", "overall_improvement_pct", "envelope_improvement_pct",
        "peak_cooling_improvement_pct", "peak_cooling_validation",
        "tedi", "meui", "ghgi", "nbc_proposed_kwh_m2", "nbc_target_kwh_m2",
    ):
        assert key in c, f"missing {key}"


def test_parse_values_match_fixture(sample_result_path):
    c = compliance.parse(sample_result_path)
    assert c["tier"] == 2
    assert c["overall_improvement_pct"] == pytest.approx(14.03, rel=0.001)
    assert c["envelope_improvement_pct"] == pytest.approx(10.71, rel=0.001)
    assert c["peak_cooling_validation"] is True
    assert c["tedi"] == pytest.approx(38.88, rel=0.001)
    assert c["meui"] == pytest.approx(61.06, rel=0.001)
    assert c["ghgi"] == pytest.approx(44, rel=0.001)
    assert c["nbc_proposed_kwh_m2"] == pytest.approx(42.20, rel=0.001)
    assert c["nbc_target_kwh_m2"] == pytest.approx(49.09, rel=0.001)
    # (2987.9 - 2774.5) / 2987.9 * 100
    assert c["peak_cooling_improvement_pct"] == pytest.approx(7.14, abs=0.05)
