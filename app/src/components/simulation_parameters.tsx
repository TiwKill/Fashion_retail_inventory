"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RefreshCw, Play, Loader2, Calendar, ChevronDown, ChevronUp, Settings } from "lucide-react"
import { runSimulation, getBrandParameters } from "@/lib/api"
import type { BrandConfig, BrandConfigs, SimulationResponse, BrandParametersResponse } from "@/types/index"
import { defaultConfigs } from "@/types/index"
import { brandToApiKey } from "@/lib/utils"

type SimulationParametersProps = {
    configs: BrandConfigs
    setConfigs: (configs: BrandConfigs) => void
    onRunSimulation: (data: SimulationResponse) => void
    setIsLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    selectedBrands: string[]
}

const FESTIVALS = [
    { id: "new_year", name: "New Year Sale", defaultMultiplier: 1.8 },
    { id: "valentines", name: "Valentine's Day", defaultMultiplier: 1.3 },
    { id: "womens_day", name: "Women's Day", defaultMultiplier: 1.2 },
    { id: "songkran", name: "Songkran", defaultMultiplier: 1.4 },
    { id: "mothers_day", name: "Mother's Day", defaultMultiplier: 1.5 },
    { id: "midyear", name: "Mid-Year Sale", defaultMultiplier: 1.6 },
    { id: "fathers_day", name: "Father's Day", defaultMultiplier: 1.3 },
    { id: "back_to_school", name: "Back to School", defaultMultiplier: 1.7 },
    { id: "halloween", name: "Halloween", defaultMultiplier: 1.2 },
    { id: "singles_day", name: "Singles' Day (11.11)", defaultMultiplier: 2.5 },
    { id: "black_friday", name: "Black Friday", defaultMultiplier: 2.2 },
    { id: "cyber_monday", name: "Cyber Monday", defaultMultiplier: 2.0 },
    { id: "christmas", name: "Christmas", defaultMultiplier: 2.0 },
    { id: "year_end", name: "Year-End Sale", defaultMultiplier: 1.9 },
]

const getMonthRangeFromDays = (startDay: number, endDay: number) => {
    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]

    // Calculate which month each day falls into (assuming 30 days per month for simplicity)
    const startMonth = Math.floor((startDay - 1) / 30)
    const endMonth = Math.floor((endDay - 1) / 30)

    const startDayInMonth = ((startDay - 1) % 30) + 1
    const endDayInMonth = ((endDay - 1) % 30) + 1

    const totalDays = endDay - startDay + 1

    return {
        startMonth: Math.min(startMonth, 11),
        endMonth: Math.min(endMonth, 11),
        startDayInMonth,
        endDayInMonth,
        totalDays,
        displayText: `${monthNames[Math.min(startMonth, 11)]} ${startDayInMonth} - ${monthNames[Math.min(endMonth, 11)]} ${endDayInMonth} (${totalDays} days)`,
    }
}

export default function SimulationParameters({
    configs,
    setConfigs,
    onRunSimulation,
    setIsLoading,
    setError,
    selectedBrands,
}: SimulationParametersProps) {
    const [simulationRange, setSimulationRange] = useState<[number, number]>([1, 365])
    const [useHistoricalData, setUseHistoricalData] = useState(true)
    const [isLoadingParams, setIsLoadingParams] = useState(true)
    const [apiDefaultConfigs, setApiDefaultConfigs] = useState<BrandConfigs>(defaultConfigs)
    const [festivalMultipliers, setFestivalMultipliers] = useState<Record<string, number>>(
        Object.fromEntries(FESTIVALS.map((f) => [f.id, f.defaultMultiplier])),
    )
    const [showFestivalSettings, setShowFestivalSettings] = useState(false)

    useEffect(() => {
        const fetchBrandParameters = async () => {
            try {
                setIsLoadingParams(true)
                const params = (await getBrandParameters()) as BrandParametersResponse

                const configsFromApi: BrandConfigs = {}
                selectedBrands.forEach((brand) => {
                    if (params[brand]) {
                        configsFromApi[brand] = {
                            ...params[brand].calculated_config,
                            enable_reorder: false,
                        }
                    } else {
                        configsFromApi[brand] = {
                            initial_stock: 4000,
                            restock_days: 20,
                            restock_quantity: 2500,
                            reorder_quantity: 1000,
                            reorder_point: 800,
                            demand_multiplier: 1.0,
                            enable_reorder: false,
                        }
                    }
                })

                setApiDefaultConfigs(configsFromApi)
                setConfigs(configsFromApi)
            } catch (err) {
                console.error("[v0] Failed to fetch brand parameters:", err)

                const fallbackConfigs: BrandConfigs = {}
                selectedBrands.forEach((brand) => {
                    fallbackConfigs[brand] = {
                        ...(defaultConfigs[brand] || {
                            initial_stock: 4000,
                            restock_days: 20,
                            restock_quantity: 2500,
                            reorder_point: 800,
                            demand_multiplier: 1.0,
                        }),
                        reorder_quantity: 1000,
                        enable_reorder: false,
                    }
                })

                setApiDefaultConfigs(fallbackConfigs)
                setConfigs(fallbackConfigs)
            } finally {
                setIsLoadingParams(false)
            }
        }

        if (selectedBrands.length > 0) {
            fetchBrandParameters()
        }
    }, [selectedBrands])

    const updateConfig = (brand: string, field: keyof BrandConfig, value: number | boolean) => {
        setConfigs({
            ...configs,
            [brand]: {
                ...configs[brand],
                [field]: value,
            },
        })
    }

    const updateFestivalMultiplier = (festivalId: string, value: number) => {
        setFestivalMultipliers((prev) => ({
            ...prev,
            [festivalId]: value,
        }))
    }

    const resetConfigs = () => {
        setConfigs(apiDefaultConfigs)
        setSimulationRange([1, 365])
        setUseHistoricalData(true)
        setFestivalMultipliers(Object.fromEntries(FESTIVALS.map((f) => [f.id, f.defaultMultiplier])))
    }

    const handleRunSimulation = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const simulationDays = simulationRange[1] - simulationRange[0] + 1

            // Main brands that have dedicated fields in the backend Pydantic model
            const MAIN_BRANDS = ["H&M", "NIKE", "ADIDAS", "PUMA", "NEW_BALANCE", "CONVERSE", "VANS"]

            const payload: any = {
                simulation_days: simulationDays,
                start_day: simulationRange[0],
                end_day: simulationRange[1],
                use_historical_data: useHistoricalData,
                festival_demand: {
                    multipliers: festivalMultipliers,
                    start_day: simulationRange[0],
                    end_day: simulationRange[1],
                    total_days: simulationDays,
                },
            }

            // Add main brands at root level
            const customBrands: Record<string, BrandConfig> = {}

            selectedBrands.forEach((brand) => {
                const apiKey = brandToApiKey(brand)
                const brandConfig = configs[brand]

                console.log(`[v0] ${brand} reorder status:`, {
                    enable_reorder: brandConfig.enable_reorder,
                    reorder_point: brandConfig.reorder_point,
                    reorder_quantity: brandConfig.reorder_quantity,
                })

                if (MAIN_BRANDS.includes(brand)) {
                    // Main brands go at root level
                    payload[apiKey] = brandConfig
                } else {
                    // Other brands go in custom_brands
                    customBrands[apiKey] = brandConfig
                }
            })

            // Add custom_brands if there are any
            if (Object.keys(customBrands).length > 0) {
                payload.custom_brands = customBrands
            }

            console.log("[v0] Running simulation with complete payload:", payload)

            const response = await runSimulation(payload)

            console.log("[v0] Simulation completed successfully:", response)
            onRunSimulation(response)
        } catch (err) {
            console.error("[v0] Simulation failed:", err)
            setError(err instanceof Error ? err.message : "Failed to run simulation")
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoadingParams) {
        return (
            <Card className="border-border bg-card">
                <CardContent className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Loading brand parameters...</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const monthRange = getMonthRangeFromDays(simulationRange[0], simulationRange[1])

    return (
        <div>
            <>
                <Card className="border-border bg-card">
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-2xl">Simulation Parameters</CardTitle>
                                <CardDescription className="mt-1.5">
                                    กำหนดค่าการตั้งค่าสินค้าคงคลังและรันการจำลองสำหรับแต่ละแบรนด์
                                </CardDescription>
                            </div>
                            <Button onClick={resetConfigs} variant="outline" size="sm" className="w-full sm:w-auto bg-transparent">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reset to Default
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                            <h3 className="font-semibold">Global Settings</h3>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="simulation-range" className="text-sm font-medium">
                                        Simulation Period
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={simulationRange[0]}
                                            onChange={(e) => setSimulationRange([Number(e.target.value), simulationRange[1]])}
                                            className="h-9 w-20 text-right"
                                            min={1}
                                            max={simulationRange[1] - 1}
                                        />
                                        <span className="text-sm text-muted-foreground">to</span>
                                        <Input
                                            type="number"
                                            value={simulationRange[1]}
                                            onChange={(e) => setSimulationRange([simulationRange[0], Number(e.target.value)])}
                                            className="h-9 w-20 text-right"
                                            min={simulationRange[0] + 1}
                                            max={365}
                                        />
                                        <span className="text-sm text-muted-foreground">days</span>
                                    </div>
                                </div>
                                <Slider
                                    value={simulationRange}
                                    onValueChange={(value) => setSimulationRange(value as [number, number])}
                                    min={1}
                                    max={365}
                                    step={1}
                                    className="w-full"
                                />
                                <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <p className="text-sm font-medium text-primary">{monthRange.displayText}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="historical-data" className="text-sm font-medium">
                                        Use Historical Data
                                    </Label>
                                    <p className="text-xs text-muted-foreground">ความต้องการพื้นฐานตามรูปแบบการขายในอดีต</p>
                                </div>
                                <Switch id="historical-data" checked={useHistoricalData} onCheckedChange={setUseHistoricalData} />
                            </div>
                        </div>

                        <Collapsible open={showFestivalSettings} onOpenChange={setShowFestivalSettings}>
                            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Settings className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="font-semibold">Festival Demand Adjustments</h3>
                                    </div>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                            {showFestivalSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            <span className="sr-only">Toggle festival settings</span>
                                        </Button>
                                    </CollapsibleTrigger>
                                </div>

                                <CollapsibleContent className="space-y-4">
                                    <p className="text-xs text-muted-foreground">
                                        ปรับตัวคูณความต้องการสำหรับกิจกรรมพิเศษและเทศกาล
                                    </p>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {FESTIVALS.map((festival) => (
                                            <div key={festival.id} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label htmlFor={`festival-${festival.id}`} className="text-xs font-medium">
                                                        {festival.name}
                                                    </Label>
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            id={`festival-${festival.id}`}
                                                            type="number"
                                                            step="0.1"
                                                            value={festivalMultipliers[festival.id]}
                                                            onChange={(e) => updateFestivalMultiplier(festival.id, Number(e.target.value))}
                                                            className="h-8 w-16 text-right text-xs"
                                                        />
                                                        <span className="text-xs text-muted-foreground">×</span>
                                                    </div>
                                                </div>
                                                <Slider
                                                    value={[festivalMultipliers[festival.id]]}
                                                    onValueChange={([value]) => updateFestivalMultiplier(festival.id, value)}
                                                    min={0.5}
                                                    max={3.0}
                                                    step={0.1}
                                                    className="w-full"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>

                        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                            <h3 className="font-semibold">Brand-Specific Parameters</h3>
                            <p className="text-xs text-muted-foreground">กำหนดค่าการตั้งค่าสินค้าคงคลังสำหรับแต่ละแบรนด์</p>

                            <Accordion type="multiple" className="w-full">
                                {selectedBrands.map((brand) => (
                                    <AccordionItem key={brand} value={brand} className="border-border">
                                        <AccordionTrigger className="hover:no-underline">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-base">{brand}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({configs[brand]?.initial_stock || 0} units initial stock)
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-6 pt-4">
                                                {/* Initial Stock */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor={`${brand}-initial`} className="text-sm font-medium">
                                                            Initial Stock
                                                        </Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                id={`${brand}-initial`}
                                                                type="number"
                                                                value={configs[brand]?.initial_stock || 0}
                                                                onChange={(e) => updateConfig(brand, "initial_stock", Number(e.target.value))}
                                                                className="h-9 w-24 text-right"
                                                            />
                                                            <span className="text-sm text-muted-foreground">units</span>
                                                        </div>
                                                    </div>
                                                    <Slider
                                                        value={[configs[brand]?.initial_stock || 0]}
                                                        onValueChange={([value]) => updateConfig(brand, "initial_stock", value)}
                                                        min={1000}
                                                        max={200000}
                                                        step={100}
                                                        className="w-full"
                                                    />
                                                    <p className="text-xs text-muted-foreground">ระดับสินค้าคงคลังเริ่มต้นสำหรับการจำลอง</p>
                                                </div>

                                                {/* Restock Days */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor={`${brand}-restock-days`} className="text-sm font-medium">
                                                            Restock Frequency
                                                        </Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                id={`${brand}-restock-days`}
                                                                type="number"
                                                                value={configs[brand]?.restock_days || 0}
                                                                onChange={(e) => updateConfig(brand, "restock_days", Number(e.target.value))}
                                                                className="h-9 w-24 text-right"
                                                            />
                                                            <span className="text-sm text-muted-foreground">days</span>
                                                        </div>
                                                    </div>
                                                    <Slider
                                                        value={[configs[brand]?.restock_days || 0]}
                                                        onValueChange={([value]) => updateConfig(brand, "restock_days", value)}
                                                        min={5}
                                                        max={60}
                                                        step={1}
                                                        className="w-full"
                                                    />
                                                    <p className="text-xs text-muted-foreground">สินค้าคงคลังจะถูกเติมบ่อยแค่ไหน</p>
                                                </div>

                                                {/* Restock Quantity */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor={`${brand}-restock-qty`} className="text-sm font-medium">
                                                            Restock Quantity
                                                        </Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                id={`${brand}-restock-qty`}
                                                                type="number"
                                                                value={configs[brand]?.restock_quantity || 0}
                                                                onChange={(e) => updateConfig(brand, "restock_quantity", Number(e.target.value))}
                                                                className="h-9 w-24 text-right"
                                                            />
                                                            <span className="text-sm text-muted-foreground">units</span>
                                                        </div>
                                                    </div>
                                                    <Slider
                                                        value={[configs[brand]?.restock_quantity || 0]}
                                                        onValueChange={([value]) => updateConfig(brand, "restock_quantity", value)}
                                                        min={1000}
                                                        max={200000}
                                                        step={100}
                                                        className="w-full"
                                                    />
                                                    <p className="text-xs text-muted-foreground">จำนวนหน่วยที่เพิ่มต่อการเติมสต๊อก</p>
                                                </div>

                                                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-0.5">
                                                            <Label htmlFor={`${brand}-enable-reorder`} className="text-sm font-medium">
                                                                Enable Automatic Reorder
                                                            </Label>
                                                            <p className="text-xs text-muted-foreground">
                                                                สั่งซื้อซ้ำโดยอัตโนมัติเมื่อสต๊อกลดลงต่ำกว่าจุดสั่งซื้อซ้ำ
                                                            </p>
                                                        </div>
                                                        <Switch
                                                            id={`${brand}-enable-reorder`}
                                                            checked={configs[brand]?.enable_reorder || false}
                                                            onCheckedChange={(checked) => updateConfig(brand, "enable_reorder", checked)}
                                                        />
                                                    </div>

                                                    {configs[brand]?.enable_reorder && (
                                                        <div className="space-y-6 pt-4">
                                                            {/* Reorder Point */}
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <Label htmlFor={`${brand}-reorder`} className="text-sm font-medium">
                                                                        Reorder Point
                                                                    </Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            id={`${brand}-reorder`}
                                                                            type="number"
                                                                            value={configs[brand]?.reorder_point || 0}
                                                                            onChange={(e) => updateConfig(brand, "reorder_point", Number(e.target.value))}
                                                                            className="h-9 w-24 text-right"
                                                                        />
                                                                        <span className="text-sm text-muted-foreground">units</span>
                                                                    </div>
                                                                </div>
                                                                <Slider
                                                                    value={[configs[brand]?.reorder_point || 0]}
                                                                    onValueChange={([value]) => updateConfig(brand, "reorder_point", value)}
                                                                    min={0}
                                                                    max={50000}
                                                                    step={50}
                                                                    className="w-full"
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    Minimum stock level before triggering reorder
                                                                </p>
                                                            </div>

                                                            {/* Reorder Quantity */}
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <Label htmlFor={`${brand}-reorder-qty`} className="text-sm font-medium">
                                                                        Reorder Quantity
                                                                    </Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            id={`${brand}-reorder-qty`}
                                                                            type="number"
                                                                            value={configs[brand]?.reorder_quantity || 0}
                                                                            onChange={(e) => updateConfig(brand, "reorder_quantity", Number(e.target.value))}
                                                                            className="h-9 w-24 text-right"
                                                                        />
                                                                        <span className="text-sm text-muted-foreground">units</span>
                                                                    </div>
                                                                </div>
                                                                <Slider
                                                                    value={[configs[brand]?.reorder_quantity || 0]}
                                                                    onValueChange={([value]) => updateConfig(brand, "reorder_quantity", value)}
                                                                    min={1000}
                                                                    max={200000}
                                                                    step={100}
                                                                    className="w-full"
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    Number of units added when reorder point is triggered
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Demand Multiplier */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor={`${brand}-multiplier`} className="text-sm font-medium">
                                                            Demand Multiplier
                                                        </Label>
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                id={`${brand}-multiplier`}
                                                                type="number"
                                                                step="0.1"
                                                                value={configs[brand]?.demand_multiplier || 0}
                                                                onChange={(e) => updateConfig(brand, "demand_multiplier", Number(e.target.value))}
                                                                className="h-9 w-24 text-right"
                                                            />
                                                            <span className="text-sm text-muted-foreground">×</span>
                                                        </div>
                                                    </div>
                                                    <Slider
                                                        value={[configs[brand]?.demand_multiplier || 0]}
                                                        onValueChange={([value]) => updateConfig(brand, "demand_multiplier", value)}
                                                        min={0.5}
                                                        max={2.0}
                                                        step={0.1}
                                                        className="w-full"
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        ปรับความต้องการ: 1.0 = ปกติ, &gt;1.0 = เพิ่มขึ้น, &lt;1.0 = ลดลง
                                                    </p>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
                            <Button onClick={handleRunSimulation} size="lg" className="w-full sm:w-auto">
                                <Play className="mr-2 h-5 w-5" />
                                Run Simulation
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </>
        </div>
    )
}
