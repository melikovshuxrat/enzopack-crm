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
    // No overflow-x-auto here: an element with overflow-x set becomes the
    // scroll container that `sticky` measures its offset against — with a
    // non-zero `top` (needed to clear the site nav) that shifts the header
    // down by that many pixels into the table instead of pinning it under
    // the nav. Confirmed by reproducing it in isolation before this fix.
    // Wide tables now scroll the page horizontally instead of a local box.
    <div className="bg-white border border-brand-border rounded-xl">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          {/* top-14: the site nav is sticky top-0 at h-14/z-30 — without this
              offset the table header sticks underneath it and looks hidden. */}
          <tr className="sticky top-14 z-10 bg-brand-gray text-left text-xs uppercase tracking-wide text-brand-gray-dark">
            <th className="px-3 py-2.5 font-semibold w-10">№</th>
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2.5 font-semibold whitespace-nowrap ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
            {rowActions && <th className="px-3 py-2.5 w-10" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={keyField(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-t border-brand-border ${
                onRowClick ? 'cursor-pointer hover:bg-brand-yellow-light/40' : ''
              } even:bg-brand-gray/30 transition`}
            >
              <td className="px-3 py-2.5 align-middle">
                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-full bg-black/5 text-brand-gray-dark text-[11px] font-medium">
                  {index + 1}
                </span>
              </td>
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
