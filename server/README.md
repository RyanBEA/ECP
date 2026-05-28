# ECP2 Perf Server

Python sidecar for the ECP2 frontend. Wraps HOT2000.exe to run basic
performance simulations of box-shaped buildings.

## Setup

    uv venv
    uv pip install -e ".[dev]"

## Run

    uv run uvicorn perf_server.api:app --host 127.0.0.1 --port 8001 --reload

## Test

    uv run pytest                          # unit tests only (CI-safe)
    uv run pytest -m requires_hot2000      # integration (needs HOT2000.exe)
