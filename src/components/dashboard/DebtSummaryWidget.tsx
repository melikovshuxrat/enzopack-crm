import { KpiCard } from '../common/KpiCard'
import { formatMoney } from '../../lib/formatters'
import { useClients } from '../../hooks/useClients'
import { useSuppliers } from '../../hooks/useSuppliers'
import { useClientBalances, useSupplierBalances } from '../../hooks/useDebts'

export function DebtSummaryWidget() {
  const { data: clients = [] } = useClients()
  const { data: suppliers = [] } = useSuppliers()
  const { data: clientBalances, isLoading: clientsLoading } = useClientBalances()
  const { data: supplierBalances, isLoading: suppliersLoading } = useSupplierBalances()

  const clientDebts = clients
    .map((c) => ({ id: c.id, name: c.name, company: c.company, debt: clientBalances?.[c.id]?.debt ?? 0 }))
    .filter((c) => c.debt > 0)
    .sort((a, b) => b.debt - a.debt)

  const supplierDebts = suppliers
    .map((s) => ({ id: s.id, name: s.name, debt: supplierBalances?.[s.id]?.debt ?? 0 }))
    .filter((s) => s.debt > 0)
    .sort((a, b) => b.debt - a.debt)

  const owedToUs = clientDebts.reduce((s, c) => s + c.debt, 0)
  const weOwe = supplierDebts.reduce((s, sup) => s + sup.debt, 0)
  const isLoading = clientsLoading || suppliersLoading

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-5">
      <div className="text-sm font-medium text-brand-ink mb-3">Задолженность</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard label="Нам должны" value={isLoading ? '…' : formatMoney(owedToUs)} tone="income" />
        <KpiCard label="Мы должны" value={isLoading ? '…' : formatMoney(weOwe)} tone="expense" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-brand-gray-dark mb-2">Клиенты должны нам</div>
          {clientDebts.length === 0 ? (
            <div className="text-xs text-brand-gray-dark">Должников нет</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {clientDebts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-brand-ink truncate">
                    {c.name}
                    {c.company ? ` (${c.company})` : ''}
                  </span>
                  <span className="font-semibold text-green-700 whitespace-nowrap">{formatMoney(c.debt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold text-brand-gray-dark mb-2">Мы должны поставщикам</div>
          {supplierDebts.length === 0 ? (
            <div className="text-xs text-brand-gray-dark">Долгов нет</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {supplierDebts.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-brand-ink truncate">{s.name}</span>
                  <span className="font-semibold text-red-600 whitespace-nowrap">{formatMoney(s.debt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
