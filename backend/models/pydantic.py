from pydantic import BaseModel
from typing import Dict, List, Optional, Any

# -----------------------------
# Core configs / requests
# -----------------------------

class BrandConfig(BaseModel):
    initial_stock: Optional[int] = None
    restock_days: Optional[int] = None
    restock_quantity: Optional[int] = None  # For periodic restock every restock_days
    reorder_quantity: Optional[int] = None  # For immediate restock when stock <= reorder_point
    reorder_point: Optional[int] = None
    demand_multiplier: Optional[float] = 1.0
    enable_reorder: Optional[bool] = True  # Enable immediate restock on reorder point trigger

class FestivalDemand(BaseModel):
    multipliers: Dict[str, float]
    start_day: int
    end_day: int
    total_days: int

class SimulationRequest(BaseModel):
    NIKE: Optional[BrandConfig] = None
    ADIDAS: Optional[BrandConfig] = None
    PUMA: Optional[BrandConfig] = None
    H_M: Optional[BrandConfig] = None  # ถ้ามี H&M ใช้ชื่อ env “H&M” ก็ได้ แต่ pydantic ใช้ H_M ได้
    simulation_days: Optional[int] = 365
    use_historical_data: Optional[bool] = True
    festival_demand: Optional[FestivalDemand] = None
    start_day: Optional[int] = 0  # 0-indexed day of year
    end_day: Optional[int] = None

# -----------------------------
# Core data rows
# -----------------------------

class DailyData(BaseModel):
    day: int
    date: str
    brand: str
    demand: int
    sales: int
    stock_before: int
    stock_after: int
    revenue: float
    stockout: int
    lost_sales: int
    price_per_unit: float
    season: str
    season_type: str
    quarter: str
    festival: Optional[str] = None
    festival_multiplier: float

class MonthlyData(BaseModel):
    month: int
    brand: str
    total_sales: int
    total_revenue: float
    avg_stock: float
    stockout_days: int

class RestockEvent(BaseModel):
    day: int
    brand: str
    quantity: int
    stock_before: int
    stock_after: int
    type: str  # "periodic" | "reorder"

class ReorderPointEvent(BaseModel):
    day: int
    brand: str
    stock_level: int
    reorder_point: int
    reorder_quantity: int
    triggered: bool

class FestivalEvent(BaseModel):
    day: int
    date: str
    festival_name: str
    multiplier: float
    demand_increase: float

class SeasonEvent(BaseModel):
    day: int
    date: str
    season_name: str
    season_type: str
    multiplier: float
    demand_increase: float

class BrandSummary(BaseModel):
    brand: str
    total_units_sold: int
    total_revenue: float
    transactions: int
    restock_count: int
    stockout_days: int
    avg_stock: float
    final_stock: int
    lost_sales_rate: float
    total_lost_sales: int
    avg_price: float

# -----------------------------
# Trend models (brand-level)
# -----------------------------

class MonthlyTrend(BaseModel):
    month: int
    brand: str
    sales: int
    baseline_units: float
    growth_vs_baseline: Optional[float] = None
    mom_growth: Optional[float] = None
    seasonality_factor: Optional[float] = 1.0
    trend: str                         # "uptrend" | "downtrend" | "sideways"
    trend_score: float                 # -1..+1 (ประมาณ)

class TrendEvent(BaseModel):
    month: int
    brand: str
    from_trend: Optional[str] = None
    to_trend: Optional[str] = None
    trend_score: Optional[float] = None
    reason: Optional[str] = None


# -----------------------------
# Trend models (product-level)
# -----------------------------

class MonthlyProductTrend(BaseModel):
    brand: str
    product: str
    month: int
    sales: int
    baseline_units: float
    growth_vs_baseline: Optional[float] = None
    mom_growth: Optional[float] = None
    trend: str                         # "uptrend" | "downtrend" | "sideways"
    trend_score: float

class ProductTrendEvent(BaseModel):
    month: int
    brand: str
    product: str
    from_trend: str
    to_trend: str
    trend_score: Optional[float] = None
    reason: Optional[str] = None

# -----------------------------
# Response + metadata
# -----------------------------

class SimulationResponse(BaseModel):
    daily_data: List[DailyData]
    monthly_data: List[MonthlyData]
    restock_events: List[RestockEvent]
    reorder_point_events: List[ReorderPointEvent]
    festival_events: List[FestivalEvent]
    season_events: List[SeasonEvent]
    summary: List[BrandSummary]
    best_selling_products: List[Dict[str, Any]]
    simulation_days: int

    # Trend (brand)
    monthly_trends: List[MonthlyTrend] = []
    trend_events: List[TrendEvent] = []

    # Trend (product) — ใช้กับ frontend ใหม่
    product_monthly_trends: List[MonthlyProductTrend] = []
    product_trend_events: List[ProductTrendEvent] = []

# -----------------------------
# Static season/festival lookups
# -----------------------------

class SeasonInfo(BaseModel):
    month: int
    season_name: str
    quarter: str
    season_type: str

class FestivalInfo(BaseModel):
    festival_id: str
    name: str
    month: int
    days: List[int]
    demand_multiplier: float

class SeasonFestivalResponse(BaseModel):
    seasons: List[SeasonInfo]
    festivals: List[FestivalInfo]
