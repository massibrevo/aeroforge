import time

from fastapi.testclient import TestClient

from apps.api import main

client = TestClient(main.app)


def test_health_geometry_and_physics():
    assert client.get("/api/health").json()["status"] == "ok"
    frame = client.get("/api/config/presets").json()["Regional"]
    result = client.post("/api/config/validate", json=frame).json()
    assert result["config"] == frame
    assert client.post("/api/config/validate", json={**frame, "version": 2}).status_code == 422
    assert client.post("/api/physics/compute", json={"speed": 155}).status_code == 200
    assert client.post("/api/physics/compute", json={"speed": 0}).status_code == 422
    assert client.post("/api/physics/simulate", json={"duration": 20}).json()["samples"][-1]["t"] == 20
    assert (
        client.post(
            "/api/physics/compute", json={}, headers={"Origin": "https://example.org"}
        ).status_code
        == 403
    )


def test_demo_and_missing_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(main.cmapss, "CACHE", tmp_path / "fd001.zip")
    assert not client.get("/api/data/status").json()["available"]
    assert client.get("/api/engines?dataset=nasa").status_code == 404
    assert client.get("/api/engines").json()["engines"]
    assert client.get("/api/engines/1").json()["rows"]
    assert client.get("/api/engines/999").status_code == 404
    assert client.post("/api/data/import-cmapss", content=b"bad zip").status_code == 422


def test_training_api(monkeypatch, tmp_path):
    original_benchmark = main.benchmark
    monkeypatch.setattr(main, "ARTIFACTS", tmp_path)

    def local_benchmark(*args, **kwargs):
        return original_benchmark(*args, **kwargs, output=tmp_path)

    monkeypatch.setattr(main, "benchmark", local_benchmark)
    response = client.post("/api/ml/train", json={"dataset": "demo", "seed": 19})
    assert response.status_code == 202
    job_id = response.json()["id"]
    for _ in range(100):
        state = client.get(f"/api/ml/jobs/{job_id}").json()
        if state["state"] != "running":
            break
        time.sleep(0.05)
    assert state["state"] == "complete"
    run_id = state["result"]
    assert client.get("/api/experiments").json()[0]["id"] == run_id
    assert client.get(f"/api/ml/runs/{run_id}").json()["models"]["forest"]["validation"]["rows"]
    prediction = client.post(
        "/api/ml/predict",
        json={
            "run_id": run_id,
            "dataset": "demo",
            "partition": "train",
            "engine": 1,
            "cycle": 20,
        },
    )
    assert prediction.status_code == 200
    assert prediction.json()["rul"] >= 0


def test_manufacturer_presets_preserve_geometry_and_legacy_configs():
    presets = client.get("/api/config/presets").json()
    reference = {
        "Boeing 737-800": ("b738", 35.8, 39.5),
        "Boeing 747-8 Intercontinental": ("b748", 68.4, 76.3),
        "Airbus A320neo": ("a20n", 35.8, 37.57),
        "Airbus A350-900": ("a359", 64.75, 66.8),
    }
    for name, expected in reference.items():
        config = presets[name]
        assert (config["profile"], config["span"], config["length"]) == expected
        verified = client.post("/api/config/validate", json=config)
        assert verified.status_code == 200
        assert verified.json()["config"] == config
        computed = client.post("/api/physics/compute", json={"airframe": config}).json()
        assert computed["q"] * config["area"] * 0.45 == computed["lift"]

    previous = {key: value for key, value in presets["Regional"].items() if key != "profile"}
    verified = client.post("/api/config/validate", json=previous)
    assert verified.json()["config"] == presets["Regional"]
    assert (
        client.post("/api/config/validate", json={**previous, "profile": "unknown"}).status_code == 422
    )
