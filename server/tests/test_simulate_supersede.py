"""simulate.run supersede behavior, using a fake run_hot2000 (no HOT2000)."""
import asyncio
import threading
import time

import pytest

from perf_server import simulate, sim_harness, runner
from perf_server.mutations import EnvelopeInputs, GeometryInputs

ENV = EnvelopeInputs(above_grade_wall_rsi=4.5, below_grade_wall_rsi=2.5, window_rsi=0.5,
                     window_shgc=0.4, airtightness_ach50=2.5, hrv_sre=0.75, dhw_ef=0.92)
GEO = GeometryInputs(length_m=10.0, width_m=8.0, fdwr=0.17)


def _fake_run_hot2000_factory(work_seconds, entered=None):
    def fake(h2k_input, result_out, cli_install, timeout_seconds, cancel_event):
        if entered is not None:
            entered.set()  # signal the job is now running inside the thread
        deadline = time.monotonic() + work_seconds
        while time.monotonic() < deadline:
            if cancel_event.is_set():
                return sim_harness.RunResult(exit_code=None, timed_out=False, duration_seconds=0.0,
                                             stdout=b"", stderr=b"", result_path=None, cancelled=True)
            time.sleep(0.01)
        import shutil
        from pathlib import Path
        shutil.copy(Path(__file__).parent / "fixtures" / "sample_result.h2k", result_out)
        return sim_harness.RunResult(exit_code=0, timed_out=False, duration_seconds=work_seconds,
                                     stdout=b"", stderr=b"", result_path=result_out, cancelled=False)
    return fake


@pytest.mark.asyncio
async def test_superseded_run_raises(monkeypatch):
    a_entered = threading.Event()
    monkeypatch.setattr(sim_harness, "run_hot2000", _fake_run_hot2000_factory(5.0, a_entered))
    a = asyncio.create_task(simulate.run(ENV, GEO))
    while not a_entered.is_set():        # wait until A's job is actually running
        await asyncio.sleep(0.01)
    # _job resolves sim_harness.run_hot2000 at call time, so swapping it now affects B only.
    monkeypatch.setattr(sim_harness, "run_hot2000", _fake_run_hot2000_factory(0.05))
    b = asyncio.create_task(simulate.run(ENV, GEO))
    with pytest.raises(runner.Superseded):
        await a
    result_b = await b
    assert "compliance" in result_b
