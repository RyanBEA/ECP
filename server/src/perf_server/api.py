"""FastAPI surface for the perf server."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from perf_server import queue, simulate
from perf_server.mutations import (
    BoundsError,
    EnvelopeInputs,
    GeometryInputs,
)


# --- Request schemas -------------------------------------------------------

class WallSpec(BaseModel):
    rsi: float = Field(gt=0)


class WindowSpec(BaseModel):
    rsi: float = Field(gt=0)
    shgc: float = Field(ge=0, le=1)


class HrvSpec(BaseModel):
    sre: float = Field(ge=0, le=1)


class DhwSpec(BaseModel):
    ef: float = Field(gt=0)


class EcpState(BaseModel):
    above_grade_wall: WallSpec
    below_grade_wall: WallSpec
    windows: WindowSpec
    airtightness_ach50: float = Field(gt=0)
    hrv: HrvSpec
    dhw: DhwSpec


class Footprint(BaseModel):
    length_m: float = Field(gt=0)
    width_m: float = Field(gt=0)


class GeometrySpec(BaseModel):
    footprint: Footprint
    fdwr: float = Field(gt=0, le=1)  # fenestration + door area / above-grade wall area


class HeatingSpec(BaseModel):
    type: str
    efficiency: float = Field(gt=0)


class PerfExtras(BaseModel):
    heating: HeatingSpec


class SimulateRequest(BaseModel):
    ecp_state: EcpState
    geometry: GeometrySpec
    perf_extras: PerfExtras


# --- App -------------------------------------------------------------------

app = FastAPI(title="ECP2 Perf Server", version="0.1.0")


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "queue_depth": queue.depth(),
    }


@app.post("/api/simulate")
async def simulate_endpoint(req: SimulateRequest) -> dict:
    envelope = EnvelopeInputs(
        above_grade_wall_rsi=req.ecp_state.above_grade_wall.rsi,
        below_grade_wall_rsi=req.ecp_state.below_grade_wall.rsi,
        window_rsi=req.ecp_state.windows.rsi,
        window_shgc=req.ecp_state.windows.shgc,
        airtightness_ach50=req.ecp_state.airtightness_ach50,
        hrv_sre=req.ecp_state.hrv.sre,
        dhw_ef=req.ecp_state.dhw.ef,
    )
    geometry = GeometryInputs(
        length_m=req.geometry.footprint.length_m,
        width_m=req.geometry.footprint.width_m,
        fdwr=req.geometry.fdwr,
    )

    try:
        return await simulate.run(envelope, geometry)
    except BoundsError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except (RuntimeError, KeyError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"simulation engine error: {e}")
