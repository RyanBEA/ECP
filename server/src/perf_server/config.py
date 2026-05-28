"""Environment-driven configuration for the perf server."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    h2k_cli_path: Path
    base_h2k_path: Path
    timeout_seconds: int


def load() -> Config:
    """Load config from env vars with sensible defaults."""
    h2k_cli = Path(os.environ.get("H2K_CLI_PATH", r"C:\H2K-CLI-11.12"))
    default_base = Path(__file__).parent / "base.h2k"
    base_h2k = Path(os.environ.get("BASE_H2K_PATH", str(default_base)))
    timeout = int(os.environ.get("HOT2000_TIMEOUT_SECONDS", "300"))
    return Config(
        h2k_cli_path=h2k_cli,
        base_h2k_path=base_h2k,
        timeout_seconds=timeout,
    )
