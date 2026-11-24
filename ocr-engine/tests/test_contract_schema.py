from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft7Validator

from app.adapter import to_contract_response

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "contract" / "recognize.schema.json"
MOCKS_DIR = ROOT / "contract" / "mocks"


def _load_validator() -> Draft7Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft7Validator.check_schema(schema)
    return Draft7Validator(schema)


def test_mocks_match_frozen_schema() -> None:
    validator = _load_validator()
    for name in ("success_200.json", "needs_review_200.json", "scene_mismatch_422.json"):
        payload = json.loads((MOCKS_DIR / name).read_text(encoding="utf-8"))
        errors = list(validator.iter_errors(payload))
        assert not errors, f"{name} schema errors: {errors}"


def test_synthetic_error_payloads_match_schema() -> None:
    validator = _load_validator()
    for payload in (
        {"code": "MISSING_MAIN", "message": "Required 'main' screenshot slot is missing."},
        {
            "code": "SLOT_DUPLICATE",
            "message": "Duplicate modal slot.",
            "detail": {"slot": "equip2", "activeSlot": 1, "conflictingWith": "equip1"},
        },
    ):
        errors = list(validator.iter_errors(payload))
        assert not errors, f"Synthetic error schema errors: {errors}"


def test_adapter_invariants_and_overrides() -> None:
    validator = _load_validator()
    raw = {
        "studentName": "",
        "currentLevel": 90,
        "currentStar": 5,
        "bondRank": None,
        "skills": {"ex": "MAX", "basic": "MAX", "enh": "7", "sub": "MAX"},
        "weapon": {"star": 0, "level": 0},
        "equipment": {
            "slot1": {"tier": 8, "level": 0},
            "slot2": {"tier": 9, "level": 0},
            "slot3": {"tier": 0, "level": 0},
            "slot4": {"tier": 1, "level": 0},
        },
        "stats": {
            "maxHP": 50000,
            "hpAbility": 0,
            "attackPower": 5000,
            "atkAbility": 25,
            "defensePower": None,
            "healPower": 4000,
            "healAbility": 0,
        },
    }
    res = to_contract_response(
        raw,
        equip_modals={1: ("equip1", {"tier": 9, "level": 65})},
        favorite_popup={"tier": 2},
        preset="QHD",
        scenes={"main": "student_info", "equip1": "equipment_modal", "favorite": "favorite_popup"},
        raw_name="아루",
        match_score=0.0,
        elapsed_ms=123.4,
    )
    errors = list(validator.iter_errors(res))
    assert not errors, f"Adapter output failed schema: {errors}"

    data = res["data"]
    assert "bondRank" in data and data["bondRank"] is None
    assert data["studentName"] == "아루"
    assert data["skills"] == {"ex": 5, "normal": 10, "passive": 7, "sub": 10}
    assert data["weapon"] == {"unequipped": True, "starGrade": None, "level": None}
    assert data["equipments"][0] == {"slot": 1, "unequipped": False, "tier": 9, "level": 65}
    assert data["equipments"][1] == {"slot": 2, "unequipped": False, "tier": 9, "level": None}
    assert data["equipments"][2] == {"slot": 3, "unequipped": True, "tier": None, "level": None}
    assert data["favoriteItem"] == {"unequipped": False, "tier": 2}
    assert data["stats"]["hp"]["releaseLevel"] is None
    assert data["stats"]["atk"]["releaseLevel"] == 25
    assert data["stats"]["def"]["value"] is None
    assert data["stats"]["def"]["releaseLevel"] is None

    assert res["meta"]["fieldSources"] == {
        "equipments[0]": "equip1",
        "equipments[1]": "main",
        "favoriteItem": "favorite",
    }
    assert "studentName" in res["meta"]["needsReview"]
    assert "bondRank" in res["meta"]["needsReview"]
    assert "equipments[1].level" in res["meta"]["needsReview"]
    assert "stats.def.value" in res["meta"]["needsReview"]
    assert len(res["meta"]["needsReview"]) == len(set(res["meta"]["needsReview"]))


def test_adapter_handles_non_numeric_modal_and_weapon_values() -> None:
    validator = _load_validator()
    raw = {
        "studentName": "아루",
        "currentLevel": 1,
        "currentStar": 1,
        "bondRank": 1,
        "skills": {"ex": "1", "basic": "1", "enh": "1", "sub": "1"},
        "weapon": {"star": "N/A", "level": "MAX"},
        "equipment": {"slot1": {"tier": "bad", "level": "MAX"}, "slot4": {"tier": "invalid"}},
        "stats": {"maxHP": 2200, "attackPower": 250, "defensePower": 50, "healPower": 400},
    }
    res = to_contract_response(
        raw,
        equip_modals={1: ("equip1", {"tier": "9", "level": "MAX"})},
        favorite_popup={"tier": "bad"},
    )
    assert not list(validator.iter_errors(res))
    assert res["data"]["equipments"][0] == {"slot": 1, "unequipped": False, "tier": 9, "level": None}
    assert "equipments[0].level" in res["meta"]["needsReview"]
    assert res["data"]["favoriteItem"] == {"unequipped": True, "tier": None}
    assert res["data"]["weapon"] == {"unequipped": True, "starGrade": None, "level": None}
