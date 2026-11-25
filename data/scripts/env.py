"""Load KEY=value lines from the repo's .env into os.environ (values are never printed)."""
import os
from pathlib import Path

ENV = Path(__file__).resolve().parents[2] / ".env"


def load(*required):
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip().removeprefix("export ").strip(), v.strip().strip("'\""))
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise SystemExit(f"missing in .env: {', '.join(missing)}")
