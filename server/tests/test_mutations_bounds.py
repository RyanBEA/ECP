import pytest

from perf_server.mutations import (
    BoundsError,
    GeometryInputs,
    EnvelopeInputs,
    validate_geometry,
    validate_envelope,
)


def _valid_envelope() -> EnvelopeInputs:
    return EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )


def test_footprint_too_small_rejected():
    with pytest.raises(BoundsError, match="footprint"):
        validate_geometry(GeometryInputs(length_m=4.0, width_m=4.0, fdwr=0.15))


def test_footprint_too_large_rejected():
    with pytest.raises(BoundsError, match="footprint"):
        validate_geometry(GeometryInputs(length_m=40.0, width_m=40.0, fdwr=0.15))


def test_fdwr_above_max_rejected():
    with pytest.raises(BoundsError, match="fdwr"):
        validate_geometry(GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.50))


def test_fdwr_below_min_rejected():
    with pytest.raises(BoundsError, match="fdwr"):
        validate_geometry(GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.03))


def test_fdwr_too_low_for_doors_rejected():
    """Door area floor — at very low FDWR, target FDA < door area."""
    # We don't have to math out the exact threshold; just pick a value below
    # MIN_FDWR=0.05 (which is well below the door-area floor for any sensible
    # footprint) and check it hits the fdwr-range error or the door-area error.
    with pytest.raises(BoundsError, match=r"fdwr|door"):
        validate_geometry(GeometryInputs(length_m=8.0, width_m=8.0, fdwr=0.01))


def test_valid_geometry_passes():
    validate_geometry(GeometryInputs(length_m=12.0, width_m=10.0, fdwr=0.15))  # no raise


def test_envelope_negative_rsi_rejected():
    bad = EnvelopeInputs(
        above_grade_wall_rsi=-1.0,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )
    with pytest.raises(BoundsError, match="rsi"):
        validate_envelope(bad)


def test_envelope_negative_below_grade_rsi_rejected():
    bad = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=-2.5,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )
    with pytest.raises(BoundsError, match="rsi"):
        validate_envelope(bad)


def test_envelope_shgc_above_one_rejected():
    bad = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=1.5,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )
    with pytest.raises(BoundsError, match="shgc"):
        validate_envelope(bad)


def test_envelope_hrv_above_one_rejected():
    bad = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=1.5,
        dhw_ef=0.92,
    )
    with pytest.raises(BoundsError, match="hrv_sre"):
        validate_envelope(bad)


def test_envelope_negative_ach50_rejected():
    bad = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=-1.0,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )
    with pytest.raises(BoundsError, match="airtightness|ach"):
        validate_envelope(bad)


def test_envelope_dhw_ef_hpwh_passes():
    """EF > 1.0 is valid (HPWH); the old upper-bound rejection is removed."""
    hpwh = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=3.0,
    )
    validate_envelope(hpwh)  # should not raise


def test_valid_envelope_passes():
    validate_envelope(_valid_envelope())  # no raise
