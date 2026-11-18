"""Run lint, domain and API tests, production build, and a real browser smoke test."""

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
REPORT = ROOT / "artifacts/verification.txt"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--running", action="store_true", help="Use the existing local development servers"
    )
    args = parser.parse_args()
    if not PYTHON.exists():
        sys.exit("Run python scripts/bootstrap.py first.")
    results = []

    def run(label, command):
        result = subprocess.run(command, cwd=ROOT, check=False)
        status = "PASS" if result.returncode == 0 else "SKIP" if result.returncode == 77 else "FAIL"
        results.append(f"{status} {label}")

    run("Ruff lint", [PYTHON, "-m", "ruff", "check", "."])
    run("Ruff formatting", [PYTHON, "-m", "ruff", "format", "--check", "."])
    run("Python unit and API integration tests", [PYTHON, "-m", "pytest", "-q"])
    npm = "npm.cmd" if os.name == "nt" else "npm"
    run("TypeScript and Vite production build", [npm, "--prefix", "apps/web", "run", "build"])

    server = None
    try:
        if not args.running:
            server = subprocess.Popen([PYTHON, "scripts/dev.py"], cwd=ROOT)
        for _ in range(60):
            if server and server.poll() is not None:
                raise RuntimeError("Development server stopped during startup.")
            try:
                with urlopen("http://127.0.0.1:5173/api/health", timeout=1) as response:
                    if json.load(response)["status"] == "ok":
                        break
            except OSError:
                time.sleep(0.25)
        else:
            raise RuntimeError("Local API health check timed out.")
        results.append("PASS Loopback API health through Vite proxy")
        run("Playwright browser E2E", ["node", "tests/e2e/smoke.mjs"])
    except RuntimeError as exc:
        results.append(f"FAIL {exc}")
    finally:
        if server and server.poll() is None:
            server.send_signal(signal.SIGTERM if os.name != "nt" else signal.CTRL_BREAK_EVENT)
            server.wait(timeout=15)
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text("\n".join(results) + "\n", encoding="utf-8")
    print("\n" + REPORT.read_text())
    sys.exit(any(status.startswith("FAIL") for status in results))


if __name__ == "__main__":
    main()
