import { useNavigate } from 'react-router-dom'
import { KpiCard } from '../common/KpiCard'
import { formatMoney } from '../../lib/formatters'
import { useFinanceSummary } from '../../hooks/useFinance'

export function FinanceSummaryWidget({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useFinanceSummary(from, to)
  const navigate = useNavigate()

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-5">
      <div className="text-sm font-medium text-brand-ink mb-3">Финансы за период</div>
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Приход"
          value={isLoading ? '…' : formatMoney(data?.income ?? 0)}
          tone="income"
          onClick={() => navigate('/finance?tab=income')}
        />
        <KpiCard
          label="Расход"
          value={isLoading ? '…' : formatMoney(data?.expense ?? 0)}
          tone="expense"
          onClick={() => navigate('/finance?tab=expense')}
        />
        <KpiCard
          label="Итог"
          value={isLoading ? '…' : formatMoney(data?.net ?? 0)}
          tone={(data?.net ?? 0) < 0 ? 'warning' : 'default'}
          onClick={() => navigate('/finance?tab=cash')}
        />
      </div>
    </div>
  )
}
