"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, ChevronRight, ChevronDown } from "lucide-react"

type TrendEvent = {
  brand: string
  product: string
  month: number            // 1..12
  from_trend: "uptrend" | "downtrend" | "sideways" | string
  to_trend: "uptrend" | "downtrend" | "sideways" | string
  trend_score?: number
  mom_growth?: number
  growth_vs_baseline?: number
  reason?: string
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const ArrowByTrend = ({ t }: { t: string }) => {
  if (t === "uptrend") return <TrendingUp className="h-4 w-4 text-green-600" />
  if (t === "downtrend") return <TrendingDown className="h-4 w-4 text-red-600" />
  return <span className="text-xs">▶</span>
}

function pct(v?: number) {
  if (typeof v !== "number") return "—"
  return `${(v * 100).toFixed(1)}%`
}

function score(v?: number) {
  if (typeof v !== "number") return "—"
  return v.toFixed(3)
}

function BrandDot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
}

export default function ProductTrendFeed({
  events = [],
  selectedBrands = [],
  getBrandColor,
  defaultOpen = false,
  initialLimit = 4,     // แสดงต่อกลุ่มกี่รายการก่อนกด Show more
  groupBy = "brand",    // "brand" | "month"
}: {
  events: TrendEvent[]
  selectedBrands: string[]
  getBrandColor: (brand: string, selectedBrands: string[]) => string
  defaultOpen?: boolean
  initialLimit?: number
  groupBy?: "brand" | "month"
}) {
  // 1) กรองตามแบรนด์ที่เลือก
  const filtered = useMemo(
    () => events.filter(ev => selectedBrands.includes(ev.brand)),
    [events, selectedBrands]
  )

  // 2) จัดกลุ่ม
  const groups = useMemo(() => {
    const map = new Map<string, TrendEvent[]>()
    filtered
      .slice()
      .sort((a, b) => b.month - a.month) // ล่าสุดก่อน
      .forEach(ev => {
        const key = groupBy === "brand"
          ? `${ev.brand} — ${MONTH_NAMES[(ev.month || 1) - 1]}`
          : `${MONTH_NAMES[(ev.month || 1) - 1]} — ${ev.brand}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(ev)
      })
    return Array.from(map.entries())
  }, [filtered, groupBy])

  // 3) state เปิด/ปิดแต่ละกลุ่ม + limit ต่อกลุ่ม
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => groups.reduce((acc, [k]) => { acc[k] = defaultOpen; return acc }, {} as Record<string, boolean>)
  )
  const [limits, setLimits] = useState<Record<string, number>>(
    () => groups.reduce((acc, [k]) => { acc[k] = initialLimit; return acc }, {} as Record<string, number>)
  )

  const toggleOpen = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }))
  const showMore = (k: string) => setLimits(s => ({ ...s, [k]: s[k] + initialLimit }))
  const showLess = (k: string) => setLimits(s => ({ ...s, [k]: initialLimit }))

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Product Trend Feed</CardTitle>
        <CardDescription>กดหัวข้อเพื่อพับ/ขยาย และกด Show more เพื่อลดความยาวรายการ</CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-muted-foreground">
            ยังไม่มีเหตุการณ์ product trend — ตรวจสอบว่า backend ส่งฟิลด์ <code>product_trend_events</code> แล้ว
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map(([key, items]) => {
              const isOpen = open[key] ?? defaultOpen
              const limit = limits[key] ?? initialLimit
              const visible = isOpen ? items.slice(0, limit) : []

              // สีจากแบรนด์แรกในกลุ่ม
              const brandInKey = key.split(" — ")[0]
              const brandColor = getBrandColor(brandInKey, selectedBrands)

              return (
                <div key={key} className="rounded-md border">
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleOpen(key)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <BrandDot color={brandColor} />
                      <span className="font-semibold">{key}</span>
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                    </div>
                    <div className="text-xs text-muted-foreground">คลิกเพื่อ{isOpen ? "พับ" : "ขยาย"}</div>
                  </button>

                  {/* Group body */}
                  {isOpen && (
                    <>
                      <div className="divide-y">
                        {visible.map((ev, idx) => (
                          <div key={idx} className="px-3 py-3 flex items-start gap-3">
                            <div className="mt-1">
                              <ArrowByTrend t={ev.to_trend} />
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <BrandDot color={getBrandColor(ev.brand, selectedBrands)} />
                                <span className="font-semibold">{ev.brand}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="font-medium">{ev.product}</span>
                                <span className="text-muted-foreground">— {MONTH_NAMES[(ev.month ?? 1) - 1]}</span>
                              </div>
                              <div className="text-sm mt-1">
                                <span className="font-medium">{ev.from_trend} → {ev.to_trend}</span>
                                <span className="text-muted-foreground"> • score {score(ev.trend_score)}</span>
                                <span className="text-muted-foreground"> • MoM={pct(ev.mom_growth)}</span>
                                <span className="text-muted-foreground"> • vsBase={pct(ev.growth_vs_baseline)}</span>
                              </div>
                              {ev.reason && (
                                <div className="text-xs text-muted-foreground mt-1">{ev.reason}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Show more / less */}
                      {items.length > initialLimit && (
                        <div className="p-3 flex items-center justify-center gap-2">
                          {limit < items.length ? (
                            <Button variant="secondary" size="sm" onClick={() => showMore(key)}>
                              Show more ({items.length - limit} more)
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => showLess(key)}>
                              Show less
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
