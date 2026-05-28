"""Smoke test for the vendored sim_harness module.

We don't re-test sim_harness internals here — the h2k-glossary project owns
that. We just verify the module imports and exposes the symbols we'll use.
"""
from perf_server import sim_harness


def test_mutation_spec_dataclass_exists():
    spec = sim_harness.MutationSpec(xpath="/a/b", attr="c", value="d")
    assert spec.xpath == "/a/b"
    assert spec.attr == "c"
    assert spec.value == "d"


def test_apply_mutations_callable():
    assert callable(sim_harness.apply_mutations)


def test_run_hot2000_callable():
    assert callable(sim_harness.run_hot2000)


def test_run_result_dataclass_exists():
    assert hasattr(sim_harness, "RunResult")
