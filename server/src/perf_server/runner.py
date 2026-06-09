"""Superseding runner for HOT2000 jobs.

A new run cancels the currently-running one (signals its cancel Event, waits for
its process to die via the shared lock), then executes. Only one job's subprocess
runs at a time. A run that is superseded raises Superseded instead of returning.
"""
from __future__ import annotations

import asyncio
import threading
from typing import Callable, TypeVar

T = TypeVar("T")


class Superseded(Exception):
    """Raised when a run was cancelled because a newer run took its place."""


class SupersedingRunner:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._current_cancel: threading.Event | None = None

    def busy(self) -> bool:
        return self._lock.locked()

    async def run(self, job: Callable[[threading.Event], T]) -> T:
        """Run `job(cancel_event)` in a thread, superseding any in-flight run.

        `job` is a blocking callable that must poll `cancel_event` and stop early
        when it is set. Raises Superseded if a newer run supersedes this one.
        """
        my_cancel = threading.Event()
        # No await between here and lock acquisition: this block is atomic w.r.t. other run() coroutines.
        # Cancel whoever is currently running (or queued ahead of us).
        prev = self._current_cancel
        self._current_cancel = my_cancel
        if prev is not None:
            prev.set()

        async with self._lock:
            # We may have been superseded while waiting for the previous run to die.
            if my_cancel.is_set():
                raise Superseded()
            result = await asyncio.to_thread(job, my_cancel)
            if my_cancel.is_set():
                # Superseded while we were running (or job returned its cancel sentinel).
                raise Superseded()
            return result
