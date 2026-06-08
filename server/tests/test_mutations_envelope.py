from perf_server.mutations import EnvelopeInputs, envelope_mutations


def _sample_inputs() -> EnvelopeInputs:
    return EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,           # renamed from window_u_value — base.h2k stores RSI
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,             # fraction; HOT2000 stores as percent (mutate 75)
        dhw_ef=0.92,              # conventional electric tank (EF ≤ 1.0)
    )


def test_above_grade_wall_rsi_mutated_both_walls():
    muts = envelope_mutations(_sample_inputs())
    # Match only the Wall Construction/Type rValue — exclude window rValues nested under Wall
    rsi_mutations = [
        m for m in muts
        if ("@id='2'" in m.xpath or "@id='4'" in m.xpath)
        and "Window" not in m.xpath
        and m.attr == "rValue"
    ]
    assert len(rsi_mutations) == 2
    for m in rsi_mutations:
        assert m.value == "4.5"


def test_below_grade_wall_rsi_mutated():
    muts = envelope_mutations(_sample_inputs())
    bg_muts = [m for m in muts if "Basement" in m.xpath and m.attr == "rsi"]
    assert len(bg_muts) >= 1
    assert any(m.value == "3.1" for m in bg_muts)


def test_all_12_windows_get_rsi_and_shgc():
    muts = envelope_mutations(_sample_inputs())
    rsi_muts = [m for m in muts if "Window" in m.xpath and m.attr == "rValue"]
    shgc_muts = [m for m in muts if "Window" in m.xpath and m.attr == "shgc"]
    assert len(rsi_muts) == 12
    assert len(shgc_muts) == 12
    for m in rsi_muts:
        assert m.value == "0.5"
    for m in shgc_muts:
        assert m.value == "0.4"


def test_ach50_mutated():
    muts = envelope_mutations(_sample_inputs())
    ach_muts = [m for m in muts if "BlowerTest" in m.xpath]
    assert any(m.value == "2.5" for m in ach_muts)


def test_hrv_sre_converted_to_percent():
    muts = envelope_mutations(_sample_inputs())
    hrv_muts = [m for m in muts if "Hrv" in m.xpath and "efficiency1" in m.attr]
    assert any(m.value == "75" for m in hrv_muts)


def test_dhw_ef_conventional_tank_one_mutation():
    """EF ≤ 1.0 should produce a single EnergyFactor.value mutation."""
    inputs = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=0.92,
    )
    muts = envelope_mutations(inputs)
    ef_muts = [m for m in muts if "EnergyFactor" in m.xpath]
    assert len(ef_muts) == 1
    assert ef_muts[0].value == "0.92"


def test_dhw_ef_hpwh_three_mutations():
    """EF > 1.0 should produce 3 mutations: TankType code=7, EnergyFactor.value=0.9,
    and heatPumpCoefficient on Primary."""
    inputs = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=3.0,
    )
    muts = envelope_mutations(inputs)
    tank_type_muts = [m for m in muts if "TankType" in m.xpath and m.attr == "code"]
    ef_muts = [m for m in muts if "EnergyFactor" in m.xpath and m.attr == "value"]
    cop_muts = [m for m in muts if m.attr == "heatPumpCoefficient"]
    assert len(tank_type_muts) == 1
    assert tank_type_muts[0].value == "7"
    assert len(ef_muts) == 1
    assert ef_muts[0].value == "0.9"
    assert len(cop_muts) == 1
    # COP = dhw_ef / 0.9 = 3.0 / 0.9
    import math
    assert math.isclose(float(cop_muts[0].value), 3.0 / 0.9)


def test_mutation_specs_are_well_formed():
    muts = envelope_mutations(_sample_inputs())
    for m in muts:
        assert m.xpath.startswith("/HouseFile/")
        assert m.attr != ""
        assert m.value != ""


def test_envelope_produces_exactly_30_mutations():
    """Conventional tank (EF ≤ 1.0): 30 mutations total."""
    assert len(envelope_mutations(_sample_inputs())) == 30


def test_envelope_with_hpwh_produces_32_mutations():
    """HPWH (EF > 1.0): 32 mutations total (2 extra DHW mutations)."""
    inputs = EnvelopeInputs(
        above_grade_wall_rsi=4.5,
        below_grade_wall_rsi=3.1,
        window_rsi=0.5,
        window_shgc=0.4,
        airtightness_ach50=2.5,
        hrv_sre=0.75,
        dhw_ef=3.0,
    )
    assert len(envelope_mutations(inputs)) == 32
