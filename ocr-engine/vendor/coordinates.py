# Ported from planaai/screenshotMacro@54b3994 (GPL-3.0)
from __future__ import annotations

import json
import logging
import threading
from dataclasses import dataclass
from typing import Any

from vendor.paths import CONFIG_DIR

logger = logging.getLogger("ocr_engine.coordinates")


@dataclass
class Preset:
    name: str
    values: dict[str, Any]


class CoordinateService:
    """Read-only coordinate preset service backed by ocr-engine/config/."""

    _instance: "CoordinateService | None" = None
    _lock = threading.Lock()

    @classmethod
    def instance(cls) -> "CoordinateService":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def __init__(self) -> None:
        self.schema: dict[str, Any] = {}
        self.presets: dict[str, Preset] = {}
        self.active_preset_name = "QHD"

        self.load_schema()
        self.load_all_presets()

    def load_schema(self) -> None:
        path = CONFIG_DIR / "coord_schema.json"
        try:
            with path.open("r", encoding="utf-8") as f:
                self.schema = json.load(f)
        except Exception as e:
            logger.error("Failed to load coord_schema.json: %s", e)
            self.schema = {"items": {}}

    def load_all_presets(self) -> None:
        self.presets.clear()
        system_presets_dir = CONFIG_DIR / "presets"

        for sys_name in ("QHD", "FHD"):
            sys_path = system_presets_dir / f"{sys_name}.json"
            if sys_path.exists():
                try:
                    with sys_path.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                    self.presets[sys_name] = Preset(sys_name, data.get("values", {}))
                except Exception as e:
                    logger.error("Failed to load system preset %s.json: %s", sys_name, e)
                    self.presets[sys_name] = Preset(sys_name, {})
            else:
                self.presets[sys_name] = Preset(sys_name, {})

        if system_presets_dir.exists():
            for path in sorted(system_presets_dir.glob("*.json")):
                if path.name in ("default.json", "QHD.json", "FHD.json"):
                    continue
                try:
                    with path.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                    name = data.get("name", path.stem)
                    base_name = data.get("base", "QHD")
                    if base_name == "default" or base_name not in self.presets:
                        base_name = "QHD"
                    merged_values = dict(self.presets.get(base_name, Preset(base_name, {})).values)
                    merged_values.update(data.get("values", {}))
                    self.presets[name] = Preset(name, merged_values)
                except Exception as e:
                    logger.error("Failed to load system preset %s: %s", path.name, e)

    def active_preset(self) -> Preset:
        return self.presets.get(self.active_preset_name, self.presets.get("QHD", Preset("QHD", {})))

    def region(self, key: str) -> tuple[float, float, float, float]:
        val = self.active_preset().values.get(key, [0, 0, 0, 0])
        if isinstance(val, dict):
            return (val.get("x", 0), val.get("y", 0), val.get("w", 0), val.get("h", 0))
        return tuple(val)

    def region_px(self, key: str, size: tuple[int, int] = (2560, 1440)) -> tuple[int, int, int, int]:
        r = self.region(key)
        return (int(r[0] * size[0]), int(r[1] * size[1]), int(r[2] * size[0]), int(r[3] * size[1]))

    def point(self, key: str) -> tuple[float, float]:
        val = self.active_preset().values.get(key, [0, 0])
        return tuple(val)
