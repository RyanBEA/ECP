"""Parse NBC 2020 tiered-performance compliance metrics from a post-HOT2000 file.

HOT2000 (run in ERS2020NBC mode) writes proposed-vs-reference compliance results
into /HouseFile/Program/Results/Tsv and .../Ers. These are separate from the
<AllResults>/<Results houseCode="UserHouse"> energy block parsed by results.py.
"""
from __future__ import annotations

from pathlib import Path

from lxml import etree


def _attr_float(el, child_tag: str, context: str) -> float:
    child = el.find(child_tag)
    if child is None or child.get("value") is None:
        raise ValueError(f"Missing {child_tag}@value in {context}")
    return float(child.get("value"))


def parse(h2k_path: Path) -> dict:
    """Extract NBC compliance metrics. Raises ValueError if the block is absent."""
    tree = etree.parse(str(h2k_path))
    root = tree.getroot()

    program_results = root.find("Program/Results")
    if program_results is None:
        raise ValueError(f"No <Program>/<Results> block in {h2k_path}")
    tsv = program_results.find("Tsv")
    ers = program_results.find("Ers")
    if tsv is None or ers is None:
        raise ValueError(f"No <Tsv>/<Ers> in Program/Results of {h2k_path}")

    ref_cool = _attr_float(ers, "RefDesCoolLoss", "Ers")
    proposed_cool = _attr_float(ers, "ERSDesCoolLoss", "Ers")
    peak_cool_pct = (
        (ref_cool - proposed_cool) / ref_cool * 100.0 if ref_cool else 0.0
    )

    validation_raw = tsv.find("PeakCoolingValidation")
    peak_cool_valid = (
        validation_raw is not None
        and (validation_raw.get("value") or "").strip().lower() == "true"
    )

    return {
        "tier": int(float(_attr_float(tsv, "EnergyPerformanceTier", "Tsv"))),
        "overall_improvement_pct": _attr_float(tsv, "OverallImprovement", "Tsv"),
        "envelope_improvement_pct": _attr_float(tsv, "EnvelopeImprovement", "Tsv"),
        "peak_cooling_improvement_pct": peak_cool_pct,
        "peak_cooling_validation": peak_cool_valid,
        "tedi": _attr_float(tsv, "TEDI", "Tsv"),
        "meui": _attr_float(tsv, "MEUI", "Tsv"),
        "ghgi": _attr_float(tsv, "GHGI", "Tsv"),
        "nbc_proposed_kwh_m2": _attr_float(tsv, "NBCAnnualEnegyConsumption", "Tsv"),
        "nbc_target_kwh_m2": _attr_float(tsv, "NBCHouseEnergyTarget", "Tsv"),
    }
