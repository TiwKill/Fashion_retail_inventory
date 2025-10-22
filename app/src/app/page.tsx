"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { BrandSelector } from "@/components/brand-selector"
import ProductTrendFeed from "@/components/product-trend-feed"
import { StoreSimulation } from "@/components/store-simulation"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
    LineChart,
    Line,
} from "recharts"
import { TrendingUp, TrendingDown, Package, DollarSign, AlertTriangle, Loader2 } from "lucide-react"

import SimulationParameters from "@/components/simulation_parameters"
import type { SimulationResponse, BrandConfigs } from "@/types/index"
import { transformMonthlyDataForChart, transformDailyDataForStockChart, calculateRegionalData } from "@/lib/api"

// ===== Colors =====
const CHART_COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#14b8a6", // Teal
    "#6366f1", // Indigo
]
const getBrandColor = (brand: string, selectedBrands: string[]) => {
    const index = selectedBrands.indexOf(brand)
    return CHART_COLORS[index % CHART_COLORS.length]
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// ===== Tooltip =====
const CustomTooltip = ({ active, payload, label, formatValue }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border-2 border-gray-200 dark:border-gray-600 min-w-[220px]">
                <p className="font-bold text-gray-900 dark:text-gray-100 mb-3 text-base border-b border-gray-200 dark:border-gray-600 pb-2">
                    {label}
                </p>
                <div className="space-y-2">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{entry.name}</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                {formatValue ? formatValue(entry.value) : Number(entry.value).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    return null
}

// ===== Trend helpers (brand-level) =====
function transformMonthlyTrendsForChart(
    monthlyTrends: SimulationResponse["monthly_trends"] = [],
    selectedBrands: string[],
) {
    const byMonth: Record<number, any> = {}
    monthlyTrends.forEach((t) => {
        if (!selectedBrands.includes(t.brand)) return
        if (!byMonth[t.month]) byMonth[t.month] = { month: MONTH_NAMES[t.month - 1] }
        byMonth[t.month][t.brand] = Number((t.trend_score ?? 0).toFixed(3))
    })
    return Object.keys(byMonth)
        .map(Number)
        .sort((a, b) => a - b)
        .map((m) => byMonth[m])
}
function buildTrendMatrix(monthlyTrends: SimulationResponse["monthly_trends"] = [], selectedBrands: string[]) {
    const result: Record<string, Record<number, { trend: string; score: number }>> = {}
    monthlyTrends.forEach((t) => {
        if (!selectedBrands.includes(t.brand)) return
        result[t.brand] = result[t.brand] || {}
        result[t.brand][t.month] = { trend: t.trend, score: t.trend_score ?? 0 }
    })
    return result
}
function pickTopMovers(monthlyTrends: SimulationResponse["monthly_trends"] = [], selectedBrands: string[]) {
    const filtered = monthlyTrends.filter((t) => selectedBrands.includes(t.brand))
    if (filtered.length === 0) return { up: null as any, down: null as any }
    const up = [...filtered].sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0))[0]
    const down = [...filtered].sort((a, b) => (a.trend_score ?? 0) - (b.trend_score ?? 0))[0]
    return { up, down }
}

// ===== PRODUCT helpers =====
function buildProductLeaderboard(
    productMonthlyTrends: SimulationResponse["product_monthly_trends"] = [],
    selectedBrands: string[],
    monthFilter: number | "latest" = "latest",
    limit = 8,
) {
    const filtered = productMonthlyTrends.filter((t) => selectedBrands.includes(t.brand))
    if (filtered.length === 0) return { up: [], down: [], month: undefined as number | undefined }

    const monthToUse = monthFilter === "latest" ? filtered.reduce((max, t) => Math.max(max, t.month), 1) : monthFilter

    const inMonth = filtered.filter((t) => t.month === monthToUse && t.sales !== undefined)

    const MIN_SUPPORT = 20
    const considered = inMonth.filter((t) => (t.sales ?? 0) >= MIN_SUPPORT)

    const up = [...considered].sort((a, b) => (b.trend_score ?? 0) - (a.trend_score ?? 0)).slice(0, limit)

    const down = [...considered].sort((a, b) => (a.trend_score ?? 0) - (b.trend_score ?? 0)).slice(0, limit)

    return { up, down, month: monthToUse }
}

export default function InventoryDashboard() {
    const [selectedBrands, setSelectedBrands] = useState<string[]>([])
    const [configs, setConfigs] = useState<BrandConfigs>({})
    const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [monthFilter, setMonthFilter] = useState<"latest" | number>("latest")

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)

    const filteredSummary = simulationData?.summary.filter((s) => selectedBrands.includes(s.brand)) || []
    const filteredMonthlyData = simulationData?.monthly_data.filter((d) => selectedBrands.includes(d.brand)) || []
    const filteredDailyData = simulationData?.daily_data.filter((d) => selectedBrands.includes(d.brand)) || []
    const filteredRestockEvents = simulationData?.restock_events.filter((e) => selectedBrands.includes(e.brand)) || []
    const filteredBestSellingProducts =
        simulationData?.best_selling_products.filter((p) => selectedBrands.includes(p.brand)) || []
    const filteredMonthlyTrends = simulationData?.monthly_trends?.filter((t) => selectedBrands.includes(t.brand)) || []
    const filteredProductMonthlyTrends =
        simulationData?.product_monthly_trends?.filter((t) => selectedBrands.includes(t.brand)) || []
    const productTrendEvents = simulationData?.product_trend_events?.filter((t) => selectedBrands.includes(t.brand)) || []

    const trendChartData = transformMonthlyTrendsForChart(filteredMonthlyTrends, selectedBrands)
    const trendMatrix = buildTrendMatrix(filteredMonthlyTrends, selectedBrands)
    const topMovers = pickTopMovers(filteredMonthlyTrends, selectedBrands)

    const productBoards = useMemo(
        () => buildProductLeaderboard(filteredProductMonthlyTrends, selectedBrands, monthFilter, 8),
        [filteredProductMonthlyTrends, selectedBrands, monthFilter],
    )

    const totalRevenue = filteredSummary.reduce((sum, s) => sum + s.total_revenue, 0)
    const totalUnitsSold = filteredSummary.reduce((sum, s) => sum + s.total_units_sold, 0)
    const avgStockoutDays =
        filteredSummary.length > 0
            ? Math.round(filteredSummary.reduce((sum, s) => sum + s.stockout_days, 0) / filteredSummary.length)
            : 0

    const bestPerformer =
        filteredSummary.length > 0
            ? filteredSummary.reduce((best, current) => {
                if (current.lost_sales_rate < best.lost_sales_rate) return current
                if (current.lost_sales_rate === best.lost_sales_rate)
                    return current.final_stock > best.final_stock ? current : best
                return best
            }, filteredSummary[0])
            : null

    const monthsAvailable = useMemo(() => {
        const set = new Set<number>()
        filteredProductMonthlyTrends.forEach((t) => set.add(t.month))
        return Array.from(set).sort((a, b) => a - b)
    }, [filteredProductMonthlyTrends])

    return (
        <>
            <SiteHeader selectedBrands={selectedBrands} />
            <div className="min-h-screen bg-background p-4 md:p-8">
                <div className="mx-auto space-y-8">
                    <BrandSelector selectedBrands={selectedBrands} onBrandsChange={setSelectedBrands} />

                    {selectedBrands.length > 0 ? (
                        <>
                            <SimulationParameters
                                configs={configs}
                                setConfigs={setConfigs}
                                onRunSimulation={setSimulationData}
                                setIsLoading={setIsLoading}
                                setError={setError}
                                selectedBrands={selectedBrands}
                            />

                            {isLoading && (
                                <Card className="border-border bg-card">
                                    <CardContent className="flex items-center justify-center py-12">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-muted-foreground">Running simulation...</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {error && (
                                <Card className="border-destructive bg-destructive/10">
                                    <CardContent className="py-6">
                                        <div className="flex items-center gap-2 text-destructive">
                                            <AlertTriangle className="h-5 w-5" />
                                            <p className="font-medium">Error: {error}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {simulationData && filteredSummary.length > 0 && (
                                <>
                                    <StoreSimulation
                                        configs={configs}
                                        monthlyData={filteredMonthlyData}
                                        restockEvents={filteredRestockEvents}
                                        simulationDays={simulationData.simulation_days}
                                        dailyData={filteredDailyData}
                                        bestSellingProducts={filteredBestSellingProducts}
                                        selectedBrands={selectedBrands}
                                    />

                                    {/* ===== KPI Cards ===== */}
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                        <Card className="border-border bg-card">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">
                                                    {new Intl.NumberFormat("en-US", {
                                                        style: "currency",
                                                        currency: "USD",
                                                        minimumFractionDigits: 0,
                                                    }).format(totalRevenue)}
                                                </div>
                                                <p className="text-xs text-muted-foreground">การจำลอง {simulationData.simulation_days} วัน</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Total Units Sold</CardTitle>
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{totalUnitsSold.toLocaleString()}</div>
                                                <p className="text-xs text-muted-foreground">ครอบคลุมแบรนด์ที่เลือก</p>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle className="flex items-center justify-between">
                                                    <span>Best Performer</span>
                                                    <TrendingUp className="h-5 w-5 text-green-500" />
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{bestPerformer?.brand || "N/A"}</div>
                                                <div className="flex justify-between text-sm mt-2">
                                                    <span className="text-muted-foreground">อัตราการสูญเสียยอดขาย</span>
                                                    <span className="font-semibold text-green-600">
                                                        {bestPerformer?.lost_sales_rate.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">สต๊อกสุดท้าย</span>
                                                    <span className="font-semibold">{(bestPerformer?.final_stock ?? 0).toLocaleString()}</span>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Avg Stockout Days</CardTitle>
                                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold">{avgStockoutDays}</div>
                                                <p className="text-xs text-muted-foreground">วันต่อแบรนด์</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* ===== BRAND Trends ===== */}
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <TrendingUp className="h-5 w-5 text-green-500" /> Top Uptrend (Brand)
                                                </CardTitle>
                                                <CardDescription>เดือน/แบรนด์ที่คะแนนเทรนด์สูงสุด</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {topMovers.up ? (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-xl font-semibold">
                                                                {topMovers.up.brand} — {MONTH_NAMES[topMovers.up.month - 1]}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                trend score: {(topMovers.up.trend_score ?? 0).toFixed(3)}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: getBrandColor(topMovers.up.brand, selectedBrands) }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground">รัน simulation เพื่อดูผล</p>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <TrendingDown className="h-5 w-5 text-red-500" /> Top Downtrend (Brand)
                                                </CardTitle>
                                                <CardDescription>เดือน/แบรนด์ที่คะแนนเทรนด์ต่ำสุด</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {topMovers.down ? (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-xl font-semibold">
                                                                {topMovers.down.brand} — {MONTH_NAMES[topMovers.down.month - 1]}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                trend score: {(topMovers.down.trend_score ?? 0).toFixed(3)}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: getBrandColor(topMovers.down.brand, selectedBrands) }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground">รัน simulation เพื่อดูผล</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* ===== Charts ===== */}
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle>Monthly Sales Comparison</CardTitle>
                                                <CardDescription>จำนวนหน่วยที่ขายต่อเดือนแยกตามแบรนด์</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={transformMonthlyDataForChart(filteredMonthlyData)}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                                                        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                                                        <Tooltip
                                                            content={<CustomTooltip formatValue={(v: number) => v.toLocaleString()} />}
                                                            cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
                                                        />
                                                        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" iconSize={10} />
                                                        {selectedBrands.map((brand) => (
                                                            <Bar
                                                                key={brand}
                                                                dataKey={brand}
                                                                fill={getBrandColor(brand, selectedBrands)}
                                                                radius={[6, 6, 0, 0]}
                                                            />
                                                        ))}
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border bg-card">
                                            <CardHeader>
                                                <CardTitle>Stock Levels Over Time</CardTitle>
                                                <CardDescription>ระดับสินค้าคงคลังตลอด {simulationData.simulation_days} วัน</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <AreaChart data={transformDailyDataForStockChart(filteredDailyData)}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                                                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                                                        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                                                        <Tooltip
                                                            content={<CustomTooltip formatValue={(v: number) => v.toLocaleString()} />}
                                                            cursor={{ stroke: "#9ca3af", strokeWidth: 1, strokeDasharray: "5 5" }}
                                                        />
                                                        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" iconSize={10} />
                                                        {selectedBrands.map((brand, index) => (
                                                            <Area
                                                                key={brand}
                                                                type="monotone"
                                                                dataKey={brand}
                                                                stackId={index + 1}
                                                                stroke={getBrandColor(brand, selectedBrands)}
                                                                fill={getBrandColor(brand, selectedBrands)}
                                                                fillOpacity={0.7}
                                                                strokeWidth={2}
                                                            />
                                                        ))}
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* ===== BRAND Trend Score by Month ===== */}
                                    <Card className="border-border bg-card">
                                        <CardHeader>
                                            <CardTitle>Monthly Trend Score (Brand, −1..+1)</CardTitle>
                                            <CardDescription>คะแนนเทรนด์ต่อเดือนของแต่ละแบรนด์ (growth vs baseline + MoM)</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={320}>
                                                <LineChart data={trendChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                                                    <YAxis
                                                        domain={[-1, 1]}
                                                        tickFormatter={(v) => v.toFixed(1)}
                                                        tick={{ fontSize: 12, fill: "#6b7280" }}
                                                        stroke="#9ca3af"
                                                    />
                                                    <Tooltip content={<CustomTooltip formatValue={(v: number) => v.toFixed(3)} />} />
                                                    <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" iconSize={10} />
                                                    {selectedBrands.map((brand) => (
                                                        <Line
                                                            key={brand}
                                                            type="monotone"
                                                            dataKey={brand}
                                                            stroke={getBrandColor(brand, selectedBrands)}
                                                            dot={false}
                                                            strokeWidth={2}
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    {/* ===== PRODUCT Trend Leaderboard ===== */}
                                    <Card className="border-border bg-card">
                                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                                            <div>
                                                <CardTitle>Product Trend Leaderboard</CardTitle>
                                                <CardDescription>บอกรุ่นไหนขึ้นเทรนด์/ตกเทรนด์ เดือนล่าสุดหรือเดือนที่เลือก</CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-muted-foreground">Month</label>
                                                <select
                                                    value={monthFilter}
                                                    onChange={(e) =>
                                                        setMonthFilter(e.target.value === "latest" ? "latest" : Number(e.target.value))
                                                    }
                                                    className="rounded-md border px-2 py-1 text-sm bg-background"
                                                >
                                                    <option value="latest">Latest</option>
                                                    {monthsAvailable.map((m) => (
                                                        <option key={m} value={m}>
                                                            {MONTH_NAMES[m - 1]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {filteredProductMonthlyTrends.length === 0 ? (
                                                <p className="text-muted-foreground">
                                                    ยังไม่มีข้อมูล product trends — ตรวจสอบว่า backend ส่งฟิลด์ <code>product_monthly_trends</code> แล้ว
                                                </p>
                                            ) : (
                                                <div className="grid gap-6 md:grid-cols-2">
                                                    {/* Uptrend table */}
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <TrendingUp className="h-5 w-5 text-green-600" />
                                                            <h4 className="font-semibold">
                                                                Top Uptrend —{" "}
                                                                {
                                                                    MONTH_NAMES[
                                                                    (productBoards.month ?? monthsAvailable[monthsAvailable.length - 1] ?? 1) - 1
                                                                    ]
                                                                }
                                                            </h4>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-border">
                                                                        <th className="pb-2 text-left font-medium">Brand</th>
                                                                        <th className="pb-2 text-left font-medium">Product</th>
                                                                        <th className="pb-2 text-right font-medium">Score</th>
                                                                        <th className="pb-2 text-right font-medium">Sales</th>
                                                                        <th className="pb-2 text-right font-medium">vs Baseline</th>
                                                                        <th className="pb-2 text-right font-medium">MoM</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {productBoards.up.map((p, idx) => (
                                                                        <tr
                                                                            key={`${p.brand}-${p.product}-${idx}`}
                                                                            className="border-b border-border hover:bg-muted/40"
                                                                        >
                                                                            <td className="py-2 pr-2 whitespace-nowrap">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span
                                                                                        className="inline-block w-2 h-2 rounded-full"
                                                                                        style={{ backgroundColor: getBrandColor(p.brand, selectedBrands) }}
                                                                                    />
                                                                                    {p.brand}
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-2 pr-2 whitespace-nowrap">{p.product}</td>
                                                                            <td className="py-2 text-right font-semibold text-green-600">
                                                                                {(p.trend_score ?? 0).toFixed(3)}
                                                                            </td>
                                                                            <td className="py-2 text-right">{(p.sales ?? 0).toLocaleString()}</td>
                                                                            <td className="py-2 text-right">
                                                                                {((p.growth_vs_baseline ?? 0) * 100).toFixed(1)}%
                                                                            </td>
                                                                            <td className="py-2 text-right">{((p.mom_growth ?? 0) * 100).toFixed(1)}%</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Downtrend table */}
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <TrendingDown className="h-5 w-5 text-red-600" />
                                                            <h4 className="font-semibold">
                                                                Top Downtrend —{" "}
                                                                {
                                                                    MONTH_NAMES[
                                                                    (productBoards.month ?? monthsAvailable[monthsAvailable.length - 1] ?? 1) - 1
                                                                    ]
                                                                }
                                                            </h4>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-border">
                                                                        <th className="pb-2 text-left font-medium">Brand</th>
                                                                        <th className="pb-2 text-left font-medium">Product</th>
                                                                        <th className="pb-2 text-right font-medium">Score</th>
                                                                        <th className="pb-2 text-right font-medium">Sales</th>
                                                                        <th className="pb-2 text-right font-medium">vs Baseline</th>
                                                                        <th className="pb-2 text-right font-medium">MoM</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {productBoards.down.map((p, idx) => (
                                                                        <tr
                                                                            key={`${p.brand}-${p.product}-${idx}`}
                                                                            className="border-b border-border hover:bg-muted/40"
                                                                        >
                                                                            <td className="py-2 pr-2 whitespace-nowrap">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span
                                                                                        className="inline-block w-2 h-2 rounded-full"
                                                                                        style={{ backgroundColor: getBrandColor(p.brand, selectedBrands) }}
                                                                                    />
                                                                                    {p.brand}
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-2 pr-2 whitespace-nowrap">{p.product}</td>
                                                                            <td className="py-2 text-right font-semibold text-red-600">
                                                                                {(p.trend_score ?? 0).toFixed(3)}
                                                                            </td>
                                                                            <td className="py-2 text-right">{(p.sales ?? 0).toLocaleString()}</td>
                                                                            <td className="py-2 text-right">
                                                                                {((p.growth_vs_baseline ?? 0) * 100).toFixed(1)}%
                                                                            </td>
                                                                            <td className="py-2 text-right">{((p.mom_growth ?? 0) * 100).toFixed(1)}%</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* ===== PRODUCT Trend Feed (collapsible component) ===== */}
                                    <ProductTrendFeed
                                        events={productTrendEvents}
                                        selectedBrands={selectedBrands}
                                        getBrandColor={getBrandColor}
                                        defaultOpen={false}
                                        initialLimit={4}
                                        groupBy="brand" // หรือ "month"
                                    />

                                    {/* ===== BRAND Trend Matrix ===== */}
                                    <Card className="border-border bg-card">
                                        <CardHeader>
                                            <CardTitle>Trend Matrix (Brand)</CardTitle>
                                            <CardDescription>ลูกศรบอกสถานะเทรนด์รายเดือน (up / down / sideways)</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-border">
                                                            <th className="pb-3 text-left font-medium">Brand</th>
                                                            {MONTH_NAMES.map((m) => (
                                                                <th key={m} className="pb-3 text-center font-medium w-16">
                                                                    {m}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedBrands.map((brand) => (
                                                            <tr key={brand} className="border-b border-border">
                                                                <td className="py-3 font-medium whitespace-nowrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="inline-block w-2 h-2 rounded-full"
                                                                            style={{ backgroundColor: getBrandColor(brand, selectedBrands) }}
                                                                        />
                                                                        {brand}
                                                                    </div>
                                                                </td>
                                                                {MONTH_NAMES.map((_, i) => {
                                                                    const cell = trendMatrix[brand]?.[i + 1]
                                                                    let icon = "—"
                                                                    let color = "text-muted-foreground"
                                                                    if (cell) {
                                                                        if (cell.trend === "uptrend") {
                                                                            icon = "▲"
                                                                            color = "text-green-600"
                                                                        } else if (cell.trend === "downtrend") {
                                                                            icon = "▼"
                                                                            color = "text-red-600"
                                                                        } else {
                                                                            icon = "▶"
                                                                            color = "text-gray-500"
                                                                        }
                                                                    }
                                                                    return (
                                                                        <td key={i} className="py-3 text-center align-middle">
                                                                            <span
                                                                                className={`text-sm font-semibold ${color}`}
                                                                                title={cell ? `score: ${(cell.score).toFixed(3)}` : "no data"}
                                                                            >
                                                                                {icon}
                                                                            </span>
                                                                        </td>
                                                                    )
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Regional Performance */}
                                    <Card className="border-border bg-card">
                                        <CardHeader>
                                            <CardTitle>Regional Sales Performance</CardTitle>
                                            <CardDescription>จำนวนหน่วยขายทั้งหมดแยกตามภูมิภาค</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={350}>
                                                <BarChart data={calculateRegionalData(filteredSummary)} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                                                    <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#9ca3af" />
                                                    <YAxis
                                                        dataKey="region"
                                                        type="category"
                                                        width={80}
                                                        tick={{ fontSize: 12, fill: "#6b7280" }}
                                                        stroke="#9ca3af"
                                                    />
                                                    <Tooltip
                                                        content={<CustomTooltip formatValue={(v: number) => v.toLocaleString()} />}
                                                        cursor={{ fill: "rgba(0,0,0,0.05)" }}
                                                    />
                                                    <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" iconSize={10} />
                                                    {selectedBrands.map((brand) => (
                                                        <Bar
                                                            key={brand}
                                                            dataKey={brand}
                                                            fill={getBrandColor(brand, selectedBrands)}
                                                            radius={[0, 6, 6, 0]}
                                                        />
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Summary Table */}
                                    <Card className="border-border bg-card">
                                        <CardHeader>
                                            <CardTitle>Simulation Summary</CardTitle>
                                            <CardDescription>การเปรียบเทียบแบรนด์ที่เลือกอย่างครบถ้วน</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-border">
                                                            <th className="pb-3 text-left font-medium">Brand</th>
                                                            <th className="pb-3 text-right font-medium">Units Sold</th>
                                                            <th className="pb-3 text-right font-medium">Revenue</th>
                                                            <th className="pb-3 text-right font-medium">Transactions</th>
                                                            <th className="pb-3 text-right font-medium">Restocks</th>
                                                            <th className="pb-3 text-right font-medium">Stockout Days</th>
                                                            <th className="pb-3 text-right font-medium">Avg Stock</th>
                                                            <th className="pb-3 text-right font-medium">Final Stock</th>
                                                            <th className="pb-3 text-right font-medium">Lost Sales %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredSummary.map((data) => (
                                                            <tr key={data.brand} className="border-b border-border">
                                                                <td className="py-3 font-medium">{data.brand}</td>
                                                                <td className="py-3 text-right">{data.total_units_sold.toLocaleString()}</td>
                                                                <td className="py-3 text-right">{formatCurrency(data.total_revenue)}</td>
                                                                <td className="py-3 text-right">{data.transactions}</td>
                                                                <td className="py-3 text-right">{data.restock_count}</td>
                                                                <td className="py-3 text-right">{data.stockout_days}</td>
                                                                <td className="py-3 text-right">{Math.round(data.avg_stock).toLocaleString()}</td>
                                                                <td className="py-3 text-right">{data.final_stock.toLocaleString()}</td>
                                                                <td className="py-3 text-right">{data.lost_sales_rate.toFixed(2)}%</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </>
                    ) : (
                        <Card className="border-border bg-card">
                            <CardContent className="flex items-center justify-center py-12">
                                <p className="text-muted-foreground">Please select at least one brand to begin simulation</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </>
    )
}
