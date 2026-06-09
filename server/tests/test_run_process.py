"""Unit tests for the cancellable low-level process runner (no HOT2000)."""
import sys
import threading
import time

from perf_server.sim_harness import ProcResult, _run_process


def _py(code: str) -> list[str]:
    return [sys.executable, "-c", code]


def test_normal_completion_returns_exit_code():
    r = _run_process(_py("print('hi')"), cwd=None, timeout_seconds=10, cancel_event=threading.Event())
    assert isinstance(r, ProcResult)
    assert r.exit_code == 0
    assert r.cancelled is False
    assert r.timed_out is False
    assert b"hi" in r.stdout


def test_cancel_terminates_quickly():
    ev = threading.Event()
    # A subprocess that would run for 30s; cancel it ~0.2s in.
    def cancel_soon():
        time.sleep(0.2)
        ev.set()
    threading.Thread(target=cancel_soon, daemon=True).start()

    start = time.monotonic()
    r = _run_process(_py("import time; time.sleep(30)"), cwd=None, timeout_seconds=60, cancel_event=ev)
    elapsed = time.monotonic() - start

    assert r.cancelled is True
    assert r.exit_code != 0 or r.exit_code is None
    assert elapsed < 5, f"cancel took {elapsed:.1f}s — should be near-immediate"


def test_timeout_is_reported():
    r = _run_process(_py("import time; time.sleep(30)"), cwd=None, timeout_seconds=1, cancel_event=threading.Event())
    assert r.timed_out is True
    assert r.cancelled is False
