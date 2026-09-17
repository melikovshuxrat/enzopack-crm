import { useEffect, useState } from 'react'
import { EntityFormModal } from '../common/EntityFormModal'
import { FormField } from '../common/FormField'
import { supabase } from '../../lib/supabaseClient'
import { getErrorMessage, nextProductCodePreview } from '../../lib/formatters'
import { useClients, useUpsertClient } from '../../hooks/useClients'
import { useCreateOrder } from '../../hooks/useOrders'
import { useProductBom, useUpsertProduct } from '../../hooks/useFinishedProducts'
import { useRawMaterials, useUpsertRawMaterial } from '../../hooks/useRawMaterials'
import { useFinishedProducts } from '../../hooks/useFinishedProducts'
import { BomEditor, type BomLine } from '../products/BomEditor'
import { ShortageForecastPanel } from './ShortageForecastPanel'

interface OrderFormModalProps {
  open: boolean
  onClose: () => void
}

export function OrderFormModal({ open, onClose }: OrderFormModalProps) {
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useFinishedProducts()
  const { data: materials = [] } = useRawMaterials()
  const createOrder = useCreateOrder()
  const upsertClient = useUpsertClient()
  const upsertProduct = useUpsertProduct()
  const upsertMaterial = useUpsertRawMaterial()

  const [clientId, setClientId] = useState('')
  const [newClient, setNewClient] = useState<{ name: string; company: string; phone: string } | null>(null)

  const [productId, setProductId] = useState('')
  const [isNewProduct, setIsNewProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductBom, setNewProductBom] = useState<BomLine[]>([])

  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [successInfo, setSuccessInfo] = useState<string | null>(null)

  const { data: existingBom = [] } = useProductBom(isNewProduct ? undefined : productId)

  useEffect(() => {
    if (!open) {
      setClientId('')
      setNewClient(null)
      setProductId('')
      setIsNewProduct(false)
      setNewProductName('')
      setNewProductBom([])
      setQuantity(1)
      setUnitPrice(0)
      setDeliveryDate('')
      setSuccessInfo(null)
    }
  }, [open])

  const forecastBom: BomLine[] = isNewProduct
    ? newProductBom
    : existingBom.map((row) => ({ raw_material_id: row.raw_material_id, qty_per_unit: Number(row.qty_per_unit) }))

  const canSave =
    (clientId || newClient?.name) &&
    (isNewProduct ? newProductName : productId) &&
    quantity > 0

  async function handleSave() {
    if (!canSave) return

    try {
      let finalClientId = clientId
      if (!finalClientId && newClient?.name) {
        finalClientId = await upsertClient.mutateAsync({
          name: newClient.name,
          company: newClient.company || null,
          phone: newClient.phone || null,
        })
      }

      let finalProductId = productId
      let createdProductCode: string | null = null
      if (isNewProduct) {
        finalProductId = (await upsertProduct.mutateAsync({
          product: { name: newProductName, sale_price: unitPrice, stock_qty: 0 },
          bom: newProductBom.filter((l) => l.raw_material_id && l.qty_per_unit > 0),
        })) as string

        const { data: createdProduct } = await supabase
          .from('finished_products')
          .select('code')
          .eq('id', finalProductId)
          .single()
        createdProductCode = createdProduct?.code ?? null
      }

      await createOrder.mutateAsync({
        client_id: finalClientId,
        product_id: finalProductId,
        quantity,
        delivery_date: deliveryDate || null,
        unit_price: unitPrice,
      })

      if (createdProductCode) {
        setSuccessInfo(`Заказ создан. Новому продукту «${newProductName}» присвоен код #${createdProductCode}.`)
      } else {
        onClose()
      }
    } catch (error) {
      alert(`Не удалось создать заказ: ${getErrorMessage(error)}`)
    }
  }

  const saving = upsertClient.isPending || upsertProduct.isPending || createOrder.isPending

  if (successInfo) {
    return (
      <EntityFormModal
        open={open}
        onClose={onClose}
        title="Готово"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black hover:brightness-95 transition"
          >
            Готово
          </button>
        }
      >
        <div className="text-sm text-brand-ink bg-brand-yellow-light border border-brand-yellow rounded-xl p-4">
          {successInfo}
        </div>
      </EntityFormModal>
    )
  }

  return (
    <EntityFormModal
      open={open}
      onClose={onClose}
      title="Новый заказ"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-brand-gray-dark hover:bg-brand-gray transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black disabled:opacity-50 hover:brightness-95 transition"
          >
            Создать заказ
          </button>
        </>
      }
    >
      <div>
        <span className="text-sm font-medium text-brand-ink">Клиент</span>
        {!newClient ? (
          <div className="flex gap-2 mt-1">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
            >
              <option value="">Выбрать клиента…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewClient({ name: '', company: '', phone: '' })}
              className="text-xs font-semibold text-brand-yellow-dark whitespace-nowrap"
            >
              + новый
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-1 border border-brand-border rounded-lg p-3">
            <FormField
              label="Имя клиента"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
            <FormField
              label="Компания"
              value={newClient.company}
              onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
            />
            <FormField
              label="Телефон"
              value={newClient.phone}
              onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setNewClient(null)}
              className="text-xs text-brand-gray-dark self-start hover:underline"
            >
              Выбрать из списка вместо этого
            </button>
          </div>
        )}
      </div>

      <div>
        <span className="text-sm font-medium text-brand-ink">Продукт</span>
        {!isNewProduct ? (
          <div className="flex gap-2 mt-1">
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((pr) => pr.id === e.target.value)
                if (p) setUnitPrice(Number(p.sale_price))
              }}
              className="flex-1 border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
            >
              <option value="">Выбрать продукт (по названию или коду)…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.code} {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsNewProduct(true)}
              className="text-xs font-semibold text-brand-yellow-dark whitespace-nowrap"
            >
              + новый
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-1 border border-brand-border rounded-lg p-3">
            <FormField
              label="Название продукта"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              suffix={
                <span className="whitespace-nowrap text-xs font-semibold text-brand-yellow-dark bg-brand-yellow-light px-2 py-1 rounded-full">
                  код #{nextProductCodePreview(products)}
                </span>
              }
            />
            <BomEditor
              lines={newProductBom}
              onChange={setNewProductBom}
              materials={materials}
              onCreateMaterial={(input) => upsertMaterial.mutateAsync(input) as Promise<string>}
            />
            <button
              type="button"
              onClick={() => setIsNewProduct(false)}
              className="text-xs text-brand-gray-dark self-start hover:underline"
            >
              Выбрать из списка вместо этого
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Количество"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <FormField
          label="Цена за единицу"
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(Number(e.target.value))}
        />
      </div>

      <FormField
        label="Дата доставки"
        type="date"
        value={deliveryDate}
        onChange={(e) => setDeliveryDate(e.target.value)}
      />

      <ShortageForecastPanel bom={forecastBom} quantity={quantity} materials={materials} />
    </EntityFormModal>
  )
}
