"""Small HTTP smoke test for the local backend."""

from __future__ import annotations

import argparse
import json
import urllib.request


DEFAULT_BASE_URL = "http://127.0.0.1:8000"


def fetch_json(url: str) -> dict | list:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    args = parser.parse_args()

    health = fetch_json(f"{args.base_url}/health")
    models = fetch_json(f"{args.base_url}/models?problem_type=classification")

    print("Health:", health)
    print("Models returned:", len(models))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
