from __future__ import annotations

import json
import logging
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger("ocr_engine.audit")

DEFAULT_TTL_SECONDS = 86400


def purge_expired(audit_dir: str | Path, ttl_seconds: int = DEFAULT_TTL_SECONDS, now: float | None = None) -> int:
    """Remove files/subdirectories older than ttl_seconds. Returns removed count."""
    if not audit_dir:
        return 0
    base = Path(audit_dir)
    if not base.exists() or not base.is_dir():
        return 0

    cutoff = (now if now is not None else time.time()) - ttl_seconds
    removed = 0
    for entry in base.iterdir():
        try:
            if entry.stat().st_mtime <= cutoff:
                if entry.is_dir():
                    shutil.rmtree(entry, ignore_errors=True)
                else:
                    entry.unlink(missing_ok=True)
                removed += 1
        except Exception as e:
            logger.debug("Audit purge skipped for %s: %s", entry, e)
    return removed


def save_audit_bundle(
    audit_dir: str | Path,
    images: dict[str, bytes],
    result: dict[str, Any],
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> Path | None:
    """Persist debug images and JSON only when OCR_AUDIT_DIR is configured."""
    if not audit_dir:
        return None
    try:
        base = Path(audit_dir)
        base.mkdir(parents=True, exist_ok=True)
        purge_expired(base, ttl_seconds=ttl_seconds)

        bundle_dir = base / f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
        bundle_dir.mkdir(parents=True, exist_ok=True)
        for slot, raw_bytes in images.items():
            (bundle_dir / f"{slot}.bin").write_bytes(raw_bytes)
        (bundle_dir / "result.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return bundle_dir
    except Exception as e:
        logger.warning("Audit bundle save failed: %s", e)
        return None
