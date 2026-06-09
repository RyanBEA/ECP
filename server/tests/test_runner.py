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


def _uncancellable_job(work_seconds, marker, started, finished):
    """A job that ignores cancellation and runs to completion — used to hold the lock
    long enough for a queued run to be superseded before it can acquire the lock."""
    def fn(cancel_event):
        started.append(marker)
        time.sleep(work_seconds)
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


@pytest.mark.asyncio
async def test_queued_run_superseded_at_lock_entry_never_starts():
    """A holds the lock (ignoring cancel); B queues behind it; C supersedes B while B
    is still queued. B must raise Superseded at lock entry without ever starting its job."""
    r = SupersedingRunner()
    started, finished = [], []
    a = asyncio.create_task(r.run(_uncancellable_job(0.3, "A", started, finished)))
    while "A" not in started:
        await asyncio.sleep(0.005)               # A now holds the lock

    b = asyncio.create_task(r.run(_blocking_job(5.0, "B", started, finished)))
    await asyncio.sleep(0.02)                     # B reaches the lock and queues
    c = asyncio.create_task(r.run(_blocking_job(0.05, "C", started, finished)))
    await asyncio.sleep(0.02)                     # C's pre-lock block sets B's cancel + swaps current

    with pytest.raises(Superseded):
        await a                                   # A's post-job check sees B's cancel
    with pytest.raises(Superseded):
        await b                                   # B superseded at lock entry
    out_c = await c

    assert out_c == "C-result"
    assert "A" in started                         # A genuinely held the lock
    assert "B" not in started, "B was superseded while queued and must not start its job"
    assert "C" in finished
