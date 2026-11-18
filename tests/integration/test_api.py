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
