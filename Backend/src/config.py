import os
from dataclasses import dataclass, field
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _origins() -> list[str]:
    value = os.getenv("CORS_ORIGINS")
    if value:
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]


def _path(name: str, default: Path) -> Path:
    return Path(os.getenv(name, str(default)))


@dataclass(frozen=True)
class Settings:
    backend_dir: Path = field(default_factory=lambda: _path("BACKEND_DIR", BACKEND_DIR))
    data_path: Path = field(default_factory=lambda: _path("BLOOD_BANK_DATA_PATH", BACKEND_DIR / "data" / "raw" / "blood_bank_data.csv"))
    inventory_path: Path = field(default_factory=lambda: _path("INVENTORY_PATH", BACKEND_DIR / "data" / "processed" / "inventory.json"))
    demand_model_path: Path = field(default_factory=lambda: _path("DEMAND_MODEL_PATH", BACKEND_DIR / "models" / "demand_xgb_model.pkl"))
    shortage_model_path: Path = field(default_factory=lambda: _path("SHORTAGE_MODEL_PATH", BACKEND_DIR / "models" / "shortage_xgb_model.pkl"))
    label_encoder_path: Path = field(default_factory=lambda: _path("LABEL_ENCODER_PATH", BACKEND_DIR / "models" / "shortage_label_encoder.pkl"))
    cors_origins: tuple[str, ...] = field(default_factory=lambda: tuple(_origins()))


settings = Settings()
