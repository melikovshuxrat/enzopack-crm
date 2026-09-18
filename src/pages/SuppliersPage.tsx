import { useState } from 'react'
import { DataTable, type DataTableColumn } from '../components/common/DataTable'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { DateRangeFilter, DEFAULT_DATE_RANGE, type DateRange } from '../components/common/DateRangeFilter'
import { formatDate, formatMoney, formatNumber, getDeleteErrorMessage, getErrorMessage } from '../lib/formatters'
import {
  useAllSupplierDeliveries,
  useCreateDelivery,
  useDeleteSupplier,
  useSupplierDeliveries,
  useSuppliers,
  useUpsertSupplier,
} from '../hooks/useSuppliers'
import { useRawMaterials } from '../hooks/useRawMaterials'
import { useSupplierBalances } from '../hooks/useDebts'
import type { Supplier } from '../types/db'

const EMPTY: Partial<Supplier> = { name: '', phone: '', supplies: '', notes: '' }

export function SuppliersPage() {
  const [tab, setTab] = useState<'list' | 'purchases'>('list')
  const [search, setSearch] = useState('')
  const { data: suppliers = [], isLoading } = useSuppliers(search)
  const { data: materials = [] } = useRawMaterials()
  const { data: balances } = useSupplierBalances()
  const upsert = useUpsertSupplier()
  const del = useDeleteSupplier()
  const createDelivery = useCreateDelivery()
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null)
  const { data: deliveries = [] } = useSupplierDeliveries(editing?.id)

  const [deliveryMaterialId, setDeliveryMaterialId] = useState('')
  const [deliveryQty, setDeliveryQty] = useState(0)
  const [deliveryUnitPrice, setDeliveryUnitPrice] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryPaidNow, setDeliveryPaidNow] = useState(0)

  const [purchasesRange, setPurchasesRange] = useState<DateRange>(DEFAULT_DATE_RANGE)
  const { data: allDeliveries = [], isLoading: purchasesLoading } = useAllSupplierDeliveries(
    purchasesRange.from,
    purchasesRange.to,
  )

  const COLUMNS: DataTableColumn<Supplier>[] = [
    { key: 'name', header: 'Имя', render: (s) => <span className="font-medium text-brand-ink">{s.name}</span> },
    { key: 'phone', header: 'Телефон', render: (s) => s.phone || '—' },
    { key: 'supplies', header: 'Поставляет', render: (s) => s.supplies || '—' },
    {
      key: 'debt',
      header: 'Долг',
      render: (s) => {
        const debt = balances?.get(s.id)?.debt ?? 0
        if (debt === 0) return '—'
        return (
          <span className={debt > 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>
            {debt > 0 ? `Мы должны: ${formatMoney(debt)}` : `Переплата: ${formatMoney(-debt)}`}
          </span>
        )
      },
    },
    {
      key: 'notes',
      header: 'Заметки',
      render: (s) => <span className="text-brand-gray-dark truncate block max-w-xs">{s.notes || '—'}</span>,
    },
  ]

  function openEdit(id: string) {
    setEditing(suppliers.find((s) => s.id === id) ?? EMPTY)
    setDeliveryMaterialId('')
    setDeliveryQty(0)
    setDeliveryUnitPrice(0)
    setDeliveryDate('')
    setDeliveryPaidNow(0)
  }

  async function handleSave() {
    if (!editing?.name) return
    try {
      await upsert.mutateAsync(editing)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось сохранить поставщика: ${getErrorMessage(error)}`)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('Удалить поставщика?')) return
    try {
      await del.mutateAsync(editing.id)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось удалить поставщика: ${getDeleteErrorMessage(error)}`)
    }
  }

  async function handleAddDelivery() {
    if (!editing?.id || !deliveryMaterialId || deliveryQty <= 0) return
    try {
      await createDelivery.mutateAsync({
        supplier_id: editing.id,
        raw_material_id: deliveryMaterialId,
        qty: deliveryQty,
        unit_price: deliveryUnitPrice || undefined,
        delivery_date: deliveryDate || undefined,
        paid_now: deliveryPaidNow || undefined,
      })
      setDeliveryMaterialId('')
      setDeliveryQty(0)
      setDeliveryUnitPrice(0)
      setDeliveryDate('')
      setDeliveryPaidNow(0)
    } catch (error) {
      alert(`Не удалось добавить поставку: ${getErrorMessage(error)}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Поставщики</h1>
        {tab === 'list' && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Поиск по имени, телефону…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-brand-border rounded-full px-4 py-2 text-sm w-64 outline-none focus:border-brand-yellow"
            />
            <button
              type="button"
              onClick={() => setEditing(EMPTY)}
              className="flex items-center gap-2 bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-full shadow-sm hover:brightness-95 active:scale-95 transition"
            >
              <span className="text-lg leading-none">+</span> Поставщик
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-brand-border">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'list' ? 'border-brand-yellow text-brand-ink' : 'border-transparent text-brand-gray-dark'
          }`}
        >
          Список поставщиков
        </button>
        <button
          type="button"
          onClick={() => setTab('purchases')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'purchases' ? 'border-brand-yellow text-brand-ink' : 'border-transparent text-brand-gray-dark'
          }`}
        >
          Закуп
        </button>
      </div>

      {tab === 'list' ? (
        isLoading ? (
          <div className="text-brand-gray-dark">Загрузка…</div>
        ) : (
          <DataTable
            columns={COLUMNS}
            items={suppliers}
            keyField={(s) => s.id}
            onRowClick={(s) => openEdit(s.id)}
            emptyLabel="Поставщиков пока нет"
          />
        )
      ) : (
        <div>
          <div className="mb-4">
            <DateRangeFilter value={purchasesRange} onChange={setPurchasesRange} />
          </div>
          {purchasesLoading ? (
            <div className="text-brand-gray-dark">Загрузка…</div>
          ) : allDeliveries.length === 0 ? (
            <div className="text-brand-gray-dark text-sm">За выбранный период поставок не было</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {allDeliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 text-sm bg-white border border-brand-border rounded-xl px-4 py-2.5"
                >
                  <span className="text-brand-ink font-medium whitespace-nowrap">{d.supplier?.name}</span>
                  <span className="text-brand-gray-dark flex-1 min-w-0 truncate">
                    #{d.raw_material?.code} {d.raw_material?.name}
                  </span>
                  <span className="whitespace-nowrap">
                    {formatNumber(Number(d.qty))} {d.raw_material?.unit}
                  </span>
                  <span className="whitespace-nowrap">
                    {d.unit_price ? `${formatMoney(Number(d.unit_price))}/ед.` : '—'}
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
      )}

      <EntityFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Редактировать поставщика' : 'Новый поставщик'}
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
              label="Телефон"
              value={editing.phone ?? ''}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
            />
            <FormField
              label="Что поставляет"
              value={editing.supplies ?? ''}
              onChange={(e) => setEditing({ ...editing, supplies: e.target.value })}
            />
            <FormField
              label="Заметки"
              value={editing.notes ?? ''}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            />

            {editing.id && (
              <>
                <div className="mt-2">
                  <div className="text-sm font-medium text-brand-ink mb-2">Новая поставка</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={deliveryMaterialId}
                      onChange={(e) => setDeliveryMaterialId(e.target.value)}
                      className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    >
                      <option value="">Материал…</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          #{m.code} {m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    />
                    <input
                      type="number"
                      placeholder="Количество"
                      value={deliveryQty || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDeliveryQty(Number(e.target.value))}
                      className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    />
                    <input
                      type="number"
                      placeholder="Цена за единицу"
                      value={deliveryUnitPrice || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDeliveryUnitPrice(Number(e.target.value))}
                      className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    />
                    <input
                      type="number"
                      placeholder="Оплачено сейчас"
                      value={deliveryPaidNow || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setDeliveryPaidNow(Number(e.target.value))}
                      className="border border-brand-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-yellow"
                    />
                  </div>
                  {deliveryQty > 0 && (
                    <div className="text-xs text-brand-gray-dark mb-2">
                      Сумма закупки: {formatMoney(deliveryUnitPrice * deliveryQty)}
                      {deliveryPaidNow > 0 && deliveryPaidNow < deliveryUnitPrice * deliveryQty && (
                        <> · останется долгом: {formatMoney(deliveryUnitPrice * deliveryQty - deliveryPaidNow)}</>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleAddDelivery}
                    disabled={!deliveryMaterialId || deliveryQty <= 0 || createDelivery.isPending}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-brand-yellow text-brand-black disabled:opacity-50"
                  >
                    Добавить поставку
                  </button>
                </div>

                <div className="mt-2">
                  <div className="text-sm font-medium text-brand-ink mb-2">История поставок</div>
                  {deliveries.length === 0 ? (
                    <div className="text-xs text-brand-gray-dark">Поставок пока не было</div>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {deliveries.map((d) => (
                        <div
                          key={d.id}
                          className="flex justify-between gap-2 text-xs bg-brand-gray rounded-lg px-3 py-2"
                        >
                          <span className="flex-1 min-w-0 truncate">
                            #{d.raw_material?.code} {d.raw_material?.name}
                          </span>
                          <span className="whitespace-nowrap">
                            {formatNumber(Number(d.qty))} {d.raw_material?.unit}
                          </span>
                          <span className="whitespace-nowrap">
                            {d.unit_price ? `${formatMoney(Number(d.unit_price))}/ед.` : '—'}
                          </span>
                          <span className="whitespace-nowrap font-semibold">
                            {d.total_cost ? formatMoney(Number(d.total_cost)) : '—'}
                          </span>
                          <span className="whitespace-nowrap">{formatDate(d.delivery_date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </EntityFormModal>
    </div>
  )
}
