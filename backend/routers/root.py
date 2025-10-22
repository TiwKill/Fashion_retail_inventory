from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from utils.helpers import clean_data_for_json
from services.data_service import get_historical_data, get_brand_parameters, get_supported_brands

router = APIRouter()

@router.get("/")
def read_root() -> Dict[str, Any]:
    return {
        "message": "Inventory Simulation API with Season & Festival Analysis",
        "version": "2.0.1",
        "data_loaded": get_historical_data() is not None,
        "brands_available": list(get_brand_parameters().keys()) if get_brand_parameters() else [],
        "endpoints": {
            "POST /simulate": "Run inventory simulation",
            "GET /health": "Health check",
            "GET /brand-params": "Get calculated brand parameters",
            "GET /seasons-festivals": "Get season and festival information",
            "GET /available-brands": "Get available brands list"
        },
        "fixes": [
            "✅ Fixed date range handling for start_day and end_day",
            "✅ Best selling products now filtered by simulation date range",
            "✅ Monthly data correctly mapped to simulation months"
        ]
    }

@router.get("/health")
def health_check() -> Dict[str, bool]:
    from services.data_service import get_historical_data
    return {"status": "healthy", "data_loaded": get_historical_data() is not None}

@router.get("/brand-params")
def get_brand_parameters_endpoint() -> Dict[str, Any]:
    """Get calculated parameters from historical data"""
    params = get_brand_parameters()
    if not params:
        raise HTTPException(status_code=404, detail="No historical data available")
    return clean_data_for_json(params)

@router.get("/seasons-festivals")
def get_seasons_and_festivals() -> Any:
    """Get all season and festival information"""
    from utils.constants import SEASON_MAPPING, FESTIVALS
    from models.pydantic import SeasonInfo, FestivalInfo, SeasonFestivalResponse

    seasons = []
    for month, data in SEASON_MAPPING.items():
        seasons.append(SeasonInfo(
            month=month,
            season_name=data["name"],
            quarter=data["quarter"],
            season_type=data["type"]
        ))

    festivals = []
    for festival_id, data in FESTIVALS.items():
        festivals.append(FestivalInfo(
            festival_id=festival_id,
            name=data["name"],
            month=data["month"],
            days=data["days"],
            demand_multiplier=data["multiplier"]
        ))

    return SeasonFestivalResponse(seasons=seasons, festivals=festivals)

@router.get("/available-brands")
def get_available_brands() -> Dict[str, Any]:
    """Get list of available brands from historical data"""
    brands = get_supported_brands()  # ใช้ฟังก์ชันใหม่
    if not brands:
        raise HTTPException(status_code=404, detail="No historical data available")
    
    count = len(brands)
    main_brands = brands.copy()
    
    return {
        "brands": brands,
        "count": count,
        "main_brands": main_brands
    }