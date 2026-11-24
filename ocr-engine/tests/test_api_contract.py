from __future__ import annotations

import json
import os
import time
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator

from app.audit import purge_expired, save_audit_bundle
from app.config import Settings
from app.main import create_app

ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT / "tests" / "fixtures"
SCHEMA = json.loads((ROOT / "contract" / "recognize.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft7Validator(SCHEMA)

TEST_TOKEN = "test-secret-token"


def _png_bytes(width: int, height: int, color: tuple[int, int, int] = (20, 30, 40)) -> bytes:
    img = np.full((height, width, 3), color, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


@pytest.fixture(scope="module")
def client():
    settings = Settings(
        HOST="127.0.0.1",
        PORT=8090,
        OCR_ENGINE_TOKEN=TEST_TOKEN,
        OCR_ENGINE_CONCURRENCY=2,
        BACKEND_INTERNAL_URL="http://127.0.0.1:4000",
        OCR_AUDIT_DIR="",
    )
    app = create_app(settings)
    with TestClient(app) as tc:
        yield tc


def test_healthz_and_default_host(client: TestClient) -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["version"] == "1.0.0"
    assert body["modelsLoaded"] is True
    assert body["studentNamesCount"] > 0

    assert client.app.state.settings.HOST == "127.0.0.1"
    bat = (ROOT / "start_ocr_engine.bat").read_text(encoding="utf-8")
    ps1 = (ROOT / "start_ocr_engine.ps1").read_text(encoding="utf-8")
    assert "--host 127.0.0.1" in bat and "--workers 1" in bat
    assert "--host 127.0.0.1" in ps1 and "--workers 1" in ps1


def test_auth_401_and_403(client: TestClient) -> None:
    for method_call in (
        lambda headers: client.post("/v1/students/reload", headers=headers),
        lambda headers: client.post(
            "/v1/recognize",
            headers=headers,
            files={"main": ("main.png", (FIXTURES_DIR / "student_info.png").read_bytes(), "image/png")},
        ),
    ):
        r401 = method_call({})
        assert r401.status_code == 401
        assert not list(VALIDATOR.iter_errors(r401.json()))

        r403 = method_call({"X-Engine-Token": "wrong-token"})
        assert r403.status_code == 403
        assert not list(VALIDATOR.iter_errors(r403.json()))

    r403_non_ascii = client.post("/v1/students/reload", headers=[(b"x-engine-token", "비ASCII-토큰-é".encode("utf-8"))])
    assert r403_non_ascii.status_code == 403
    assert r403_non_ascii.json()["code"] == "FORBIDDEN"


def test_400_input_validation(client: TestClient) -> None:
    headers = {"X-Engine-Token": TEST_TOKEN}

    # MISSING_MAIN
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"equip1": ("eq.png", (FIXTURES_DIR / "equipment_modal.png").read_bytes(), "image/png")},
    )
    assert r.status_code == 400 and r.json()["code"] == "MISSING_MAIN"
    assert not list(VALIDATOR.iter_errors(r.json()))

    # INVALID_SLOT
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"unknown_slot": ("m.png", _png_bytes(1920, 1080), "image/png")},
    )
    assert r.status_code == 400 and r.json()["code"] == "INVALID_SLOT"

    # FILE_TOO_LARGE (> 8MB)
    oversize = b"0" * (8 * 1024 * 1024 + 1)
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("big.png", oversize, "image/png")},
    )
    assert r.status_code == 400 and r.json()["code"] == "FILE_TOO_LARGE"

    # BAD_IMAGE
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("bad.png", b"not-an-image", "image/png")},
    )
    assert r.status_code == 400 and r.json()["code"] == "BAD_IMAGE"

    # LOW_RESOLUTION
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("low.png", _png_bytes(1279, 720), "image/png")},
    )
    assert r.status_code == 400 and r.json()["code"] == "LOW_RESOLUTION"

    # UNSUPPORTED_RATIO (16:10)
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("ratio.png", _png_bytes(1920, 1200), "image/png")},
    )
    assert r.status_code == 400 and r.json()["code"] == "UNSUPPORTED_RATIO"


def test_422_scene_mismatch_and_slot_duplicate(client: TestClient) -> None:
    headers = {"X-Engine-Token": TEST_TOKEN}
    main_bytes = (FIXTURES_DIR / "student_info.png").read_bytes()
    eq_bytes = (FIXTURES_DIR / "equipment_modal.png").read_bytes()
    fav_bytes = (FIXTURES_DIR / "favorite_popup.png").read_bytes()

    # student_info uploaded to equip2 -> SCENE_MISMATCH
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={
            "main": ("main.png", main_bytes, "image/png"),
            "equip2": ("equip2.png", main_bytes, "image/png"),
        },
    )
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "SCENE_MISMATCH"
    assert body["detail"] == {"slot": "equip2", "detected": "student_info", "expected": "equipment_modal"}
    assert not list(VALIDATOR.iter_errors(body))

    # equipment_modal uploaded to main -> SCENE_MISMATCH
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("main.png", eq_bytes, "image/png")},
    )
    assert r.status_code == 422
    assert r.json()["detail"]["detected"] == "equipment_modal"
    assert not list(VALIDATOR.iter_errors(r.json()))

    # favorite_popup uploaded to equip1 -> SCENE_MISMATCH
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={
            "main": ("main.png", main_bytes, "image/png"),
            "equip1": ("eq1.png", fav_bytes, "image/png"),
        },
    )
    assert r.status_code == 422
    assert r.json()["detail"]["detected"] == "favorite_popup"

    # blank 16:9 image uploaded to main -> detected: "unknown"
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("blank.png", _png_bytes(1920, 1080), "image/png")},
    )
    assert r.status_code == 422
    assert r.json()["code"] == "SCENE_MISMATCH"
    assert r.json()["detail"]["detected"] == "unknown"

    # 1920x1080 uniform RGB noise uploaded to main -> 422 SCENE_MISMATCH (no star/bond hallucination bypass)
    rng = np.random.default_rng(42)
    noise = rng.integers(0, 255, (1080, 1920, 3), dtype=np.uint8)
    ok_noise, buf_noise = cv2.imencode(".png", noise)
    assert ok_noise
    r_noise = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("noise.png", buf_noise.tobytes(), "image/png")},
    )
    assert r_noise.status_code == 422
    assert r_noise.json()["code"] == "SCENE_MISMATCH"
    assert r_noise.json()["detail"]["detected"] == "unknown"
    assert not list(VALIDATOR.iter_errors(r_noise.json()))

    # same modal uploaded to equip1 and equip2 -> SLOT_DUPLICATE
    r = client.post(
        "/v1/recognize",
        headers=headers,
        files={
            "main": ("main.png", main_bytes, "image/png"),
            "equip1": ("eq1.png", eq_bytes, "image/png"),
            "equip2": ("eq2.png", eq_bytes, "image/png"),
        },
    )
    assert r.status_code == 422
    dup = r.json()
    assert dup["code"] == "SLOT_DUPLICATE"
    assert dup["detail"]["slot"] == "equip2"
    assert dup["detail"]["conflictingWith"] == "equip1"
    assert dup["detail"]["activeSlot"] in (1, 2, 3)
    assert not list(VALIDATOR.iter_errors(dup))


def test_reload_students_backend_and_fallback(client: TestClient) -> None:
    headers = {"X-Engine-Token": TEST_TOKEN}

    class _FakeResp:
        status_code = 200

        def json(self):
            return ["아루", "호시노"]

    with patch("app.pipeline.httpx.Client.get", return_value=_FakeResp()):
        r = client.post("/v1/students/reload", headers=headers)
        assert r.status_code == 200
        assert r.json() == {"ok": True, "count": 2, "source": "backend"}

    with patch("app.pipeline.httpx.Client.get", side_effect=OSError("down")):
        r = client.post("/v1/students/reload", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["source"] == "bundled"
        assert body["count"] >= 200


def test_zero_disk_writes_and_audit_ttl(client: TestClient, tmp_path: Path) -> None:
    before = {p for p in ROOT.rglob("*") if "__pycache__" not in p.parts and ".pytest_cache" not in p.parts and ".venv" not in p.parts}
    r = client.post(
        "/v1/recognize",
        headers={"X-Engine-Token": TEST_TOKEN},
        files={"main": ("main.png", (FIXTURES_DIR / "student_info.png").read_bytes(), "image/png")},
    )
    assert r.status_code == 200
    after = {p for p in ROOT.rglob("*") if "__pycache__" not in p.parts and ".pytest_cache" not in p.parts and ".venv" not in p.parts}
    assert before == after
    assert not (ROOT / "logs").exists()
    assert not (ROOT / "user_data").exists()

    # Audit bundle save + 24h auto-purge
    old_dir = tmp_path / "expired_entry"
    old_dir.mkdir()
    (old_dir / "old.txt").write_text("stale", encoding="utf-8")
    old_mtime = time.time() - 90000
    os.utime(old_dir, (old_mtime, old_mtime))

    fresh_dir = save_audit_bundle(tmp_path, {"main": b"img"}, {"ok": True})
    assert fresh_dir is not None and fresh_dir.exists()
    assert not old_dir.exists()
    assert purge_expired(tmp_path, ttl_seconds=86400) == 0
