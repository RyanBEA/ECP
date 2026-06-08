"""Serialization lock for HOT2000.exe invocations.

HOT2000 is single-threaded and mutates files in place. Two concurrent runs
against the same install corrupt both. This module exposes an asyncio.Lock
that simulate.py acquires before invoking sim_harness.run_hot2000.

depth() reports the number of waiters currently blocked on the lock —
useful for /health endpoints and logging.
"""
from __future__ import annotations

import asyncio

sim_lock = asyncio.Lock()


def depth() -> int:
    """Number of tasks waiting to acquire sim_lock (excluding the holder)."""
    if not sim_lock.locked():
        return 0
    waiters = getattr(sim_lock, "_waiters", None)
    if waiters is None:
        return 0
    return sum(1 for w in waiters if not w.done())
