"""Export labeled training-fleet channel distributions and correlations as JSON."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from packages.aeroforge_data.cmapss import cached  # noqa: E402
from packages.aeroforge_data.eda import summarize  # noqa: E402
from packages.aeroforge_data.synthetic import demo  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--demo", action="store_true")
args = parser.parse_args()
try:
    fleet = demo() if args.demo else cached()
except (OSError, ValueError) as exc:
    sys.exit(str(exc))
print(json.dumps({"origin": fleet.origin, "sha256": fleet.digest, **summarize(fleet.train)}, indent=2))
