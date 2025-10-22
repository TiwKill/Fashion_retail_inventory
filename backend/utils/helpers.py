from datetime import datetime
from typing import Any, Dict, Tuple
import pandas as pd
import numpy as np

from utils.constants import SEASON_MAPPING, FESTIVALS

def get_season_info(date: datetime) -> Dict[str, str]:
    """Get season information for a given date"""
    month = date.month
    season_data = SEASON_MAPPING.get(month, {})
    return {
        "season": season_data.get("name", "Unknown"),
        "quarter": season_data.get("quarter", "Unknown"),
        "season_type": season_data.get("type", "Medium Season")
    }

def get_festival_info(date: datetime) -> Tuple[str, float]:
    """Check if date is a festival and return festival name and multiplier"""
    month = date.month
    day = date.day
    for festival_id, festival_data in FESTIVALS.items():
        if festival_data["month"] == month and day in festival_data["days"]:
            return festival_data["name"], festival_data["multiplier"]
    return "", 1.0

def clean_data_for_json(data: Any) -> Any:
    """ทำความสะอาดข้อมูลสำหรับ JSON serialization"""
    if isinstance(data, dict):
        return {k: clean_data_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_data_for_json(item) for item in data]
    elif isinstance(data, np.floating):
        return float(data) if not np.isnan(data) else 0.0
    elif isinstance(data, np.integer):
        return int(data)
    elif isinstance(data, (np.bool_, bool)):
        return bool(data)
    elif isinstance(data, (pd.Timestamp, datetime)):
        return data.strftime('%Y-%m-%d')
    elif data is None:
        return None
    elif pd.isna(data):
        return 0.0
    else:
        return data