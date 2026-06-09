"""HOT2000 simulation harness.

Applies XPath -> value mutations to a .h2k file and invokes HOT2000.exe
headless to produce a result file. Used by /goal-driven field investigations
that need empirical evidence for a glossary entry.

CLI install assumed at C:\\H2K-CLI-11.12. HOT2000 invocation pattern follows
HTAP's substitute-h2k.rb: cwd is a subdirectory of the install, the h2k file
is referenced via ..\\filename.h2k.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from lxml import etree


@dataclass(frozen=True)
class MutationSpec:
    """One XPath -> value mutation, applied to an XML attribute."""
    xpath: str
    attr: str
    value: str


def apply_mutations(src: Path, dst: Path, mutations: list[MutationSpec]) -> None:
    """Apply mutations to a copy of `src`, writing to `dst`.

    XPaths must start with the HouseFile root.  Each mutation locates the
    element via a relative search from the root and sets `attr` to `value`.
    Raises KeyError if an XPath does not match any element in the file.
    """
    tree = etree.parse(str(src))
    root = tree.getroot()
    root_path = f"/{root.tag}"
    for m in mutations:
        if not m.xpath.startswith(root_path + "/"):
            raise KeyError(f"XPath {m.xpath!r} does not start with root {root_path}")
        relative = m.xpath[len(root_path):].lstrip("/")
        element = root.find(relative)
        if element is None:
            raise KeyError(f"XPath {m.xpath!r} did not match any element")
        element.set(m.attr, m.value)
    tree.write(str(dst), xml_declaration=True, encoding="UTF-8", pretty_print=False)


@dataclass
class RunResult:
    """Outcome of one HOT2000.exe invocation."""
    exit_code: int | None
    timed_out: bool
    duration_seconds: float
    stdout: bytes
    stderr: bytes
    result_path: Path | None  # path to the populated result .h2k, or None on failure/cancel
    cancelled: bool = False


@dataclass
class ProcResult:
    """Outcome of one cancellable subprocess invocation."""
    exit_code: int | None
    timed_out: bool
    cancelled: bool
    stdout: bytes
    stderr: bytes


def _run_process(cmd: "list[str] | str", cwd: "Path | str | None", timeout_seconds: int, cancel_event: "threading.Event") -> ProcResult:
    """Run `cmd` to completion, honoring cancellation and a wall-clock timeout.

    Polls every 100 ms. On cancel: terminate(), then kill() after a 2 s grace.
    HOT2000's console output is tiny, so buffering on the pipes is not a concern.
    """
    proc = subprocess.Popen(
        cmd, cwd=str(cwd) if cwd is not None else None,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    start = time.monotonic()
    while True:
        try:
            proc.wait(timeout=0.1)
            # small output assumed (see docstring); communicate() below drains pipes after exit
            break  # exited on its own
        except subprocess.TimeoutExpired:
            pass
        if cancel_event.is_set():
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass  # orphaned child holding the handle — nothing more we can do
            return ProcResult(exit_code=proc.returncode, timed_out=False, cancelled=True, stdout=b"", stderr=b"")
        if time.monotonic() - start > timeout_seconds:
            proc.kill()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass  # orphaned child holding the handle — nothing more we can do
            return ProcResult(exit_code=proc.returncode, timed_out=True, cancelled=False, stdout=b"", stderr=b"")
    out, err = proc.communicate()
    return ProcResult(exit_code=proc.returncode, timed_out=False, cancelled=False, stdout=out, stderr=err)


def _copy_result_back(working_h2k: Path, result_out: Path) -> Path:
    """Copy the populated result file back out of the H2K CLI working area."""
    shutil.copy(working_h2k, result_out)
    return result_out


def run_hot2000(
    h2k_input: Path,
    result_out: Path,
    cli_install: Path = Path(r"C:\H2K-CLI-11.12"),
    timeout_seconds: int = 300,
    cancel_event: "threading.Event | None" = None,
) -> RunResult:
    """Invoke HOT2000.exe headless on the given .h2k file (cancellable).

    Each run gets its own working subdirectory under sim-harness-work so a killed
    run leaves no fixed-name scratch files for the next run. The input is copied to
    sim-harness-work/<token>.h2k and HOT2000 is invoked from sim-harness-work/<token>/
    as `-inp ..\\<token>.h2k` (one level up — same relative depth as HTAP's pattern).
    """
    if cancel_event is None:
        cancel_event = threading.Event()
    if not cli_install.exists():
        raise FileNotFoundError(f"HOT2000 CLI install not found at {cli_install}")
    exe = cli_install / "HOT2000.exe"
    if not exe.exists():
        raise FileNotFoundError(f"HOT2000.exe not found at {exe}")

    work_root = cli_install / "sim-harness-work"
    work_root.mkdir(exist_ok=True)
    # Unique token from pid + a monotonic counter avoids same-second collisions.
    token = f"run-{os.getpid()}-{int(time.monotonic() * 1000)}"
    input_name = f"{token}.h2k"
    staged_input = work_root / input_name          # sim-harness-work/<token>.h2k
    cwd = work_root / token                         # sim-harness-work/<token>/
    cwd.mkdir(exist_ok=True)
    shutil.copy(h2k_input, staged_input)

    cmd = [str(exe), "-inp", f"..\\{input_name}"]
    start = time.monotonic()
    proc_result = _run_process(cmd, cwd=cwd, timeout_seconds=timeout_seconds, cancel_event=cancel_event)
    duration = time.monotonic() - start

    try:
        if proc_result.cancelled:
            return RunResult(exit_code=proc_result.exit_code, timed_out=False,
                             duration_seconds=duration, stdout=proc_result.stdout,
                             stderr=proc_result.stderr, result_path=None, cancelled=True)
        if proc_result.timed_out:
            return RunResult(exit_code=None, timed_out=True, duration_seconds=duration,
                             stdout=proc_result.stdout, stderr=proc_result.stderr,
                             result_path=None, cancelled=False)
        result_path = _copy_result_back(staged_input, result_out)
        return RunResult(exit_code=proc_result.exit_code, timed_out=False,
                         duration_seconds=duration, stdout=proc_result.stdout,
                         stderr=proc_result.stderr, result_path=result_path, cancelled=False)
    finally:
        # Best-effort cleanup of this run's isolated working area.
        try:
            if staged_input.exists():
                staged_input.unlink()
            if cwd.exists():
                shutil.rmtree(cwd, ignore_errors=True)
        except OSError:
            pass
