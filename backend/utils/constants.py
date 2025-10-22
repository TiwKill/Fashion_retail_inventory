from typing import Dict, List, Any

# Season mapping - กำหนดฤดูกาลตามเดือน
SEASON_MAPPING: Dict[int, Dict[str, str]] = {
    1: {"name": "Q1 - Winter/New Year", "quarter": "Q1", "type": "High Season"},
    2: {"name": "Q1 - Valentine", "quarter": "Q1", "type": "High Season"},
    3: {"name": "Q1 - Spring", "quarter": "Q1", "type": "Medium Season"},
    4: {"name": "Q2 - Summer Start", "quarter": "Q2", "type": "Medium Season"},
    5: {"name": "Q2 - Mid Year", "quarter": "Q2", "type": "Low Season"},
    6: {"name": "Q2 - Mid Year Sale", "quarter": "Q2", "type": "Medium Season"},
    7: {"name": "Q3 - Summer Peak", "quarter": "Q3", "type": "Low Season"},
    8: {"name": "Q3 - Back to School", "quarter": "Q3", "type": "High Season"},
    9: {"name": "Q3 - Fall Start", "quarter": "Q3", "type": "Medium Season"},
    10: {"name": "Q4 - Fall", "quarter": "Q4", "type": "Medium Season"},
    11: {"name": "Q4 - Black Friday", "quarter": "Q4", "type": "Peak Season"},
    12: {"name": "Q4 - Christmas/Year End", "quarter": "Q4", "type": "Peak Season"}
}

# Festival/Holiday calendar - เทศกาลและวันหยุดที่ส่งผลต่อยอดขาย
FESTIVALS: Dict[str, Dict[str, Any]] = {
    # Format: (month, day_start, day_end, name, demand_multiplier)
    "new_year": {"month": 1, "days": [1, 2, 3], "name": "New Year Sale", "multiplier": 1.8},
    "valentine": {"month": 2, "days": [13, 14, 15], "name": "Valentine's Day", "multiplier": 1.5},
    "womens_day": {"month": 3, "days": [8], "name": "Women's Day", "multiplier": 1.3},
    "songkran": {"month": 4, "days": [13, 14, 15], "name": "Songkran Festival", "multiplier": 1.4},
    "mothers_day": {"month": 5, "days": [10, 11, 12], "name": "Mother's Day", "multiplier": 1.4},
    "mid_year_sale": {"month": 6, "days": list(range(15, 22)), "name": "Mid Year Sale", "multiplier": 1.6},
    "fathers_day": {"month": 6, "days": [16, 17, 18], "name": "Father's Day", "multiplier": 1.3},
    "back_to_school": {"month": 8, "days": list(range(1, 15)), "name": "Back to School", "multiplier": 1.7},
    "halloween": {"month": 10, "days": [30, 31], "name": "Halloween", "multiplier": 1.2},
    "singles_day": {"month": 11, "days": [11], "name": "11.11 Sale", "multiplier": 2.0},
    "black_friday": {"month": 11, "days": list(range(24, 28)), "name": "Black Friday", "multiplier": 2.2},
    "cyber_monday": {"month": 11, "days": [28, 29], "name": "Cyber Monday", "multiplier": 1.9},
    "christmas": {"month": 12, "days": list(range(20, 26)), "name": "Christmas Sale", "multiplier": 2.0},
    "year_end": {"month": 12, "days": list(range(26, 32)), "name": "Year End Sale", "multiplier": 1.8}
}