from datetime import datetime, timedelta
import random
import simpy
from typing import Dict, Any, Optional

from utils.constants import FESTIVALS
from utils.helpers import get_season_info, get_festival_info

class BrandSimulation:
    def __init__(self, env, brand_name: str, config: Any, brand_params: Dict[str, Any], start_date: Optional[datetime] = None, festival_multipliers: Optional[Dict[str, float]] = None):
        self.env = env
        self.brand_name = brand_name
        self.start_date = start_date if start_date else datetime(2024, 1, 1)
        self.festival_multipliers = festival_multipliers if festival_multipliers else {}

        params = brand_params.get(brand_name, {})

        # Config
        self.initial_stock = config.initial_stock if config.initial_stock else params.get('calculated_config', {}).get('initial_stock', 1000)
        self.restock_days = config.restock_days if config.restock_days else params.get('calculated_config', {}).get('restock_days', 25)
        self.restock_quantity = config.restock_quantity if config.restock_quantity else params.get('calculated_config', {}).get('restock_quantity', 500)
        self.reorder_quantity = config.reorder_quantity if config.reorder_quantity else params.get('calculated_config', {}).get('reorder_quantity', 500)
        self.reorder_point = config.reorder_point if config.reorder_point else params.get('calculated_config', {}).get('reorder_point', 200)
        self.demand_multiplier = config.demand_multiplier if config.demand_multiplier else 1.0
        self.enable_reorder = config.enable_reorder if config.enable_reorder is not None else True

        # Stock
        self.stock = self.initial_stock

        # Demand parameters
        self.base_daily_demand = params.get('base_demand', 50) * self.demand_multiplier
        self.seasonality_factors = params.get('seasonality', {m: 1.0 for m in range(1, 13)})
        self.monthly_baseline_units = params.get('monthly_baseline_units', {m: self.base_daily_demand * 30 for m in range(1, 13)})
        self.avg_price = params.get('avg_price', 100)

        # Stats & logs
        self.sales_data = []
        self.restock_events = []
        self.reorder_point_events = []
        self.festival_events = []
        self.season_events = []
        self.trend_events = []  # monthly trend “events” (online)

        self.stockout_days = 0
        self.total_sales_transactions = 0
        self.total_revenue = 0
        self.total_units_sold = 0
        self.restock_count = 0

        # Accumulators for online monthly trend
        self._month_sales_acc: Dict[int, int] = {}  # key=YYYYMM, value=sum sales
        self._prev_month_sales: Optional[int] = None

        self.env.process(self.daily_sales_process())

    def get_seasonality_factor(self, current_date: datetime) -> float:
        return self.seasonality_factors.get(current_date.month, 1.0)

    def get_festival_multiplier(self, current_date: datetime) -> float:
        month, day = current_date.month, current_date.day
        for fid, fdata in FESTIVALS.items():
            if fdata["month"] == month and day in fdata["days"]:
                return self.festival_multipliers.get(fid, fdata["multiplier"])
        return 1.0

    def calculate_daily_demand(self, current_date: datetime) -> tuple[int, float, float, float]:
        base_demand = self.base_daily_demand
        seasonality = self.get_seasonality_factor(current_date)
        festival_multiplier = self.get_festival_multiplier(current_date)
        random_variation = random.uniform(0.7, 1.3)
        daily_demand = int(base_demand * seasonality * festival_multiplier * random_variation)

        base_without_factors = base_demand * random_variation
        season_increase = (seasonality - 1) * base_without_factors * festival_multiplier if seasonality > 1 else 0
        festival_increase = (festival_multiplier - 1) * base_demand * seasonality * random_variation if festival_multiplier > 1 else 0
        return max(1, daily_demand), festival_multiplier, season_increase, festival_increase

    def _emit_month_trend_if_needed(self, current_date: datetime):
        """Call daily: if tomorrow is next month → emit trend event for current month."""
        next_day = current_date + timedelta(days=1)
        if next_day.month == current_date.month:
            return  # not month-end

        yyyymm = current_date.year * 100 + current_date.month
        sales_m = int(self._month_sales_acc.get(yyyymm, 0))
        baseline_m = float(self.monthly_baseline_units.get(current_date.month, self.base_daily_demand * 30))
        season_factor = float(self.seasonality_factors.get(current_date.month, 1.0))

        growth_vs_baseline = 0.0 if baseline_m <= 0 else (sales_m - baseline_m) / baseline_m
        mom_growth = None
        if self._prev_month_sales is not None and self._prev_month_sales > 0:
            mom_growth = (sales_m - self._prev_month_sales) / self._prev_month_sales

        up_cond = (growth_vs_baseline >= 0.15) or (mom_growth is not None and mom_growth >= 0.10)
        down_cond = (growth_vs_baseline <= -0.10) or (mom_growth is not None and mom_growth <= -0.10)
        if up_cond and not down_cond:
            trend_label = "uptrend"
        elif down_cond and not up_cond:
            trend_label = "downtrend"
        else:
            trend_label = "sideways"

        trend_score = 0.7 * growth_vs_baseline + 0.3 * (mom_growth if mom_growth is not None else 0.0)

        self.trend_events.append({
            'month': int(current_date.month),
            'brand': self.brand_name,
            'sales': sales_m,
            'baseline_units': baseline_m,
            'growth_vs_baseline': float(growth_vs_baseline),
            'mom_growth': float(mom_growth) if mom_growth is not None else None,
            'seasonality_factor': season_factor,
            'trend': trend_label,
            'trend_score': float(trend_score)
        })
        self._prev_month_sales = sales_m

    def daily_sales_process(self):
        while True:
            current_date = self.start_date + timedelta(days=int(self.env.now))
            stock_before = self.stock
            daily_demand, festival_multiplier, season_increase, festival_increase = self.calculate_daily_demand(current_date)
            actual_sales = min(daily_demand, self.stock)

            season_info = get_season_info(current_date)
            festival_name, _ = get_festival_info(current_date)

            daily_revenue = actual_sales * self.avg_price

            common = {
                'day': int(self.env.now),
                'date': current_date.strftime('%Y-%m-%d'),
                'brand': self.brand_name,
                'demand': int(daily_demand),
                'stock_before': int(stock_before),
                'revenue': float(daily_revenue),
                'price_per_unit': float(self.avg_price),
                'season': season_info['season'],
                'season_type': season_info['season_type'],
                'quarter': season_info['quarter'],
                'festival': festival_name,
                'festival_multiplier': float(festival_multiplier)
            }

            if actual_sales > 0:
                self.stock -= actual_sales
                self.total_sales_transactions += 1
                self.total_units_sold += actual_sales
                self.total_revenue += daily_revenue
                entry = {
                    **common,
                    'sales': int(actual_sales),
                    'stock_after': int(self.stock),
                    'stockout': 0,
                    'lost_sales': int(daily_demand - actual_sales)
                }
            else:
                self.stockout_days += 1
                entry = {
                    **common,
                    'sales': 0,
                    'stock_after': int(self.stock),
                    'stockout': 1,
                    'lost_sales': int(daily_demand)
                }

            self.sales_data.append(entry)

            # season/festival logs
            seasonality = self.get_seasonality_factor(current_date)
            if seasonality > 1:
                self.season_events.append({
                    'day': int(self.env.now),
                    'date': current_date.strftime('%Y-%m-%d'),
                    'season_name': season_info['season'],
                    'season_type': season_info['season_type'],
                    'multiplier': float(seasonality),
                    'demand_increase': float(season_increase)
                })
            if festival_multiplier > 1:
                self.festival_events.append({
                    'day': int(self.env.now),
                    'date': current_date.strftime('%Y-%m-%d'),
                    'festival_name': festival_name,
                    'multiplier': float(festival_multiplier),
                    'demand_increase': float(festival_increase)
                })

            # periodic / reorder
            if int(self.env.now) > 0 and int(self.env.now) % self.restock_days == 0:
                before = self.stock
                self.stock += self.restock_quantity
                self.restock_count += 1
                self.restock_events.append({
                    'day': int(self.env.now),
                    'brand': self.brand_name,
                    'quantity': int(self.restock_quantity),
                    'stock_before': int(before),
                    'stock_after': int(self.stock),
                    'type': 'periodic'
                })
                entry['stock_after'] = int(self.stock)
            elif self.reorder_point > 0 and self.stock <= self.reorder_point:
                will_trigger = self.enable_reorder
                self.reorder_point_events.append({
                    'day': int(self.env.now),
                    'brand': self.brand_name,
                    'stock_level': int(self.stock),
                    'reorder_point': int(self.reorder_point),
                    'reorder_quantity': int(self.reorder_quantity),
                    'triggered': will_trigger
                })
                if will_trigger:
                    before = self.stock
                    self.stock += self.reorder_quantity
                    self.restock_count += 1
                    self.restock_events.append({
                        'day': int(self.env.now),
                        'brand': self.brand_name,
                        'quantity': int(self.reorder_quantity),
                        'stock_before': int(before),
                        'stock_after': int(self.stock),
                        'type': 'reorder'
                    })
                    entry['stock_after'] = int(self.stock)

            # accumulate month sales
            yyyymm = current_date.year * 100 + current_date.month
            self._month_sales_acc[yyyymm] = int(self._month_sales_acc.get(yyyymm, 0) + entry['sales'])

            # month-end trend event
            self._emit_month_trend_if_needed(current_date)

            yield self.env.timeout(1)
