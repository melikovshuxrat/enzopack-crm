import type { ReactNode } from 'react'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  items: T[]
  keyField: (item: T) => string
  onRowClick?: (item: T) => void
  rowActions?: (item: T) => ReactNode
  emptyLabel?: string
}

// Flat Excel-style table used across every list page (Clients, warehouses,
// Suppliers, Dies, Employees, Orders) — replaces the old photo-card grid.
export function DataTable<T>({
  columns,
  items,
  keyField,
  onRowClick,
  rowActions,
  emptyLabel = 'Пока пусто',
}: DataTableProps<T>) {
  if (items.length === 0) {
    return <div className="text-center text-brand-gray-dark py-16 bg-white border border-brand-border rounded-xl">{emptyLabel}</div>
  }

  return (
    <div className="overflow-x-auto bg-white border border-brand-border rounded-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="sticky top-0 bg-brand-gray text-left text-xs uppercase tracking-wide text-brand-gray-dark">
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2.5 font-semibold whitespace-nowrap ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
            {rowActions && <th className="px-3 py-2.5 w-10" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={keyField(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-t border-brand-border ${
                onRowClick ? 'cursor-pointer hover:bg-brand-yellow-light/40' : ''
              } even:bg-brand-gray/30 transition`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2.5 align-middle ${col.className ?? ''}`}>
                  {col.render(item)}
                </td>
              ))}
              {rowActions && (
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  {rowActions(item)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
