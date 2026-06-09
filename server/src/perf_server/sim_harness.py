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
    result_path: Path | None  # path to the populated result .h2k, or None on failure


@dataclass
class ProcResult:
    """Outcome of one cancellable subprocess invocation."""
    exit_code: int | None
    timed_out: bool
    cancelled: bool
    stdout: bytes
    stderr: bytes


def _run_process(cmd, cwd, timeout_seconds: int, cancel_event: "threading.Event") -> ProcResult:
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
            break  # exited on its own
        except subprocess.TimeoutExpired:
            pass
        if cancel_event.is_set():
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            return ProcResult(exit_code=proc.returncode, timed_out=False, cancelled=True, stdout=b"", stderr=b"")
        if time.monotonic() - start > timeout_seconds:
            proc.kill()
            proc.wait()
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
) -> RunResult:
    """Invoke HOT2000.exe headless on the given .h2k file.

    Pattern (from C:\\HTAP\\substitute-h2k.rb:4849):
      - cwd = a subdirectory of the CLI install
      - h2k file is copied to the install directory
      - argv = [HOT2000.exe, -inp, ..\\filename.h2k]
      - HOT2000 writes results back into the same file.

    Returns a RunResult. On success, `result_out` contains the post-run file.
    """
    if not cli_install.exists():
        raise FileNotFoundError(f"HOT2000 CLI install not found at {cli_install}")
    exe = cli_install / "HOT2000.exe"
    if not exe.exists():
        raise FileNotFoundError(f"HOT2000.exe not found at {exe}")

    # Use a deterministic subdirectory of the install for cwd, and a fresh
    # filename to avoid colliding with concurrent runs.
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    pid = os.getpid()
    working_name = f"sim-harness-run-{timestamp}-{pid}.h2k"
    working_path = cli_install / working_name
    shutil.copy(h2k_input, working_path)

    # cwd: a subdirectory of the install. Create if needed.
    cwd = cli_install / "sim-harness-work"
    cwd.mkdir(exist_ok=True)

    cmd = [str(exe), "-inp", f"..\\{working_name}"]
    start = time.monotonic()
    try:
        completed = subprocess.run(
            cmd, cwd=str(cwd),
            timeout=timeout_seconds,
            capture_output=True,
        )
        duration = time.monotonic() - start
        result_path = _copy_result_back(working_path, result_out)
        return RunResult(
            exit_code=completed.returncode,
            timed_out=False,
            duration_seconds=duration,
            stdout=completed.stdout,
            stderr=completed.stderr,
            result_path=result_path,
        )
    except subprocess.TimeoutExpired as exc:
        duration = time.monotonic() - start
        return RunResult(
            exit_code=None,
            timed_out=True,
            duration_seconds=duration,
            stdout=exc.stdout or b"",
            stderr=exc.stderr or b"",
            result_path=None,
        )
    finally:
        # Best-effort cleanup of working file. Caller already has result_out.
        try:
            if working_path.exists() and result_out.exists():
                working_path.unlink()
        except OSError:
            pass
