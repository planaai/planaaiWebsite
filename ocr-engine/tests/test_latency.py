from __future__ import annotations

import math
import time
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from app.config import Settings
from app.main import create_app

ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT / "tests" / "fixtures"
TEST_TOKEN = "latency-test-token"


def _p95(samples: list[float]) -> float:
    ordered = sorted(samples)
    idx = max(0, math.ceil(0.95 * len(ordered)) - 1)
    return ordered[idx]


def _make_modal_variant(base_png: bytes, label: str) -> bytes:
    """Create a valid equipment_modal image with a different category title for 5-slot benchmark."""
    arr = np.frombuffer(base_png, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    h, w = bgr.shape[:2]
    # Replace detail_panel top title strip (x: 0.16..0.543, y: 0.207..0.35) with clean Korean label
    x1, y1 = int(w * 0.17), int(h * 0.21)
    x2, y2 = int(w * 0.45), int(h * 0.29)
    bgr[y1:y2, x1:x2] = (245, 247, 250)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    draw = ImageDraw.Draw(pil_img)
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    font = ImageFont.truetype(str(font_path), 42) if font_path.exists() else ImageFont.load_default()
    draw.text((x1 + 20, y1 + 15), label, fill=(30, 40, 60), font=font)
    out_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".png", out_bgr)
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


def test_p95_latency_single_and_five_set(client: TestClient) -> None:
    headers = {"X-Engine-Token": TEST_TOKEN}
    main_bytes = (FIXTURES_DIR / "student_info.png").read_bytes()
    eq1_bytes = (FIXTURES_DIR / "equipment_modal.png").read_bytes()
    eq2_bytes = _make_modal_variant(eq1_bytes, "가방")
    eq3_bytes = _make_modal_variant(eq1_bytes, "시계")
    fav_bytes = (FIXTURES_DIR / "favorite_popup.png").read_bytes()

    # Warmup
    warm = client.post(
        "/v1/recognize",
        headers=headers,
        files={"main": ("main.png", main_bytes, "image/png")},
    )
    assert warm.status_code == 200

    single_times: list[float] = []
    for _ in range(5):
        t0 = time.perf_counter()
        r = client.post(
            "/v1/recognize",
            headers=headers,
            files={"main": ("main.png", main_bytes, "image/png")},
        )
        single_times.append(time.perf_counter() - t0)
        assert r.status_code == 200

    five_times: list[float] = []
    for _ in range(5):
        t0 = time.perf_counter()
        r = client.post(
            "/v1/recognize",
            headers=headers,
            files={
                "main": ("main.png", main_bytes, "image/png"),
                "equip1": ("eq1.png", eq1_bytes, "image/png"),
                "equip2": ("eq2.png", eq2_bytes, "image/png"),
                "equip3": ("eq3.png", eq3_bytes, "image/png"),
                "favorite": ("fav.png", fav_bytes, "image/png"),
            },
        )
        five_times.append(time.perf_counter() - t0)
        assert r.status_code == 200

    single_p95 = _p95(single_times)
    five_p95 = _p95(five_times)
    assert single_p95 <= 2.5, f"Single main p95={single_p95:.3f}s exceeded 2.5s ({single_times})"
    assert five_p95 <= 5.0, f"5-set p95={five_p95:.3f}s exceeded 5.0s ({five_times})"
