"""Acquire the NASA-linked ZIP explicitly, or import a local copy."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from packages.aeroforge_data.cmapss import LIMIT, download, install  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--archive", type=Path)
args = parser.parse_args()
try:
    if args.archive:
        with args.archive.open("rb") as archive:
            print(json.dumps(install(archive.read(LIMIT + 1), "User-imported FD001 ZIP"), indent=2))
    else:
        print(json.dumps(download(), indent=2))
except (ValueError, OSError) as exc:
    sys.exit(str(exc))
