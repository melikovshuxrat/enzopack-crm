import { DataTable, type DataTableColumn } from '../common/DataTable'
import { StatusBadge } from '../common/StatusBadge'
import { formatDate, formatMoney, formatNumber } from '../../lib/formatters'
import type { Order } from '../../types/db'

interface OrdersListProps {
  orders: Order[]
  onAdvance: (order: Order) => void
  onCancel: (order: Order) => void
  onOpen: (order: Order) => void
}

export function OrdersList({ orders, onAdvance, onCancel, onOpen }: OrdersListProps) {
  const columns: DataTableColumn<Order>[] = [
    {
      key: 'client',
      header: 'Клиент',
      render: (o) => (
        <span className="font-medium text-brand-ink">
          {o.client?.name} {o.client?.company ? `· ${o.client.company}` : ''}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Товар',
      render: (o) => (
        <span>
          #{o.product?.code} {o.product?.name}
          {o.notes && (
            <span className="ml-1 cursor-help" title={o.notes}>
              📝
            </span>
          )}
        </span>
      ),
    },
    { key: 'quantity', header: 'Кол-во', render: (o) => `${formatNumber(Number(o.quantity))} шт` },
    { key: 'unit_price', header: 'Цена за ед.', render: (o) => formatMoney(Number(o.unit_price)) },
    { key: 'total', header: 'Сумма', render: (o) => <span className="font-medium">{formatMoney(Number(o.total_amount))}</span> },
    { key: 'delivery_date', header: 'Дата доставки', render: (o) => formatDate(o.delivery_date) },
    { key: 'created_at', header: 'Создан', render: (o) => formatDate(o.created_at) },
    {
      key: 'status',
      header: 'Статус',
      render: (o) => (
        <StatusBadge status={o.status} onAdvance={o.status !== 'cancelled' ? () => onAdvance(o) : undefined} />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      items={orders}
      keyField={(o) => o.id}
      onRowClick={onOpen}
      emptyLabel="Заказов пока нет"
      rowActions={(order) =>
        order.status !== 'cancelled' ? (
          <button
            type="button"
            onClick={() => onCancel(order)}
            className="text-brand-gray-dark hover:text-red-600 transition text-sm"
            title="Отменить заказ"
          >
            ✕
          </button>
        ) : null
      }
    />
  )
}
