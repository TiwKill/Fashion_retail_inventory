"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Store } from "lucide-react"
import { getAvailableBrands } from "@/lib/api"

type BrandSelectorProps = {
    selectedBrands: string[]
    onBrandsChange: (brands: string[]) => void
}

export function BrandSelector({ selectedBrands, onBrandsChange }: BrandSelectorProps) {
    const [availableBrands, setAvailableBrands] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                setIsLoading(true)
                const data = await getAvailableBrands()
                setAvailableBrands(data.brands)

                // Auto-select main brands if no brands are selected
                if (selectedBrands.length === 0 && data.main_brands.length > 0) {
                    onBrandsChange(data.main_brands.slice(0, 3))
                }
            } catch (err) {
                console.error("[v0] Failed to fetch available brands:", err)
                setError(err instanceof Error ? err.message : "Failed to load brands")
            } finally {
                setIsLoading(false)
            }
        }

        fetchBrands()
    }, [])

    const handleBrandToggle = (brand: string) => {
        if (selectedBrands.includes(brand)) {
            onBrandsChange(selectedBrands.filter((b) => b !== brand))
        } else {
            onBrandsChange([...selectedBrands, brand])
        }
    }

    const handleSelectAll = () => {
        onBrandsChange(availableBrands)
    }

    const handleClearAll = () => {
        onBrandsChange([])
    }

    if (isLoading) {
        return (
            <Card className="border-border bg-card">
                <CardContent className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground">Loading available brands...</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="border-destructive bg-destructive/10">
                <CardContent className="py-6">
                    <p className="text-destructive">Error: {error}</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border bg-card">
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Store className="h-6 w-6" />
                            Select Brands to Simulate
                        </CardTitle>
                        <CardDescription className="mt-1.5">
                            เลือกแบรนด์ที่จะรวมอยู่ในการจำลองสินค้าคงคลังของคุณ (มีให้เลือก {availableBrands.length} แบรนด์)
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSelectAll} variant="outline" size="sm">
                            Select All
                        </Button>
                        <Button onClick={handleClearAll} variant="outline" size="sm">
                            Clear All
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {availableBrands.map((brand) => (
                        <div
                            key={brand}
                            className={`flex items-center space-x-2 rounded-lg border p-3 transition-colors ${selectedBrands.includes(brand)
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-muted/30 hover:bg-muted/50"
                                }`}
                        >
                            <Checkbox
                                id={`brand-${brand}`}
                                checked={selectedBrands.includes(brand)}
                                onCheckedChange={() => handleBrandToggle(brand)}
                            />
                            <Label
                                htmlFor={`brand-${brand}`}
                                className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {brand}
                            </Label>
                        </div>
                    ))}
                </div>
                {selectedBrands.length > 0 && (
                    <div className="mt-4 rounded-lg bg-primary/10 p-3 border border-primary/20">
                        <p className="text-sm font-medium text-primary">
                            Selected: {selectedBrands.length} brand{selectedBrands.length !== 1 ? "s" : ""} -{" "}
                            {selectedBrands.join(", ")}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
