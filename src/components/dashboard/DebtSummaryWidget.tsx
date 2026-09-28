import { KpiCard } from '../common/KpiCard'
import { formatMoney } from '../../lib/formatters'
import { useClientBalances, useSupplierBalances } from '../../hooks/useDebts'

export function DebtSummaryWidget() {
  const { data: clientBalances, isLoading: clientsLoading } = useClientBalances()
  const { data: supplierBalances, isLoading: suppliersLoading } = useSupplierBalances()

  let owedToUs = 0
  for (const b of Object.values(clientBalances ?? {})) owedToUs += Math.max(0, b.debt)

  let weOwe = 0
  for (const b of Object.values(supplierBalances ?? {})) weOwe += Math.max(0, b.debt)

  const isLoading = clientsLoading || suppliersLoading

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-5">
      <div className="text-sm font-medium text-brand-ink mb-3">Задолженность</div>
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Нам должны" value={isLoading ? '…' : formatMoney(owedToUs)} tone="income" />
        <KpiCard label="Мы должны" value={isLoading ? '…' : formatMoney(weOwe)} tone="expense" />
      </div>
    </div>
  )
}
