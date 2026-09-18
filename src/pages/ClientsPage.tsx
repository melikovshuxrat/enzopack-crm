import { useState } from 'react'
import { DataTable, type DataTableColumn } from '../components/common/DataTable'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { formatDate, formatMoney, formatNumber, getDeleteErrorMessage, getErrorMessage } from '../lib/formatters'
import { useClients, useDeleteClient, useUpsertClient } from '../hooks/useClients'
import { useClientOrders } from '../hooks/useOrders'
import { useTechCardByOrder } from '../hooks/useTechCards'
import { useClientBalances, useOrderPayments } from '../hooks/useDebts'
import { TechCardView } from '../components/techcards/TechCardView'
import { ORDER_STATUS_LABELS } from '../types/db'
import type { Client } from '../types/db'

const EMPTY: Partial<Client> = { name: '', company: '', phone: '', notes: '' }

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const { data: clients = [], isLoading } = useClients(search)
  const { data: balances } = useClientBalances()
  const upsert = useUpsertClient()
  const del = useDeleteClient()
  const [editing, setEditing] = useState<Partial<Client> | null>(null)
  const { data: orders = [] } = useClientOrders(editing?.id)
  const { data: orderPayments } = useOrderPayments(editing?.id)
  const [techCardOrderId, setTechCardOrderId] = useState<string | null>(null)

  const COLUMNS: DataTableColumn<Client>[] = [
    { key: 'name', header: 'Имя', render: (c) => <span className="font-medium text-brand-ink">{c.name}</span> },
    { key: 'company', header: 'Компания', render: (c) => c.company || '—' },
    { key: 'phone', header: 'Телефон', render: (c) => c.phone || '—' },
    {
      key: 'debt',
      header: 'Долг',
      render: (c) => {
        const debt = balances?.get(c.id)?.debt ?? 0
        if (debt === 0) return '—'
        return (
          <span className={debt > 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>
            {debt > 0 ? `Должен нам: ${formatMoney(debt)}` : `Переплата: ${formatMoney(-debt)}`}
          </span>
        )
      },
    },
    {
      key: 'notes',
      header: 'Заметки',
      render: (c) => <span className="text-brand-gray-dark truncate block max-w-xs">{c.notes || '—'}</span>,
    },
  ]

  function openEdit(id: string) {
    setEditing(clients.find((c) => c.id === id) ?? EMPTY)
  }

  async function handleSave() {
    if (!editing?.name) return
    try {
      await upsert.mutateAsync(editing)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось сохранить клиента: ${getErrorMessage(error)}`)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('Удалить клиента?')) return
    try {
      await del.mutateAsync(editing.id)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось удалить клиента: ${getDeleteErrorMessage(error)}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Клиенты</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Поиск по имени, компании, телефону…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-brand-border rounded-full px-4 py-2 text-sm w-64 outline-none focus:border-brand-yellow"
          />
          <button
            type="button"
            onClick={() => setEditing(EMPTY)}
            className="flex items-center gap-2 bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-full shadow-sm hover:brightness-95 active:scale-95 transition"
          >
            <span className="text-lg leading-none">+</span> Клиент
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-brand-gray-dark">Загрузка…</div>
      ) : (
        <DataTable
          columns={COLUMNS}
          items={clients}
          keyField={(c) => c.id}
          onRowClick={(c) => openEdit(c.id)}
          emptyLabel="Клиентов пока нет"
        />
      )}

      <EntityFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Редактировать клиента' : 'Новый клиент'}
        onDelete={editing?.id ? handleDelete : undefined}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-brand-gray-dark hover:bg-brand-gray transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={upsert.isPending || !editing?.name}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black disabled:opacity-50 hover:brightness-95 transition"
            >
              Сохранить
            </button>
          </>
        }
      >
        {editing && (
          <>
            <FormField
              label="Имя"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <FormField
              label="Компания"
              value={editing.company ?? ''}
              onChange={(e) => setEditing({ ...editing, company: e.target.value })}
            />
            <FormField
              label="Телефон"
              value={editing.phone ?? ''}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
            />
            <FormField
              label="Заметки"
              value={editing.notes ?? ''}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            />

            {editing.id && (
              <div className="mt-2">
                <div className="text-sm font-medium text-brand-ink mb-2">История заказов</div>
                {orders.length === 0 ? (
                  <div className="text-xs text-brand-gray-dark">Заказов пока не было</div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {orders.map((o) => {
                      const paid = orderPayments?.get(o.id) ?? 0
                      const orderDebt = Number(o.total_amount) - paid
                      return (
                        <div
                          key={o.id}
                          className="flex items-center justify-between gap-2 text-xs bg-brand-gray rounded-lg px-3 py-2 flex-wrap"
                        >
                          <span className="flex-1 min-w-0 truncate">
                            #{o.product?.code} {o.product?.name}
                          </span>
                          <span className="whitespace-nowrap">
                            {formatNumber(Number(o.quantity))} шт × {formatMoney(Number(o.unit_price))}
                          </span>
                          <span className="whitespace-nowrap font-semibold">
                            {formatMoney(Number(o.total_amount))}
                          </span>
                          {o.status !== 'cancelled' && orderDebt !== 0 && (
                            <span
                              className={`whitespace-nowrap font-medium ${orderDebt > 0 ? 'text-red-600' : 'text-green-700'}`}
                            >
                              {orderDebt > 0 ? `Долг: ${formatMoney(orderDebt)}` : `Переплата: ${formatMoney(-orderDebt)}`}
                            </span>
                          )}
                          <span className="whitespace-nowrap text-brand-gray-dark">
                            {formatDate(o.created_at)}
                          </span>
                          <span className="whitespace-nowrap text-brand-gray-dark">
                            {ORDER_STATUS_LABELS[o.status]}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTechCardOrderId(o.id)}
                            className="whitespace-nowrap text-brand-yellow-dark font-semibold hover:underline"
                          >
                            Техкарта
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </EntityFormModal>

      {techCardOrderId && (
        <ClientTechCardPeek orderId={techCardOrderId} onClose={() => setTechCardOrderId(null)} />
      )}
    </div>
  )
}

function ClientTechCardPeek({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data: techCard, isLoading } = useTechCardByOrder(orderId)

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-brand-ink mb-3">Техкарта заказа</div>
        {isLoading ? (
          <div className="text-sm text-brand-gray-dark">Загрузка…</div>
        ) : techCard ? (
          <TechCardView techCard={techCard} mode="client" />
        ) : (
          <div className="text-sm text-brand-gray-dark">Для этого заказа техкарта не найдена.</div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black hover:brightness-95 transition"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
