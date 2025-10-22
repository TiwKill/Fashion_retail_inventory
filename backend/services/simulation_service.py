from datetime import datetime, timedelta
from typing import Dict, Any, List
from fastapi import HTTPException

from models.pydantic import (
    SimulationRequest, BrandConfig, SimulationResponse,
    MonthlyTrend, TrendEvent, MonthlyProductTrend, ProductTrendEvent
)
from services.data_service import get_brand_parameters, get_supported_brands, get_historical_data
from simulation.brand_simulation import BrandSimulation
from utils.helpers import clean_data_for_json

import simpy
import pandas as pd


# -----------------------------
# Run SimPy per brand
# -----------------------------
def run_simulation(
    configs: Dict[str, BrandConfig],
    simulation_days: int,
    start_date: datetime,
    festival_multipliers: Dict[str, float] | None = None
) -> Dict[str, BrandSimulation]:
    env = simpy.Environment()
    simulations: Dict[str, BrandSimulation] = {}
    for brand_name, config in configs.items():
        if config is None:
            config = BrandConfig()
        sim = BrandSimulation(
            env=env,
            brand_name=brand_name,
            config=config,
            brand_params=get_brand_parameters(),
            start_date=start_date,
            festival_multipliers=festival_multipliers
        )
        simulations[brand_name] = sim
    env.run(until=simulation_days)
    return simulations


# -----------------------------
# Post-process results
# -----------------------------
def process_results(
    simulations: Dict[str, BrandSimulation],
    simulation_days: int,
    start_date: datetime
) -> SimulationResponse:

    all_daily_data: List[Dict[str, Any]] = []
    all_monthly_data: List[Dict[str, Any]] = []
    all_restock_events: List[Dict[str, Any]] = []
    all_reorder_point_events: List[Dict[str, Any]] = []
    all_festival_events: List[Dict[str, Any]] = []
    all_season_events: List[Dict[str, Any]] = []
    all_trend_events: List[Dict[str, Any]] = []    # จาก online SimPy (ถ้ามี)
    summary_data: List[Dict[str, Any]] = []
    best_selling_products: List[Dict[str, Any]] = []
    monthly_trends: List[Dict[str, Any]] = []      # ย่อระดับแบรนด์ (offline ในขั้นนี้)

    # NEW: product trends
    product_monthly_trends: List[Dict[str, Any]] = []
    product_trend_events: List[Dict[str, Any]] = []

    # เดือนที่อยู่ในช่วงจำลอง
    simulated_months = set()
    for d in range(simulation_days):
        simulated_months.add((start_date + timedelta(days=d)).month)

    historical_data = get_historical_data()
    brand_params = get_brand_parameters() or {}

    for brand_name, sim in simulations.items():
        # --- เก็บ logs ---
        all_daily_data.extend(sim.sales_data)
        all_restock_events.extend(sim.restock_events)
        all_reorder_point_events.extend(sim.reorder_point_events)
        all_festival_events.extend(sim.festival_events)
        all_season_events.extend(sim.season_events)
        if hasattr(sim, "trend_events"):
            all_trend_events.extend(sim.trend_events)

        # --- สรุปรายเดือนจากผลจำลอง ---
        df = pd.DataFrame(sim.sales_data)
        df["date"] = pd.to_datetime(df["date"])
        df["month"] = df["date"].dt.month

        monthly_agg = (
            df.groupby("month")
              .agg({
                  "sales": "sum",
                  "revenue": "sum",
                  "stock_after": "mean",
                  "stockout": "sum"
              })
              .reset_index()
              .sort_values("month")
        )

        for _, row in monthly_agg.iterrows():
            all_monthly_data.append({
                "month": int(row["month"]),
                "brand": brand_name,
                "total_sales": int(row["sales"]),
                "total_revenue": float(row["revenue"]),
                "avg_stock": float(row["stock_after"]),
                "stockout_days": int(row["stockout"])
            })

        # --- best selling product (อ้าง historical เฉพาะเดือนที่ simulate) ---
        if historical_data is not None and {"Brand", "Invoice Date", "Product", "Units Sold"} <= set(historical_data.columns):
            brand_df = historical_data[historical_data["Brand"] == brand_name].copy()
            brand_df["Invoice Date"] = pd.to_datetime(brand_df["Invoice Date"])
            brand_df["month"] = brand_df["Invoice Date"].dt.month
            brand_df = brand_df[brand_df["month"].isin(simulated_months)]
            if len(brand_df) > 0:
                product_monthly_sales = (
                    brand_df.groupby(["month", "Product"])["Units Sold"]
                            .sum()
                            .reset_index()
                )
                if len(product_monthly_sales) > 0:
                    top_products = (
                        product_monthly_sales.sort_values(["month", "Units Sold"], ascending=[True, False])
                                           .groupby("month").first().reset_index()
                    )
                    for _, r in top_products.iterrows():
                        best_selling_products.append({
                            "brand": brand_name,
                            "month": int(r["month"]),
                            "product": str(r["Product"]),
                            "units_sold": int(r["Units Sold"])
                        })

        # --- Brand-level monthly trends (offline) ---
        params = brand_params.get(brand_name, {})
        seasonality = params.get("seasonality", {m: 1.0 for m in range(1, 13)})
        monthly_baseline_units = params.get("monthly_baseline_units", {m: 0.0 for m in range(1, 13)})

        prev_sales = None
        for _, row in monthly_agg.iterrows():
            m = int(row["month"])
            sales_m = int(row["sales"])
            baseline_m = float(monthly_baseline_units.get(m, 0.0))
            season_factor = float(seasonality.get(m, 1.0))
            growth_vs_baseline = 0.0 if baseline_m <= 0 else (sales_m - baseline_m) / baseline_m
            mom_growth = (sales_m - prev_sales) / prev_sales if (prev_sales is not None and prev_sales > 0) else None

            up = (growth_vs_baseline >= 0.15) or (mom_growth is not None and mom_growth >= 0.10)
            down = (growth_vs_baseline <= -0.10) or (mom_growth is not None and mom_growth <= -0.10)
            if up and not down:
                trend_label = "uptrend"
            elif down and not up:
                trend_label = "downtrend"
            else:
                trend_label = "sideways"

            trend_score = 0.7 * growth_vs_baseline + 0.3 * (mom_growth if mom_growth is not None else 0.0)

            monthly_trends.append({
                "month": m,
                "brand": brand_name,
                "sales": sales_m,
                "baseline_units": baseline_m,
                "growth_vs_baseline": float(growth_vs_baseline),
                "mom_growth": float(mom_growth) if mom_growth is not None else None,
                "seasonality_factor": season_factor,
                "trend": trend_label,
                "trend_score": float(trend_score)
            })

            prev_sales = sales_m

        # --- Product-level monthly trends & events ---
        if historical_data is not None and {"Brand", "Invoice Date", "Product", "Units Sold"} <= set(historical_data.columns):
            h = historical_data.copy()
            h["Invoice Date"] = pd.to_datetime(h["Invoice Date"])
            h["month"] = h["Invoice Date"].dt.month
            h = h[(h["Brand"] == brand_name) & (h["month"].isin(simulated_months))]

            if len(h) > 0:
                baseline = (
                    h.groupby(["Product", "month"])["Units Sold"]
                     .mean()
                     .rename("baseline_units")
                     .reset_index()
                )
                actual = (
                    h.groupby(["Product", "month"])["Units Sold"]
                     .sum()
                     .rename("sales")
                     .reset_index()
                )
                merged = pd.merge(actual, baseline, on=["Product", "month"], how="left")
                merged["brand"] = brand_name

                merged = merged.sort_values(["Product", "month"])
                merged["growth_vs_baseline"] = merged.apply(
                    lambda r: 0.0 if (pd.isna(r["baseline_units"]) or r["baseline_units"] <= 0)
                    else (r["sales"] - r["baseline_units"]) / r["baseline_units"], axis=1
                )

                merged["mom_growth"] = None
                for product, grp in merged.groupby("Product"):
                    prev = None
                    for idx, row in grp.iterrows():
                        if prev is not None and prev > 0:
                            merged.loc[idx, "mom_growth"] = (row["sales"] - prev) / prev
                        prev = row["sales"]

                def classify(gvb: float, mom: Any) -> tuple[str, float]:
                    momv = mom if mom is not None else 0.0
                    score = 0.7 * gvb + 0.3 * momv
                    if gvb >= 0.15 or momv >= 0.10:
                        label = "uptrend"
                    elif gvb <= -0.10 or momv <= -0.10:
                        label = "downtrend"
                    else:
                        label = "sideways"
                    return label, score

                merged[["trend", "trend_score"]] = merged.apply(
                    lambda r: pd.Series(classify(r["growth_vs_baseline"], r["mom_growth"])),
                    axis=1
                )

                # push monthly rows
                for _, r in merged.iterrows():
                    product_monthly_trends.append({
                        "brand": brand_name,
                        "product": str(r["Product"]),
                        "month": int(r["month"]),
                        "sales": int(r["sales"]),
                        "baseline_units": float(r["baseline_units"]) if pd.notna(r["baseline_units"]) else 0.0,
                        "growth_vs_baseline": float(r["growth_vs_baseline"]) if pd.notna(r["growth_vs_baseline"]) else None,
                        "mom_growth": float(r["mom_growth"]) if pd.notna(r["mom_growth"]) else None,
                        "trend": str(r["trend"]),
                        "trend_score": float(r["trend_score"])
                    })

                # events (เมื่อเปลี่ยนสถานะ)
                for product, grp in merged.groupby("Product"):
                    grp = grp.sort_values("month")
                    prev_trend = None
                    for _, r in grp.iterrows():
                        cur = str(r["trend"])
                        if prev_trend is not None and cur != prev_trend:
                            reason = []
                            if pd.notna(r["mom_growth"]):
                                reason.append(f"MoM={(float(r['mom_growth']) * 100):.1f}%")
                            if pd.notna(r["growth_vs_baseline"]):
                                reason.append(f"vsBase={(float(r['growth_vs_baseline']) * 100):.1f}%")
                            product_trend_events.append({
                                "month": int(r["month"]),
                                "brand": brand_name,
                                "product": str(product),
                                "from_trend": prev_trend,
                                "to_trend": cur,
                                "trend_score": float(r["trend_score"]),
                                "reason": "; ".join(reason) if reason else None
                            })
                        prev_trend = cur

        # --- Summary per brand ---
        total_demand = df["demand"].sum()
        total_lost_sales = df["lost_sales"].sum()
        lost_rate = (total_lost_sales / total_demand * 100) if total_demand > 0 else 0.0

        summary_data.append({
            "brand": brand_name,
            "total_units_sold": int(df["sales"].sum()),
            "total_revenue": float(df["revenue"].sum()),
            "transactions": int((df["sales"] > 0).sum()),
            "restock_count": int(len(sim.restock_events)),
            "stockout_days": int((df["stockout"] > 0).sum()),
            "avg_stock": float(df["stock_after"].mean()),
            "final_stock": int(df["stock_after"].iloc[-1]),
            "lost_sales_rate": float(lost_rate),
            "total_lost_sales": int(total_lost_sales),
            "avg_price": float(sim.avg_price)
        })

    # -------- Clean for JSON --------
    all_daily_data = clean_data_for_json(all_daily_data)
    all_monthly_data = clean_data_for_json(all_monthly_data)
    all_restock_events = clean_data_for_json(all_restock_events)
    all_reorder_point_events = clean_data_for_json(all_reorder_point_events)
    all_festival_events = clean_data_for_json(all_festival_events)
    all_season_events = clean_data_for_json(all_season_events)
    summary_data = clean_data_for_json(summary_data)
    best_selling_products = clean_data_for_json(best_selling_products)
    monthly_trends = clean_data_for_json(monthly_trends)
    all_trend_events = clean_data_for_json(all_trend_events)
    product_monthly_trends = clean_data_for_json(product_monthly_trends)
    product_trend_events = clean_data_for_json(product_trend_events)

    return SimulationResponse(
        daily_data=all_daily_data,
        monthly_data=all_monthly_data,
        restock_events=all_restock_events,
        reorder_point_events=all_reorder_point_events,
        festival_events=all_festival_events,
        season_events=all_season_events,
        summary=summary_data,
        best_selling_products=best_selling_products,
        simulation_days=simulation_days,
        monthly_trends=[MonthlyTrend(**x) for x in monthly_trends],
        trend_events=[TrendEvent(**x) for x in all_trend_events],
        product_monthly_trends=[MonthlyProductTrend(**x) for x in product_monthly_trends],
        product_trend_events=[ProductTrendEvent(**x) for x in product_trend_events]
    )


# -----------------------------
# Main entry
# -----------------------------
def run_inventory_simulation(request: SimulationRequest) -> SimulationResponse:
    configs: Dict[str, BrandConfig] = {}

    # สร้าง config เริ่มต้นให้ทุกแบรนด์ที่รองรับ (ถ้าไม่ได้ส่งมา)
    for b in get_supported_brands():
        # รองรับกรณี field เป็น H&M ใน env แต่ pydantic ส่ง H_M: None มาก็ไม่เป็นไร
        cfg = getattr(request, b, None)
        if cfg is None and b == "H&M":
            cfg = getattr(request, "H_M", None)
        configs[b] = cfg or BrandConfig()

    start_day = request.start_day if request.start_day is not None else 0
    start_date = datetime(2024, 1, 1) + timedelta(days=start_day)

    if request.end_day is not None:
        simulation_days = request.end_day - start_day + 1
    else:
        simulation_days = request.simulation_days or 365

    if simulation_days <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date range: start_day={start_day}, end_day={request.end_day}"
        )

    festival_multipliers: Dict[str, float] = {}
    if request.festival_demand and request.festival_demand.multipliers:
        festival_multipliers = request.festival_demand.multipliers

    end_date = start_date + timedelta(days=simulation_days - 1)

    print("\n🎯 Simulation Parameters:")
    print(f" 📅 Start Date: {start_date.strftime('%Y-%m-%d')} (day {start_day} of year)")
    print(f" 📅 End Date:   {end_date.strftime('%Y-%m-%d')} (day {request.end_day} of year)")
    print(f" 📆 Simulation Days: {simulation_days}")
    print(f" 🎉 Festival Multipliers: {len(festival_multipliers)} festivals")
    print(f" 📊 Date Range: {start_date.strftime('%b %d')} - {end_date.strftime('%b %d')}")

    simulations = run_simulation(
        configs=configs,
        simulation_days=simulation_days,
        start_date=start_date,
        festival_multipliers=festival_multipliers
    )

    results = process_results(simulations, simulation_days, start_date)
    print("✅ Simulation completed successfully")
    print(f" 📊 Total daily records: {len(results.daily_data)}")
    print(f" 📈 Date range in results: {results.daily_data[0].date} to {results.daily_data[-1].date}")
    return results
