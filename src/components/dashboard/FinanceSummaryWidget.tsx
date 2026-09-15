import { KpiCard } from '../common/KpiCard'
import { formatMoney } from '../../lib/formatters'
import { useFinanceSummary } from '../../hooks/useFinance'

export function FinanceSummaryWidget({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useFinanceSummary(from, to)

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-5">
      <div className="text-sm font-medium text-brand-ink mb-3">Финансы за период</div>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Приход" value={isLoading ? '…' : formatMoney(data?.income ?? 0)} tone="income" />
        <KpiCard label="Расход" value={isLoading ? '…' : formatMoney(data?.expense ?? 0)} tone="expense" />
        <KpiCard
          label="Итог"
          value={isLoading ? '…' : formatMoney(data?.net ?? 0)}
          tone={(data?.net ?? 0) < 0 ? 'warning' : 'default'}
        />
      </div>
    </div>
  )
}
