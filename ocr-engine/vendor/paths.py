# Ported from planaai/screenshotMacro@54b3994 (GPL-3.0)
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT_DIR / "config"
MODELS_DIR = ROOT_DIR / "models"
STUDENTS_PATH = ROOT_DIR / "students.json"


def get_bundle_dir() -> Path:
    """Return the base directory for bundled read-only files (ocr-engine/)."""
    return ROOT_DIR
