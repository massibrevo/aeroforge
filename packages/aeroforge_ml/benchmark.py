"""Causal RUL features and deterministic engine-level evaluation."""

import json
import platform
import tempfile
import time
from pathlib import Path
from uuid import uuid4

import joblib
import numpy as np
import sklearn
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from packages.aeroforge_data.cmapss import CHANNELS, ROOT, atomic_write

ARTIFACTS = ROOT / "artifacts"
SCHEMA = "rul-v1"
FEATURES = ["cycle", *CHANNELS, *(f"{name}_mean10" for name in CHANNELS[3:])]
VERSION = "0.1.0"


def features(series):
    sensors = series[:, 5:]
    total = np.vstack([np.zeros(sensors.shape[1]), np.cumsum(sensors, axis=0)])
    end = np.arange(1, len(series) + 1)
    start = np.maximum(0, end - 10)
    return np.column_stack([series[:, 1:], (total[end] - total[start]) / (end - start)[:, None]])


def split_engines(train, seed):
    if len(train) < 5:
        raise ValueError("At least five training engines are required.")
    shuffled = np.random.default_rng(seed).permutation(sorted(train))
    count = max(1, len(shuffled) // 5)
    return sorted(shuffled[count:].tolist()), sorted(shuffled[:count].tolist())


def metrics(rows):
    error = np.asarray([row["error"] for row in rows])
    return {
        "mae": float(np.abs(error).mean()),
        "rmse": float(np.sqrt(np.square(error).mean())),
        "phm_score": float(np.expm1(np.where(error < 0, -error / 13, error / 10)).sum()),
    }


def benchmark(fleet, dataset, seed=42, final=False, output=ARTIFACTS, progress=lambda _: None):
    train_ids, val_ids = split_engines(fleet.train, seed)
    x = np.vstack([features(fleet.train[i]) for i in train_ids])
    y = np.concatenate([len(fleet.train[i]) - fleet.train[i][:, 1] for i in train_ids])
    rng = np.random.default_rng(seed + 1)
    endpoints = {}
    for unit in val_ids:
        trajectory = fleet.train[unit]
        cut = max(1, int(len(trajectory) * rng.uniform(0.35, 0.85)))
        endpoints[unit] = (trajectory[:cut], len(trajectory) - cut)
    holdouts = {"validation": endpoints}
    if final:
        holdouts["test"] = {unit: (series, fleet.labels[unit]) for unit, series in fleet.test.items()}
    models = {
        "median": DummyRegressor(strategy="median"),
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=10)),
        "forest": RandomForestRegressor(
            n_estimators=48,
            max_depth=13,
            min_samples_leaf=5,
            random_state=seed,
            n_jobs=1,
            max_features=0.65,
        ),
    }
    run_id = uuid4().hex
    output.mkdir(parents=True, exist_ok=True)
    result = {
        "id": run_id,
        "dataset": dataset,
        "source": fleet.origin,
        "sha256": fleet.digest,
        "seed": seed,
        "schema": SCHEMA,
        "version": VERSION,
        "features": FEATURES,
        "runtime": {"platform": platform.platform(), "scikit_learn": sklearn.__version__},
        "train_ids": train_ids,
        "validation_ids": val_ids,
        "test_ids": sorted(fleet.test) if final else [],
        "models": {},
    }
    with tempfile.TemporaryDirectory(dir=output, prefix=".in-progress-") as temp:
        folder = Path(temp)
        for index, (name, model) in enumerate(models.items()):
            progress(f"Fitting {name} ({index + 1}/{len(models)})")
            start = time.process_time()
            model.fit(x, y)
            model_result = {
                "fit_cpu_s": time.process_time() - start,
                "parameters": model.get_params(deep=False)
                if name != "ridge"
                else {"scaler": "StandardScaler", "alpha": 10},
            }
            if name == "forest":
                model_result["importance"] = dict(zip(FEATURES, model.feature_importances_.tolist()))
            for partition, group in holdouts.items():
                rows = []
                for unit, (series, actual) in group.items():
                    predicted = float(max(0, model.predict(features(series)[-1:])[0]))
                    rows.append(
                        {
                            "engine": unit,
                            "cycle": len(series),
                            "actual": actual,
                            "prediction": predicted,
                            "error": predicted - actual,
                        }
                    )
                model_result[partition] = {"metrics": metrics(rows), "rows": rows}
            result["models"][name] = model_result
            joblib.dump(
                {
                    "schema": SCHEMA,
                    "features": FEATURES,
                    "model": model,
                    "dataset": dataset,
                    "sha256": fleet.digest,
                },
                folder / f"{name}.joblib",
            )
        (folder / "model_card.md").write_text(
            f"# RUL experiment {run_id}\n\nSource: {fleet.origin}\n\nSHA-256: {fleet.digest}\n\n"
            f"Seed {seed}, feature schema {SCHEMA}. RUL is uncapped operating cycles. "
            "Training and validation engines are disjoint. Validation uses one seeded truncated endpoint "
            "per engine. Official test scoring requires explicit opt-in.\n\n"
            f"Features: {', '.join(FEATURES)}\n\n"
            "Simulated conditions only. Extrapolation, other failure modes and real engines remain "
            "unvalidated. No calibrated prediction intervals.\n\n"
            f"```json\n{json.dumps({k: {p: v[p]['metrics'] for p in holdouts} for k, v in result['models'].items()}, indent=2)}\n```\n",
            encoding="utf-8",
        )
        atomic_write(folder / "result.json", json.dumps(result, indent=2, allow_nan=False).encode())
        folder.rename(output / run_id)
    return result


def predict(folder, model, fleet, dataset, series, cycle):
    stored = joblib.load(folder / f"{model}.joblib")
    if (stored["schema"], stored["features"], stored["dataset"], stored["sha256"]) != (
        SCHEMA,
        FEATURES,
        dataset,
        fleet.digest,
    ):
        raise ValueError("Model feature schema or dataset provenance does not match.")
    if not 1 <= cycle <= len(series):
        raise ValueError("Cycle is outside the observed trajectory.")
    return float(max(0, stored["model"].predict(features(series[:cycle])[-1:])[0]))
