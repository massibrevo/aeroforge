"""Run the loopback-only API and Vite, and shut both down together."""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NODE = ROOT / "apps/web/node_modules/vite/bin/vite.js"


def interrupt(*_):
    raise KeyboardInterrupt


def main():
    if not PYTHON.exists() or not NODE.exists():
        sys.exit("Run python scripts/bootstrap.py first.")
    signal.signal(signal.SIGTERM, interrupt)
    children = []
    status = 0
    try:
        children.append(
            subprocess.Popen(
                [PYTHON, "-m", "uvicorn", "apps.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
                cwd=ROOT,
            )
        )
        children.append(subprocess.Popen(["node", NODE], cwd=ROOT / "apps/web"))
        print(
            "AeroForge UI  http://localhost:5173\nAPI docs      http://127.0.0.1:8000/docs", flush=True
        )
        while all(child.poll() is None for child in children):
            time.sleep(0.25)
        status = next(child.returncode for child in children if child.returncode is not None) or 1
    except KeyboardInterrupt:
        pass
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
    sys.exit(status)


if __name__ == "__main__":
    main()
