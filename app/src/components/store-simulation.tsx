"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Play, Pause, RotateCcw, Sparkles, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type Customer = {
    id: number
    x: number
    y: number
    targetX: number
    targetY: number
    state: "entering" | "browsing" | "checkout" | "exiting"
    brand: string
    color: string
    speed: number
    hasPurchased: boolean
}

type Employee = {
    id: number
    x: number
    y: number
    targetX: number
    targetY: number
    state: "idle" | "going-to-shelf" | "restocking" | "returning"
    brand: string
    color: string
    speed: number
    restockTimer: number
    hasRestocked: boolean
    restockQuantity: number
}

type BrandConfig = {
    initial_stock: number
    restock_days: number
    restock_quantity: number
    reorder_point: number
    reorder_quantity: number
    demand_multiplier: number
}

type MonthlyData = {
    month: number
    brand: string
    total_sales: number
    total_revenue: number
    avg_stock: number
    stockout_days: number
}

type RestockEvent = {
    day: number
    brand: string
    quantity: number
    stock_before: number
    stock_after: number
}

type DailyData = {
    day: number
    date: string
    brand: string
    demand: number
    sales: number
    stock_before: number
    stock_after: number
    revenue: number
    stockout: number
    lost_sales: number
    price_per_unit: number
    season: string
    season_type: string
    quarter: string
    festival: string
    festival_multiplier: number
}

type BestSellingProduct = {
    brand: string
    month: number
    product: string
    units_sold: number
}

type BrandConfigs = { [brand: string]: BrandConfig }

type StoreSimulationProps = {
    configs: BrandConfigs
    monthlyData: MonthlyData[]
    restockEvents: RestockEvent[]
    simulationDays: number
    dailyData: DailyData[]
    bestSellingProducts: BestSellingProduct[]
    selectedBrands: string[]
}

const BRAND_COLORS = [
    "#f97316", // orange
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#10b981", // green
    "#ef4444", // red
    "#f59e0b", // amber
    "#06b6d4", // cyan
    "#ec4899", // pink
    "#84cc16", // lime
    "#6366f1", // indigo
    "#14b8a6", // teal
    "#f43f5e", // rose
    "#a855f7", // violet
    "#22c55e", // emerald
    "#eab308", // yellow
    "#0ea5e9", // sky
    "#d946ef", // fuchsia
    "#64748b", // slate
    "#78716c", // stone
    "#dc2626", // red-600
    "#2563eb", // blue-600
    "#7c3aed", // violet-600
    "#059669", // emerald-600
]

export function StoreSimulation({
    configs,
    monthlyData,
    restockEvents,
    simulationDays,
    dailyData,
    bestSellingProducts,
    selectedBrands,
}: StoreSimulationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const customersRef = useRef<Customer[]>([])
    const employeesRef = useRef<Employee[]>([])
    const [isRunning, setIsRunning] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState(0)
    const [currentDay, setCurrentDay] = useState(1)
    const [isMonthComplete, setIsMonthComplete] = useState(false)
    const shouldStopSpawningRef = useRef(false)
    const [currentStock, setCurrentStock] = useState({} as { [brand: string]: number })
    const [stats, setStats] = useState({
        totalCustomers: 0,
        brandCustomers: {} as { [brand: string]: number },
    })
    const animationFrameRef = useRef<number>(0)
    const customerIdRef = useRef(0)
    const employeeIdRef = useRef(0)
    const lastSpawnTimeRef = useRef(0)
    const simulationDayRef = useRef(0)
    const lastDayUpdateRef = useRef(0)
    const lastRestockCheckRef = useRef(0)
    const dailySalesProgressRef = useRef({} as { [brand: string]: number })
    const dailyTargetStockRef = useRef({} as { [brand: string]: number })

    const CANVAS_WIDTH = 1000
    const CANVAS_HEIGHT = 700
    const CUSTOMER_SIZE = 12
    const EMPLOYEE_SIZE = 14
    const DAY_DURATION = 2000

    const ENTRANCE = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30 }
    const EXIT = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 30 }
    const CHECKOUT = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 150 }
    const WAREHOUSE = { x: CANVAS_WIDTH - 100, y: 50 }

    const getShelfPositions = () => {
        const positions: { [brand: string]: { x: number; y: number } } = {}
        const brandCount = selectedBrands.length

        if (brandCount === 0) return positions

        // Calculate grid layout
        const cols = Math.ceil(Math.sqrt(brandCount))
        const rows = Math.ceil(brandCount / cols)

        const startX = 150
        const startY = 150
        const spacingX = (CANVAS_WIDTH - 300) / Math.max(1, cols - 1)
        const spacingY = (CANVAS_HEIGHT - 400) / Math.max(1, rows - 1)

        selectedBrands.forEach((brand, index) => {
            const col = index % cols
            const row = Math.floor(index / cols)
            positions[brand] = {
                x: startX + col * spacingX,
                y: startY + row * spacingY,
            }
        })

        return positions
    }

    const getBrandColors = () => {
        const colors: { [brand: string]: string } = {}
        selectedBrands.forEach((brand, index) => {
            colors[brand] = BRAND_COLORS[index % BRAND_COLORS.length]
        })
        return colors
    }

    const shelfPositions = getShelfPositions()
    const brandColors = getBrandColors()

    const getAvailableMonths = () => {
        const uniqueMonths = [...new Set(monthlyData.map((d) => d.month))].sort((a, b) => a - b)
        return uniqueMonths
    }

    const availableMonths = getAvailableMonths()
    const maxMonthIndex = availableMonths.length - 1

    const getDailyDataForDay = (dayInMonth: number) => {
        const actualMonth = availableMonths[selectedMonth]
        const daysPerMonth = Math.floor(simulationDays / availableMonths.length)
        const absoluteDay = selectedMonth * daysPerMonth + (dayInMonth - 1)

        const dailyDataForBrands = {} as { [brand: string]: DailyData | undefined }

        for (const brand of selectedBrands) {
            // ตรวจสอบว่าเป็นข้อมูลของเดือนที่เลือกเท่านั้น
            const dayData = dailyData.find((d) => d.day === absoluteDay && d.brand === brand)

            // ตรวจสอบว่า date ตรงกับเดือนที่เลือก (รูปแบบ "2024-01-02")
            if (dayData) {
                const dateMonth = parseInt(dayData.date.split('-')[1]) // ดึงเดือนจาก date
                if (dateMonth === actualMonth) {
                    dailyDataForBrands[brand.toLowerCase()] = dayData
                } else {
                    dailyDataForBrands[brand.toLowerCase()] = undefined
                }
            } else {
                dailyDataForBrands[brand.toLowerCase()] = undefined
            }
        }

        return dailyDataForBrands
    }

    const getStartingStockForDay = (dayInMonth: number) => {
        if (dayInMonth === 1) {
            const daysPerMonth = Math.floor(simulationDays / availableMonths.length)
            const absoluteDay = selectedMonth * daysPerMonth - 1

            if (absoluteDay >= 0) {
                const startingStockForBrands = {} as { [brand: string]: number }

                for (const brand of selectedBrands) {
                    const previousDayData = dailyData.find((d) => d.day === absoluteDay && d.brand === brand)
                    // ตรวจสอบว่าเป็นข้อมูลของเดือนที่เลือก
                    if (previousDayData) {
                        const dateMonth = parseInt(previousDayData.date.split('-')[1])
                        if (dateMonth === availableMonths[selectedMonth]) {
                            startingStockForBrands[brand.toLowerCase()] = previousDayData.stock_after
                        } else {
                            const brandConfig = configs[brand]
                            startingStockForBrands[brand.toLowerCase()] = brandConfig?.initial_stock || 4000
                        }
                    } else {
                        const brandConfig = configs[brand]
                        startingStockForBrands[brand.toLowerCase()] = brandConfig?.initial_stock || 4000
                    }
                }

                return startingStockForBrands
            }
        }

        const previousDayData = getDailyDataForDay(dayInMonth - 1)
        const startingStockForBrands = {} as { [brand: string]: number }

        for (const brand of selectedBrands) {
            const brandConfig = configs[brand]
            const fallbackStock = brandConfig?.initial_stock || 4000

            // ใช้ข้อมูลจาก previousDayData ถ้ามีและเป็นเดือนที่ถูกต้อง
            if (previousDayData[brand.toLowerCase()]) {
                startingStockForBrands[brand.toLowerCase()] = previousDayData[brand.toLowerCase()]!.stock_after
            } else {
                startingStockForBrands[brand.toLowerCase()] = fallbackStock
            }
        }

        return startingStockForBrands
    }

    const getDailySalesInfo = (dayInMonth: number) => {
        const currentDayData = getDailyDataForDay(dayInMonth)
        const startingStock = getStartingStockForDay(dayInMonth)

        const dailySalesInfoForBrands = {} as {
            [brand: string]: { sales: number; targetStock: number; startingStock: number }
        }

        for (const brand of selectedBrands) {
            const brandKey = brand.toLowerCase()
            dailySalesInfoForBrands[brandKey] = {
                sales: currentDayData[brandKey]?.sales || 0,
                targetStock: currentDayData[brandKey]?.stock_after || startingStock[brandKey],
                startingStock: startingStock[brandKey],
            }
        }

        return dailySalesInfoForBrands
    }

    const getMonthlyStockLevels = () => {
        return getStartingStockForDay(1)
    }

    const getMonthlySales = () => {
        const actualMonth = availableMonths[selectedMonth]
        const monthData = monthlyData.filter((d) => d.month === actualMonth)
        const monthlySalesForBrands = {} as { [brand: string]: number }

        for (const brand of selectedBrands) {
            const brandData = monthData.find((d) => d.brand === brand)
            monthlySalesForBrands[brand.toLowerCase()] = brandData?.total_sales || 0
        }

        monthlySalesForBrands.total = selectedBrands.reduce(
            (sum, brand) => sum + monthlySalesForBrands[brand.toLowerCase()],
            0,
        )

        return monthlySalesForBrands
    }

    const getMonthlyRestockEvents = () => {
        const daysPerMonth = Math.floor(simulationDays / availableMonths.length)
        const startDay = selectedMonth * daysPerMonth
        const endDay = (selectedMonth + 1) * daysPerMonth

        return restockEvents.filter((event) => event.day >= startDay && event.day < endDay)
    }

    const stockLevels = getMonthlyStockLevels()
    const monthlySales = getMonthlySales()
    const monthlyRestocks = getMonthlyRestockEvents()

    const getStockColor = (stock: number) => {
        if (stock > 3000) return "#22c55e"
        if (stock > 1000) return "#eab308"
        return "#ef4444"
    }

    const getSpawnInterval = () => {
        const totalSales = monthlySales.total
        const avgSales = 10000
        const multiplier = avgSales / Math.max(totalSales, 1000)
        return Math.max(500, Math.min(3000, 2000 * multiplier))
    }

    const drawStore = (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = "#fafafa"
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

        ctx.strokeStyle = "#e5e5e5"
        ctx.lineWidth = 1
        for (let x = 0; x < CANVAS_WIDTH; x += 40) {
            for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
                ctx.strokeRect(x, y, 40, 40)
            }
        }

        // Draw warehouse
        ctx.fillStyle = "#6b7280"
        ctx.fillRect(WAREHOUSE.x - 70, WAREHOUSE.y - 40, 140, 80)
        ctx.fillStyle = "#374151"
        ctx.fillRect(WAREHOUSE.x - 65, WAREHOUSE.y - 35, 130, 70)
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 14px sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("WAREHOUSE", WAREHOUSE.x, WAREHOUSE.y - 10)
        ctx.font = "10px sans-serif"
        ctx.fillText("STOCK ROOM", WAREHOUSE.x, WAREHOUSE.y + 10)

        for (const brand of selectedBrands) {
            const shelf = shelfPositions[brand]
            if (!shelf) continue

            const brandColor = getStockColor(currentStock[brand.toLowerCase()])

            ctx.fillStyle = "#1f2937"
            ctx.fillRect(shelf.x - 60, shelf.y - 40, 120, 80)
            ctx.fillStyle = brandColor
            ctx.fillRect(shelf.x - 55, shelf.y - 35, 110, 70)
            ctx.fillStyle = "#ffffff"
            ctx.font = "bold 14px sans-serif"
            ctx.textAlign = "center"
            ctx.fillText(brand.toUpperCase(), shelf.x, shelf.y - 10)
            ctx.font = "11px sans-serif"
            ctx.fillText(`Stock: ${currentStock[brand.toLowerCase()]}`, shelf.x, shelf.y + 10)
        }

        // Draw checkout
        ctx.fillStyle = "#3b82f6"
        ctx.fillRect(CHECKOUT.x - 80, CHECKOUT.y - 30, 160, 60)
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 14px sans-serif"
        ctx.fillText("CHECKOUT", CHECKOUT.x, CHECKOUT.y + 5)

        // Draw entrance/exit
        ctx.fillStyle = "#10b981"
        ctx.fillRect(ENTRANCE.x - 60, ENTRANCE.y - 20, 120, 40)
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 14px sans-serif"
        ctx.fillText("ENTRANCE / EXIT", ENTRANCE.x, ENTRANCE.y + 5)
    }

    const drawCustomer = (ctx: CanvasRenderingContext2D, customer: Customer) => {
        ctx.fillStyle = customer.color
        ctx.beginPath()
        ctx.arc(customer.x, customer.y, CUSTOMER_SIZE, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = "#000000"
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        const angle = Math.atan2(customer.targetY - customer.y, customer.targetX - customer.x)
        ctx.moveTo(customer.x + Math.cos(angle) * 8, customer.y + Math.sin(angle) * 8)
        ctx.lineTo(customer.x + Math.cos(angle + 2.5) * 5, customer.y + Math.sin(angle + 2.5) * 5)
        ctx.lineTo(customer.x + Math.cos(angle - 2.5) * 5, customer.y + Math.sin(angle - 2.5) * 5)
        ctx.closePath()
        ctx.fill()
    }

    const drawEmployee = (ctx: CanvasRenderingContext2D, employee: Employee) => {
        const employeeColor = employee.color.replace(/[0-9a-f]{2}$/, (match) => {
            const val = Number.parseInt(match, 16)
            return Math.max(0, val - 40)
                .toString(16)
                .padStart(2, "0")
        })

        ctx.fillStyle = employeeColor
        ctx.fillRect(employee.x - EMPLOYEE_SIZE / 2, employee.y - EMPLOYEE_SIZE / 2, EMPLOYEE_SIZE, EMPLOYEE_SIZE)

        ctx.strokeStyle = "#000000"
        ctx.lineWidth = 2
        ctx.strokeRect(employee.x - EMPLOYEE_SIZE / 2, employee.y - EMPLOYEE_SIZE / 2, EMPLOYEE_SIZE, EMPLOYEE_SIZE)

        if (employee.state === "going-to-shelf" || employee.state === "restocking") {
            ctx.fillStyle = "#8b4513"
            ctx.fillRect(employee.x - 6, employee.y - 18, 12, 10)
            ctx.strokeStyle = "#000000"
            ctx.lineWidth = 1
            ctx.strokeRect(employee.x - 6, employee.y - 18, 12, 10)
        }

        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        const angle = Math.atan2(employee.targetY - employee.y, employee.targetX - employee.x)
        ctx.moveTo(employee.x + Math.cos(angle) * 8, employee.y + Math.sin(angle) * 8)
        ctx.lineTo(employee.x + Math.cos(angle + 2.5) * 5, employee.y + Math.sin(angle + 2.5) * 5)
        ctx.lineTo(employee.x + Math.cos(angle - 2.5) * 5, employee.y + Math.sin(angle - 2.5) * 5)
        ctx.closePath()
        ctx.fill()
    }

    const spawnCustomer = () => {
        const availableBrands = selectedBrands.filter((brand) => currentStock[brand.toLowerCase()] > 0)

        if (availableBrands.length === 0) {
            return
        }

        const totalWeight = availableBrands.reduce((sum, brand) => sum + monthlySales[brand.toLowerCase()], 0)

        let random = Math.random() * totalWeight
        let selectedBrand = availableBrands[0]

        for (const brand of availableBrands) {
            random -= monthlySales[brand.toLowerCase()]
            if (random <= 0) {
                selectedBrand = brand
                break
            }
        }

        const newCustomer: Customer = {
            id: customerIdRef.current++,
            x: ENTRANCE.x,
            y: ENTRANCE.y,
            targetX: ENTRANCE.x,
            targetY: ENTRANCE.y,
            state: "entering",
            brand: selectedBrand,
            color: brandColors[selectedBrand],
            speed: 4 + Math.random() * 2,
            hasPurchased: false,
        }

        customersRef.current.push(newCustomer)

        setStats((prev) => ({
            totalCustomers: prev.totalCustomers + 1,
            brandCustomers: {
                ...prev.brandCustomers,
                [selectedBrand]: (prev.brandCustomers[selectedBrand] || 0) + 1,
            },
        }))
    }

    const spawnEmployee = (brand: string, restockQuantity: number) => {
        const shelf = shelfPositions[brand]
        if (!shelf) return

        const newEmployee: Employee = {
            id: employeeIdRef.current++,
            x: WAREHOUSE.x,
            y: WAREHOUSE.y,
            targetX: shelf.x,
            targetY: shelf.y,
            state: "going-to-shelf",
            brand,
            color: brandColors[brand],
            speed: 4,
            restockTimer: 0,
            hasRestocked: false,
            restockQuantity,
        }

        employeesRef.current.push(newEmployee)
    }

    const updateCustomer = (customer: Customer): Customer => {
        const dx = customer.targetX - customer.x
        const dy = customer.targetY - customer.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 5) {
            switch (customer.state) {
                case "entering":
                    const shelf = shelfPositions[customer.brand]
                    if (!shelf) return customer

                    return {
                        ...customer,
                        targetX: shelf.x + (Math.random() - 0.5) * 40,
                        targetY: shelf.y + (Math.random() - 0.5) * 40,
                        state: "browsing",
                    }
                case "browsing":
                    return {
                        ...customer,
                        targetX: CHECKOUT.x + (Math.random() - 0.5) * 60,
                        targetY: CHECKOUT.y + (Math.random() - 0.5) * 30,
                        state: "checkout",
                    }
                case "checkout":
                    if (!customer.hasPurchased) {
                        const brandKey = customer.brand.toLowerCase()
                        const dailySalesInfo = getDailySalesInfo(currentDay)
                        const brandInfo = dailySalesInfo[brandKey]

                        const totalDailySales = brandInfo.sales
                        const salesSoFar = dailySalesProgressRef.current[brandKey]
                        const remainingSales = totalDailySales - salesSoFar

                        const stockDecrease = Math.max(
                            1,
                            Math.ceil(
                                remainingSales /
                                Math.max(1, customersRef.current.filter((c) => c.brand === customer.brand && !c.hasPurchased).length),
                            ),
                        )

                        dailySalesProgressRef.current[brandKey] += stockDecrease

                        setCurrentStock((prev) => ({
                            ...prev,
                            [brandKey]: Math.max(0, prev[brandKey] - stockDecrease),
                        }))
                    }
                    return {
                        ...customer,
                        targetX: EXIT.x,
                        targetY: EXIT.y,
                        state: "exiting",
                        hasPurchased: true,
                    }
                case "exiting":
                    return customer
            }
        }

        const moveX = (dx / distance) * customer.speed
        const moveY = (dy / distance) * customer.speed

        return {
            ...customer,
            x: customer.x + moveX,
            y: customer.y + moveY,
        }
    }

    const updateEmployee = (employee: Employee): Employee => {
        const dx = employee.targetX - employee.x
        const dy = employee.targetY - employee.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 5) {
            switch (employee.state) {
                case "going-to-shelf":
                    return {
                        ...employee,
                        state: "restocking",
                        restockTimer: 120,
                    }
                case "restocking":
                    if (employee.restockTimer > 0) {
                        return {
                            ...employee,
                            restockTimer: employee.restockTimer - 1,
                        }
                    }
                    if (!employee.hasRestocked) {
                        setCurrentStock((prev) => ({
                            ...prev,
                            [employee.brand.toLowerCase()]: prev[employee.brand.toLowerCase()] + employee.restockQuantity,
                        }))
                    }
                    return {
                        ...employee,
                        targetX: WAREHOUSE.x,
                        targetY: WAREHOUSE.y,
                        state: "returning",
                        hasRestocked: true,
                    }
                case "returning":
                    return employee
                default:
                    return employee
            }
        }

        const moveX = (dx / distance) * employee.speed
        const moveY = (dy / distance) * employee.speed

        return {
            ...employee,
            x: employee.x + moveX,
            y: employee.y + moveY,
        }
    }

    const animate = useCallback(
        (timestamp: number) => {
            const canvas = canvasRef.current
            if (!canvas) return

            const ctx = canvas.getContext("2d")
            if (!ctx) return

            drawStore(ctx)

            if (lastDayUpdateRef.current === 0) {
                lastDayUpdateRef.current = timestamp
            }

            const daysPerMonth = Math.floor(simulationDays / availableMonths.length)
            if (timestamp - lastDayUpdateRef.current > DAY_DURATION && !isMonthComplete) {
                lastDayUpdateRef.current = timestamp

                const nextDay = currentDay + 1

                if (nextDay > daysPerMonth) {
                    setIsMonthComplete(true)
                    shouldStopSpawningRef.current = true
                    setCurrentDay(daysPerMonth)
                    setIsRunning(false) // หยุดการรันเมื่อครบเดือน
                } else {
                    setCurrentDay(nextDay)

                    const dailySalesInfo = getDailySalesInfo(nextDay)
                    dailySalesProgressRef.current = {} as { [brand: string]: number }
                    dailyTargetStockRef.current = {} as { [brand: string]: number }

                    for (const brand of selectedBrands) {
                        dailySalesProgressRef.current[brand.toLowerCase()] = 0
                        dailyTargetStockRef.current[brand.toLowerCase()] = dailySalesInfo[brand.toLowerCase()]?.targetStock || 0
                    }

                    const previousDayData = getDailyDataForDay(nextDay - 1)
                    const currentDayData = getDailyDataForDay(nextDay)

                    for (const brand of selectedBrands) {
                        if (
                            currentDayData[brand.toLowerCase()] &&
                            previousDayData[brand.toLowerCase()] &&
                            currentDayData[brand.toLowerCase()]!.stock_after > previousDayData[brand.toLowerCase()]!.stock_after
                        ) {
                            const restockAmount =
                                currentDayData[brand.toLowerCase()]!.stock_after - previousDayData[brand.toLowerCase()]!.stock_after
                            spawnEmployee(brand, restockAmount)
                        }
                    }
                }
            }

            customersRef.current = customersRef.current
                .map(updateCustomer)
                .filter((c) => !(c.state === "exiting" && c.y >= CANVAS_HEIGHT - 20))

            employeesRef.current = employeesRef.current
                .map(updateEmployee)
                .filter((e) => !(e.state === "returning" && Math.abs(e.x - WAREHOUSE.x) < 5 && Math.abs(e.y - WAREHOUSE.y) < 5))

            customersRef.current.forEach((customer) => {
                drawCustomer(ctx, customer)
            })

            employeesRef.current.forEach((employee) => {
                drawEmployee(ctx, employee)
            })

            if (isMonthComplete && customersRef.current.length === 0 && employeesRef.current.length === 0) {
                setIsRunning(false)
                return
            }

            const maxConcurrentCustomers = Math.min(100, Math.max(20, Math.floor((monthlySales.total || 0) / 500)))

            const spawnInterval = getSpawnInterval()
            if (
                !shouldStopSpawningRef.current &&
                timestamp - lastSpawnTimeRef.current > spawnInterval &&
                customersRef.current.length < maxConcurrentCustomers
            ) {
                spawnCustomer()
                lastSpawnTimeRef.current = timestamp
            }

            if (isRunning) {
                animationFrameRef.current = requestAnimationFrame(animate)
            }
        },
        [
            isRunning,
            configs,
            currentStock,
            selectedMonth,
            monthlySales,
            monthlyRestocks,
            isMonthComplete,
            currentDay,
            availableMonths,
            selectedBrands,
        ],
    )

    useEffect(() => {
        if (isRunning) {
            animationFrameRef.current = requestAnimationFrame(animate)
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [isRunning, animate])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        drawStore(ctx)
        customersRef.current.forEach((customer) => {
            drawCustomer(ctx, customer)
        })
        employeesRef.current.forEach((employee) => {
            drawEmployee(ctx, employee)
        })
    }, [currentStock, configs, selectedBrands])

    useEffect(() => {
        const startingStock = getStartingStockForDay(1)
        const dailySalesInfo = getDailySalesInfo(1)

        setCurrentStock(startingStock)

        for (const brand of selectedBrands) {
            dailyTargetStockRef.current[brand.toLowerCase()] = dailySalesInfo[brand.toLowerCase()].targetStock
            dailySalesProgressRef.current[brand.toLowerCase()] = 0
        }

        setIsMonthComplete(false)
        shouldStopSpawningRef.current = false
        setCurrentDay(1)
    }, [selectedMonth, selectedBrands])

    const handleReset = () => {
        customersRef.current = []
        employeesRef.current = []
        const brandCustomers: { [brand: string]: number } = {}
        selectedBrands.forEach((brand) => {
            brandCustomers[brand] = 0
        })
        setStats({
            totalCustomers: 0,
            brandCustomers,
        })
        customerIdRef.current = 0
        employeeIdRef.current = 0
        lastSpawnTimeRef.current = 0
        simulationDayRef.current = 0
        lastDayUpdateRef.current = 0
        lastRestockCheckRef.current = 0
        setCurrentDay(1)
        setIsMonthComplete(false)
        shouldStopSpawningRef.current = false
        setIsRunning(true)

        const startingStock = getStartingStockForDay(1)
        const dailySalesInfo = getDailySalesInfo(1)

        setCurrentStock(startingStock)

        for (const brand of selectedBrands) {
            dailyTargetStockRef.current[brand.toLowerCase()] = dailySalesInfo[brand.toLowerCase()].targetStock
            dailySalesProgressRef.current[brand.toLowerCase()] = 0
        }
    }

    const getMonthName = () => {
        const months = [
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
        const actualMonth = availableMonths[selectedMonth]
        return months[actualMonth - 1]
    }

    const getBestSellingProducts = () => {
        const actualMonth = availableMonths[selectedMonth]
        const currentMonthProducts = bestSellingProducts.filter((p) => p.month === actualMonth)
        const bestProductsForBrands = {} as { [brand: string]: BestSellingProduct | undefined }

        for (const brand of selectedBrands) {
            bestProductsForBrands[brand.toLowerCase()] = currentMonthProducts.find((p) => p.brand === brand)
        }

        return bestProductsForBrands
    }

    const bestProducts = getBestSellingProducts()

    const jumpToDay = useCallback(
        (targetDay: number) => {
            customersRef.current = []
            employeesRef.current = []

            customerIdRef.current = 0
            employeeIdRef.current = 0
            lastSpawnTimeRef.current = 0
            lastDayUpdateRef.current = 0

            setCurrentDay(targetDay)

            const startingStock = getStartingStockForDay(targetDay)
            const dailySalesInfo = getDailySalesInfo(targetDay)

            setCurrentStock(startingStock)

            for (const brand of selectedBrands) {
                dailyTargetStockRef.current[brand.toLowerCase()] = dailySalesInfo[brand.toLowerCase()].targetStock
                dailySalesProgressRef.current[brand.toLowerCase()] = 0
            }

            const daysPerMonth = Math.floor(simulationDays / availableMonths.length)
            setIsMonthComplete(targetDay >= daysPerMonth)
            shouldStopSpawningRef.current = targetDay >= daysPerMonth

            if (targetDay < daysPerMonth) {
                setIsRunning(true)
            } else {
                setIsRunning(false)
            }
        },
        [simulationDays, configs, dailyData, selectedMonth, availableMonths, selectedBrands],
    )

    const handleDayChange = (value: number[]) => {
        const targetDay = value[0]
        jumpToDay(targetDay)
    }

    const getCurrentDayInfo = () => {
        const daysPerMonth = Math.floor(simulationDays / availableMonths.length)
        const absoluteDay = selectedMonth * daysPerMonth + (currentDay - 1)

        const currentDayData = dailyData.find((d) => d.day === absoluteDay)

        return {
            season: currentDayData?.season || "",
            seasonType: currentDayData?.season_type || "",
            quarter: currentDayData?.quarter || "",
            festival: currentDayData?.festival || "",
            festivalMultiplier: currentDayData?.festival_multiplier || 1.0,
        }
    }

    const currentDayInfo = getCurrentDayInfo()

    return (
        <Card className="border-border bg-card">
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="text-2xl">Store Simulation</CardTitle>
                        <CardDescription className="mt-1.5">
                            ดูลูกค้าซื้อของและพนักงานเติมสินค้าบนชั้นวางแบบเรียลไทม์
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsRunning(!isRunning)} variant="outline" size="sm" disabled={isMonthComplete}>
                            {isRunning ? (
                                <>
                                    <Pause className="mr-2 h-4 w-4" />
                                    Pause
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Play
                                </>
                            )}
                        </Button>
                        <Button onClick={handleReset} variant="outline" size="sm">
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {(currentDayInfo.season || currentDayInfo.festival) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-4">
                        {currentDayInfo.season && (
                            <div className="flex items-center gap-3">
                                <Sun className="h-5 w-5 text-orange-500" />
                                <div className="flex-1">
                                    <div className="text-xs text-muted-foreground">Current Season</div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{currentDayInfo.season}</span>
                                        <Badge
                                            variant={currentDayInfo.seasonType === "High Season" ? "default" : "secondary"}
                                            className="text-xs"
                                        >
                                            {currentDayInfo.seasonType}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )}
                        {currentDayInfo.festival && (
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-yellow-500" />
                                <div className="flex-1">
                                    <div className="text-xs text-muted-foreground">Active Festival</div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{currentDayInfo.festival}</span>
                                        <Badge variant="destructive" className="text-xs">
                                            {currentDayInfo.festivalMultiplier.toFixed(1)}× Demand
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Viewing Month</Label>
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{getMonthName()}</span>
                            <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1">
                                <span className="text-xs font-medium text-muted-foreground">Day</span>
                                <span className={`text-xl font-bold ${isMonthComplete ? "text-green-600" : "text-primary"}`}>
                                    {currentDay}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Slider
                        value={[selectedMonth]}
                        onValueChange={([value]) => setSelectedMonth(value)}
                        min={0}
                        max={maxMonthIndex}
                        step={1}
                        className="w-full"
                    />

                    <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold text-foreground">Replay Day</Label>
                            <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-1 border border-blue-500/20">
                                <span className="text-xs font-medium text-blue-600">Day {currentDay}</span>
                                <span className="text-xs text-muted-foreground">
                                    of {Math.floor(simulationDays / availableMonths.length)}
                                </span>
                            </div>
                        </div>
                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">
                                Drag the slider to jump to any day and replay from that point
                            </p>
                            <Slider
                                value={[currentDay]}
                                onValueChange={handleDayChange}
                                min={1}
                                max={Math.floor(simulationDays / availableMonths.length)}
                                step={1}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {isMonthComplete ? (
                        <p className="text-xs font-medium text-green-600">
                            ✓ Month simulation complete! Change month or reset to continue.
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Customer activity adjusts based on monthly sales data. {monthlyRestocks.length} restock events this month.
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Monthly Sales</div>
                        <div className="text-2xl font-bold">{monthlySales.total.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground mt-1">จำนวนหน่วยที่ขายทั้งหมด</div>
                    </div>
                    {selectedBrands.map((brand) => (
                        <div key={brand} className="rounded-lg border border-border bg-muted/50 p-3">
                            <div className="text-xs text-muted-foreground">{brand}</div>
                            <div className="text-2xl font-bold" style={{ color: brandColors[brand] }}>
                                {monthlySales[brand.toLowerCase()].toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Stock: {currentStock[brand.toLowerCase()] || 0}</div>
                            {bestProducts[brand.toLowerCase()] && (
                                <div className="text-xs font-medium mt-1 truncate" title={bestProducts[brand.toLowerCase()]!.product}>
                                    {bestProducts[brand.toLowerCase()]!.product}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex justify-center overflow-x-auto">
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        className="rounded-lg border-2 border-border bg-white shadow-lg"
                    />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                    {selectedBrands.map((brand) => (
                        <div key={brand} className="flex items-center gap-2">
                            <div
                                className="h-4 w-4 rounded-full"
                                style={{ backgroundColor: brandColors[brand], border: "2px solid black" }}
                            ></div>
                            <span>{brand}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-gray-700 border-2 border-black"></div>
                        <span>Employee</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
