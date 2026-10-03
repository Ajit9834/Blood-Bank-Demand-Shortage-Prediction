import json
from datetime import datetime, timezone
from functools import lru_cache
from threading import RLock

import pandas as pd

from api.schemas.operations import (
    BloodGroup,
    InventoryCreate,
    InventoryRecord,
    InventoryUpdate,
    RiskLevel,
)
from src.config import settings


DATA_PATH = settings.data_path
INVENTORY_PATH = settings.inventory_path
INVENTORY_LOCK = RLock()
INVENTORY_CACHE: list[dict] | None = None


@lru_cache(maxsize=1)
def _load_source_data() -> pd.DataFrame:
    data = pd.read_csv(DATA_PATH)
    data["date"] = pd.to_datetime(data["date"])
    return data.sort_values("date")


def _risk(value: str) -> RiskLevel:
    return RiskLevel(value)


def _seed_inventory() -> list[dict]:
    data = _load_source_data()
    records: list[dict] = []
    for group in BloodGroup:
        group_data = data[data["blood_group"] == group.value]
        latest = group_data.iloc[-1]
        previous = group_data.iloc[-2] if len(group_data) > 1 else latest
        usage = float(latest["average_daily_usage"])
        records.append(
            {
                "blood_group": group.value,
                "current_blood_stock": int(latest["current_blood_stock"]),
                "incoming_blood_units": int(latest["incoming_blood_units"]),
                "average_daily_usage": usage,
                "available_units": int(latest["current_blood_stock"] + latest["incoming_blood_units"]),
                "projected_demand": float(latest["future_demand"]),
                "days_of_stock_remaining": round(float(latest["current_blood_stock"] / usage), 2) if usage else 0,
                "shortage_risk": str(latest["shortage_risk"]),
                "stock_change": int(latest["current_blood_stock"] - previous["current_blood_stock"]),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    return records


def _read_records() -> list[dict]:
    global INVENTORY_CACHE
    with INVENTORY_LOCK:
        INVENTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
        if INVENTORY_CACHE is None:
            if not INVENTORY_PATH.exists():
                _write_records(_seed_inventory())
            else:
                INVENTORY_CACHE = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
        return [record.copy() for record in INVENTORY_CACHE]


def _write_records(records: list[dict]) -> None:
    global INVENTORY_CACHE
    INVENTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = INVENTORY_PATH.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    temporary_path.replace(INVENTORY_PATH)
    INVENTORY_CACHE = [record.copy() for record in records]


def _recalculate(record: dict) -> dict:
    usage = float(record["average_daily_usage"])
    stock = int(record["current_blood_stock"])
    incoming = int(record["incoming_blood_units"])
    demand = float(record["projected_demand"])
    coverage = round(stock / usage, 2) if usage else 0
    gap = stock + incoming - demand
    risk = "High" if gap < 0 else "Medium" if coverage < 7 else "Low"
    record.update(
        {
            "available_units": stock + incoming,
            "days_of_stock_remaining": coverage,
            "shortage_risk": risk,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return record


def list_inventory() -> list[InventoryRecord]:
    return [InventoryRecord.model_validate(_recalculate(record)) for record in _read_records()]


def get_inventory(blood_group: BloodGroup) -> InventoryRecord | None:
    for record in list_inventory():
        if record.blood_group == blood_group:
            return record
    return None


def create_inventory(payload: InventoryCreate) -> InventoryRecord:
    with INVENTORY_LOCK:
        records = _read_records()
        if any(record["blood_group"] == payload.blood_group.value for record in records):
            raise ValueError("Inventory already exists for this blood group")
        record = {
            "blood_group": payload.blood_group.value,
            "current_blood_stock": payload.current_blood_stock,
            "incoming_blood_units": payload.incoming_blood_units,
            "average_daily_usage": payload.average_daily_usage,
            "projected_demand": payload.average_daily_usage * 7,
            "stock_change": 0,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        records.append(_recalculate(record))
        _write_records(records)
    return InventoryRecord.model_validate(record)


def update_inventory(blood_group: BloodGroup, payload: InventoryUpdate) -> InventoryRecord | None:
    with INVENTORY_LOCK:
        records = _read_records()
        for record in records:
            if record["blood_group"] != blood_group.value:
                continue
            old_stock = int(record["current_blood_stock"])
            changes = payload.model_dump(exclude_none=True)
            record.update(changes)
            record["stock_change"] = int(record["current_blood_stock"]) - old_stock
            _recalculate(record)
            _write_records(records)
            return InventoryRecord.model_validate(record)
    return None


def inventory_frame() -> pd.DataFrame:
    return pd.DataFrame([record.model_dump(mode="json") for record in list_inventory()])
