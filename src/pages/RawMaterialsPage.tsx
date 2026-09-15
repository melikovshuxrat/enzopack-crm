import { useState } from 'react'
import { CardListWithPhoto } from '../components/common/CardListWithPhoto'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { PhotoUploader } from '../components/common/PhotoUploader'
import { formatNumber, getDeleteErrorMessage, getErrorMessage } from '../lib/formatters'
import {
  useDeleteRawMaterial,
  useRawMaterials,
  useUpsertRawMaterial,
} from '../hooks/useRawMaterials'
import { useSuppliers } from '../hooks/useSuppliers'
import type { RawMaterial } from '../types/db'

const EMPTY: Partial<RawMaterial> = {
  name: '',
  unit: '',
  photo_url: null,
  supplier_id: null,
  unit_price: 0,
  stock_qty: 0,
  grammage: null,
}

export function RawMaterialsPage() {
  const [search, setSearch] = useState('')
  const { data: materials = [], isLoading } = useRawMaterials(search)
  const { data: suppliers = [] } = useSuppliers()
  const upsert = useUpsertRawMaterial()
  const del = useDeleteRawMaterial()
  const [editing, setEditing] = useState<Partial<RawMaterial> | null>(null)

  function openEdit(id: string) {
    setEditing(materials.find((m) => m.id === id) ?? EMPTY)
  }

  async function handleSave() {
    if (!editing?.name || !editing.unit) return
    try {
      await upsert.mutateAsync({
        id: editing.id,
        name: editing.name,
        unit: editing.unit,
        photo_url: editing.photo_url ?? null,
        supplier_id: editing.supplier_id ?? null,
        unit_price: Number(editing.unit_price ?? 0),
        stock_qty: Number(editing.stock_qty ?? 0),
        grammage: editing.grammage === null || editing.grammage === undefined ? null : Number(editing.grammage),
      })
      setEditing(null)
    } catch (error) {
      alert(`Не удалось сохранить материал: ${getErrorMessage(error)}`)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('Удалить материал?')) return
    try {
      await del.mutateAsync(editing.id)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось удалить материал: ${getDeleteErrorMessage(error)}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Склад сырья</h1>
        <input
          type="text"
          placeholder="Поиск по коду или названию…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-brand-border rounded-full px-4 py-2 text-sm w-64 outline-none focus:border-brand-yellow"
        />
      </div>

      {isLoading ? (
        <div className="text-brand-gray-dark">Загрузка…</div>
      ) : (
        <CardListWithPhoto
          items={materials.map((m) => ({
            id: m.id,
            photo_url: m.photo_url,
            title: m.name,
            subtitle: m.supplier?.name,
            badge: `#${m.code}`,
            meta: `${formatNumber(Number(m.stock_qty))} ${m.unit}${
              Number(m.stock_qty) < 0 ? ' — дефицит!' : ''
            }`,
          }))}
          onItemClick={openEdit}
          onAdd={() => setEditing(EMPTY)}
          emptyLabel="Материалов пока нет"
          addLabel="Материал"
        />
      )}

      <EntityFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Материал #${editing.code}` : 'Новый материал'}
        onDelete={editing?.id ? handleDelete : undefined}
        photoSlot={
          <PhotoUploader
            value={editing?.photo_url ?? null}
            folder="materials"
            onChange={(path) => setEditing((prev) => (prev ? { ...prev, photo_url: path } : prev))}
          />
        }
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
              label="Название"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Ед. измерения"
                placeholder="кг, м², рулон…"
                value={editing.unit ?? ''}
                onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
              />
              <FormField
                label="Остаток"
                type="number"
                value={editing.stock_qty ?? 0}
                onChange={(e) => setEditing({ ...editing, stock_qty: Number(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Цена за единицу"
                money
                value={editing.unit_price ?? 0}
                onMoneyChange={(v) => setEditing({ ...editing, unit_price: v })}
              />
              <FormField
                label="Граммаж, г/м² (для бумаги)"
                type="number"
                value={editing.grammage ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, grammage: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-brand-ink">Поставщик</span>
              <select
                value={editing.supplier_id ?? ''}
                onChange={(e) => setEditing({ ...editing, supplier_id: e.target.value || null })}
                className="border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
              >
                <option value="">Не выбран</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </EntityFormModal>
    </div>
  )
}
