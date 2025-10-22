export function SiteHeader({ selectedBrands }: { selectedBrands?: string[] }) {
    const brandText =
        selectedBrands && selectedBrands.length > 0 ? selectedBrands.join(", ") : "Select brands to simulate"

    return (
        <header className="sticky top-0 z-50 w-full p-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center px-4 md:px-8">
                <div className="flex flex-1 items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                            Inventory Simulation Dashboard
                        </h1>
                        <p className="text-xs text-muted-foreground md:text-sm">{brandText} - การวิเคราะห์ 365 วัน</p>
                    </div>
                </div>
            </div>
        </header>
    )
}
