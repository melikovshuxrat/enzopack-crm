import { useEffect, useState } from 'react'
import { BomEditor, type BomLine } from '../components/products/BomEditor'
import { CardListWithPhoto } from '../components/common/CardListWithPhoto'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { PhotoUploader } from '../components/common/PhotoUploader'
import { DateRangeFilter, DEFAULT_DATE_RANGE, type DateRange } from '../components/common/DateRangeFilter'
import {
  formatDateTimeTashkent,
  formatMoney,
  formatNumber,
  getDeleteErrorMessage,
  getErrorMessage,
  nextProductCodePreview,
} from '../lib/formatters'
import {
  useDeleteProduct,
  useFinishedProducts,
  useProductBom,
  useUpsertProduct,
} from '../hooks/useFinishedProducts'
import { useAllFinishedGoodsMovements, useFinishedGoodsMovements } from '../hooks/useFinishedGoodsMovements'
import { useRawMaterials, useUpsertRawMaterial } from '../hooks/useRawMaterials'
import { FINISHED_GOODS_MOVEMENT_LABELS, type FinishedProduct } from '../types/db'

const EMPTY: Partial<FinishedProduct> = { name: '', photo_url: null, sale_price: 0, stock_qty: 0 }

export function FinishedProductsPage() {
  const [tab, setTab] = useState<'stock' | 'history'>('stock')
  const [search, setSearch] = useState('')
  const [showZeroStock, setShowZeroStock] = useState(false)
  const { data: products = [], isLoading } = useFinishedProducts(search)
  const visibleProducts = showZeroStock ? products : products.filter((p) => Number(p.stock_qty) > 0)
  const { data: materials = [] } = useRawMaterials()
  const upsertMaterial = useUpsertRawMaterial()
  const upsert = useUpsertProduct()
  const del = useDeleteProduct()
  const [editing, setEditing] = useState<Partial<FinishedProduct> | null>(null)
  const [bom, setBom] = useState<BomLine[]>([])
  const { data: existingBom } = useProductBom(editing?.id)
  const [showHistory, setShowHistory] = useState(false)
  const [historyRange, setHistoryRange] = useState<DateRange>(DEFAULT_DATE_RANGE)
  const { data: movements = [] } = useFinishedGoodsMovements(
    showHistory ? editing?.id : undefined,
    historyRange.from,
    historyRange.to,
  )

  const [archiveRange, setArchiveRange] = useState<DateRange>(DEFAULT_DATE_RANGE)
  const { data: allMovements = [], isLoading: archiveLoading } = useAllFinishedGoodsMovements(
    archiveRange.from,
    archiveRange.to,
  )

  useEffect(() => {
    if (existingBom) {
      setBom(existingBom.map((row) => ({ raw_material_id: row.raw_material_id, qty_per_unit: Number(row.qty_per_unit) })))
    } else if (editing && !editing.id) {
      setBom([])
    }
  }, [existingBom, editing])

  function openEdit(id: string) {
    setEditing(products.find((p) => p.id === id) ?? EMPTY)
    setShowHistory(false)
  }

  async function handleSave() {
    if (!editing?.name) return
    try {
      await upsert.mutateAsync({
        id: editing.id,
        product: {
          name: editing.name,
          photo_url: editing.photo_url ?? null,
          sale_price: Number(editing.sale_price ?? 0),
          stock_qty: Number(editing.stock_qty ?? 0),
        },
        bom: bom.filter((l) => l.raw_material_id && l.qty_per_unit > 0),
      })
      setEditing(null)
    } catch (error) {
      alert(`Не удалось сохранить продукт: ${getErrorMessage(error)}`)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('Удалить продукт?')) return
    try {
      await del.mutateAsync(editing.id)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось удалить продукт: ${getDeleteErrorMessage(error)}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Склад готовой продукции</h1>
        {tab === 'stock' && (
          <input
            type="text"
            placeholder="Поиск по коду или названию…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-brand-border rounded-full px-4 py-2 text-sm w-64 outline-none focus:border-brand-yellow"
          />
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-brand-border">
        <button
          type="button"
          onClick={() => setTab('stock')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'stock' ? 'border-brand-yellow text-brand-ink' : 'border-transparent text-brand-gray-dark'
          }`}
        >
          На складе сейчас
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'history' ? 'border-brand-yellow text-brand-ink' : 'border-transparent text-brand-gray-dark'
          }`}
        >
          История склада
        </button>
      </div>

      {tab === 'stock' ? (
        isLoading ? (
          <div className="text-brand-gray-dark">Загрузка…</div>
        ) : (
          <>
            <label className="flex items-center gap-2 mb-3 text-xs text-brand-gray-dark cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={showZeroStock}
                onChange={(e) => setShowZeroStock(e.target.checked)}
                className="accent-brand-yellow"
              />
              Показать товары без остатка на складе
            </label>
            <CardListWithPhoto
              items={visibleProducts.map((p) => ({
                id: p.id,
                photo_url: p.photo_url,
                title: p.name,
                badge: `#${p.code}`,
                subtitle: formatMoney(Number(p.sale_price)),
                meta: `На складе: ${formatNumber(Number(p.stock_qty))} шт · себестоимость ${formatMoney(Number(p.cost_price))}`,
              }))}
              onItemClick={openEdit}
              onAdd={() => setEditing(EMPTY)}
              emptyLabel={showZeroStock ? 'Продуктов пока нет' : 'На складе сейчас ничего нет'}
              addLabel="Продукт"
            />
          </>
        )
      ) : (
        <div>
          <div className="mb-4">
            <DateRangeFilter value={archiveRange} onChange={setArchiveRange} />
          </div>
          {archiveLoading ? (
            <div className="text-brand-gray-dark">Загрузка…</div>
          ) : allMovements.length === 0 ? (
            <div className="text-brand-gray-dark text-sm">За выбранный период движений не было</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {allMovements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 text-sm bg-white border border-brand-border rounded-xl px-4 py-2.5"
                >
                  <span className="text-brand-ink font-medium">
                    #{m.product?.code} {m.product?.name}
                  </span>
                  <span
                    className={
                      m.movement_type === 'produced'
                        ? 'text-green-700 font-medium'
                        : m.movement_type === 'shipped'
                          ? 'text-brand-gray-dark font-medium'
                          : 'text-brand-yellow-dark font-medium'
                    }
                  >
                    {FINISHED_GOODS_MOVEMENT_LABELS[m.movement_type]}
                  </span>
                  <span className="whitespace-nowrap">{formatNumber(Number(m.qty))} шт</span>
                  <span className="whitespace-nowrap text-brand-gray-dark">{formatDateTimeTashkent(m.movement_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <EntityFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Продукт #${editing.code}` : 'Новый продукт'}
        onDelete={editing?.id ? handleDelete : undefined}
        photoSlot={
          <PhotoUploader
            value={editing?.photo_url ?? null}
            folder="products"
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
              suffix={
                !editing.id ? (
                  <span className="whitespace-nowrap text-xs font-semibold text-brand-yellow-dark bg-brand-yellow-light px-2 py-1 rounded-full">
                    код #{nextProductCodePreview(products)}
                  </span>
                ) : undefined
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Цена продажи"
                money
                value={editing.sale_price ?? 0}
                onMoneyChange={(v) => setEditing({ ...editing, sale_price: v })}
              />
              <FormField
                label="Остаток на складе"
                type="number"
                value={editing.stock_qty ?? 0}
                onChange={(e) => setEditing({ ...editing, stock_qty: Number(e.target.value) })}
              />
            </div>
            {editing.id && (
              <div className="text-xs text-brand-gray-dark">
                Себестоимость считается автоматически из рецептуры: {formatMoney(Number(editing.cost_price ?? 0))}
              </div>
            )}
            <BomEditor
              lines={bom}
              onChange={setBom}
              materials={materials}
              onCreateMaterial={(input) => upsertMaterial.mutateAsync(input) as Promise<string>}
            />

            {editing.id && (
              <div className="mt-2 border-t border-brand-border pt-3">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-xs font-semibold text-brand-yellow-dark hover:underline"
                >
                  {showHistory ? 'Скрыть историю движений' : 'Показать историю движений'}
                </button>

                {showHistory && (
                  <div className="mt-2 flex flex-col gap-2">
                    <DateRangeFilter value={historyRange} onChange={setHistoryRange} />
                    {movements.length === 0 ? (
                      <div className="text-xs text-brand-gray-dark">За выбранный период движений не было</div>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                        {movements.map((m) => (
                          <div
                            key={m.id}
                            className="flex justify-between gap-2 text-xs bg-brand-gray rounded-lg px-3 py-2"
                          >
                            <span
                              className={
                                m.movement_type === 'produced'
                                  ? 'text-green-700 font-medium'
                                  : m.movement_type === 'shipped'
                                    ? 'text-brand-gray-dark font-medium'
                                    : 'text-brand-yellow-dark font-medium'
                              }
                            >
                              {FINISHED_GOODS_MOVEMENT_LABELS[m.movement_type]}
                            </span>
                            <span className="whitespace-nowrap">{formatNumber(Number(m.qty))} шт</span>
                            <span className="whitespace-nowrap text-brand-gray-dark">
                              {formatDateTimeTashkent(m.movement_date)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </EntityFormModal>
    </div>
  )
}
