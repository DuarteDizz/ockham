"""Run the lightweight backend checks used during local development."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"


def run_step(label: str, command: list[str]) -> None:
    print(f"\n==> {label}")
    subprocess.run(command, cwd=PROJECT_ROOT, check=True)


def main() -> int:
    run_step("Compile backend", [sys.executable, "-m", "compileall", "backend/main.py", "backend/src"])
    run_step(
        "Run backend unit tests",
        [
            sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            str(BACKEND_ROOT / "tests"),
            "-p",
            "test_*.py",
        ],
    )
    if importlib.util.find_spec("ruff") is not None:
        run_step("Run Ruff", [sys.executable, "-m", "ruff", "check", str(BACKEND_ROOT)])
    else:
        print("\n==> Skip Ruff (module not installed in the current environment)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
