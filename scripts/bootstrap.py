"""Install local Python and JavaScript dependencies."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    if not (3, 11) <= sys.version_info[:2] <= (3, 13):
        sys.exit("Use Python 3.11–3.13 for the pinned scientific dependencies.")
    node_version = subprocess.check_output(["node", "--version"], text=True)
    if int(node_version.split(".")[0][1:]) < 20:
        sys.exit("Node.js 20 or newer is required.")
    env = ROOT / ".venv"
    subprocess.run([sys.executable, "-m", "venv", env], check=True)
    python = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([python, "-m", "pip", "install", "-r", ROOT / "requirements.txt"], check=True)
    web = ROOT / "apps/web"
    npm = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.run([npm, "ci", "--no-audit", "--no-fund"], cwd=web, check=True)
    for directory in ("data/raw", "data/processed", "artifacts"):
        (ROOT / directory).mkdir(parents=True, exist_ok=True)
    print("Setup complete. Run python scripts/dev.py.")


if __name__ == "__main__":
    main()
