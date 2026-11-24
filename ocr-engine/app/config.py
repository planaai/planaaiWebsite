from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from vendor.paths import ROOT_DIR


def _load_dotenv(env_path: Path) -> None:
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        if key:
            os.environ.setdefault(key, val)


@dataclass(frozen=True)
class Settings:
    HOST: str
    PORT: int
    OCR_ENGINE_TOKEN: str
    OCR_ENGINE_CONCURRENCY: int
    BACKEND_INTERNAL_URL: str
    OCR_AUDIT_DIR: str
    ENGINE_VERSION: str = "1.0.0"
    ENGINE_ID: str = "plana-ocr@1.0.0"


def load_settings(env_file: Path | None = None) -> Settings:
    _load_dotenv(env_file or (ROOT_DIR / ".env"))
    raw_port = os.environ.get("OCR_ENGINE_PORT", "8090").strip() or "8090"
    raw_conc = os.environ.get("OCR_ENGINE_CONCURRENCY", "2").strip() or "2"
    return Settings(
        HOST="127.0.0.1",
        PORT=int(raw_port),
        OCR_ENGINE_TOKEN=os.environ.get("OCR_ENGINE_TOKEN", ""),
        OCR_ENGINE_CONCURRENCY=max(1, int(raw_conc)),
        BACKEND_INTERNAL_URL=os.environ.get("BACKEND_INTERNAL_URL", "http://127.0.0.1:4000").strip().rstrip("/"),
        OCR_AUDIT_DIR=os.environ.get("OCR_AUDIT_DIR", "").strip(),
    )
