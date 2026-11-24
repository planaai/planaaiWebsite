# Ported from planaai/screenshotMacro@54b3994 (GPL-3.0)
from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any, Iterator, Optional

import cv2
import numpy as np

from vendor.paths import CONFIG_DIR

if TYPE_CHECKING:
    from vendor.coordinates import CoordinateService

logger = logging.getLogger("ocr_engine.equipment_reader")

TUNING_PATH = CONFIG_DIR / "equipment_tuning.json"

REGULAR_SLOT_INDICES = (1, 2, 3)
FAVORITE_SLOT_INDEX = 4
MAX_REGULAR_TIER = 10
MAX_FAVORITE_TIER = 2
MAX_EQUIPMENT_LEVEL = 99
MAX_T1_LEVEL = 10
CONTENT_SIZE = (1920, 1080)

# 블루아카이브 장비 티어별 최대 레벨 매핑
TIER_MAX_LEVEL = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 45,
    6: 50,
    7: 55,
    8: 60,
    9: 65,
    10: 70,
}

Point = tuple[float, float]
Region = tuple[float, float, float, float]


class _NullAudit:
    def record(self, *args: Any, **kwargs: Any) -> None:
        return None


# ============================================================================
# 예외
# ============================================================================
class EquipmentScanError(Exception):
    """슬롯/팝업 단위로 복구 가능한 스캔 실패."""


class ExpectedUiNotFound(EquipmentScanError):
    """클릭 후 기대한 화면(모달, 팝업, 패널 갱신)이 나타나지 않음."""


class TierNotRecognized(EquipmentScanError):
    """티어 뱃지 OCR 판독 실패."""


# ============================================================================
# 결과 DTO
# ============================================================================
@dataclass
class TierReading:
    tier: int
    level: Optional[int]
    raw_text: str
    crop_path: Optional[str] = None


@dataclass
class SlotScanResult:
    slot_index: int
    tier: Optional[int] = None
    level: Optional[int] = None
    raw_text: str = ""
    error: Optional[str] = None
    crop_path: Optional[str] = None

    @property
    def succeeded(self) -> bool:
        return self.error is None and self.tier is not None


class FavoriteStatus:
    EQUIPPED = "EQUIPPED"
    EMPTY = "EMPTY"
    FAILED = "FAILED"
    NOT_SCANNED = "NOT_SCANNED"


@dataclass
class FavoriteScanResult:
    status: str = FavoriteStatus.NOT_SCANNED
    tier: Optional[int] = None
    raw_text: str = ""
    error: Optional[str] = None
    crop_path: Optional[str] = None


@dataclass
class EquipmentScanResult:
    slots: list[SlotScanResult] = field(default_factory=list)
    favorite: FavoriteScanResult = field(default_factory=FavoriteScanResult)
    menu_error: Optional[str] = None
    return_error: Optional[str] = None

    @property
    def needs_review(self) -> bool:
        favorite_unresolved = self.favorite.status in (FavoriteStatus.FAILED, FavoriteStatus.NOT_SCANNED)
        any_slot_failed = len(self.slots) < len(REGULAR_SLOT_INDICES) or not all(s.succeeded for s in self.slots)
        return bool(self.menu_error) or any_slot_failed or favorite_unresolved

    def to_extractor_format(self) -> dict:
        equipment = {
            f"slot{slot.slot_index}": {"tier": slot.tier, "level": slot.level or 0, "crop": slot.crop_path}
            for slot in self.slots if slot.succeeded
        }
        if self.favorite.status == FavoriteStatus.EQUIPPED:
            equipment[f"slot{FAVORITE_SLOT_INDEX}"] = {"tier": self.favorite.tier, "level": 0, "crop": self.favorite.crop_path}
        elif self.favorite.status == FavoriteStatus.EMPTY:
            equipment[f"slot{FAVORITE_SLOT_INDEX}"] = {"tier": 0, "level": 0}
        return equipment

    def to_dict(self) -> dict:
        return {**asdict(self), "needs_review": self.needs_review}


# ============================================================================
# 데이터 추출 - 크롭 / OCR / 상태 판정
# ============================================================================
class EquipmentScreenReader:
    """프레임을 읽기만 한다. 클릭·대기는 하지 않는다."""

    MENU_TITLE_KEYWORDS = ("장비", "성장")
    EQUIPMENT_BUTTON_KEYWORD = "성장"

    def __init__(self, layout: "UiLayout", ocr: "OcrEngine", audit: Optional[Any] = None):
        self._layout = layout
        self._ocr = ocr
        self._audit = audit if audit is not None else _NullAudit()

    def is_equipment_menu_open(self, frame: np.ndarray) -> bool:
        return self._title_contains(frame, "equipment_menu_title", self.MENU_TITLE_KEYWORDS)

    def has_region_changed(self, before: np.ndarray, after: np.ndarray, region_name: str) -> bool:
        return self._region_diff(before, after, region_name) >= self._layout.thresholds["changed_mean_diff"]

    def is_region_stable(self, previous: np.ndarray, current: np.ndarray, region_name: str) -> bool:
        return self._region_diff(previous, current, region_name) < self._layout.thresholds["stable_mean_diff"]

    def locate_equipment_button(self, frame: np.ndarray) -> Optional[Point]:
        region = self._layout.region("equipment_button_search")
        crop = crop_region(frame, region)
        for box, text in self._ocr.find_korean_text(crop):
            if self.EQUIPMENT_BUTTON_KEYWORD in text.replace(" ", ""):
                return box_center_to_frame_point(box, crop.shape, region)
        return None

    def read_slot_tier(self, frame: np.ndarray, slot_idx: int) -> TierReading:
        tag = f"slot{slot_idx}"
        unified = self._read_slot_unified(frame, slot_idx, tag)
        if unified is not None:
            return unified

        try:
            tier, raw_text, crop_path = self._read_tier(frame, "detail_tier_badge", MAX_REGULAR_TIER, tag)
            level = self._read_level(frame, slot_idx)
            return TierReading(tier, level, raw_text, crop_path)
        except TierNotRecognized as error:
            rail_reading = self._read_slot_from_rail(frame, slot_idx, tag)
            if rail_reading is not None:
                logger.info("[슬롯 %d] 좌측 레일 아이콘에서 T%d / Lv.%s 판독 성공",
                            slot_idx, rail_reading.tier, rail_reading.level or "?")
                return rail_reading
            raise error

    def _read_slot_unified(self, frame: np.ndarray, slot_idx: int, tag: str) -> Optional[TierReading]:
        region = self._get_unified_slot_region()
        crop = crop_region(frame, region)
        candidates = list(self._ocr.iter_line_candidates(crop))
        if not candidates:
            return None

        found_tier: Optional[int] = None
        found_tier_text: str = ""
        found_level: Optional[int] = None

        for text in candidates:
            if found_tier is None:
                t = parse_tier_text(text, MAX_REGULAR_TIER)
                if t is not None:
                    found_tier = t
                    found_tier_text = text
            if found_level is None:
                lvl = parse_level_text(text)
                if lvl is not None:
                    found_level = lvl

        if found_tier is None and found_level is None:
            return None

        note = ""
        if found_tier is None and found_level is not None and found_level <= MAX_T1_LEVEL:
            found_tier = 1
            found_tier_text = f"Lv.{found_level}"
            note = "T1_INFERRED_FROM_LEVEL"

        if found_tier is not None and found_level is None:
            found_level = self._read_level(frame, slot_idx)

        if found_tier is not None:
            self._audit.record(f"{tag}.tier", "detail_item_badge", crop, candidates, found_tier, "OK", note=note)
            if found_level is not None:
                self._audit.record(f"{tag}.level", "detail_item_badge", crop, candidates, found_level, "OK", note=note)
            return TierReading(found_tier, found_level, found_tier_text, None)

        return None

    SLOT_CATEGORY_KEYWORDS = {
        1: ("모자", "장갑", "신발", "Hat", "Gloves", "Shoes", "帽子", "グローブ", "シューズ"),
        2: ("헤어핀", "배지", "가방", "Hairpin", "Badge", "Bag", "ヘアピン", "バッジ", "バッグ"),
        3: ("시계", "부적", "목걸이", "Watch", "Charm", "Necklace", "腕時計", "お守り", "ネックレス"),
    }

    def detect_active_modal_slot(self, frame: np.ndarray) -> int:
        try:
            dp = self._layout.region("detail_panel")
            title_region = (dp[0], dp[1], dp[2], dp[3] * 0.28)
            crop = crop_region(frame, title_region)
            korean_items = self._ocr.find_korean_text(crop)
            for _, text in korean_items:
                clean_text = text.replace(" ", "")
                for slot_idx, keywords in self.SLOT_CATEGORY_KEYWORDS.items():
                    if any(kw in clean_text for kw in keywords):
                        return slot_idx
        except Exception:
            pass
        return 1

    def read_slot_from_rail(self, frame: np.ndarray, slot_idx: int) -> TierReading:
        tag = f"slot{slot_idx}"
        rail_reading = self._read_slot_from_rail(frame, slot_idx, tag)
        if rail_reading is not None:
            return rail_reading
        return TierReading(0, 0, "", None)

    def _read_slot_from_rail(self, frame: np.ndarray, slot_idx: int, tag: str) -> Optional[TierReading]:
        try:
            sx, sy = self._layout.point(f"slot_{slot_idx}")
        except Exception:
            return None

        rail_region = (max(0.0, sx - 0.055), max(0.0, sy - 0.065), 0.110, 0.130)
        crop = crop_region(frame, rail_region)
        candidates = list(self._ocr.iter_line_candidates(crop))
        if not candidates:
            return None

        found_tier: Optional[int] = None
        found_tier_text: str = ""
        found_level: Optional[int] = None

        for text in candidates:
            if found_tier is None:
                t = parse_tier_text(text, MAX_REGULAR_TIER)
                if t is not None:
                    found_tier = t
                    found_tier_text = text
            if found_level is None:
                lvl = parse_level_text(text)
                if lvl is not None:
                    found_level = lvl

        if found_tier is None and found_level is not None:
            if found_level <= MAX_T1_LEVEL:
                found_tier = 1
                found_tier_text = f"Lv.{found_level}"
            else:
                for t in sorted(TIER_MAX_LEVEL.keys()):
                    if found_level <= TIER_MAX_LEVEL[t]:
                        found_tier = t
                        found_tier_text = f"Lv.{found_level}"
                        break

        if found_tier is not None:
            self._audit.record(f"{tag}.tier", f"rail_slot_{slot_idx}", crop, candidates, found_tier, "OK", note="READ_FROM_LEFT_RAIL")
            if found_level is not None:
                self._audit.record(f"{tag}.level", f"rail_slot_{slot_idx}", crop, candidates, found_level, "OK", note="READ_FROM_LEFT_RAIL")
            return TierReading(found_tier, found_level, found_tier_text, None)

        return None

    def _get_unified_slot_region(self) -> Region:
        try:
            return self._layout.region("detail_item_badge")
        except KeyError:
            pass
        try:
            t_reg = self._layout.region("detail_tier_badge")
            l_reg = self._layout.region("detail_level")
            min_x = min(t_reg[0], l_reg[0])
            max_x = max(t_reg[0] + t_reg[2], l_reg[0] + l_reg[2])
            min_y = min(t_reg[1], l_reg[1], 0.320)
            max_y = max(t_reg[1] + t_reg[3], l_reg[1] + l_reg[3], 0.425)
            return (min_x, min_y, max_x - min_x, max_y - min_y)
        except Exception:
            return (0.255, 0.320, 0.180, 0.110)

    def read_favorite_tier(self, frame: np.ndarray) -> TierReading:
        tier, raw_text, crop_path = self._read_tier(frame, "favorite_tier_badge", MAX_FAVORITE_TIER, "slot4")
        return TierReading(tier, None, raw_text, crop_path)

    def _read_tier(self, frame: np.ndarray, region_name: str, max_tier: int, tag: str) -> tuple[int, str, Optional[str]]:
        crop = crop_region(frame, self._layout.region(region_name))
        candidates = []
        found_tier: Optional[int] = None
        found_text: str = ""
        for text in self._ocr.iter_line_candidates(crop):
            candidates.append(text)
            tier = parse_tier_text(text, max_tier)
            if tier is not None and found_tier is None:
                found_tier = tier
                found_text = text

        if found_tier is not None:
            self._audit.record(f"{tag}.tier", region_name, crop, candidates, found_tier, "OK")
            return found_tier, found_text, None

        self._audit.record(f"{tag}.tier", region_name, crop, candidates, None, "PARSE_FAIL")
        raise TierNotRecognized(f"{region_name} 판독 실패 (OCR 후보={candidates})")

    def _read_level(self, frame: np.ndarray, slot_idx: int = 1) -> Optional[int]:
        crop = crop_region(frame, self._layout.region("detail_level"))
        candidates = []
        found_level: Optional[int] = None
        for text in self._ocr.iter_line_candidates(crop):
            candidates.append(text)
            level = parse_level_text(text)
            if level is not None and found_level is None:
                found_level = level

        if found_level is not None:
            self._audit.record(f"slot{slot_idx}.level", "detail_level", crop, candidates, found_level, "OK")
            return found_level

        self._audit.record(f"slot{slot_idx}.level", "detail_level", crop, candidates, None, "PARSE_FAIL")
        logger.warning("[레벨] 판독 실패 -> 티어만 사용 (OCR 후보=%s)", candidates)
        return None

    def _title_contains(self, frame: np.ndarray, region_name: str, keywords: tuple[str, ...]) -> bool:
        text = self._ocr.read_korean_line(crop_region(frame, self._layout.region(region_name)))
        return contains_any(text, keywords)

    def _region_diff(self, a: np.ndarray, b: np.ndarray, region_name: str) -> float:
        region = self._layout.region(region_name)
        return mean_abs_diff(crop_region(a, region), crop_region(b, region))


class OcrEngine:
    """RapidOCR 래퍼. 전처리 변형을 순서대로 시도하며 후보 문자열을 내놓는다."""

    def __init__(self, korean_reader, english_reader):
        self._korean = korean_reader
        self._english = english_reader

    def read_korean_line(self, crop: np.ndarray) -> str:
        return self._recognize(self._korean, upscale(crop))

    def iter_line_candidates(self, crop: np.ndarray) -> Iterator[str]:
        for _, text in self.find_english_text(crop):
            t = text.strip()
            if t:
                yield t
        for variant in preprocess_variants(crop):
            text = self._recognize(self._english, variant)
            if text:
                yield text

    def find_english_text(self, crop: np.ndarray) -> list[tuple[list, str]]:
        result, _ = self._english(crop)
        return [(box, text) for box, text, _confidence in (result or [])]

    def find_korean_text(self, crop: np.ndarray) -> list[tuple[list, str]]:
        result, _ = self._korean(crop)
        return [(box, text) for box, text, _confidence in (result or [])]

    @staticmethod
    def _recognize(reader, image: np.ndarray) -> str:
        result, _ = reader.text_recognizer([image])
        return result[0][0].strip() if result else ""


@dataclass(frozen=True)
class UiLayout:
    svc: "CoordinateService"
    timing: dict[str, float]
    thresholds: dict[str, float]
    preset_name: Optional[str] = None

    @classmethod
    def load(cls, svc: "CoordinateService", tuning_path: Path | str = TUNING_PATH, preset_name: Optional[str] = None) -> "UiLayout":
        with Path(tuning_path).open("r", encoding="utf-8") as file:
            raw = json.load(file)
        return cls(
            svc=svc,
            timing=raw["timing"],
            thresholds=raw["thresholds"],
            preset_name=preset_name,
        )

    def point(self, name: str) -> Point:
        preset = self.svc.presets.get(self.preset_name, self.svc.active_preset()) if self.preset_name else self.svc.active_preset()
        val = preset.values.get(name, [0, 0])
        return tuple(val)

    def region(self, name: str) -> Region:
        preset = self.svc.presets.get(self.preset_name, self.svc.active_preset()) if self.preset_name else self.svc.active_preset()
        val = preset.values.get(name, [0, 0, 0, 0])
        if isinstance(val, dict):
            return (val.get("x", 0), val.get("y", 0), val.get("w", 0), val.get("h", 0))
        return tuple(val)


# ============================================================================
# 순수 함수 - 파싱 / 이미지 유틸
# ============================================================================
_DIGIT_ALIASES = str.maketrans({
    "I": "1", "l": "1", "i": "1", "|": "1",
    "O": "0", "o": "0", "D": "0",
    "Z": "7", "z": "7",
})
_NOISE_PUNCT = str.maketrans("", "", "()[]{}<>'\":;,`~-_")
_TIER_PATTERN = re.compile(r"[Tt]([0-9Ili|OoDZz]{1,2})")
_LEVEL_PATTERN = re.compile(r"[LlI1][VvyY][.:,]?([0-9IlOo]{1,2})")


def parse_tier_text(text: str, max_tier: int) -> Optional[int]:
    if not text:
        return None
    cleaned = text.translate(_NOISE_PUNCT).strip()
    if not cleaned:
        return None
    compact = re.sub(r"\s+", "", cleaned)
    match = _TIER_PATTERN.search(compact)
    if match:
        return _longest_valid_tier_prefix(match.group(1), max_tier)
    tier = _to_tier(compact, max_tier)
    if tier is not None:
        return tier
    if max_tier > MAX_FAVORITE_TIER:
        level = parse_level_text(text)
        if level is not None and level <= MAX_T1_LEVEL:
            return 1
    return None


def parse_level_text(text: str) -> Optional[int]:
    if not text:
        return None
    match = _LEVEL_PATTERN.search(re.sub(r"\s+", "", text))
    if not match:
        return None
    digits = match.group(1).translate(_DIGIT_ALIASES)
    level = int(digits) if digits.isdigit() else 0
    return level if 1 <= level <= MAX_EQUIPMENT_LEVEL else None


def _longest_valid_tier_prefix(token: str, max_tier: int) -> Optional[int]:
    for end in range(len(token), 0, -1):
        tier = _to_tier(token[:end], max_tier)
        if tier is not None:
            return tier
    return None


def _to_tier(token: str, max_tier: int) -> Optional[int]:
    digits = token.translate(_DIGIT_ALIASES)
    if not digits.isdigit():
        return None
    value = int(digits)
    return value if 1 <= value <= max_tier else None


def contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    compact = text.replace(" ", "")
    return any(keyword in compact for keyword in keywords)


def crop_region(frame: np.ndarray, region: Region) -> np.ndarray:
    if frame is None or getattr(frame, "size", 0) == 0:
        return np.zeros((0, 0, 3) if frame is not None and frame.ndim == 3 else (0, 0), dtype=np.uint8)
    height, width = frame.shape[:2]
    x, y, w, h = region
    x1 = max(0, min(width, int(round(x * width))))
    y1 = max(0, min(height, int(round(y * height))))
    x2 = max(0, min(width, int(round((x + w) * width))))
    y2 = max(0, min(height, int(round((y + h) * height))))
    if x2 < x1:
        x1, x2 = x2, x1
    if y2 < y1:
        y1, y2 = y2, y1
    return frame[y1:y2, x1:x2]


def mean_abs_diff(a: np.ndarray, b: np.ndarray) -> float:
    if a is None or b is None or getattr(a, "size", 0) == 0 or getattr(b, "size", 0) == 0:
        return 999.0
    gray_a = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY) if a.ndim == 3 else a
    gray_b = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY) if b.ndim == 3 else b
    if gray_a.shape != gray_b.shape:
        return 999.0
    return float(np.mean(cv2.absdiff(gray_a, gray_b)))


def box_center_to_frame_point(box: list, crop_shape: tuple, region: Region) -> Point:
    crop_height, crop_width = crop_shape[:2]
    center_x = sum(p[0] for p in box) / len(box) / crop_width
    center_y = sum(p[1] for p in box) / len(box) / crop_height
    x, y, w, h = region
    return x + center_x * w, y + center_y * h


def centered_16_9_box(monitor: dict) -> dict:
    """와이드/세로 모니터에서 중앙 16:9 영역만 잘라낸다 (모달은 화면 중앙 기준으로 배치됨)."""
    left, top, width, height = monitor["left"], monitor["top"], monitor["width"], monitor["height"]
    target_ratio = 16 / 9
    if width / height > target_ratio:
        content_width = round(height * target_ratio)
        left, width = left + (width - content_width) // 2, content_width
    elif width / height < target_ratio:
        content_height = round(width / target_ratio)
        top, height = top + (height - content_height) // 2, content_height
    return {"left": left, "top": top, "width": width, "height": height}


def upscale(image: np.ndarray, factor: int = 3) -> np.ndarray:
    return cv2.resize(image, None, fx=factor, fy=factor, interpolation=cv2.INTER_CUBIC)


def preprocess_variants(crop: np.ndarray) -> Iterator[np.ndarray]:
    """원본 확대 -> 대비 강화 그레이 -> Otsu 이진화 순. 앞 단계에서 판독되면 뒤는 생략된다."""
    scaled = upscale(crop)
    yield scaled
    gray = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)
    yield cv2.cvtColor(cv2.convertScaleAbs(gray, alpha=1.5, beta=0), cv2.COLOR_GRAY2BGR)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    yield cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
