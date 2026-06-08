import asyncio

import pytest

from perf_server import queue


@pytest.mark.asyncio
async def test_serializes_concurrent_callers():
    """Two callers entering the lock at once must execute serially."""
    timeline: list[str] = []

    async def caller(name: str) -> None:
        async with queue.sim_lock:
            timeline.append(f"{name}-start")
            await asyncio.sleep(0.05)
            timeline.append(f"{name}-end")

    await asyncio.gather(caller("A"), caller("B"))

    # No interleaving — both starts and ends are paired, in order
    assert timeline.index("A-end") < timeline.index("B-start") or \
           timeline.index("B-end") < timeline.index("A-start")


@pytest.mark.asyncio
async def test_queue_depth_starts_zero():
    assert queue.depth() == 0


@pytest.mark.asyncio
async def test_queue_depth_increments_when_waiting():
    async def hold_lock(release_after: float) -> None:
        async with queue.sim_lock:
            await asyncio.sleep(release_after)

    holder = asyncio.create_task(hold_lock(0.1))
    await asyncio.sleep(0.01)  # let holder acquire

    waiter = asyncio.create_task(hold_lock(0.0))
    await asyncio.sleep(0.01)  # let waiter try and block

    assert queue.depth() == 1  # one waiter pending

    await holder
    await waiter
    assert queue.depth() == 0
