import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OrderDetailModal } from '../components/orders/OrderDetailModal'
import { OrdersList } from '../components/orders/OrdersList'
import { useOrders, useUpdateOrderStatus } from '../hooks/useOrders'
import { ORDER_STATUS_FLOW } from '../types/db'
import type { Order } from '../types/db'

export function OrdersPage() {
  const navigate = useNavigate()
  const { data: orders = [], isLoading } = useOrders()
  const updateStatus = useUpdateOrderStatus()
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const openOrder = orders.find((o) => o.id === openOrderId) ?? null

  const filteredOrders = search
    ? orders.filter((o) => {
        const haystack = `${o.client?.name ?? ''} ${o.client?.company ?? ''} ${o.product?.code ?? ''} ${o.product?.name ?? ''}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
    : orders

  function handleAdvance(order: Order) {
    if (order.status === 'cancelled') return
    const nextIndex = (ORDER_STATUS_FLOW.indexOf(order.status) + 1) % ORDER_STATUS_FLOW.length
    updateStatus.mutate({ orderId: order.id, status: ORDER_STATUS_FLOW[nextIndex] })
  }

  function handleCancel(order: Order) {
    if (!confirm('Отменить заказ? Сырьё вернётся на склад.')) return
    updateStatus.mutate({ orderId: order.id, status: 'cancelled' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Заказы</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Поиск по клиенту или товару…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-brand-border rounded-full px-4 py-2 text-sm w-64 outline-none focus:border-brand-yellow"
          />
          <button
            type="button"
            onClick={() => navigate('/orders/new')}
            className="flex items-center gap-2 bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-full shadow-sm hover:brightness-95 active:scale-95 transition"
          >
            <span className="text-lg leading-none">+</span> Заказ
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-brand-gray-dark">Загрузка…</div>
      ) : (
        <OrdersList
          orders={filteredOrders}
          onAdvance={handleAdvance}
          onCancel={handleCancel}
          onOpen={(order) => setOpenOrderId(order.id)}
        />
      )}

      <OrderDetailModal order={openOrder} onClose={() => setOpenOrderId(null)} />
    </div>
  )
}
