import pytest

from perf_server.mutations import GeometryInputs, geometry_mutations


def test_geometry_produces_exactly_27_mutations():
    """Lock the count: 6 perim + 4 area + 1 length + 16 window = 27."""
    inputs = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.15)
    assert len(geometry_mutations(inputs)) == 27


def test_ceiling_area_scales_with_footprint():
    """At L=10, W=8, target floor_area=80; base=58.4; ceiling area should hit 80."""
    inputs = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.15)
    muts = geometry_mutations(inputs)
    ceiling_area_muts = [
        m for m in muts
        if "Ceiling" in m.xpath and m.attr == "area"
    ]
    assert len(ceiling_area_muts) == 1
    assert float(ceiling_area_muts[0].value) == pytest.approx(80.0, rel=0.001)


def test_perimeter_matches_dimensions():
    """At L=10, W=8, perimeter = 36; mutations should set walls to that value."""
    inputs = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.15)
    muts = geometry_mutations(inputs)
    wall_perimeter_muts = [
        m for m in muts
        if "Wall[@id='2']/Measurements" in m.xpath and m.attr == "perimeter"
    ]
    assert len(wall_perimeter_muts) == 1
    assert float(wall_perimeter_muts[0].value) == pytest.approx(36.0, rel=0.001)


def test_basement_area_scales_with_footprint():
    """Basement floor area = floor area per storey = L × W = 80 at L=10, W=8."""
    inputs = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.15)
    muts = geometry_mutations(inputs)
    basement_area_muts = [
        m for m in muts
        if "Basement" in m.xpath and "Floor" in m.xpath and m.attr == "area"
    ]
    assert len(basement_area_muts) == 1
    assert float(basement_area_muts[0].value) == pytest.approx(80.0, rel=0.001)


def test_8_above_grade_windows_have_height_and_width_mutations():
    """Each above-grade window gets 2 mutations (height + width). 8 windows × 2 = 16."""
    inputs = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.15)
    muts = geometry_mutations(inputs)
    window_muts = [m for m in muts if "/Window[" in m.xpath]
    assert len(window_muts) == 16

    heights = [m for m in window_muts if m.attr == "height"]
    widths = [m for m in window_muts if m.attr == "width"]
    assert len(heights) == 8
    assert len(widths) == 8


def test_window_dims_scale_with_fdwr():
    """Higher FDWR → larger window dimensions (height/width in mm)."""
    low  = geometry_mutations(GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.10))
    high = geometry_mutations(GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.20))
    low_heights  = {m.xpath: float(m.value) for m in low  if "/Window[" in m.xpath and m.attr == "height"}
    high_heights = {m.xpath: float(m.value) for m in high if "/Window[" in m.xpath and m.attr == "height"}
    for xp, low_h in low_heights.items():
        assert high_heights[xp] > low_h, f"window at {xp} height should be larger at higher FDWR"


def test_fdwr_too_low_raises():
    """Door area (3.528 m²) > target FDA → ValueError."""
    # At L=8, W=8 (smallest test box): wall_area = 32 × 5.05 = 161.6 m²
    # door area 3.528 / 161.6 = 0.0218 → fdwr=0.01 would give FDA = 1.6 < 3.528
    with pytest.raises(ValueError, match="fdwr|door"):
        geometry_mutations(GeometryInputs(length_m=8.0, width_m=8.0, fdwr=0.01))


def test_window_height_locks_to_known_value_at_known_input():
    """At L=10, W=8, fdwr=0.15, North main window (id=13) height should be ~2400.27 mm."""
    muts = geometry_mutations(GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.15))
    north_main_heights = [
        float(m.value) for m in muts
        if "Window[@id='13']" in m.xpath and m.attr == "height"
    ]
    assert len(north_main_heights) == 1
    assert north_main_heights[0] == pytest.approx(2400.27, rel=0.01)
