import { useState } from 'react'
import { DateRangeFilter, DEFAULT_DATE_RANGE, type DateRange } from '../components/common/DateRangeFilter'
import { KpiCard } from '../components/common/KpiCard'
import { ProductionTrendChart } from '../components/dashboard/ProductionTrendChart'
import { ShortageTopWidget } from '../components/dashboard/ShortageTopWidget'
import { FinanceSummaryWidget } from '../components/dashboard/FinanceSummaryWidget'
import { useDashboardKpi, useProductionTrend, useShortageTop } from '../hooks/useDashboard'
import { formatNumber } from '../lib/formatters'

export function DashboardPage() {
  const [range, setRange] = useState<DateRange>(DEFAULT_DATE_RANGE)
  const { data: kpi, isLoading } = useDashboardKpi(range.from, range.to)
  const { data: trend = [] } = useProductionTrend()
  const { data: shortages = [] } = useShortageTop(8)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Дашборд</h1>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="flex gap-4 flex-wrap mb-6">
        <KpiCard
          label="Изготовлено за период"
          value={isLoading ? '…' : `${formatNumber(Number(kpi?.produced_qty ?? 0))} шт`}
        />
        <KpiCard
          label="Объём заказов"
          value={isLoading ? '…' : formatNumber(Number(kpi?.orders_count ?? 0))}
          hint={`Активных: ${formatNumber(Number(kpi?.active_orders ?? 0))}`}
        />
        <KpiCard
          label="Дефицит сырья"
          value={isLoading ? '…' : formatNumber(Number(kpi?.shortage_materials_count ?? 0))}
          hint="позиций не хватает"
          tone={Number(kpi?.shortage_materials_count ?? 0) > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ProductionTrendChart data={trend} />
        <ShortageTopWidget data={shortages} />
      </div>

      <div>
        <FinanceSummaryWidget from={range.from} to={range.to} />
      </div>
    </div>
  )
}
