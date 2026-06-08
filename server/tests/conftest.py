import asyncio
from pathlib import Path

import pytest

from perf_server import queue


@pytest.fixture(autouse=True)
def reset_sim_lock() -> None:
    """Replace sim_lock with a fresh Lock bound to the current event loop.

    asyncio.Lock binds to the running loop on first acquire; a module-level
    lock acquired in one test's loop raises RuntimeError in the next test's
    loop. Re-creating it here keeps each test isolated without changing loop
    scopes project-wide.
    """
    queue.sim_lock = asyncio.Lock()


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_result_path(fixtures_dir: Path) -> Path:
    return fixtures_dir / "sample_result.h2k"
