import os
from pathlib import Path

import pytest

from perf_server import config


def test_defaults(monkeypatch):
    monkeypatch.delenv("H2K_CLI_PATH", raising=False)
    monkeypatch.delenv("BASE_H2K_PATH", raising=False)
    monkeypatch.delenv("HOT2000_TIMEOUT_SECONDS", raising=False)

    cfg = config.load()
    assert cfg.h2k_cli_path == Path(r"C:\H2K-CLI-11.12")
    assert cfg.timeout_seconds == 300
    # base.h2k default is alongside the package
    assert cfg.base_h2k_path.name == "base.h2k"


def test_env_overrides(monkeypatch, tmp_path):
    monkeypatch.setenv("H2K_CLI_PATH", str(tmp_path))
    monkeypatch.setenv("BASE_H2K_PATH", str(tmp_path / "x.h2k"))
    monkeypatch.setenv("HOT2000_TIMEOUT_SECONDS", "60")

    cfg = config.load()
    assert cfg.h2k_cli_path == tmp_path
    assert cfg.base_h2k_path == tmp_path / "x.h2k"
    assert cfg.timeout_seconds == 60
