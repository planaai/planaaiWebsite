from __future__ import annotations

from typing import Any, Optional


def _safe_int(val: Any, default: int = 0) -> int:
    if val is None or isinstance(val, bool):
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _clamp_int(val: Any, min_val: int, max_val: int) -> tuple[int, bool]:
    try:
        num = int(val)
    except (TypeError, ValueError):
        return min_val, True
    if num < min_val:
        return min_val, True
    if num > max_val:
        return max_val, True
    return num, False


def _parse_skill_level(raw: Any, max_val: int) -> tuple[int, bool]:
    if isinstance(raw, str) and raw.strip().upper() in ("MAX", "M"):
        return max_val, False
    return _clamp_int(raw, 1, max_val)


def to_contract_response(
    main_raw: dict[str, Any],
    *,
    equip_modals: Optional[dict[int, tuple[str, dict[str, Any]]]] = None,
    favorite_popup: Optional[dict[str, Any]] = None,
    preset: str = "QHD",
    scenes: Optional[dict[str, str]] = None,
    raw_name: str = "",
    match_score: float = 0.0,
    elapsed_ms: float = 0.0,
    engine_id: str = "plana-ocr@1.0.0",
) -> dict[str, Any]:
    """Single transformation boundary from vendor raw outputs to recognize.schema.json."""
    needs_review: list[str] = []
    field_sources: dict[str, str] = {}

    matched_name = str(main_raw.get("studentName") or "").strip()
    clamped_score = max(0.0, min(1.0, float(match_score)))
    if not matched_name:
        needs_review.append("studentName")
        student_name = raw_name.strip()
    else:
        student_name = matched_name
        if clamped_score < 0.85:
            needs_review.append("studentName")

    level, level_flagged = _clamp_int(main_raw.get("currentLevel"), 1, 90)
    if level_flagged:
        needs_review.append("level")

    star_grade, star_flagged = _clamp_int(main_raw.get("currentStar"), 1, 5)
    if star_flagged:
        needs_review.append("starGrade")

    raw_bond = main_raw.get("bondRank")
    if raw_bond is None:
        bond_rank: Optional[int] = None
        needs_review.append("bondRank")
    else:
        try:
            bond_int = int(raw_bond)
        except (TypeError, ValueError):
            bond_rank = None
            needs_review.append("bondRank")
        else:
            if bond_int < 1:
                bond_rank = None
                needs_review.append("bondRank")
            elif bond_int > 100:
                bond_rank = 100
                needs_review.append("bondRank")
            else:
                bond_rank = bond_int

    raw_skills = main_raw.get("skills") or {}
    ex_lvl, ex_flag = _parse_skill_level(raw_skills.get("ex"), 5)
    norm_lvl, norm_flag = _parse_skill_level(raw_skills.get("basic"), 10)
    pas_lvl, pas_flag = _parse_skill_level(raw_skills.get("enh"), 10)
    sub_lvl, sub_flag = _parse_skill_level(raw_skills.get("sub"), 10)
    for flag, path in (
        (ex_flag, "skills.ex"),
        (norm_flag, "skills.normal"),
        (pas_flag, "skills.passive"),
        (sub_flag, "skills.sub"),
    ):
        if flag:
            needs_review.append(path)

    skills = {
        "ex": ex_lvl,
        "normal": norm_lvl,
        "passive": pas_lvl,
        "sub": sub_lvl,
    }

    main_eq = main_raw.get("equipment") or {}
    modals = equip_modals or {}
    equipments: list[dict[str, Any]] = []
    for slot_idx in (1, 2, 3):
        if slot_idx in modals:
            src_slot, modal_entry = modals[slot_idx]
            tier_val = _safe_int(modal_entry.get("tier"), 0)
            lvl_parsed = _safe_int(modal_entry.get("level"), 0)
            lvl_val = lvl_parsed if lvl_parsed >= 1 else None
            field_sources[f"equipments[{slot_idx - 1}]"] = src_slot
            if tier_val <= 0:
                equipments.append({"slot": slot_idx, "unequipped": True, "tier": None, "level": None})
                needs_review.append(f"equipments[{slot_idx - 1}]")
            else:
                equipments.append({"slot": slot_idx, "unequipped": False, "tier": tier_val, "level": lvl_val})
                if lvl_val is None:
                    needs_review.append(f"equipments[{slot_idx - 1}].level")
        else:
            slot_entry = main_eq.get(f"slot{slot_idx}") or {}
            tier_val = _safe_int(slot_entry.get("tier"), 0)
            lvl_raw = _safe_int(slot_entry.get("level"), 0)
            if tier_val <= 0:
                equipments.append({"slot": slot_idx, "unequipped": True, "tier": None, "level": None})
            else:
                lvl_val = lvl_raw if lvl_raw >= 1 else None
                equipments.append({"slot": slot_idx, "unequipped": False, "tier": tier_val, "level": lvl_val})
                field_sources[f"equipments[{slot_idx - 1}]"] = "main"
                if lvl_val is None:
                    needs_review.append(f"equipments[{slot_idx - 1}].level")

    if favorite_popup is not None:
        field_sources["favoriteItem"] = "favorite"
        fav_tier_raw = _safe_int(favorite_popup.get("tier"), 0)
        if fav_tier_raw <= 0:
            favorite_item = {"unequipped": True, "tier": None}
            needs_review.append("favoriteItem")
        else:
            fav_tier, fav_flag = _clamp_int(fav_tier_raw, 1, 2)
            favorite_item = {"unequipped": False, "tier": fav_tier}
            if fav_flag:
                needs_review.append("favoriteItem.tier")
    else:
        s4 = main_eq.get("slot4") or {}
        fav_tier_raw = _safe_int(s4.get("tier"), 0)
        if fav_tier_raw <= 0:
            favorite_item = {"unequipped": True, "tier": None}
        else:
            fav_tier, fav_flag = _clamp_int(fav_tier_raw, 1, 2)
            favorite_item = {"unequipped": False, "tier": fav_tier}
            field_sources["favoriteItem"] = "main"
            if fav_flag:
                needs_review.append("favoriteItem.tier")

    raw_weapon = main_raw.get("weapon") or {}
    w_star_raw = _safe_int(raw_weapon.get("star"), 0)
    w_lvl_raw = _safe_int(raw_weapon.get("level"), 0)
    if w_star_raw <= 0 or w_lvl_raw <= 0:
        weapon = {"unequipped": True, "starGrade": None, "level": None}
        if w_star_raw > 0 and w_lvl_raw <= 0:
            needs_review.append("weapon")
    else:
        w_star, w_star_flag = _clamp_int(w_star_raw, 1, 4)
        w_lvl, w_lvl_flag = _clamp_int(w_lvl_raw, 1, 60)
        weapon = {"unequipped": False, "starGrade": w_star, "level": w_lvl}
        if w_star_flag:
            needs_review.append("weapon.starGrade")
        if w_lvl_flag:
            needs_review.append("weapon.level")

    raw_stats = main_raw.get("stats") or {}
    stats: dict[str, dict[str, Optional[int]]] = {}
    for out_key, val_key, rel_key in (
        ("hp", "maxHP", "hpAbility"),
        ("atk", "attackPower", "atkAbility"),
        ("def", "defensePower", None),
        ("heal", "healPower", "healAbility"),
    ):
        raw_val = raw_stats.get(val_key)
        val: Optional[int]
        if raw_val is None:
            val = None
            needs_review.append(f"stats.{out_key}.value")
        else:
            try:
                parsed_val = int(raw_val)
            except (TypeError, ValueError):
                val = None
                needs_review.append(f"stats.{out_key}.value")
            else:
                if parsed_val < 0:
                    val = None
                    needs_review.append(f"stats.{out_key}.value")
                else:
                    val = parsed_val
                    if out_key == "hp" and val < 1000:
                        needs_review.append("stats.hp.value")

        rel_val: Optional[int] = None
        if rel_key:
            raw_rel = raw_stats.get(rel_key)
            if raw_rel is not None:
                try:
                    rel_int = int(raw_rel)
                except (TypeError, ValueError):
                    rel_val = None
                else:
                    if rel_int >= 1:
                        rel_val, rel_flag = _clamp_int(rel_int, 1, 25)
                        if rel_flag:
                            needs_review.append(f"stats.{out_key}.releaseLevel")

        stats[out_key] = {"value": val, "releaseLevel": rel_val}

    deduped_review = list(dict.fromkeys(needs_review))

    return {
        "data": {
            "studentName": student_name,
            "level": level,
            "starGrade": star_grade,
            "bondRank": bond_rank,
            "skills": skills,
            "equipments": equipments,
            "favoriteItem": favorite_item,
            "weapon": weapon,
            "stats": stats,
        },
        "meta": {
            "engine": engine_id,
            "preset": preset or "QHD",
            "scenes": scenes or {"main": "student_info"},
            "fieldSources": field_sources,
            "needsReview": deduped_review,
            "studentMatch": {
                "raw": raw_name,
                "score": round(clamped_score, 4),
            },
            "elapsedMs": round(max(0.0, float(elapsed_ms)), 2),
        },
    }
