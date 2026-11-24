from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft7Validator

from app.adapter import to_contract_response
from app.config import Settings
from app.main import create_app
from app.pipeline import _has_student_ui_signals
from vendor import equipment_reader, extractor
from vendor.coordinates import CoordinateService

ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = ROOT / "tests" / "fixtures"
GOLDEN_DIR = ROOT / "tests" / "golden"
SCHEMA = json.loads((ROOT / "contract" / "recognize.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft7Validator(SCHEMA)
TEST_TOKEN = "parity-test-token"


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


def test_parity_main_and_3_scene_fixtures(client: TestClient) -> None:
    main_path = FIXTURES_DIR / "student_info.png"
    eq_path = FIXTURES_DIR / "equipment_modal.png"
    fav_path = FIXTURES_DIR / "favorite_popup.png"

    # 1. Direct upstream-ported extractor + adapter on main fixture
    ko, en = extractor.init_readers()
    names = extractor.load_bundled_student_names()
    raw_main = extractor.extract_screenshot_data(main_path, student_names=names, ko_reader=ko, en_reader=en, include_meta=True)
    assert raw_main is not None
    raw_meta = raw_main.pop("_meta")

    expected_single = to_contract_response(
        raw_main,
        preset=raw_meta["preset"],
        scenes={"main": "student_info"},
        raw_name=raw_meta["rawName"],
        match_score=raw_meta["matchScore"],
        elapsed_ms=0.0,
    )

    resp_single = client.post(
        "/v1/recognize",
        headers={"X-Engine-Token": TEST_TOKEN},
        files={"main": ("student_info.png", main_path.read_bytes(), "image/png")},
    )
    assert resp_single.status_code == 200
    body_single = resp_single.json()
    assert not list(VALIDATOR.iter_errors(body_single))
    assert body_single["data"] == expected_single["data"]
    assert body_single["meta"]["studentMatch"] == expected_single["meta"]["studentMatch"]
    assert body_single["meta"]["needsReview"] == expected_single["meta"]["needsReview"]
    assert body_single["meta"]["preset"] == expected_single["meta"]["preset"]

    # 2. Multi-scene parity: main + equipment_modal + favorite_popup
    eq_img = cv2.imdecode(np.frombuffer(eq_path.read_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
    fav_img = cv2.imdecode(np.frombuffer(fav_path.read_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
    svc = CoordinateService.instance()
    sr_eq = equipment_reader.EquipmentScreenReader(
        equipment_reader.UiLayout.load(svc, preset_name="QHD"),
        equipment_reader.OcrEngine(ko, en),
    )
    active_slot = sr_eq.detect_active_modal_slot(eq_img)
    eq_reading = sr_eq.read_slot_tier(eq_img, active_slot)
    try:
        fav_reading = sr_eq.read_favorite_tier(fav_img)
        fav_tier = fav_reading.tier or 0
    except equipment_reader.EquipmentScanError:
        fav_tier = 0

    expected_multi = to_contract_response(
        raw_main,
        equip_modals={active_slot: ("equip1", {"tier": eq_reading.tier, "level": eq_reading.level})},
        favorite_popup={"tier": fav_tier},
        preset=raw_meta["preset"],
        scenes={"main": "student_info", "equip1": "equipment_modal", "favorite": "favorite_popup"},
        raw_name=raw_meta["rawName"],
        match_score=raw_meta["matchScore"],
        elapsed_ms=0.0,
    )

    resp_multi = client.post(
        "/v1/recognize",
        headers={"X-Engine-Token": TEST_TOKEN},
        files={
            "main": ("student_info.png", main_path.read_bytes(), "image/png"),
            "equip1": ("equipment_modal.png", eq_path.read_bytes(), "image/png"),
            "favorite": ("favorite_popup.png", fav_path.read_bytes(), "image/png"),
        },
    )
    assert resp_multi.status_code == 200
    body_multi = resp_multi.json()
    assert not list(VALIDATOR.iter_errors(body_multi))
    assert body_multi["data"] == expected_multi["data"]
    assert body_multi["meta"]["fieldSources"] == expected_multi["meta"]["fieldSources"]
    assert body_multi["meta"]["scenes"] == {"main": "student_info", "equip1": "equipment_modal", "favorite": "favorite_popup"}
    assert body_multi["data"]["favoriteItem"] == (
        {"unequipped": False, "tier": fav_tier} if fav_tier > 0 else {"unequipped": True, "tier": None}
    )
    assert body_multi["data"]["equipments"][active_slot - 1]["tier"] == eq_reading.tier


def test_21_9_preprocess_isolation() -> None:
    # Verify preprocess_image does not share mutable global offset state across calls
    img1 = np.zeros((1080, 2560, 3), dtype=np.uint8)
    img2 = np.full((1080, 2560, 3), 255, dtype=np.uint8)
    out1 = extractor.preprocess_image(img1)
    out2 = extractor.preprocess_image(img2)
    assert out1.shape == (1080, 1920, 3)
    assert out2.shape == (1080, 1920, 3)


def test_non_exact_16_9_normalization_and_low_level_signal_guard(client: TestClient) -> None:
    raw_bytes = (FIXTURES_DIR / "student_info.png").read_bytes()
    src = cv2.imdecode(np.frombuffer(raw_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert src is not None
    for width, height in ((1366, 768), (1920, 1070), (2560, 1430)):
        resized = cv2.resize(src, (width, height), interpolation=cv2.INTER_CUBIC)
        ok, buf = cv2.imencode(".png", resized)
        assert ok
        resp = client.post(
            "/v1/recognize",
            headers={"X-Engine-Token": TEST_TOKEN},
            files={"main": (f"{width}x{height}.png", buf.tobytes(), "image/png")},
        )
        assert resp.status_code == 200, f"{width}x{height} failed: {resp.text}"
        body = resp.json()
        assert not list(VALIDATOR.iter_errors(body))
        assert body["data"]["studentName"] == "하나코수영복"
        assert body["data"]["stats"]["hp"]["value"] == 43846
        assert body["data"]["stats"]["atk"]["value"] == 7872

    # Low-level 1-star student with unmatched name passes; pure noise hallucinating star+bond fails.
    assert _has_student_ui_signals(
        {
            "studentName": "",
            "currentLevel": 1,
            "currentStar": 1,
            "bondRank": 1,
            "skills": {"ex": "1", "basic": "1", "enh": "1", "sub": "1"},
            "weapon": {"star": 0, "level": 0},
            "equipment": {},
            "stats": {"maxHP": 2100, "attackPower": 240, "healPower": 480},
        }
    )
    assert not _has_student_ui_signals(
        {
            "studentName": "",
            "currentLevel": 1,
            "currentStar": 5,
            "bondRank": 2,
            "skills": {"ex": "1", "basic": "1", "enh": "1", "sub": "1"},
            "weapon": {"star": 12, "level": 0},
            "equipment": {},
            "stats": {"maxHP": 0, "attackPower": 0, "healPower": 0},
        }
    )


def test_golden_images_if_present(client: TestClient) -> None:
    golden_images = sorted(
        p for p in GOLDEN_DIR.rglob("*")
        if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )
    if not golden_images:
        pytest.skip("No golden images placed in tests/golden/")

    for img_path in golden_images:
        resp = client.post(
            "/v1/recognize",
            headers={"X-Engine-Token": TEST_TOKEN},
            files={"main": (img_path.name, img_path.read_bytes(), "image/png")},
        )
        assert resp.status_code in (200, 422), f"{img_path.name}: unexpected status {resp.status_code}"
        assert not list(VALIDATOR.iter_errors(resp.json()))
