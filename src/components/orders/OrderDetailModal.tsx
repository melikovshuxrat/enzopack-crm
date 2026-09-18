import { useEffect, useState } from 'react'
import { EntityFormModal } from '../common/EntityFormModal'
import { FormField } from '../common/FormField'
import { StatusBadge } from '../common/StatusBadge'
import { formatMoney, formatNumber, getErrorMessage } from '../../lib/formatters'
import { useClients } from '../../hooks/useClients'
import { useOrderMaterialConsumption, useUpdateOrderDetails, useUpdateOrderStatus } from '../../hooks/useOrders'
import { useProductBom } from '../../hooks/useFinishedProducts'
import { useTechCardByOrder } from '../../hooks/useTechCards'
import { useCreateFinanceTransaction } from '../../hooks/useFinance'
import { useOrderPaid } from '../../hooks/useDebts'
import { TechCardView } from '../techcards/TechCardView'
import { ORDER_STATUS_FLOW } from '../../types/db'
import type { Order } from '../../types/db'

interface OrderDetailModalProps {
  order: Order | null
  onClose: () => void
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const { data: clients = [] } = useClients()
  const { data: bom = [] } = useProductBom(order?.product_id)
  const { data: consumption = [] } = useOrderMaterialConsumption(order?.id)
  const { data: techCard } = useTechCardByOrder(order?.id)
  const { data: paid = 0 } = useOrderPaid(order?.id)
  const updateDetails = useUpdateOrderDetails()
  const updateStatus = useUpdateOrderStatus()
  const createPayment = useCreateFinanceTransaction()

  const [clientId, setClientId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [notes, setNotes] = useState('')
  const [paymentAmount, setPaymentAmount] = useState(0)

  useEffect(() => {
    if (order) {
      setClientId(order.client_id)
      setDeliveryDate(order.delivery_date ?? '')
      setUnitPrice(Number(order.unit_price))
      setNotes(order.notes ?? '')
    }
  }, [order])

  const isCancelled = order?.status === 'cancelled'
  const nextIndex = order ? (ORDER_STATUS_FLOW.indexOf(order.status) + 1) % ORDER_STATUS_FLOW.length : -1
  const canAdvance = !isCancelled && nextIndex >= 0

  async function handleSave() {
    if (!order) return
    try {
      await updateDetails.mutateAsync({
        orderId: order.id,
        client_id: clientId,
        delivery_date: deliveryDate || null,
        unit_price: unitPrice,
        notes: notes || null,
      })
      onClose()
    } catch (error) {
      alert(`Не удалось сохранить изменения: ${getErrorMessage(error)}`)
    }
  }

  async function handleAdvance() {
    if (!order || nextIndex < 0) return
    try {
      await updateStatus.mutateAsync({ orderId: order.id, status: ORDER_STATUS_FLOW[nextIndex] })
    } catch (error) {
      alert(`Не удалось изменить статус: ${getErrorMessage(error)}`)
    }
  }

  async function handleCancel() {
    if (!order) return
    if (!confirm('Отменить заказ? Сырьё вернётся на склад.')) return
    try {
      await updateStatus.mutateAsync({ orderId: order.id, status: 'cancelled' })
      onClose()
    } catch (error) {
      alert(`Не удалось отменить заказ: ${getErrorMessage(error)}`)
    }
  }

  async function handleAddPayment() {
    if (!order || paymentAmount <= 0) return
    try {
      await createPayment.mutateAsync({
        type: 'income',
        category: 'order_payment',
        amount: paymentAmount,
        related_order_id: order.id,
        related_client_id: order.client_id,
        transaction_date: new Date().toISOString().slice(0, 10),
      })
      setPaymentAmount(0)
    } catch (error) {
      alert(`Не удалось записать оплату: ${getErrorMessage(error)}`)
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId)

  return (
    <EntityFormModal
      open={!!order}
      onClose={onClose}
      title={`Заказ #${order?.product?.code ?? ''}`}
      footer={
        <>
          {!isCancelled && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition mr-auto"
            >
              Отменить заказ
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-brand-gray-dark hover:bg-brand-gray transition"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateDetails.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black disabled:opacity-50 hover:brightness-95 transition"
          >
            Сохранить
          </button>
        </>
      }
    >
      {order && (
        <>
          <div className="flex items-center justify-between bg-brand-gray rounded-xl p-3">
            <div>
              <div className="text-sm font-semibold text-brand-ink">
                #{order.product?.code} {order.product?.name}
              </div>
              <div className="text-xs text-brand-gray-dark">
                {formatNumber(Number(order.quantity))} шт · {formatMoney(Number(order.total_amount))} ·{' '}
                {formatMoney(Number(order.unit_price))}/шт
              </div>
              <div className="text-xs text-brand-gray-dark mt-0.5">
                Создан: {new Date(order.created_at).toLocaleString('ru-RU')}
              </div>
            </div>
            <StatusBadge status={order.status} onAdvance={canAdvance ? handleAdvance : undefined} />
          </div>
          {isCancelled && (
            <div className="text-xs text-brand-gray-dark">
              Заказ отменён — статус больше не меняется.
            </div>
          )}

          {!isCancelled && (
            <div className="border border-brand-border rounded-xl p-3">
              <div className="text-sm font-medium text-brand-ink mb-2">Оплата</div>
              <div className="flex items-center gap-3 text-xs mb-2">
                <span>Сумма заказа: <span className="font-semibold">{formatMoney(Number(order.total_amount))}</span></span>
                <span>Оплачено: <span className="font-semibold">{formatMoney(paid)}</span></span>
                {Number(order.total_amount) - paid !== 0 && (
                  <span
                    className={`font-semibold ${Number(order.total_amount) - paid > 0 ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {Number(order.total_amount) - paid > 0
                      ? `Долг: ${formatMoney(Number(order.total_amount) - paid)}`
                      : `Переплата: ${formatMoney(paid - Number(order.total_amount))}`}
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2">
                <FormField
                  label="Записать оплату"
                  money
                  value={paymentAmount}
                  onMoneyChange={setPaymentAmount}
                />
                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={paymentAmount <= 0 || createPayment.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black disabled:opacity-50 hover:brightness-95 transition"
                >
                  Внести
                </button>
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-brand-ink">Клиент</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
            {selectedClient && (selectedClient.company || selectedClient.phone) && (
              <span className="text-xs text-brand-gray-dark">
                {[selectedClient.company, selectedClient.phone].filter(Boolean).join(' · ')}
              </span>
            )}
          </label>

          {bom.length > 0 && (
            <div className="border border-brand-border rounded-xl p-3">
              <div className="text-sm font-medium text-brand-ink mb-2">Состав продукта (на 1 шт)</div>
              <div className="flex flex-col gap-1">
                {bom.map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-xs">
                    <span className="text-brand-ink">
                      #{row.raw_material?.code} {row.raw_material?.name}
                    </span>
                    <span className="text-brand-gray-dark">
                      {formatNumber(Number(row.qty_per_unit))} {row.raw_material?.unit} × {formatNumber(Number(order.quantity))} ={' '}
                      {formatNumber(Number(row.qty_per_unit) * Number(order.quantity))} {row.raw_material?.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {consumption.length > 0 && (
            <div className="border border-brand-border rounded-xl p-3">
              <div className="text-sm font-medium text-brand-ink mb-2">Расход сырья на этот заказ (из расчёта)</div>
              <div className="flex flex-col gap-1">
                {consumption.map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-brand-ink">
                      #{row.raw_material?.code} {row.raw_material?.name}
                    </span>
                    <span className="flex items-center gap-2 text-brand-gray-dark whitespace-nowrap">
                      {formatNumber(Number(row.qty_consumed))} {row.raw_material?.unit}
                      {row.applied ? (
                        <span className="text-green-700 font-medium">списано</span>
                      ) : (
                        <span className="text-brand-yellow-dark font-medium">спишется при переходе «В работе»</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Дата доставки"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <FormField
              label="Цена за единицу"
              money
              value={unitPrice}
              onMoneyChange={(v) => setUnitPrice(v)}
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-brand-ink">Заметки</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow-light transition resize-none"
            />
          </label>

          {techCard && (
            <div className="border-t border-brand-border pt-3">
              <div className="text-sm font-medium text-brand-ink mb-2">Техкарта</div>
              <TechCardView techCard={techCard} mode="management" />
            </div>
          )}
        </>
      )}
    </EntityFormModal>
  )
}
