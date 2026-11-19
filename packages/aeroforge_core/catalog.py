"""Shared commercial aircraft reference data and procedural geometry inputs."""

import json
from pathlib import Path

CATALOG = json.loads((Path(__file__).resolve().parents[2] / "shared/aircraft/catalog.json").read_text())
