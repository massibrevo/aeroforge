"""Read C-MAPSS FD001 without extracting any archive members to disk."""

import hashlib
import io
import json
import os
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from urllib.request import urlopen
from zipfile import BadZipFile, ZipFile

import numpy as np

URL = "https://phm-datasets.s3.amazonaws.com/NASA/6.+Turbofan+Engine+Degradation+Simulation+Data+Set.zip"
LIMIT = 32 * 1024**2
FILES = ("train_FD001.txt", "test_FD001.txt", "RUL_FD001.txt")
CHANNELS = [*(f"setting_{i}" for i in range(1, 4)), *(f"sensor_{i:02}" for i in range(1, 22))]
ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data/raw/fd001.zip"


@dataclass
class Fleet:
    train: dict[int, np.ndarray]
    test: dict[int, np.ndarray]
    labels: dict[int, int]
    digest: str
    origin: str


def parse_rows(data):
    rows = np.loadtxt(io.BytesIO(data), dtype=float, ndmin=2)
    if not len(rows) or rows.shape[1] != 26 or not np.isfinite(rows).all():
        raise ValueError("Expected 26 finite numeric columns per row.")
    keys = rows[:, :2]
    if (keys < 1).any() or (keys > 1_000_000).any() or not np.equal(keys, keys.astype(int)).all():
        raise ValueError("Engine ID and cycle must be positive integers.")
    fleet = {}
    for row in rows:
        fleet.setdefault(int(row[0]), []).append(row)
    for unit, series in fleet.items():
        matrix = np.asarray(series)
        if not np.array_equal(matrix[:, 1], np.arange(1, len(matrix) + 1)):
            raise ValueError(f"Engine {unit} has duplicate, missing or unordered cycles.")
        fleet[unit] = matrix
    return fleet


def read_members(payload, nested=False):
    with ZipFile(io.BytesIO(payload)) as archive:
        entries = {}
        for member in archive.infolist():
            path = PurePosixPath(member.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in member.filename:
                raise ValueError("Archive contains an unsafe path.")
            if path.name in (*FILES, "CMAPSSData.zip"):
                if path.name in entries or member.file_size > LIMIT:
                    raise ValueError("Duplicate or oversized C-MAPSS archive member.")
                entries[path.name] = member
        if all(name in entries for name in FILES):
            return tuple(archive.read(entries[name]) for name in FILES)
        if not nested and "CMAPSSData.zip" in entries:
            return read_members(archive.read(entries["CMAPSSData.zip"]), nested=True)
        raise ValueError("Archive is missing the three expected FD001 files.")


def load_zip(payload, origin="Imported FD001"):
    if not 0 < len(payload) <= LIMIT:
        raise ValueError("The ZIP must be at most 32 MiB.")
    try:
        train_data, test_data, label_data = read_members(payload)
    except (BadZipFile, RuntimeError, NotImplementedError) as exc:
        raise ValueError("Invalid or unsupported ZIP archive.") from exc
    train, test = parse_rows(train_data), parse_rows(test_data)
    labels = np.loadtxt(io.BytesIO(label_data), ndmin=2)
    if (
        labels.shape != (len(test), 1)
        or not np.isfinite(labels).all()
        or (labels < 0).any()
        or (labels > 100_000).any()
        or not np.equal(labels, labels.astype(int)).all()
        or sorted(test) != list(range(1, len(test) + 1))
    ):
        raise ValueError("RUL file must have one nonnegative integer per sequential test engine ID.")
    return Fleet(
        train,
        test,
        dict(zip(sorted(test), labels[:, 0].astype(int).tolist(), strict=True)),
        hashlib.sha256(payload).hexdigest(),
        origin,
    )


def atomic_write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temp = Path(stream.name)
        try:
            stream.write(payload)
            stream.close()
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)


def install(payload, source, cache=None):
    cache = CACHE if cache is None else cache
    fleet = load_zip(payload, source)
    manifest = {
        "source": source,
        "sha256": fleet.digest,
        "split": "FD001",
        "acquired_utc": datetime.now(UTC).isoformat(),
        "train_engines": len(fleet.train),
        "test_engines": len(fleet.test),
    }
    # Content-addressed manifests keep provenance coupled to each archive during replacement.
    atomic_write(cache.parent / f"{fleet.digest}.json", json.dumps(manifest, indent=2).encode())
    atomic_write(cache, payload)
    return manifest


def cached(cache=None):
    cache = CACHE if cache is None else cache
    if not cache.exists():
        raise FileNotFoundError("FD001 is missing. Import a ZIP or download it in Research & Sources.")
    with cache.open("rb") as stream:
        payload = stream.read(LIMIT + 1)
    digest = hashlib.sha256(payload).hexdigest()
    manifest_file = cache.parent / f"{digest}.json"
    if not manifest_file.exists():
        raise ValueError("FD001 cache manifest is missing or the archive changed.")
    return load_zip(payload, json.loads(manifest_file.read_text())["source"])


def download():
    try:
        with urlopen(URL, timeout=25) as response:
            return install(response.read(LIMIT + 1), URL)
    except OSError as exc:
        raise ValueError("NASA download unavailable. Try importing the FD001 ZIP manually.") from exc
