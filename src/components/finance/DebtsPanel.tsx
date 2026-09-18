import { useState } from 'react'
import { formatDate, formatMoney, formatNumber } from '../../lib/formatters'
import { useClients } from '../../hooks/useClients'
import { useSuppliers, useSupplierDeliveries } from '../../hooks/useSuppliers'
import { useClientOrders } from '../../hooks/useOrders'
import {
  useClientBalances,
  useSupplierBalances,
  useOrderPayments,
  useSupplierPayments,
  type Balance,
} from '../../hooks/useDebts'
import { ORDER_STATUS_LABELS } from '../../types/db'

function debtLabel(debt: number, oweLabel: string, overpaidLabel: string): string {
  if (debt > 0) return `${oweLabel}: ${formatMoney(debt)}`
  if (debt < 0) return `${overpaidLabel}: ${formatMoney(-debt)}`
  return '—'
}

/** Positive client debt = they owe us = green. Positive supplier debt = we owe them = red. */
function debtColor(debt: number, positiveIsGood: boolean): string {
  if (debt === 0) return 'text-brand-gray-dark'
  const isGood = debt > 0 ? positiveIsGood : !positiveIsGood
  return isGood ? 'text-green-700' : 'text-red-600'
}

export function DebtsPanel() {
  const [showAllClients, setShowAllClients] = useState(false)
  const [showAllSuppliers, setShowAllSuppliers] = useState(false)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  const { data: clients = [] } = useClients()
  const { data: suppliers = [] } = useSuppliers()
  const { data: clientBalances } = useClientBalances()
  const { data: supplierBalances } = useSupplierBalances()

  const zeroBalance: Balance = { total: 0, paid: 0, debt: 0 }

  const clientRows = clients
    .map((c) => ({ ...c, balance: clientBalances?.get(c.id) ?? zeroBalance }))
    .filter((c) => showAllClients || c.balance.debt !== 0)
    .sort((a, b) => Math.abs(b.balance.debt) - Math.abs(a.balance.debt))

  const supplierRows = suppliers
    .map((s) => ({ ...s, balance: supplierBalances?.get(s.id) ?? zeroBalance }))
    .filter((s) => showAllSuppliers || s.balance.debt !== 0)
    .sort((a, b) => Math.abs(b.balance.debt) - Math.abs(a.balance.debt))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-brand-ink">Клиенты</div>
          <label className="flex items-center gap-1.5 text-xs text-brand-gray-dark cursor-pointer">
            <input
              type="checkbox"
              checked={showAllClients}
              onChange={(e) => setShowAllClients(e.target.checked)}
              className="accent-brand-yellow"
            />
            Показать без долга
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          {clientRows.length === 0 && (
            <div className="text-xs text-brand-gray-dark py-4 text-center">Нет клиентов с долгом</div>
          )}
          {clientRows.map((c) => (
            <div key={c.id} className="border border-brand-border rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left"
              >
                <span className="font-medium text-brand-ink truncate">
                  {c.name}
                  {c.company ? ` (${c.company})` : ''}
                </span>
                <span className={`whitespace-nowrap font-semibold ${debtColor(c.balance.debt, true)}`}>
                  {debtLabel(c.balance.debt, 'Должен', 'Переплата')}
                </span>
              </button>
              {expandedClient === c.id && <ClientDebtDetail clientId={c.id} />}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-brand-ink">Поставщики</div>
          <label className="flex items-center gap-1.5 text-xs text-brand-gray-dark cursor-pointer">
            <input
              type="checkbox"
              checked={showAllSuppliers}
              onChange={(e) => setShowAllSuppliers(e.target.checked)}
              className="accent-brand-yellow"
            />
            Показать без долга
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          {supplierRows.length === 0 && (
            <div className="text-xs text-brand-gray-dark py-4 text-center">Нет поставщиков с долгом</div>
          )}
          {supplierRows.map((s) => (
            <div key={s.id} className="border border-brand-border rounded-xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedSupplier(expandedSupplier === s.id ? null : s.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left"
              >
                <span className="font-medium text-brand-ink truncate">{s.name}</span>
                <span className={`whitespace-nowrap font-semibold ${debtColor(s.balance.debt, false)}`}>
                  {debtLabel(s.balance.debt, 'Мы должны', 'Переплата')}
                </span>
              </button>
              {expandedSupplier === s.id && <SupplierDebtDetail supplierId={s.id} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ClientDebtDetail({ clientId }: { clientId: string }) {
  const { data: orders = [] } = useClientOrders(clientId)
  const { data: payments } = useOrderPayments(clientId)
  const relevant = orders.filter((o) => o.status !== 'cancelled')

  return (
    <div className="border-t border-brand-border px-3 py-2 bg-brand-gray flex flex-col gap-1">
      {relevant.length === 0 ? (
        <div className="text-xs text-brand-gray-dark">Заказов нет</div>
      ) : (
        relevant.map((o) => {
          const paid = payments?.get(o.id) ?? 0
          const debt = Number(o.total_amount) - paid
          return (
            <div key={o.id} className="flex items-center justify-between gap-2 text-xs flex-wrap">
              <span className="flex-1 min-w-0 truncate">
                #{o.product?.code} {o.product?.name} · {ORDER_STATUS_LABELS[o.status]}
              </span>
              <span className="whitespace-nowrap">
                {formatMoney(Number(o.total_amount))} · оплачено {formatMoney(paid)}
              </span>
              {debt !== 0 && (
                <span className={`whitespace-nowrap font-medium ${debtColor(debt, true)}`}>
                  {debtLabel(debt, 'долг', 'переплата')}
                </span>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function SupplierDebtDetail({ supplierId }: { supplierId: string }) {
  const { data: deliveries = [] } = useSupplierDeliveries(supplierId)
  const { data: payments = [] } = useSupplierPayments(supplierId)

  return (
    <div className="border-t border-brand-border px-3 py-2 bg-brand-gray flex flex-col gap-2">
      <div>
        <div className="text-xs font-semibold text-brand-ink mb-1">Поставки</div>
        {deliveries.length === 0 ? (
          <div className="text-xs text-brand-gray-dark">Поставок нет</div>
        ) : (
          <div className="flex flex-col gap-1">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex-1 min-w-0 truncate">
                  #{d.raw_material?.code} {d.raw_material?.name}
                </span>
                <span className="whitespace-nowrap">
                  {formatNumber(Number(d.qty))} {d.raw_material?.unit}
                </span>
                <span className="whitespace-nowrap font-semibold">
                  {d.total_cost ? formatMoney(Number(d.total_cost)) : '—'}
                </span>
                <span className="whitespace-nowrap text-brand-gray-dark">{formatDate(d.delivery_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold text-brand-ink mb-1">Платежи</div>
        {payments.length === 0 ? (
          <div className="text-xs text-brand-gray-dark">Платежей нет</div>
        ) : (
          <div className="flex flex-col gap-1">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex-1 min-w-0 truncate">{p.description || 'Оплата поставщику'}</span>
                <span className="whitespace-nowrap font-semibold text-green-700">{formatMoney(Number(p.amount))}</span>
                <span className="whitespace-nowrap text-brand-gray-dark">{formatDate(p.transaction_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
