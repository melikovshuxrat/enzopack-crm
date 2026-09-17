import { useState } from 'react'
import { DataTable, type DataTableColumn } from '../components/common/DataTable'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { formatDate, getDeleteErrorMessage, getErrorMessage } from '../lib/formatters'
import { useDeleteDie, useDies, useUpsertDie } from '../hooks/useDies'
import { useFinishedProducts } from '../hooks/useFinishedProducts'
import { DIE_STATUS_LABELS, type Die, type DieStatus } from '../types/db'

const EMPTY: Partial<Die> = {
  name: '',
  for_product_id: null,
  purchase_date: null,
  status: 'active',
  notes: '',
}

const COLUMNS: DataTableColumn<Die>[] = [
  { key: 'code', header: 'Код', render: (d) => <span className="text-brand-gray-dark">#{d.code}</span> },
  { key: 'name', header: 'Название', render: (d) => <span className="font-medium text-brand-ink">{d.name}</span> },
  { key: 'product', header: 'Товар', render: (d) => (d.for_product ? `#${d.for_product.code} ${d.for_product.name}` : '—') },
  { key: 'purchase_date', header: 'Дата покупки', render: (d) => formatDate(d.purchase_date) },
  { key: 'status', header: 'Статус', render: (d) => DIE_STATUS_LABELS[d.status] },
  {
    key: 'notes',
    header: 'Заметки',
    render: (d) => <span className="text-brand-gray-dark truncate block max-w-xs">{d.notes || '—'}</span>,
  },
]

export function DiesPage() {
  const [search, setSearch] = useState('')
  const { data: dies = [], isLoading } = useDies(search)
  const { data: products = [] } = useFinishedProducts()
  const upsert = useUpsertDie()
  const del = useDeleteDie()
  const [editing, setEditing] = useState<Partial<Die> | null>(null)

  function openEdit(id: string) {
    setEditing(dies.find((d) => d.id === id) ?? EMPTY)
  }

  async function handleSave() {
    if (!editing?.name) return
    try {
      await upsert.mutateAsync({
        id: editing.id,
        name: editing.name,
        for_product_id: editing.for_product_id ?? null,
        purchase_date: editing.purchase_date || null,
        status: (editing.status ?? 'active') as DieStatus,
        notes: editing.notes ?? null,
      })
      setEditing(null)
    } catch (error) {
      alert(`Не удалось сохранить нож: ${getErrorMessage(error)}`)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('Удалить нож?')) return
    try {
      await del.mutateAsync(editing.id)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось удалить нож: ${getDeleteErrorMessage(error)}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Ножи</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Поиск по коду или названию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-brand-border rounded-full px-4 py-2 text-sm w-64 outline-none focus:border-brand-yellow"
          />
          <button
            type="button"
            onClick={() => setEditing(EMPTY)}
            className="flex items-center gap-2 bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-full shadow-sm hover:brightness-95 active:scale-95 transition"
          >
            <span className="text-lg leading-none">+</span> Нож
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-brand-gray-dark">Загрузка…</div>
      ) : (
        <DataTable
          columns={COLUMNS}
          items={dies}
          keyField={(d) => d.id}
          onRowClick={(d) => openEdit(d.id)}
          emptyLabel="Ножей пока нет"
        />
      )}

      <EntityFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Нож #${editing.code}` : 'Новый нож'}
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
              label="Название / номер"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-brand-ink">Для какого товара</span>
              <select
                value={editing.for_product_id ?? ''}
                onChange={(e) => setEditing({ ...editing, for_product_id: e.target.value || null })}
                className="border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
              >
                <option value="">Не указан</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.code} {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Дата покупки"
                type="date"
                value={editing.purchase_date ?? ''}
                onChange={(e) => setEditing({ ...editing, purchase_date: e.target.value || null })}
              />
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-brand-ink">Статус</span>
                <select
                  value={editing.status ?? 'active'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as DieStatus })}
                  className="border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
                >
                  {Object.entries(DIE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <FormField
              label="Заметки"
              value={editing.notes ?? ''}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            />
          </>
        )}
      </EntityFormModal>
    </div>
  )
}
