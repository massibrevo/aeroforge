"""Train the median, standardized ridge and random forest RUL models."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from packages.aeroforge_data.cmapss import cached  # noqa: E402
from packages.aeroforge_data.synthetic import demo  # noqa: E402
from packages.aeroforge_ml.benchmark import benchmark  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--demo", action="store_true")
parser.add_argument("--final", action="store_true", help="Also score on the untouched test endpoints")
parser.add_argument("--seed", type=int, default=42)
args = parser.parse_args()
try:
    result = benchmark(
        demo() if args.demo else cached(),
        "demo" if args.demo else "nasa",
        args.seed,
        args.final,
        progress=print,
    )
except (ValueError, OSError) as exc:
    sys.exit(str(exc))
for name, model in result["models"].items():
    print(name, {split: model[split]["metrics"] for split in ("validation", "test") if split in model})
print(f"Results: artifacts/{result['id']}/result.json")
