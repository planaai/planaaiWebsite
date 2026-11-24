from __future__ import annotations

import asyncio
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import cv2
import httpx
import numpy as np

from app.adapter import to_contract_response
from app.audit import purge_expired, save_audit_bundle
from app.config import Settings
from vendor import equipment_reader, extractor
from vendor.coordinates import CoordinateService

logger = logging.getLogger("ocr_engine.pipeline")

ALLOWED_SLOTS = ("main", "equip1", "equip2", "equip3", "favorite")
MAX_FILE_BYTES = 8 * 1024 * 1024
RATIO_16_9 = 16 / 9
RATIO_21_9 = 21 / 9
RATIO_TOLERANCE = 0.02


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, detail: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.detail = detail


def _is_ratio_supported(width: int, height: int) -> bool:
    if height <= 0:
        return False
    ratio = width / height
    return (
        abs(ratio - RATIO_16_9) / RATIO_16_9 <= RATIO_TOLERANCE
        or abs(ratio - RATIO_21_9) / RATIO_21_9 <= RATIO_TOLERANCE
    )


def _crop_centered_16_9(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    if h <= 0 or abs((w / h) - RATIO_16_9) / RATIO_16_9 <= RATIO_TOLERANCE:
        return img
    box = equipment_reader.centered_16_9_box({"left": 0, "top": 0, "width": w, "height": h})
    x, y, bw, bh = box["left"], box["top"], box["width"], box["height"]
    return img[y : y + bh, x : x + bw]


def decode_and_validate(slot: str, raw_bytes: bytes) -> np.ndarray:
    if not raw_bytes:
        raise ApiError(400, "BAD_IMAGE", f"{slot} file is empty.")
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        raise ApiError(400, "BAD_IMAGE", f"{slot} could not be decoded as an image.")
    h, w = img.shape[:2]
    if w < 1280 or h < 720:
        raise ApiError(400, "LOW_RESOLUTION", f"{slot} resolution {w}x{h} is below minimum 1280x720.")
    if not _is_ratio_supported(w, h):
        raise ApiError(400, "UNSUPPORTED_RATIO", f"{slot} aspect ratio {w}x{h} must be 16:9 or 21:9 (±2%).")
    return img


def _has_student_ui_signals(raw_data: dict[str, Any]) -> bool:
    stats = raw_data.get("stats") or {}
    nonzero_stats = sum(1 for k in ("maxHP", "attackPower", "healPower") if (stats.get(k) or 0) > 0)
    has_hp = (stats.get("maxHP") or 0) >= 1000
    eq = raw_data.get("equipment") or {}
    has_equip = any(((eq.get(f"slot{i}") or {}).get("tier") or 0) > 0 for i in (1, 2, 3, 4))
    has_weapon_lvl = ((raw_data.get("weapon") or {}).get("level") or 0) > 0
    skills = raw_data.get("skills") or {}
    has_skill = any(str(skills.get(k, "1")).strip() not in ("", "1") for k in ("ex", "basic", "enh", "sub"))

    score = 0
    if raw_data.get("studentName"):
        score += 2
    if has_hp and nonzero_stats >= 2:
        score += 2
    elif nonzero_stats >= 2:
        score += 1
    if (raw_data.get("currentLevel") or 0) > 1:
        score += 1
    if has_equip:
        score += 1
    if has_weapon_lvl:
        score += 1
    if has_skill:
        score += 1
    if 1 <= (raw_data.get("currentStar") or 0) <= 5:
        score += 1
    if raw_data.get("bondRank") is not None:
        score += 1
    return score >= 3


class OcrPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._names_lock = threading.RLock()
        self._student_names: list[str] = []
        self._ko_reader = None
        self._en_reader = None
        self._modal_ko_reader = None
        self._modal_en_reader = None
        self._layouts: dict[str, equipment_reader.UiLayout] = {}
        self._models_loaded = False
        self._semaphore = asyncio.Semaphore(settings.OCR_ENGINE_CONCURRENCY)
        self._executor = ThreadPoolExecutor(max_workers=settings.OCR_ENGINE_CONCURRENCY)

    def startup(self) -> None:
        if getattr(self._executor, "_shutdown", False):
            self._executor = ThreadPoolExecutor(max_workers=self.settings.OCR_ENGINE_CONCURRENCY)
        self._ko_reader, self._en_reader = extractor.init_readers()
        self._modal_ko_reader = self._ko_reader
        self._modal_en_reader = self._en_reader
        self._models_loaded = self._ko_reader is not None and self._en_reader is not None
        self.reload_students_sync()
        if self.settings.OCR_AUDIT_DIR:
            purge_expired(self.settings.OCR_AUDIT_DIR)

    def _get_layout(self, svc: CoordinateService, preset_name: str) -> equipment_reader.UiLayout:
        with self._names_lock:
            layout = self._layouts.get(preset_name)
            if layout is None:
                layout = equipment_reader.UiLayout.load(svc, preset_name=preset_name)
                self._layouts[preset_name] = layout
            return layout

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True)

    @property
    def models_loaded(self) -> bool:
        return self._models_loaded

    @property
    def student_names_count(self) -> int:
        with self._names_lock:
            return len(self._student_names)

    def _get_student_names_snapshot(self) -> list[str]:
        with self._names_lock:
            return list(self._student_names)

    def reload_students_sync(self) -> dict[str, Any]:
        names: list[str] = []
        source = "bundled"
        url = f"{self.settings.BACKEND_INTERNAL_URL}/api/students/names"
        if self.settings.BACKEND_INTERNAL_URL:
            try:
                with httpx.Client(timeout=5.0, trust_env=False) as client:
                    resp = client.get(url)
                if resp.status_code == 200:
                    payload = resp.json()
                    if isinstance(payload, list):
                        parsed = [
                            str(item["name"]) if isinstance(item, dict) and "name" in item else str(item)
                            for item in payload
                            if (isinstance(item, str) and item) or (isinstance(item, dict) and item.get("name"))
                        ]
                        if parsed:
                            names = parsed
                            source = "backend"
            except Exception as e:
                logger.info("Student list backend fetch failed (%s), falling back to bundled students.json", e)

        if not names:
            names = extractor.load_bundled_student_names()
            source = "bundled"

        with self._names_lock:
            self._student_names = names
        return {"ok": True, "count": len(names), "source": source}

    async def reload_students(self) -> dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, self.reload_students_sync)

    async def recognize(self, slot_bytes: dict[str, bytes]) -> dict[str, Any]:
        async with self._semaphore:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(self._executor, self._recognize_sync, slot_bytes)

    def _detect_scene(
        self,
        img: np.ndarray,
        screen_reader: equipment_reader.EquipmentScreenReader,
        expected: str = "student_info",
    ) -> str:
        modal_view = _crop_centered_16_9(img)
        if screen_reader.is_equipment_menu_open(modal_view):
            return "equipment_modal"

        mh, mw = modal_view.shape[:2]
        if self._ko_reader is not None:
            fav_strip = modal_view[int(mh * 0.13) : int(mh * 0.21), int(mw * 0.41) : int(mw * 0.59)]
            rec_res, _ = self._ko_reader.text_recognizer([fav_strip])
            if rec_res and any("애용품" in str(r[0]) for r in rec_res):
                return "favorite_popup"
            if expected == "favorite_popup":
                top_crop = modal_view[int(mh * 0.12) : int(mh * 0.25), int(mw * 0.35) : int(mw * 0.65)]
                modal_ko = self._modal_ko_reader or self._ko_reader
                top_res, _ = modal_ko(top_crop)
                if top_res and any("애용품" in r[1] for r in top_res):
                    return "favorite_popup"

        if float(np.std(img)) < 5.0:
            return "unknown"
        return "student_info"

    def _recognize_sync(self, slot_bytes: dict[str, bytes]) -> dict[str, Any]:
        started = time.perf_counter()
        decoded: dict[str, np.ndarray] = {
            slot: decode_and_validate(slot, raw) for slot, raw in slot_bytes.items()
        }

        svc = CoordinateService.instance()
        main_img = decoded["main"]
        mh, mw = main_img.shape[:2]
        main_preset = extractor.resolve_target_preset(mw, mh, svc)
        modal_ko = self._modal_ko_reader or self._ko_reader
        modal_en = self._modal_en_reader or self._en_reader
        modal_ocr = equipment_reader.OcrEngine(modal_ko, modal_en)

        expected_scenes = {
            "main": "student_info",
            "equip1": "equipment_modal",
            "equip2": "equipment_modal",
            "equip3": "equipment_modal",
            "favorite": "favorite_popup",
        }
        detected_scenes: dict[str, str] = {}
        for slot, img in decoded.items():
            sh, sw = img.shape[:2]
            slot_preset = extractor.resolve_target_preset(sw, sh, svc)
            slot_reader = equipment_reader.EquipmentScreenReader(self._get_layout(svc, slot_preset), modal_ocr)
            expected = expected_scenes[slot]
            detected = self._detect_scene(img, slot_reader, expected=expected)
            if detected != expected:
                raise ApiError(
                    422,
                    "SCENE_MISMATCH",
                    f"{slot} 슬롯에는 {expected} 화면이 필요하지만 {detected} 화면이 감지되었습니다.",
                    detail={"slot": slot, "detected": detected, "expected": expected},
                )
            detected_scenes[slot] = detected

        seen_modal_slots: dict[int, str] = {}
        equip_modals: dict[int, tuple[str, dict[str, Any]]] = {}
        for slot in ("equip1", "equip2", "equip3"):
            if slot not in decoded:
                continue
            modal_view = _crop_centered_16_9(decoded[slot])
            vh, vw = modal_view.shape[:2]
            modal_preset = extractor.resolve_target_preset(vw, vh, svc)
            modal_reader = equipment_reader.EquipmentScreenReader(self._get_layout(svc, modal_preset), modal_ocr)
            active_slot = modal_reader.detect_active_modal_slot(modal_view)
            if active_slot in seen_modal_slots:
                raise ApiError(
                    422,
                    "SLOT_DUPLICATE",
                    f"{slot} 슬롯이 {seen_modal_slots[active_slot]}과 동일한 장비 슬롯({active_slot})입니다.",
                    detail={"slot": slot, "activeSlot": active_slot, "conflictingWith": seen_modal_slots[active_slot]},
                )
            seen_modal_slots[active_slot] = slot
            try:
                reading = modal_reader.read_slot_tier(modal_view, active_slot)
                equip_modals[active_slot] = (slot, {"tier": reading.tier or 0, "level": reading.level})
            except Exception as e:
                logger.debug("Modal slot %s (%s) read failed: %s", slot, active_slot, e)
                equip_modals[active_slot] = (slot, {"tier": 0, "level": None})

        favorite_popup: Optional[dict[str, Any]] = None
        if "favorite" in decoded:
            fav_view = _crop_centered_16_9(decoded["favorite"])
            fh, fw = fav_view.shape[:2]
            fav_preset = extractor.resolve_target_preset(fw, fh, svc)
            fav_reader = equipment_reader.EquipmentScreenReader(self._get_layout(svc, fav_preset), modal_ocr)
            try:
                fav_reading = fav_reader.read_favorite_tier(fav_view)
                favorite_popup = {"tier": fav_reading.tier or 0}
            except Exception as e:
                logger.debug("Favorite popup read failed: %s", e)
                favorite_popup = {"tier": 0}

        covered_equip_slots = set(equip_modals.keys()) | ({4} if favorite_popup is not None else set())
        student_names = self._get_student_names_snapshot()
        # Non-exact 16:9 (±2%) frames avoid extractor's 1080p ultrawide canvas crop by normalizing directly to QHD.
        if (
            mh > 0
            and abs((mw / mh) - RATIO_16_9) / RATIO_16_9 <= RATIO_TOLERANCE
            and (mw, mh) not in ((1920, 1080), (2560, 1440), (1280, 720))
        ):
            main_img = cv2.resize(main_img, (2560, 1440), interpolation=cv2.INTER_CUBIC)
            main_preset = "QHD"
        main_raw = extractor.extract_screenshot_data(
            main_img,
            preset_name=main_preset,
            student_names=student_names,
            ko_reader=self._ko_reader,
            en_reader=self._en_reader,
            include_meta=True,
            skip_scene_check=True,
            skip_equip_slots=covered_equip_slots,
        )
        if not main_raw or not _has_student_ui_signals(main_raw):
            raise ApiError(
                422,
                "SCENE_MISMATCH",
                "main 슬롯에서 학생 정보 화면을 감지하지 못했습니다.",
                detail={"slot": "main", "detected": "unknown", "expected": "student_info"},
            )

        raw_meta = main_raw.pop("_meta", {})
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        response = to_contract_response(
            main_raw,
            equip_modals=equip_modals,
            favorite_popup=favorite_popup,
            preset=raw_meta.get("preset", main_preset),
            scenes=detected_scenes,
            raw_name=raw_meta.get("rawName", ""),
            match_score=raw_meta.get("matchScore", 0.0),
            elapsed_ms=elapsed_ms,
            engine_id=self.settings.ENGINE_ID,
        )

        if self.settings.OCR_AUDIT_DIR:
            save_audit_bundle(self.settings.OCR_AUDIT_DIR, slot_bytes, response)

        return response
