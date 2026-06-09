import asyncio
import threading

import pytest

from perf_server import queue, simulate


@pytest.mark.asyncio
async def test_queue_depth_starts_zero():
    assert queue.depth() == 0


@pytest.mark.asyncio
async def test_queue_depth_is_one_while_running():
    """depth() reports 1 while a run holds the runner, then 0 after it completes."""
    entered = threading.Event()
    release = threading.Event()

    def job(cancel_event: threading.Event):
        entered.set()
        release.wait(timeout=5)
        return "done"

    task = asyncio.create_task(simulate._runner.run(job))
    while not entered.is_set():       # wait until the job is actually running
        await asyncio.sleep(0.01)
    assert queue.depth() == 1
    release.set()
    await task
    assert queue.depth() == 0
