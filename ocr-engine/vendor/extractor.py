# Ported from planaai/screenshotMacro@54b3994 (GPL-3.0)
from __future__ import annotations

import difflib
import json
import logging
import math
import re
import threading
import warnings
from pathlib import Path
from typing import Any, Optional, Sequence

import cv2
import numpy as np
import rapidocr_onnxruntime

warnings.filterwarnings("ignore", category=UserWarning)

from rapidocr_onnxruntime import RapidOCR

from vendor import equipment_reader
from vendor.coordinates import CoordinateService
from vendor.paths import MODELS_DIR, STUDENTS_PATH

logger = logging.getLogger("ocr_engine.extractor")

_init_lock = threading.Lock()
reader_ko: Optional[RapidOCR] = None
reader_en: Optional[RapidOCR] = None


def log_debug(msg: str) -> None:
    logger.debug("%s", msg)


def _default_det_kwargs() -> dict[str, Any]:
    det_path = Path(rapidocr_onnxruntime.__file__).resolve().parent / "models" / "ch_PP-OCRv3_det_infer.onnx"
    if det_path.is_file():
        return {"det_model_path": str(det_path), "det_limit_type": "max", "det_limit_side_len": 1280}
    return {}


def init_readers(
    ko_model_path: Optional[Path | str] = None,
    ko_dict_path: Optional[Path | str] = None,
) -> tuple[RapidOCR, RapidOCR]:
    """Explicitly initialize RapidOCR Korean and English readers once."""
    global reader_ko, reader_en
    with _init_lock:
        if reader_ko is not None and reader_en is not None:
            return reader_ko, reader_en
        model_path = Path(ko_model_path) if ko_model_path else MODELS_DIR / "korean_PP-OCRv3_rec_infer.onnx"
        dict_path = Path(ko_dict_path) if ko_dict_path else MODELS_DIR / "korean_dict.txt"
        det_kwargs = _default_det_kwargs()
        reader_ko = RapidOCR(
            rec_model_path=str(model_path),
            rec_keys_path=str(dict_path),
            use_angle_cls=False,
            **det_kwargs,
        )
        reader_en = RapidOCR(use_angle_cls=False, **det_kwargs)
        return reader_ko, reader_en


def load_bundled_student_names(path: Optional[Path | str] = None) -> list[str]:
    target = Path(path) if path else STUDENTS_PATH
    if not target.exists():
        return []
    try:
        with target.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [str(x) for x in data if x]
    except Exception as e:
        logger.warning("Failed to load bundled students.json (%s): %s", target, e)
    return []


def split_jamo(text: str) -> str:
    CHOSUNG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
    JUNGSUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
    JONGSUNG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"

    result = []
    for char in text:
        if "가" <= char <= "힣":
            char_code = ord(char) - 44032
            cho1 = char_code // 588
            jung1 = (char_code - (588 * cho1)) // 28
            jong1 = char_code - (588 * cho1) - (28 * jung1)
            result.append(CHOSUNG[cho1])
            result.append(JUNGSUNG[jung1])
            if jong1 > 0:
                result.append(JONGSUNG[jong1])
        else:
            result.append(char)
    return "".join(result)


def split_jamo_char(char: str) -> Optional[tuple[int, int, int]]:
    if "가" <= char <= "힣":
        code = ord(char) - 44032
        cho = code // 588
        jung = (code - 588 * cho) // 28
        jong = code - 588 * cho - 28 * jung
        return (cho, jung, jong)
    return None


def char_similarity(c1: str, c2: str) -> float:
    if c1 == c2:
        return 1.0
    j1 = split_jamo_char(c1)
    j2 = split_jamo_char(c2)
    if j1 is None or j2 is None:
        return 0.0

    score = 0.0
    weight = 0.0

    weight += 1.0
    if j1[0] == j2[0]:
        score += 1.0

    weight += 1.0
    if j1[1] == j2[1]:
        score += 1.0

    if j1[2] != 0 or j2[2] != 0:
        weight += 1.0
        if j1[2] == j2[2]:
            score += 1.0

    return score / weight if weight > 0 else 0.0


def split_name_variant(name: str) -> tuple[str, str]:
    """Split 'Base(Variant)' into (base, variant) while preserving non-paren names like '시로코*테러'."""
    if not name:
        return ("", "")
    normalized = str(name).translate(str.maketrans({"（": "(", "）": ")", "＊": "*"})).strip()
    match = re.match(r"^([^\(]+?)\s*\(([^)]+)\)\s*$", normalized)
    if match:
        return (match.group(1).strip(), match.group(2).strip())
    return (normalized, "")


def name_similarity(ocr_text: str, candidate: str) -> float:
    ocr_base, ocr_var = split_name_variant(ocr_text)
    cand_base, cand_var = split_name_variant(candidate)

    if ocr_var.replace(" ", "") != cand_var.replace(" ", ""):
        return 0.0

    ocr_k = re.sub(r"[^가-힣]", "", ocr_base)
    name_k = re.sub(r"[^가-힣]", "", cand_base)

    if not ocr_k or not name_k:
        return 0.0

    if ocr_k == name_k:
        return 1.0

    seq_ratio = difflib.SequenceMatcher(None, ocr_k, name_k).ratio()

    if len(name_k) >= len(ocr_k) + 1 and len(ocr_k) <= 1:
        return max(0.3, seq_ratio - 0.2)

    best_score = 0.0
    max_len = max(len(ocr_k), len(name_k))
    window_size = len(name_k)

    if len(ocr_k) < len(name_k):
        total = sum(char_similarity(ocr_k[i], name_k[i]) for i in range(len(ocr_k)))
        best_score = total / max_len
    else:
        for i in range(len(ocr_k) - window_size + 1):
            window = ocr_k[i : i + window_size]
            total = sum(char_similarity(window[j], name_k[j]) for j in range(window_size))
            score = total / max_len
            if score > best_score:
                best_score = score

    return max(0.0, best_score, seq_ratio)


def match_student_name_with_score(
    extracted_name: str,
    student_names: Optional[Sequence[str]] = None,
) -> tuple[str, str, float]:
    raw_input = extracted_name or ""
    names = list(student_names) if student_names is not None else load_bundled_student_names()
    if not extracted_name or not names:
        log_debug("Empty extracted_name or student_names list.")
        return ("", raw_input, 0.0)

    raw_ex = extracted_name.strip().lower()
    if raw_ex == "h":
        return ("노노미", raw_input, 1.0)
    if raw_ex == "10":
        return ("리츠", raw_input, 1.0)

    log_debug("--- Name Matching Start ---")
    log_debug(f"Raw OCR Output: '{extracted_name}'")

    normalized_ex = extracted_name.translate(str.maketrans({"（": "(", "）": ")", "＊": "*"})).strip()
    clean_ex = re.sub(r"[^가-힣\(\)\*]", "", normalized_ex)
    if not clean_ex:
        log_debug("Cleaned name is empty.")
        return ("", raw_input, 0.0)

    ocr_fallbacks = {
        "숲": "슌",
        "순": "슌",
        "숨": "슌",
        "슘": "슌",
        "춘": "슌",
        "스프미": "스즈미",
        "스트미": "스즈미",
        "스르미": "스즈미",
        "즈미": "스즈미",
        "스즈": "스즈미",
        "치하로": "치히로",
        "소구호미사키": "쇼쿠호미사키",
        "사례루이코": "사텐루이코",
        "나코": "니코",
        "너코": "니코",
        "미라시": "미카",
        "미라스": "미카",
        "미라0시": "미카",
        "피시에": "피나",
        "로모에": "토모에",
        "즈코": "시즈코",
        "시조코": "시즈코",
        "츠쿠": "츠쿠요",
        "쿠요": "츠쿠요",
        "츠구요": "츠쿠요",
        "우미": "루미",
    }
    ex_base, ex_var = split_name_variant(clean_ex)
    if ex_base in ocr_fallbacks:
        ex_base = ocr_fallbacks[ex_base]
        clean_ex = f"{ex_base}({ex_var})" if ex_var else ex_base

    exact_fallbacks = {
        "레이": "케이",
        "켜이": "케이",
        "웨이": "케이",
        "소": "슌",
        "춘": "슌",
        "토": "토키",
        "유": "유즈",
        "하나": "히나",
        "하루": "하루나",
        "니": "니야",
    }
    if clean_ex in exact_fallbacks:
        clean_ex = exact_fallbacks[clean_ex]

    log_debug(f"Cleaned String: '{clean_ex}'")

    cleaned_names = {re.sub(r"[^가-힣\(\)\*]", "", n): n for n in names}

    if clean_ex in cleaned_names:
        log_debug(f"Exact match found: '{cleaned_names[clean_ex]}'")
        return (cleaned_names[clean_ex], raw_input, 1.0)

    clean_ex_no_paren = re.sub(r"[^가-힣\*]", "", clean_ex)
    if clean_ex_no_paren:
        paren_stripped_matches = [
            orig_n for orig_n in names if re.sub(r"[^가-힣\*]", "", orig_n) == clean_ex_no_paren
        ]
        if len(paren_stripped_matches) == 1:
            log_debug(f"Paren-stripped exact match found: '{paren_stripped_matches[0]}'")
            return (paren_stripped_matches[0], raw_input, 1.0)

    candidate_scores: dict[str, float] = {}
    for orig_n in names:
        ratio = name_similarity(clean_ex, orig_n)
        if ratio > candidate_scores.get(orig_n, 0.0):
            candidate_scores[orig_n] = ratio

    if not candidate_scores:
        return ("", raw_input, 0.0)

    sorted_candidates = sorted(
        candidate_scores.items(),
        key=lambda item: (-item[1], len(item[0])),
    )
    best_match, best_ratio = sorted_candidates[0]
    second_best_ratio = sorted_candidates[1][1] if len(sorted_candidates) > 1 else 0.0
    clamped_score = max(0.0, min(1.0, float(best_ratio)))

    log_debug(
        f"Best Match Candidate: '{best_match}' ({best_ratio:.3f}), "
        f"Second: {second_best_ratio:.3f}"
    )

    ocr_base_final, _ = split_name_variant(clean_ex)
    ocr_base_k = re.sub(r"[^가-힣]", "", ocr_base_final)
    base_len = len(ocr_base_k)

    if base_len <= 1:
        threshold = 0.90
    elif base_len == 2:
        threshold = 0.90
    else:
        threshold = 0.85

    if best_match and best_ratio >= threshold and (best_ratio - second_best_ratio) >= 0.05:
        log_debug(f"Accepted Match: '{best_match}'")
        return (best_match, raw_input, round(clamped_score, 4))

    log_debug(f"Match Rejected (Ratio {best_ratio:.3f} < {threshold:.2f} or margin < 0.05)")
    return ("", raw_input, round(clamped_score, 4))


def match_student_name(
    extracted_name: str,
    student_names: Optional[Sequence[str]] = None,
) -> str:
    matched, _, _ = match_student_name_with_score(extracted_name, student_names=student_names)
    return matched


def get_base_rois(size: Optional[tuple[int, int]] = None, preset_name: Optional[str] = None) -> dict[str, tuple[int, int, int, int]]:
    svc = CoordinateService.instance()
    if size is None:
        size = (2560, 1440)
    preset = svc.presets.get(preset_name, svc.active_preset()) if preset_name else svc.active_preset()
    mapping = {
        "studentName": "student_name",
        "bondRank": "bond_rank",
        "currentLevel": "student_level",
        "stars_area": "student_stars",
        "skill_ex": "skill_ex",
        "skill_basic": "skill_basic",
        "skill_enh": "skill_enh",
        "skill_sub": "skill_sub",
        "weapon_level": "weapon_level",
        "weapon_stars_area": "weapon_stars_area",
        "equip_1": "equip_1_box",
        "equip_2": "equip_2_box",
        "equip_3": "equip_3_box",
        "equip_4": "equip_4_box",
        "equip_1_tier": "equip_1_tier_box",
        "equip_2_tier": "equip_2_tier_box",
        "equip_3_tier": "equip_3_tier_box",
        "equip_4_tier": "equip_4_tier_box",
        "stat_hp": "stat_hp",
        "stat_attack": "stat_attack",
        "stat_defense": "stat_defense",
        "stat_heal": "stat_heal",
    }

    def get_reg_px(k: str) -> tuple[int, int, int, int]:
        val = preset.values.get(k, [0, 0, 0, 0])
        if isinstance(val, dict):
            r = (val.get("x", 0), val.get("y", 0), val.get("w", 0), val.get("h", 0))
        else:
            r = tuple(val)
        return (int(r[0] * size[0]), int(r[1] * size[1]), int(r[2] * size[0]), int(r[3] * size[1]))

    return {k: get_reg_px(v) for k, v in mapping.items()}


def count_stars(img_crop: np.ndarray, is_weapon: bool = False) -> int:
    if (
        img_crop is None
        or getattr(img_crop, "size", 0) == 0
        or getattr(img_crop, "ndim", 0) != 3
        or img_crop.shape[2] not in (3, 4)
    ):
        return 0

    if getattr(img_crop, "dtype", None) != np.uint8:
        try:
            img_crop = np.nan_to_num(img_crop, nan=0.0, posinf=255.0, neginf=0.0)
            img_crop = np.clip(img_crop, 0, 255).astype(np.uint8)
        except Exception:
            return 0

    try:
        hsv = cv2.cvtColor(img_crop, cv2.COLOR_BGR2HSV)
        crop_h = img_crop.shape[0]
        scale_factor = crop_h / 39.0 if crop_h > 0 else 1.0
        if not is_weapon:
            lower_color = np.array([15, 100, 100])
            upper_color = np.array([40, 255, 255])
            expected_w = 24.0 * scale_factor
        else:
            lower_color = np.array([80, 100, 100])
            upper_color = np.array([110, 255, 255])
            expected_w = 26.0 * scale_factor

        mask = cv2.inRange(hsv, lower_color, upper_color)
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        star_count = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 20 * (scale_factor ** 2):
                _, _, w, _ = cv2.boundingRect(cnt)
                if w < 10 * scale_factor:
                    continue
                num = max(1, math.ceil(w / expected_w - 0.15))
                star_count += num

        return star_count
    except Exception as e:
        log_debug(f"count_stars error: {e}")
        return 0


def _resolve_readers(ko_reader: Optional[RapidOCR], en_reader: Optional[RapidOCR]) -> tuple[Optional[RapidOCR], Optional[RapidOCR]]:
    ko = ko_reader if ko_reader is not None else reader_ko
    en = en_reader if en_reader is not None else reader_en
    if ko is None or en is None:
        ko, en = init_readers()
    return ko, en


def extract_text(
    img: np.ndarray,
    bbox: tuple[int, int, int, int],
    allowlist: Optional[str] = None,
    scale: int = 1,
    is_name: bool = False,
    min_length: int = 0,
    ko_reader: Optional[RapidOCR] = None,
    en_reader: Optional[RapidOCR] = None,
) -> str:
    ko, en = _resolve_readers(ko_reader, en_reader)
    x, y, w, h = bbox
    crop = img[y : y + h, x : x + w]

    if crop.size == 0:
        return ""

    if scale != 1:
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    active_reader = ko if is_name else en

    try:
        ocr_res, _ = active_reader.text_recognizer([crop])
    except Exception as e:
        log_debug(f"text_recognizer error: {e}")
        ocr_res = None

    if ocr_res is None or len(ocr_res) == 0:
        parts = []
    else:
        parts = [ocr_res[0][0]]

    if is_name:
        korean_parts = []
        for part in parts:
            if re.search(r"[가-힣]", part):
                korean_parts.append(part)
        text = "".join(korean_parts).replace(" ", "")
        text = re.sub(r"[^가-힣\(\)\*]", "", text)

        if not text:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)
            thresh_bgr = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
            try:
                retry_res, _ = active_reader.text_recognizer([thresh_bgr])
                if retry_res and len(retry_res) > 0:
                    retry_text = retry_res[0][0]
                    if re.search(r"[가-힣]", retry_text):
                        text = re.sub(r"[^가-힣]", "", retry_text)
            except Exception:
                pass

        if not text:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            enhanced_bgr = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
            try:
                retry_res, _ = active_reader.text_recognizer([enhanced_bgr])
                if retry_res and len(retry_res) > 0:
                    retry_text = retry_res[0][0]
                    if re.search(r"[가-힣]", retry_text):
                        text = re.sub(r"[^가-힣]", "", retry_text)
            except Exception:
                pass

        if not text:
            log_debug("Name OCR FAILED - returning empty string")

        log_debug(f"Name OCR raw parts: {parts} -> filtered: '{text}'")
        return text

    text = "".join(parts).replace(" ", "")

    if allowlist:
        text = "".join(c for c in text if c in allowlist)

    needs_retry = not text or len(text) < min_length

    def has_digit_or_alias(s: str) -> bool:
        return any(c.isdigit() or c in "lIOoSs" for c in s)

    if allowlist and any(c.isdigit() for c in allowlist) and not has_digit_or_alias(text):
        needs_retry = True

    if needs_retry:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)
        thresh_bgr = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
        try:
            ocr_res, _ = active_reader.text_recognizer([thresh_bgr])
        except Exception:
            ocr_res = None

        if ocr_res and len(ocr_res) > 0:
            retry_text = "".join(ocr_res[0][0]).replace(" ", "")
            if allowlist:
                retry_text = "".join(c for c in retry_text if c in allowlist)
            if has_digit_or_alias(retry_text):
                text = retry_text
            elif not text:
                text = retry_text

        if not has_digit_or_alias(text) and not is_name:
            try:
                ocr_res, _ = ko.text_recognizer([crop])
                if ocr_res and len(ocr_res) > 0:
                    retry_ko = "".join(ocr_res[0][0]).replace(" ", "")
                    if allowlist:
                        retry_ko = "".join(c for c in retry_ko if c in allowlist)
                    if has_digit_or_alias(retry_ko):
                        text = retry_ko
            except Exception:
                pass

    return text


_DIGIT_ALIASES = {
    "Z": "7", "z": "7",
    "O": "0", "o": "0",
    "I": "1", "l": "1", "|": "1", "!": "1",
    "S": "5", "s": "5",
    "B": "8", "b": "8",
}


def infer_tier_from_level(level: int) -> int:
    if level > 65:
        return 10
    if level > 60:
        return 9
    if level > 55:
        return 8
    if level > 50:
        return 7
    if level > 45:
        return 6
    if level > 40:
        return 5
    if level > 30:
        return 4
    if level > 20:
        return 3
    if level > 10:
        return 2
    return 1


def extract_equip_text(
    img: np.ndarray,
    icon_bbox: tuple[int, int, int, int],
    tier_bbox: Optional[tuple[int, int, int, int]] = None,
    is_bond_gear: bool = False,
    en_reader: Optional[RapidOCR] = None,
) -> str:
    _, en = _resolve_readers(None, en_reader)
    if tier_bbox is None:
        tier_bbox = icon_bbox
    x, y, w, h = icon_bbox
    crop = img[y : y + h, x : x + w]
    if crop.size == 0:
        return ""

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    if np.mean(gray) < 130:
        return "EMPTY"
    if np.std(gray) < 25:
        return "EMPTY"

    try:
        scaled = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        gray_scaled = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)
        adj = cv2.convertScaleAbs(gray_scaled, alpha=1.5, beta=0)

        res, _ = en(adj)
        texts = [r[1] for r in res] if res else []
        full_text = " ".join(texts).upper()
        if any(k in full_text for k in ("EMPTY", "MPTY", "PTY")):
            return "EMPTY"

        parsed = parse_equip(full_text, is_bond_gear=is_bond_gear)

        needs_retry = (parsed["tier"] == 0) if is_bond_gear else (parsed["tier"] == 0 or parsed["level"] == 0)
        if needs_retry:
            res_raw, _ = en(scaled)
            if res_raw:
                raw_texts = [r[1] for r in res_raw]
                full_text_raw = " ".join(raw_texts).upper()
                if any(k in full_text_raw for k in ("EMPTY", "MPTY", "PTY")):
                    return "EMPTY"
                parsed_raw = parse_equip(full_text_raw, is_bond_gear=is_bond_gear)
                combined_text = f"{full_text} {full_text_raw}".strip()
                parsed_comb = parse_equip(combined_text, is_bond_gear=is_bond_gear)

                best_parsed = parsed
                best_text = full_text
                for cand_parsed, cand_text in ((parsed_raw, full_text_raw), (parsed_comb, combined_text)):
                    s_cand = (2 if cand_parsed["tier"] > 0 else 0) + (1 if cand_parsed["level"] > 0 else 0)
                    s_best = (2 if best_parsed["tier"] > 0 else 0) + (1 if best_parsed["level"] > 0 else 0)
                    if s_cand > s_best:
                        best_parsed = cand_parsed
                        best_text = cand_text
                full_text = best_text
                parsed = best_parsed

        if parsed["tier"] == 0 and tier_bbox and tier_bbox != icon_bbox:
            tx, ty, tw, th = tier_bbox
            t_crop = img[ty : ty + th, tx : tx + tw]
            if t_crop.size > 0:
                t_scaled = cv2.resize(t_crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
                t_gray = cv2.cvtColor(t_scaled, cv2.COLOR_BGR2GRAY)
                t_adj = cv2.convertScaleAbs(t_gray, alpha=1.5, beta=0)
                t_res, _ = en(t_adj)
                if t_res:
                    t_text = " ".join([r[1] for r in t_res]).upper()
                    full_text += " " + t_text
                    parsed = parse_equip(full_text, is_bond_gear=is_bond_gear)
                if parsed["tier"] == 0:
                    t_res_raw, _ = en(t_scaled)
                    if t_res_raw:
                        t_text_raw = " ".join([r[1] for r in t_res_raw]).upper()
                        full_text += " " + t_text_raw
                        parsed = parse_equip(full_text, is_bond_gear=is_bond_gear)

        return full_text
    except Exception as e:
        log_debug(f"OCR Exception: {e}")

    return ""


def extract_bond_text(
    img: np.ndarray,
    bbox: tuple[int, int, int, int],
    ko_reader: Optional[RapidOCR] = None,
    en_reader: Optional[RapidOCR] = None,
) -> str:
    ko, en = _resolve_readers(ko_reader, en_reader)
    x, y, w, h = bbox
    crop = img[y : y + h, x : x + w]
    if crop.size == 0:
        return ""

    scaled = cv2.resize(crop, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)
    thresh_bgr = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

    try:
        res, _ = en.text_recognizer([thresh_bgr])
        if res and len(res) > 0:
            text = "".join(res[0][0]).replace(" ", "")
            text = "".join(c for c in text if c in "0123456789LvlIOoSs")
            if parse_number(text):
                return text
    except Exception:
        pass

    ch, cw = thresh.shape
    center = thresh[int(ch * 0.2) : int(ch * 0.8), int(cw * 0.15) : int(cw * 0.85)]
    if center.size > 0:
        center_inv = cv2.bitwise_not(center)
        padded = np.full((center.shape[0] + 40, center.shape[1] + 40), 255, dtype=np.uint8)
        ch_c, cw_c = center_inv.shape
        padded[20 : 20 + ch_c, 20 : 20 + cw_c] = center_inv

        try:
            res, _ = en.text_recognizer([cv2.cvtColor(padded, cv2.COLOR_GRAY2BGR)])
            if res and len(res) > 0:
                t = "".join(res[0][0]).replace(" ", "")
                t = "".join(c for c in t if c in "0123456789LvlIOoSs")
                if parse_number(t):
                    return t
        except Exception:
            pass

    return extract_text(img, bbox, allowlist="0123456789LvlIOoSs", scale=2, ko_reader=ko, en_reader=en)


def parse_number(text: str) -> Optional[int]:
    if not text:
        return None

    text = (
        text.replace("l", "1")
        .replace("I", "1")
        .replace("O", "0")
        .replace("o", "0")
        .replace("S", "5")
        .replace("s", "5")
        .replace("z", "2")
        .replace("Z", "2")
        .replace("B", "8")
        .replace("b", "8")
        .replace("q", "9")
        .replace("g", "9")
    )

    numbers = re.findall(r"\d+", text)
    if numbers:
        num = "".join(numbers)
        return int(num)
    return None


def parse_stat_with_ability(text: str) -> tuple[int, int]:
    stat = 0
    ability = 0
    if not text:
        return stat, ability

    text = text.replace("S", "5").replace("s", "5").replace("O", "0").replace("o", "0").replace("z", "2").replace("Z", "2")

    match = re.search(r"(?:[LlI][VvYy]*|1[VvYy]+|[Vv])[:.]?\s*(\d+)", text)
    if match:
        ability = int(match.group(1))
        if ability > 25:
            ability = 25
        text = text[: match.start()]
    stat_val = parse_number(text)
    if stat_val:
        stat = stat_val
    return stat, ability


def parse_skill(text: str, is_ex: bool = False) -> str:
    if not text:
        return "1"

    text_upper = text.upper()
    if "M" in text_upper or "X" in text_upper or "MAX" in text_upper:
        return "MAX"

    text_clean = re.sub(r"[Ll][VvOo0]?", "", text)

    num = parse_number(text_clean)
    if num is None or num == 0:
        return "1"

    max_val = 5 if is_ex else 10

    while num > max_val:
        num_str = str(num)
        if len(num_str) >= 2 and (num_str[-1] == "1" or num_str[-1] == "7"):
            num = int(num_str[:-1])
        else:
            num = max_val
            break

    if num > max_val:
        num = max_val

    return str(max(1, num))


def clamp_stat(val: Optional[int], max_val: int) -> Optional[int]:
    if val is None:
        return None
    val_str = str(val)
    while len(val_str) > 0 and int(val_str) > max_val:
        if len(val_str) > 1 and val_str[0] in ("1", "7"):
            val_str = val_str[1:]
        else:
            val_str = val_str[:-1]
    return int(val_str) if val_str else 0


def parse_equip(text: str, is_bond_gear: bool = False) -> dict[str, int]:
    if not text or any(k in text.upper() for k in ("EMPTY", "MPTY", "PTY")):
        return {"tier": 0, "level": 0}

    tier = 0
    level = 0

    match_t = re.search(r"[Tt][.\s]*(10|1[Oo0]|[1-9]|[ZzIilSsBb])(?![a-zA-Z])", text)
    if match_t:
        raw_t = match_t.group(1)
        mapped_t = "".join(_DIGIT_ALIASES.get(c, c) for c in raw_t)
        if mapped_t.isdigit():
            t_val = int(mapped_t)
            if 1 <= t_val <= 10:
                tier = t_val

    match_lv = re.search(r"(?:[LlI][VvYy]*|[Vv])[^0-9a-zA-Z\s]*\s*(\d+)", text)
    if match_lv:
        level = int(match_lv.group(1))
    elif not is_bond_gear and tier > 0 and match_t:
        rem = text[: match_t.start()] + " " + text[match_t.end() :]
        nums = re.findall(r"\b\d+\b", rem)
        for n in nums:
            val = int(n)
            if 1 <= val <= 90:
                level = val
                break

    if tier == 0 and level == 0:
        return {"tier": 0, "level": 0}

    if not is_bond_gear:
        if level > 90:
            level = int(str(level)[:2])

        if tier == 0 and level > 0:
            if level <= 10:
                tier = 1
            else:
                tier = infer_tier_from_level(level)
        elif tier == 1 and level > 10:
            tier = infer_tier_from_level(level)
    else:
        if tier == 0 and level > 0:
            return {"tier": 0, "level": 0}
        level = 0

    return {"tier": tier, "level": level}


def get_calibrated_rois(img: np.ndarray, preset_name: Optional[str] = None) -> dict[str, tuple[int, int, int, int]]:
    h, w = img.shape[:2]
    base_rois = get_base_rois(size=(w, h), preset_name=preset_name)

    aspect = w / h if h > 0 else 1.7778
    if aspect < 1.8:
        return base_rois

    base_w = 2560 if (w > 2200 or h >= 1400) else 1920
    extra_w = w - base_w
    if extra_w <= 10:
        return base_rois

    scale_y = h / 1080.0
    scale_x = base_w / 1920.0

    dx_left = int(extra_w * 0.234)
    dx_stats_left = int(extra_w * 0.370)
    dx_stats_right = int(extra_w * 0.476)
    dx_right_panel = int(extra_w * 0.640)

    dy_stats = int(-25 * extra_w / 640 * scale_y)
    dy_equip = int(80 * extra_w / 640 * scale_y)
    dy_weapon = int(30 * extra_w / 640 * scale_y)

    calibrated: dict[str, tuple[int, int, int, int]] = {}
    mid_x = int(960 * scale_x)
    for key, (x, y, bw, bh) in base_rois.items():
        if x < mid_x:
            calibrated[key] = (x + dx_left, y + dy_stats, bw, bh)
        elif key in ("stat_hp", "stat_defense"):
            calibrated[key] = (x + dx_stats_left, y + dy_stats, bw, bh)
        elif key in ("stat_attack", "stat_heal"):
            calibrated[key] = (x + dx_stats_right, y + dy_stats, bw, bh)
        elif key == "weapon_level":
            calibrated[key] = (x + int(290 * extra_w / 640), y + dy_weapon, int(120 * scale_x), bh)
        elif key == "weapon_stars_area":
            calibrated[key] = (x + int(460 * extra_w / 640), y + dy_weapon, int(120 * scale_x), bh)
        elif key == "equip_1":
            calibrated[key] = (x + int(340 * extra_w / 640), y + dy_equip - int(10 * scale_y), bw, int(145 * scale_y))
        elif key == "equip_2":
            calibrated[key] = (x + int(356 * extra_w / 640), y + dy_equip - int(10 * scale_y), bw, int(145 * scale_y))
        elif key == "equip_3":
            calibrated[key] = (x + int(384 * extra_w / 640), y + dy_equip - int(10 * scale_y), bw, int(145 * scale_y))
        elif key == "equip_4":
            calibrated[key] = (x + int(420 * extra_w / 640), y + dy_equip - int(10 * scale_y), bw, int(145 * scale_y))
        else:
            calibrated[key] = (x + dx_right_panel, y, bw, bh)

    return calibrated


def preprocess_image(
    img: np.ndarray,
    ko_reader: Optional[RapidOCR] = None,
    align_cache: Optional[dict[tuple[int, int], tuple[int, int, int]]] = None,
) -> np.ndarray:
    """
    Reassemble non-standard/wide screenshots onto a 1920x1080 canvas via anchor OCR.
    Per-call isolated unless caller passes a resolution-keyed align_cache dict.
    """
    if img is None or getattr(img, "size", 0) == 0 or getattr(img, "ndim", 0) < 2:
        return img

    h, w = img.shape[:2]

    if (w, h) in ((1920, 1080), (2560, 1440)):
        return img

    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    ko, _ = _resolve_readers(ko_reader, None)
    cache_key = (w, h)

    if align_cache is not None and cache_key in align_cache:
        dx_left, dx_right, dy = align_cache[cache_key]
    else:
        dx_left, dx_right, dy = 0, 0, 0
        matched_anchor = False

        y1_l = max(0, min(700, h))
        y2_l = max(0, min(1080, h))
        x2_l = max(0, min(w // 2, w))
        left_crop = img[y1_l:y2_l, 0:x2_l]
        if left_crop.size > 0 and ko is not None:
            try:
                res, _ = ko(left_crop)
                if res:
                    for line in res:
                        bbox, text, _conf = line
                        if "STRIKER" in text or "SPECIAL" in text:
                            abs_x = bbox[0][0]
                            abs_y = bbox[0][1] + y1_l
                            dx_left = int(abs_x - 558)
                            dy = int(abs_y - 840)
                            matched_anchor = True
                            break
                        elif "FRONT" in text or "MIDDLE" in text or "BACK" in text:
                            abs_x = bbox[0][0]
                            abs_y = bbox[0][1] + y1_l
                            dx_left = int(abs_x - 75)
                            dy = int(abs_y - 1014)
                            matched_anchor = True
                            break
            except Exception:
                pass

        y1_r = max(0, min(200, h))
        y2_r = max(0, min(600, h))
        x1_r = max(0, min(w // 2, w))
        right_crop = img[y1_r:y2_r, x1_r:w]
        if right_crop.size > 0 and ko is not None:
            try:
                res, _ = ko(right_crop)
                if res:
                    for line in res:
                        bbox, text, _conf = line
                        if "치유력" in text:
                            abs_x = bbox[0][0] + x1_r
                            dx_right = int(abs_x - 1410)
                            matched_anchor = True
                            break
                        elif "방어력" in text:
                            abs_x = bbox[0][0] + x1_r
                            dx_right = int(abs_x - 1095)
                            matched_anchor = True
                            break
            except Exception:
                pass

        if dx_left == 0 and dx_right == 0 and w > 1920:
            dx_left, dx_right, dy = 150, 305, -21

        if align_cache is not None and matched_anchor and (dx_left, dx_right, dy) != (0, 0, 0):
            align_cache[cache_key] = (dx_left, dx_right, dy)
        logger.debug("[Auto-Align] Computed offsets for %sx%s: dx_left=%s, dx_right=%s, dy=%s", w, h, dx_left, dx_right, dy)

    canvas = np.zeros((1080, 1920, 3), dtype=np.uint8)

    y_c_start = max(0, -dy)
    y_c_end = min(1080, h - dy)
    y_i_start = y_c_start + dy
    y_i_end = y_c_end + dy

    x_c_left_start = max(0, -dx_left)
    x_c_left_end = min(960, w - dx_left)
    x_i_left_start = x_c_left_start + dx_left
    x_i_left_end = x_c_left_end + dx_left

    if y_c_end > y_c_start and x_c_left_end > x_c_left_start:
        canvas[y_c_start:y_c_end, x_c_left_start:x_c_left_end] = img[y_i_start:y_i_end, x_i_left_start:x_i_left_end]

    x_c_right_start = max(960, -dx_right)
    x_c_right_end = min(1920, w - dx_right)
    x_i_right_start = x_c_right_start + dx_right
    x_i_right_end = x_c_right_end + dx_right

    if y_c_end > y_c_start and x_c_right_end > x_c_right_start:
        canvas[y_c_start:y_c_end, x_c_right_start:x_c_right_end] = img[y_i_start:y_i_end, x_i_right_start:x_i_right_end]

    return canvas


def resolve_target_preset(w: int, h: int, svc: CoordinateService, preset_name: Optional[str] = None) -> str:
    if preset_name is not None and preset_name in svc.presets:
        return preset_name
    if (w, h) == (1920, 1080) and "FHD" in svc.presets:
        return "FHD"
    if (w, h) == (2560, 1440) and "QHD" in svc.presets:
        return "QHD"
    return svc.active_preset_name


def extract_screenshot_data(
    img_path_or_mat: np.ndarray | str | Path,
    preset_name: Optional[str] = None,
    student_names: Optional[Sequence[str]] = None,
    ko_reader: Optional[RapidOCR] = None,
    en_reader: Optional[RapidOCR] = None,
    include_meta: bool = False,
    skip_scene_check: bool = False,
    skip_equip_slots: Optional[set[int]] = None,
) -> Optional[dict[str, Any]]:
    svc = CoordinateService.instance()
    ko, en = _resolve_readers(ko_reader, en_reader)

    if isinstance(img_path_or_mat, (str, Path)):
        raw_bytes = Path(img_path_or_mat).read_bytes()
        img = cv2.imdecode(np.frombuffer(raw_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    else:
        img = img_path_or_mat

    if img is None or getattr(img, "size", 0) == 0:
        logger.warning("Failed to load image.")
        return None

    h, w = img.shape[:2]
    target_preset = resolve_target_preset(w, h, svc, preset_name=preset_name)

    if not skip_scene_check:
        try:
            layout = equipment_reader.UiLayout.load(svc, preset_name=target_preset)
            screen_reader = equipment_reader.EquipmentScreenReader(
                layout, equipment_reader.OcrEngine(ko, en)
            )
            if screen_reader.is_equipment_menu_open(img):
                modal_data: dict[str, Any] = {
                    "scene": "equipment_modal",
                    "equipment": {
                        "slot1": {"tier": 0, "level": 0},
                        "slot2": {"tier": 0, "level": 0},
                        "slot3": {"tier": 0, "level": 0},
                        "slot4": {"tier": 0, "level": 0},
                    },
                }
                active_slot = screen_reader.detect_active_modal_slot(img)
                for slot_idx in [1, 2, 3]:
                    try:
                        if slot_idx == active_slot:
                            reading = screen_reader.read_slot_tier(img, slot_idx)
                        else:
                            reading = screen_reader.read_slot_from_rail(img, slot_idx)
                        modal_data["equipment"][f"slot{slot_idx}"] = {
                            "tier": reading.tier or 0,
                            "level": reading.level or 0,
                        }
                    except Exception as e:
                        log_debug(f"Modal slot {slot_idx} read error: {e}")
                return modal_data

            top_crop = img[int(h * 0.12) : int(h * 0.25), int(w * 0.35) : int(w * 0.65)]
            top_res, _ = ko(top_crop) if ko else (None, None)
            if top_res and any("애용품" in r[1] for r in top_res):
                popup_data: dict[str, Any] = {
                    "scene": "favorite_popup",
                    "equipment": {
                        "slot1": {"tier": 0, "level": 0},
                        "slot2": {"tier": 0, "level": 0},
                        "slot3": {"tier": 0, "level": 0},
                        "slot4": {"tier": 0, "level": 0},
                    },
                }
                try:
                    fav_reading = screen_reader.read_favorite_tier(img)
                    popup_data["equipment"]["slot4"] = {
                        "tier": fav_reading.tier or 0,
                        "level": fav_reading.level or 0,
                    }
                except Exception as e:
                    log_debug(f"Favorite popup read error: {e}")
                return popup_data
        except Exception as e:
            log_debug(f"Modal/popup scene detection error: {e}")

    if (w, h) not in ((2560, 1440), (1920, 1080)):
        if h != 1080 and h != 1440:
            target_h = 1440 if target_preset == "QHD" else 1080
            new_w = int(w * target_h / h)
            img = cv2.resize(img, (new_w, target_h), interpolation=cv2.INTER_CUBIC)
        img = preprocess_image(img, ko_reader=ko, align_cache=None)
        h, w = img.shape[:2]

    rois = get_calibrated_rois(img, preset_name=target_preset)

    data: dict[str, Any] = {}

    raw_name = extract_text(img, rois["studentName"], scale=3, is_name=True, ko_reader=ko, en_reader=en)
    matched_name, _, match_score = match_student_name_with_score(raw_name, student_names=student_names)
    data["studentName"] = matched_name

    if data["studentName"] == "케이":
        atk_type_crop = img[
            rois["studentName"][1] + 60 : rois["studentName"][1] + 110,
            rois["studentName"][0] + 215 : rois["studentName"][0] + 315,
        ]
        if atk_type_crop.shape[0] > 0 and atk_type_crop.shape[1] > 0:
            hsv_crop = cv2.cvtColor(atk_type_crop, cv2.COLOR_BGR2HSV)
            purple_mask = cv2.inRange(hsv_crop, np.array([125, 50, 50]), np.array([165, 255, 255]))
            if cv2.countNonZero(purple_mask) > 500:
                data["studentName"] = "레이"

    num_allowlist = "0123456789LvlIOoSszZBbqg"

    raw_bond = parse_number(extract_bond_text(img, rois["bondRank"], ko_reader=ko, en_reader=en))
    if raw_bond is not None and raw_bond > 100:
        br_str = str(raw_bond)
        raw_bond = int(br_str[:2])
        log_debug(f"[Validation] bondRank {br_str} -> {raw_bond} 클램핑 (2자리 초과)")
    if raw_bond is not None and raw_bond <= 0:
        raw_bond = None
    data["bondRank"] = raw_bond

    lvl_val = parse_number(extract_text(img, rois["currentLevel"], allowlist=num_allowlist, scale=2, ko_reader=ko, en_reader=en))
    if lvl_val is not None:
        lvl_str = str(lvl_val)
        if len(lvl_str) > 2:
            lvl_val = int(lvl_str[:2])
            log_debug(f"[Validation] currentLevel truncated {lvl_str} -> {lvl_val}")

    data["currentLevel"] = lvl_val
    if data["currentLevel"] is None or data["currentLevel"] == 0:
        data["currentLevel"] = 1
        log_debug("[Warning] currentLevel OCR failed or read as 0, defaulting to 1")

    data["skills"] = {
        "ex": parse_skill(extract_text(img, rois["skill_ex"], ko_reader=ko, en_reader=en), is_ex=True),
        "basic": parse_skill(extract_text(img, rois["skill_basic"], ko_reader=ko, en_reader=en), is_ex=False),
        "enh": parse_skill(extract_text(img, rois["skill_enh"], ko_reader=ko, en_reader=en), is_ex=False),
        "sub": parse_skill(extract_text(img, rois["skill_sub"], ko_reader=ko, en_reader=en), is_ex=False),
    }

    data["weapon"] = {
        "level": parse_number(extract_text(img, rois["weapon_level"], allowlist=num_allowlist, scale=2, ko_reader=ko, en_reader=en)),
    }
    if data["weapon"]["level"] is None:
        data["weapon"]["level"] = 0

    skipped = skip_equip_slots or set()
    t1_text = "" if 1 in skipped else extract_equip_text(img, rois["equip_1"], rois.get("equip_1_tier", rois["equip_1"]), en_reader=en)
    t2_text = "" if 2 in skipped else extract_equip_text(img, rois["equip_2"], rois.get("equip_2_tier", rois["equip_2"]), en_reader=en)
    t3_text = "" if 3 in skipped else extract_equip_text(img, rois["equip_3"], rois.get("equip_3_tier", rois["equip_3"]), en_reader=en)
    t4_text = "" if 4 in skipped else extract_equip_text(img, rois["equip_4"], rois.get("equip_4_tier", rois["equip_4"]), is_bond_gear=True, en_reader=en)

    data["equipment"] = {
        "slot1": parse_equip(t1_text),
        "slot2": parse_equip(t2_text),
        "slot3": parse_equip(t3_text),
        "slot4": parse_equip(t4_text, is_bond_gear=True),
    }

    hp_stat, hp_ability = parse_stat_with_ability(extract_text(img, rois["stat_hp"], allowlist=num_allowlist, scale=2, min_length=3, ko_reader=ko, en_reader=en))
    atk_stat, atk_ability = parse_stat_with_ability(extract_text(img, rois["stat_attack"], allowlist=num_allowlist, scale=2, min_length=3, ko_reader=ko, en_reader=en))
    heal_stat, heal_ability = parse_stat_with_ability(extract_text(img, rois["stat_heal"], allowlist=num_allowlist, scale=2, min_length=3, ko_reader=ko, en_reader=en))

    data["stats"] = {
        "maxHP": clamp_stat(hp_stat, 200000),
        "hpAbility": hp_ability,
        "attackPower": clamp_stat(atk_stat, 25000),
        "atkAbility": atk_ability,
        "defensePower": clamp_stat(parse_number(extract_text(img, rois["stat_defense"], allowlist=num_allowlist, scale=2, ko_reader=ko, en_reader=en)), 10000),
        "healPower": clamp_stat(heal_stat, 35000),
        "healAbility": heal_ability,
    }

    stars_x, stars_y, stars_w, stars_h = rois["stars_area"]
    stars_crop = img[stars_y : stars_y + stars_h, stars_x : stars_x + stars_w]
    data["currentStar"] = count_stars(stars_crop, is_weapon=False)

    w_stars_x, w_stars_y, w_stars_w, w_stars_h = rois["weapon_stars_area"]
    w_stars_crop = img[w_stars_y : w_stars_y + w_stars_h, w_stars_x : w_stars_x + w_stars_w]
    data["weapon"]["star"] = count_stars(w_stars_crop, is_weapon=True)

    validate_extracted_data(data)

    if include_meta:
        data["_meta"] = {
            "rawName": raw_name,
            "matchScore": match_score,
            "preset": target_preset,
        }

    return data


WEAPON_MAX_LEVEL_BY_STAR = {0: 0, 1: 30, 2: 40, 3: 50, 4: 60}


def validate_extracted_data(data: dict[str, Any]) -> None:
    current_star = data.get("currentStar") or 0
    if current_star == 1:
        if "skills" in data:
            data["skills"]["enh"] = 1
            data["skills"]["sub"] = 1
            log_debug("[Validation] 1성 강제 스킬 레벨 조정 (enh=1, sub=1)")
    elif current_star == 2:
        if "skills" in data:
            data["skills"]["sub"] = 1
            log_debug("[Validation] 2성 강제 스킬 레벨 조정 (sub=1)")

    if (data.get("currentLevel") or 0) > 90:
        log_debug(f"[Validation] currentLevel {data['currentLevel']} -> 90 클램핑 (name={data.get('studentName')})")
        data["currentLevel"] = 90

    if data.get("currentLevel") == 9:
        skills = data.get("skills", {})
        has_max_skill = any(v == "MAX" for v in skills.values())
        has_high_bond = (data.get("bondRank") or 0) >= 15
        has_high_star = (data.get("currentStar") or 0) >= 4
        has_weapon = (data.get("weapon", {}).get("star") or 0) >= 2

        if has_max_skill or has_high_bond or has_high_star or has_weapon:
            log_debug(
                f"[Validation] currentLevel 9 -> 90 보정 (name={data.get('studentName')}, "
                f"bond={data.get('bondRank')}, star={data.get('currentStar')}, has_max_skill={has_max_skill})"
            )
            data["currentLevel"] = 90

    weapon = data.get("weapon", {})
    w_star = weapon.get("star") or 0
    w_level = weapon.get("level")

    max_weapon_level = WEAPON_MAX_LEVEL_BY_STAR.get(w_star, 50)

    if w_level is not None and w_level > max_weapon_level:
        log_debug(f"[Validation] weapon level {w_level} -> {max_weapon_level} 클램핑 (star={w_star}, name={data.get('studentName')})")
        weapon["level"] = max_weapon_level

    if w_star > 0 and w_level is None:
        log_debug(f"[Validation] weapon level None -> 1 (star={w_star}, name={data.get('studentName')})")
        weapon["level"] = 1

    needs_review = False
    lvl = data.get("currentLevel") or 1
    hp = data.get("stats", {}).get("maxHP") or 0
    if lvl > 90:
        needs_review = True
    if hp < 1000:
        needs_review = True
    if not data.get("bondRank") or data.get("bondRank") < 1:
        needs_review = True
    data["needs_review"] = needs_review
