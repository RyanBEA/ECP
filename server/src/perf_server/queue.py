"""Backwards-compatible queue-depth shim.

Concurrency is now handled by perf_server.runner.SupersedingRunner (a new request
supersedes the running one rather than queueing). depth() reports 1 while a run is
in flight, else 0, so the existing /health contract keeps working.
"""
from __future__ import annotations

from perf_server import simulate


def depth() -> int:
    # Coupled to simulate._runner by name; if that private attribute is renamed, update here.
    return 1 if simulate._runner.busy() else 0
