"""Orchestrator for a single perf simulation job.

Pipeline:
  1. Validate inputs (bounds checks)
  2. Build MutationSpec list from envelope + geometry
  3. Submit the job to the superseding runner (a new request cancels the
     in-flight one; the superseded run raises Superseded)
  4. Apply mutations to a temp copy of base.h2k
  5. Invoke HOT2000.exe via sim_harness.run_hot2000
  6. Parse the resulting <Results> block
  7. Return results dict with timing
"""
from __future__ import annotations

import tempfile
import time
from pathlib import Path

from lxml import etree

from perf_server import compliance, config, results, sim_harness
from perf_server import runner as _runner_mod
from perf_server.mutations import (
    EnvelopeInputs,
    GeometryInputs,
    envelope_mutations,
    geometry_mutations,
    validate_envelope,
    validate_geometry,
)

_runner = _runner_mod.SupersedingRunner()


async def run(envelope: EnvelopeInputs, geometry: GeometryInputs) -> dict:
    """Run one simulation. Raises BoundsError, FileNotFoundError, ValueError, etc."""
    validate_envelope(envelope)
    validate_geometry(geometry)

    cfg = config.load()

    # Note: perf_extras.heating is accepted by the API but not yet wired in.
    # Heating preset mutations are deferred to v1.2; base.h2k's electric
    # baseboard at 100% is used regardless of request.
    mutations = envelope_mutations(envelope) + geometry_mutations(geometry)

    def _job(cancel_event):
        with tempfile.TemporaryDirectory() as td:
            td_path = Path(td)
            mutated = td_path / "input.h2k"
            result_file = td_path / "result.h2k"

            sim_harness.apply_mutations(cfg.base_h2k_path, mutated, mutations)

            # Strip <AllResults> from the mutated input so we can detect HOT2000 silent
            # failures: if HOT2000 succeeds it adds a fresh <AllResults>; if it silently
            # fails ("calculate failed" with exit code 0), results.parse() will raise
            # ValueError because the canonical <Results houseCode="UserHouse"> block
            # won't exist in the output.
            tree = etree.parse(str(mutated))
            root = tree.getroot()
            all_results = root.find("AllResults")
            if all_results is not None:
                root.remove(all_results)
            tree.write(str(mutated), xml_declaration=True, encoding="UTF-8", pretty_print=False)

            start = time.monotonic()
            run_result = sim_harness.run_hot2000(
                h2k_input=mutated,
                result_out=result_file,
                cli_install=cfg.h2k_cli_path,
                timeout_seconds=cfg.timeout_seconds,
                cancel_event=cancel_event,
            )
            duration = time.monotonic() - start

            if run_result.cancelled:
                # Superseded: the runner already set our cancel event and will
                # raise Superseded after we return. Return value is ignored.
                return None
            if run_result.timed_out:
                raise TimeoutError(f"HOT2000 exceeded {cfg.timeout_seconds}s timeout")
            if run_result.exit_code != 0:
                raise RuntimeError(
                    f"HOT2000 exited {run_result.exit_code}: "
                    f"stderr={run_result.stderr.decode(errors='replace')[:500]}"
                )

            parsed = results.parse(result_file)
            parsed["compliance"] = compliance.parse(result_file)
            parsed["job_duration_seconds"] = duration
            return parsed

    return await _runner.run(_job)
