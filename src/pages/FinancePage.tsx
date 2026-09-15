import { useState } from 'react'
import { KpiCard } from '../components/common/KpiCard'
import { MoneyInput } from '../components/common/MoneyInput'
import { formatDate, formatMoney } from '../lib/formatters'
import {
  useCashBalance,
  useCreateFinanceTransaction,
  useDeleteFinanceTransaction,
  useFinanceTransactions,
} from '../hooks/useFinance'

const TABS = [
  { key: 'income', label: 'Приход' },
  { key: 'expense', label: 'Расход' },
  { key: 'cash', label: 'Касса' },
] as const

function categoryLabel(category: string | null): string | null {
  if (category === 'order_payment') return 'Оплата по заказу'
  return category
}

export function FinancePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('cash')
  const { data: balance } = useCashBalance()
  const { data: transactions = [] } = useFinanceTransactions(tab === 'cash' ? undefined : tab)
  const create = useCreateFinanceTransaction()
  const del = useDeleteFinanceTransaction()

  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  async function handleAdd() {
    if (!amount || tab === 'cash') return
    await create.mutateAsync({
      type: tab,
      amount,
      description: description || null,
      category: category || null,
      transaction_date: new Date().toISOString().slice(0, 10),
    })
    setAmount(0)
    setDescription('')
    setCategory('')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink mb-6">Финансы</h1>

      <div className="flex gap-3 mb-6">
        <KpiCard label="Приход" value={formatMoney(balance?.income ?? 0)} tone="income" />
        <KpiCard label="Расход" value={formatMoney(balance?.expense ?? 0)} tone="expense" />
        <KpiCard label="Касса" value={formatMoney(balance?.balance ?? 0)} />
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.key
                ? 'bg-brand-yellow text-brand-black'
                : 'bg-white border border-brand-border text-brand-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'cash' && (
        <div className="flex flex-wrap items-end gap-2 bg-white border border-brand-border rounded-xl p-3 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-brand-gray-dark">Сумма</span>
            <MoneyInput
              value={amount}
              onChange={setAmount}
              className="border border-brand-border rounded-lg px-3 py-1.5 text-sm w-32 outline-none focus:border-brand-yellow"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-brand-gray-dark">Категория</span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-brand-border rounded-lg px-3 py-1.5 text-sm w-40 outline-none focus:border-brand-yellow"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <span className="text-xs text-brand-gray-dark">Описание</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border border-brand-border rounded-lg px-3 py-1.5 text-sm w-full outline-none focus:border-brand-yellow"
            />
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!amount || create.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {transactions.map((t) => (
          <div
            key={t.id}
            className={`flex items-center justify-between border rounded-xl px-3 py-2 text-sm ${
              t.type === 'income' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
            }`}
          >
            <span
              className={`font-semibold ${t.type === 'income' ? 'text-red-600' : 'text-green-700'}`}
            >
              {t.type === 'income' ? '+' : '−'}
              {formatMoney(Number(t.amount))}
            </span>
            <span className="text-brand-gray-dark truncate flex-1 mx-3">
              {categoryLabel(t.category) ? `${categoryLabel(t.category)} · ` : ''}
              {t.category === 'order_payment' && t.related_client
                ? t.related_client.name
                : t.description}
            </span>
            <span className="text-brand-gray-dark whitespace-nowrap">
              {formatDate(t.transaction_date)}
            </span>
            <button
              type="button"
              onClick={() => del.mutate(t.id)}
              className="ml-3 text-brand-gray-dark hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center text-brand-gray-dark py-10">Записей пока нет</div>
        )}
      </div>
    </div>
  )
}
