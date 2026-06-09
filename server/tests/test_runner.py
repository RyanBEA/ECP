import asyncio
import threading
import time

import pytest

from perf_server.runner import SupersedingRunner, Superseded


def _blocking_job(work_seconds, marker, started, finished):
    """Returns a fn(cancel_event) that sleeps, honoring cancellation."""
    def fn(cancel_event: threading.Event):
        started.append(marker)
        deadline = time.monotonic() + work_seconds
        while time.monotonic() < deadline:
            if cancel_event.is_set():
                return f"{marker}-cancelled-internally"
            time.sleep(0.01)
        finished.append(marker)
        return f"{marker}-result"
    return fn


@pytest.mark.asyncio
async def test_single_run_returns_result():
    r = SupersedingRunner()
    started, finished = [], []
    out = await r.run(_blocking_job(0.05, "A", started, finished))
    assert out == "A-result"
    assert finished == ["A"]


@pytest.mark.asyncio
async def test_new_run_supersedes_in_flight():
    r = SupersedingRunner()
    started, finished = [], []
    a = asyncio.create_task(r.run(_blocking_job(5.0, "A", started, finished)))
    while "A" not in started:
        await asyncio.sleep(0.01)  # ensure A is actually running

    b = asyncio.create_task(r.run(_blocking_job(0.05, "B", started, finished)))

    with pytest.raises(Superseded):
        await a
    out_b = await b
    assert out_b == "B-result"
    assert "A" not in finished  # A was cancelled before finishing
    assert "B" in finished


@pytest.mark.asyncio
async def test_only_one_job_runs_at_a_time():
    r = SupersedingRunner()
    started, finished = [], []
    concurrent = []

    def fn(marker):
        def inner(cancel_event):
            concurrent.append(marker)
            assert len(concurrent) == 1, "two jobs ran simultaneously"
            time.sleep(0.05)
            concurrent.remove(marker)
            return marker
        return inner

    # Fire two non-superseding sequential runs; each must run alone.
    out1 = await r.run(fn("X"))
    out2 = await r.run(fn("Y"))
    assert (out1, out2) == ("X", "Y")
