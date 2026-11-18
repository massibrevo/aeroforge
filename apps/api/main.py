"""Local-only research API."""

import asyncio
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from threading import Lock
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Path, Request
from pydantic import Field
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from packages.aeroforge_core.aerodynamics import Airframe, Contract, Flight
from packages.aeroforge_core.performance import performance
from packages.aeroforge_core.simulation import Segment, simulate
from packages.aeroforge_data import cmapss
from packages.aeroforge_data.eda import summarize
from packages.aeroforge_data.synthetic import demo
from packages.aeroforge_ml.benchmark import ARTIFACTS, benchmark, predict

app = FastAPI(title="AeroForge", version="0.1.0")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"])
ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://testserver",
}
NOTICE = "Research and education only — not for operational flight or maintenance decisions."
Dataset = Literal["demo", "nasa"]
Partition = Literal["train", "test"]
RunID = Annotated[str, Path(pattern=r"^[a-f0-9]{32}$")]
pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rul")
jobs = {}
lock = Lock()
import_lock = asyncio.Semaphore(1)
log = logging.getLogger(__name__)

SOURCES = [
    {
        "name": "NASA C-MAPSS catalogue",
        "url": "https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data",
        "detail": "Historical simulated turbofan trajectories. The NASA catalogue does not specify a license.",
    },
    {
        "name": "NASA PCoE data repository",
        "url": "https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/",
        "detail": "Provider listing and bundled FD001 download.",
    },
    {
        "name": "NASA PHM methodology",
        "url": "https://ntrs.nasa.gov/api/citations/20205001125/downloads/Run_to_Failure_Simulation_Under_Real_Flight_Conditions_Dataset.pdf",
        "detail": "Reference for the asymmetric RUL scoring convention.",
    },
    {
        "name": "NASA Glenn atmosphere",
        "url": "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/earth-atmosphere-equation-english/",
        "detail": "Atmosphere modeling background. AeroForge uses a dry SI standard troposphere.",
    },
    {
        "name": "OpenVSP",
        "url": "https://github.com/OpenVSP/OpenVSP",
        "detail": "Optional external research tool. NOSA 1.3. No adapter shipped.",
    },
    {
        "name": "Aviary",
        "url": "https://github.com/OpenMDAO/Aviary",
        "detail": "Optional external research tool. Apache-2.0. No adapter shipped.",
    },
    {
        "name": "NASA ASRS",
        "url": "https://asrs.arc.nasa.gov/search/database.html",
        "detail": "Voluntary, unverified narratives. No ingestion adapter shipped.",
    },
]


@app.middleware("http")
async def local_mutations(request, call_next):
    if request.method == "POST":
        origin = request.headers.get("origin")
        if (origin and origin not in ORIGINS) or request.headers.get("sec-fetch-site") == "cross-site":
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Local AeroForge origin required."}, status_code=403)
    return await call_next(request)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": app.version, "notice": NOTICE}


@app.get("/api/sources")
def sources():
    return SOURCES


@app.get("/api/config/presets")
def presets():
    return {
        "Regional": Airframe(),
        "Glider": Airframe(span=33, area=44, length=17, width=1.6, sweep=4, taper=0.5, dihedral=8),
        "Transport": Airframe(span=38, area=135, length=37, width=4.3, sweep=29, tail=1.2),
    }


@app.post("/api/config/validate")
def validate(airframe: Airframe):
    return {"config": airframe, "dimensions": airframe.dimensions()}


@app.post("/api/physics/compute")
def compute(flight: Flight):
    return performance(flight)


@app.post("/api/physics/simulate")
def simulation(segment: Segment):
    try:
        return simulate(segment)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@lru_cache(maxsize=1)
def read_nasa(inode, modified):
    return cmapss.cached()


def fleet(dataset):
    if dataset == "demo":
        return demo()
    try:
        info = cmapss.CACHE.stat()
        return read_nasa(info.st_ino, info.st_mtime_ns)
    except FileNotFoundError as exc:
        raise HTTPException(
            404, "FD001 is missing. Import or download the ZIP in Research & Sources."
        ) from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(422, "Cached FD001 is invalid. Import a fresh archive.") from exc


@app.get("/api/data/status")
def data_status():
    try:
        nasa = fleet("nasa")
    except HTTPException as exc:
        return {"available": False, "detail": exc.detail}
    return {
        "available": True,
        "sha256": nasa.digest,
        "source": nasa.origin,
        "train_engines": len(nasa.train),
        "test_engines": len(nasa.test),
    }


@app.post("/api/data/import-cmapss")
async def import_cmapss(request: Request):
    if import_lock.locked():
        raise HTTPException(409, "Another import is running.")
    async with import_lock:
        try:
            async with asyncio.timeout(30):
                payload = bytearray()
                async for chunk in request.stream():
                    if len(payload) + len(chunk) > cmapss.LIMIT:
                        raise HTTPException(413, "Maximum archive size is 32 MiB.")
                    payload.extend(chunk)
            return await run_in_threadpool(cmapss.install, payload, "User-imported FD001 ZIP")
        except TimeoutError as exc:
            raise HTTPException(408, "Archive upload timed out.") from exc
        except ValueError as exc:
            log.info("Rejected malformed C-MAPSS upload.")
            raise HTTPException(
                422, "Invalid FD001 ZIP. Check its files, columns and engine cycles."
            ) from exc


@app.post("/api/data/download-cmapss")
async def download_cmapss():
    if import_lock.locked():
        raise HTTPException(409, "Another import is running.")
    async with import_lock:
        try:
            return await run_in_threadpool(cmapss.download)
        except (ValueError, OSError) as exc:
            raise HTTPException(503, "NASA download failed. Import the FD001 ZIP manually.") from exc


@app.get("/api/engines")
def engines(dataset: Dataset = "demo", partition: Partition = "train"):
    selected = fleet(dataset)
    return {
        "origin": selected.origin,
        "engines": [
            {"id": unit, "cycles": len(series)}
            for unit, series in sorted(getattr(selected, partition).items())
        ],
    }


def trajectory(selected, partition, engine):
    series = getattr(selected, partition).get(engine)
    if series is None:
        raise HTTPException(404, "Engine not found in this partition.")
    return series


@app.get("/api/engines/{engine}")
def engine_detail(engine: int, dataset: Dataset = "demo", partition: Partition = "train"):
    selected = fleet(dataset)
    return {
        "origin": selected.origin,
        "channels": cmapss.CHANNELS,
        "rows": trajectory(selected, partition, engine)[:, 1:].tolist(),
        "endpoint_rul": selected.labels.get(engine) if partition == "test" else 0,
    }


@app.get("/api/data/eda")
def eda(dataset: Dataset = "demo"):
    selected = fleet(dataset)
    return {"origin": selected.origin, **summarize(selected.train)}


class Training(Contract):
    dataset: Dataset = "demo"
    seed: int = Field(42, ge=0, le=2**32 - 2)
    final: bool = False


@app.post("/api/ml/train", status_code=202)
def train(settings: Training):
    selected = fleet(settings.dataset)

    def update(**fields):
        with lock:
            jobs[job_id].update(fields)

    def run():
        try:
            result = benchmark(
                selected,
                settings.dataset,
                settings.seed,
                settings.final,
                progress=lambda stage: update(detail=stage),
            )
            update(state="complete", result=result["id"], detail="Results saved")
        except Exception:
            log.exception("RUL training failed")
            update(state="failed", detail="Training failed. See the local API log.")

    with lock:
        if any(job["state"] == "running" for job in jobs.values()):
            raise HTTPException(409, "A training job is already running.")
        if len(jobs) >= 32:
            jobs.pop(next(iter(jobs)))
        job_id = uuid4().hex
        jobs[job_id] = {"id": job_id, "state": "running", "detail": "Preparing features"}
    accepted = get_job(job_id)
    pool.submit(run)
    return accepted


@app.get("/api/ml/jobs/{job_id}")
def get_job(job_id: RunID):
    with lock:
        if job_id not in jobs:
            raise HTTPException(404, "Job not found.")
        return jobs[job_id].copy()


@app.get("/api/ml/runs")
@app.get("/api/experiments")
def runs(dataset: Dataset = "demo"):
    results = []
    for file in sorted(
        ARTIFACTS.glob("[a-f0-9]*/result.json"), key=lambda p: p.stat().st_mtime, reverse=True
    ):
        record = json.loads(file.read_text())
        if record["dataset"] == dataset:
            results.append({key: record[key] for key in ("id", "seed", "source", "sha256")})
    return results


@app.get("/api/ml/runs/{run_id}")
def run_detail(run_id: RunID):
    path = ARTIFACTS / run_id / "result.json"
    if not path.is_file():
        raise HTTPException(404, "Experiment not found.")
    return json.loads(path.read_text())


class Prediction(Contract):
    run_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    dataset: Dataset
    partition: Partition
    model: Literal["median", "ridge", "forest"] = "forest"
    engine: int
    cycle: int


@app.post("/api/ml/predict")
def prediction(request: Prediction):
    selected = fleet(request.dataset)
    series = trajectory(selected, request.partition, request.engine)
    try:
        estimate = predict(
            ARTIFACTS / request.run_id, request.model, selected, request.dataset, series, request.cycle
        )
    except FileNotFoundError as exc:
        raise HTTPException(404, "Saved model not found.") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"rul": estimate, "units": "cycles", "origin": "ML prediction"}
