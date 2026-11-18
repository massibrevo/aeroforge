import io
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pytest

from packages.aeroforge_data import cmapss
from packages.aeroforge_data.eda import summarize
from packages.aeroforge_data.synthetic import demo
from packages.aeroforge_ml.benchmark import benchmark, features, metrics, predict, split_engines


def fixture_zip(nested=True, invalid=None):
    def archive(entries):
        buffer = io.BytesIO()
        with ZipFile(buffer, "w") as zip_file:
            for name, content in entries.items():
                zip_file.writestr(name, content)
        return buffer.getvalue()

    fixture = Path(__file__).resolve().parents[2] / "data/sample/demo_engine.txt"
    row = "\n".join(line + "  " for line in fixture.read_text().splitlines()) + "\n"
    entries = {
        "raw/train_FD001.txt": invalid or row,
        "raw/test_FD001.txt": row,
        "raw/RUL_FD001.txt": "42  \n",
    }
    inner = archive(entries)
    return archive({"NASA/CMAPSSData.zip": inner}) if nested else inner


@pytest.mark.parametrize("nested", [True, False])
def test_cmapss_install_and_reload(tmp_path, nested):
    cache = tmp_path / "fd001.zip"
    with pytest.raises(FileNotFoundError):
        cmapss.cached(cache)
    manifest = cmapss.install(fixture_zip(nested), "Fixture", cache)
    result = cmapss.cached(cache)
    assert result.digest == manifest["sha256"]
    assert result.labels == {1: 42}
    assert result.test[1].shape == (2, 26)


@pytest.mark.parametrize(
    "payload",
    [b"bad zip", fixture_zip(invalid="1 1 2\n"), fixture_zip(invalid=("1 1 " + "0 " * 24 + "\n") * 2)],
)
def test_invalid_archives(payload):
    with pytest.raises(ValueError):
        cmapss.load_zip(payload)


def test_traversal_is_rejected():
    payload = io.BytesIO()
    with ZipFile(payload, "w") as archive:
        archive.writestr("../train_FD001.txt", "bad")
    with pytest.raises(ValueError, match="unsafe path"):
        cmapss.load_zip(payload.getvalue())


def test_grouped_split_and_causality():
    fleet = demo()
    train, validation = split_engines(fleet.train, 42)
    assert not set(train).intersection(validation)
    assert set(train + validation) == set(fleet.train)
    row = fleet.train[train[0]]
    np.testing.assert_array_equal(features(row)[:12], features(row[:12]))
    data = summarize(fleet.train)
    assert data["engines"] == 28
    assert len(data["correlation"]) == 24


def test_asymmetric_phm():
    early = metrics([{"error": -10}])
    late = metrics([{"error": 10}])
    assert early["phm_score"] == pytest.approx(np.expm1(10 / 13))
    assert late["phm_score"] > early["phm_score"]


def test_training_reload_is_deterministic(tmp_path):
    fleet = demo()
    first = benchmark(fleet, "demo", seed=12, final=True, output=tmp_path)
    second = benchmark(fleet, "demo", seed=12, final=True, output=tmp_path)
    unit, series = next(iter(fleet.test.items()))
    for model in first["models"]:
        assert first["models"][model]["validation"] == second["models"][model]["validation"]
        actual = next(row for row in first["models"][model]["test"]["rows"] if row["engine"] == unit)
        assert actual["actual"] == fleet.labels[unit]
        assert (
            predict(tmp_path / first["id"], model, fleet, "demo", series, len(series))
            == actual["prediction"]
        )
        with pytest.raises(ValueError, match="provenance"):
            predict(tmp_path / first["id"], model, fleet, "nasa", series, len(series))
    assert (tmp_path / first["id"] / "model_card.md").is_file()
