from pathlib import Path

import pytest

from perf_server import runner, simulate


@pytest.fixture(autouse=True)
def reset_runner() -> None:
    """Give each test a fresh SupersedingRunner.

    SupersedingRunner holds an asyncio.Lock, which binds to the running loop on
    first use; a module-level runner reused across tests' event loops raises
    RuntimeError. Re-creating it per test keeps each test isolated.
    """
    simulate._runner = runner.SupersedingRunner()


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_result_path(fixtures_dir: Path) -> Path:
    return fixtures_dir / "sample_result.h2k"
