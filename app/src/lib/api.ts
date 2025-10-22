import axios from "axios"
import type { BrandConfig, BrandConfigs, SimulationResponse, MonthlyData, DailyData, BrandSummary } from "@/types/index"

export type SimulationRequest = Record<string, BrandConfig> & {
    festival_multipliers?: Record<string, number>
    simulation_days: number
    use_historical_data: boolean
    start_day?: number
    end_day?: number
    festival_demand?: {
        multipliers: Record<string, number>
        start_day: number
        end_day: number
        total_days: number
    }
}

export type { BrandConfig, BrandConfigs, SimulationResponse, MonthlyData, DailyData, BrandSummary }

// Create axios instance with base configuration
const apiClient = axios.create({
    baseURL: "http://localhost:8000",
    timeout: 30000, // 30 seconds timeout
    headers: {
        "Content-Type": "application/json",
    },
})

// Add request interceptor for logging
apiClient.interceptors.request.use(
    (config) => {
        console.log(`🚀 Making ${config.method?.toUpperCase()} request to: ${config.url}`)
        return config
    },
    (error) => {
        console.error("❌ Request error:", error)
        return Promise.reject(error)
    },
)

// Add response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => {
        console.log(`✅ Received response from: ${response.config.url}`)
        return response
    },
    (error) => {
        console.error("❌ Response error:", error)

        if (error.response) {
            // Server responded with error status
            console.error(`Status: ${error.response.status}`)
            console.error(`Data:`, error.response.data)
        } else if (error.request) {
            // Request was made but no response received
            console.error("No response received from server")
        } else {
            // Something else happened
            console.error("Error setting up request:", error.message)
        }

        return Promise.reject(error)
    },
)

export async function runSimulation(config: SimulationRequest): Promise<SimulationResponse> {
    try {
        const response = await apiClient.post<SimulationResponse>("/simulate", config)
        return response.data
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.detail || error.message
            throw new Error(`API request failed: ${errorMessage}`)
        }
        throw new Error(`Unexpected error: ${error}`)
    }
}

// Transform monthly data from API to chart format
export function transformMonthlyDataForChart(monthlyData: MonthlyData[]) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    // Get unique brands
    const brands = [...new Set(monthlyData.map((d) => d.brand))]

    // Group by month
    const monthlyMap = new Map<number, Record<string, number>>()

    monthlyData.forEach((data) => {
        if (!monthlyMap.has(data.month)) {
            const brandData: Record<string, number> = {}
            brands.forEach((brand) => {
                brandData[brand] = 0
            })
            monthlyMap.set(data.month, brandData)
        }
        const monthData = monthlyMap.get(data.month)!
        monthData[data.brand] = data.total_sales
    })

    // Convert to array format
    return Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([month, data]) => ({
            month: months[month - 1],
            ...data,
        }))
}

// Transform daily data to stock level chart format
export function transformDailyDataForStockChart(dailyData: DailyData[]) {
    // Get unique brands
    const brands = [...new Set(dailyData.map((d) => d.brand))]

    const stockMap = new Map<number, Record<string, number>>()

    dailyData.forEach((data) => {
        if (!stockMap.has(data.day)) {
            const brandData: Record<string, number> = {}
            brands.forEach((brand) => {
                brandData[brand] = 0
            })
            stockMap.set(data.day, brandData)
        }
        const dayData = stockMap.get(data.day)!
        dayData[data.brand] = data.stock_after
    })

    // Sample every 30 days
    const sampledData: Array<{ day: number } & Record<string, number>> = []
    Array.from(stockMap.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([day, data]) => {
            if (day % 30 === 0 || day === 0) {
                sampledData.push({
                    day,
                    ...data,
                })
            }
        })

    return sampledData
}

// Calculate regional data from daily data (mock distribution)
export function calculateRegionalData(summary: BrandSummary[]) {
    const regions = ["Midwest", "Northeast", "South", "Southeast", "West"]
    const distribution = [0.15, 0.2, 0.22, 0.18, 0.25] // Regional distribution percentages

    return regions.map((region, index) => {
        const data: any = { region }
        summary.forEach((brand) => {
            data[brand.brand] = Math.round(brand.total_units_sold * distribution[index])
        })
        return data
    })
}

// Additional utility functions with axios
export async function getBrandParameters() {
    try {
        const response = await apiClient.get("/brand-params")
        return response.data
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.detail || error.message
            throw new Error(`Failed to get brand parameters: ${errorMessage}`)
        }
        throw new Error(`Unexpected error: ${error}`)
    }
}

export async function healthCheck() {
    try {
        const response = await apiClient.get("/health")
        return response.data
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.detail || error.message
            throw new Error(`Health check failed: ${errorMessage}`)
        }
        throw new Error(`Unexpected error: ${error}`)
    }
}

export async function getAvailableBrands(): Promise<{ brands: string[]; count: number; main_brands: string[] }> {
    try {
        const response = await apiClient.get("/available-brands")
        return response.data
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.detail || error.message
            throw new Error(`Failed to get available brands: ${errorMessage}`)
        }
        throw new Error(`Unexpected error: ${error}`)
    }
}

// Export axios instance for custom usage
export { apiClient }
