import { useState } from 'react'
import { DataTable, type DataTableColumn } from '../components/common/DataTable'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { formatMoney, getDeleteErrorMessage, getErrorMessage } from '../lib/formatters'
import {
  useDeleteEmployee,
  useEmployeeHours,
  useEmployees,
  useUpsertEmployee,
  useUpsertEmployeeHours,
} from '../hooks/useEmployees'
import type { Employee } from '../types/db'

const EMPTY: Partial<Employee> = {
  full_name: '',
  position: '',
  monthly_salary: 0,
  monthly_norm_hours: 176,
  daily_norm_hours: 8,
  active: true,
}

function currentMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
}

export function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(currentMonthISO())
  const { data: employees = [], isLoading } = useEmployees(search)
  const { data: hoursRows = [] } = useEmployeeHours(month)
  const upsert = useUpsertEmployee()
  const del = useDeleteEmployee()
  const upsertHours = useUpsertEmployeeHours()
  const [editing, setEditing] = useState<Partial<Employee> | null>(null)

  function shiftMonth(delta: number) {
    const d = new Date(month)
    d.setMonth(d.getMonth() + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  function openEdit(id: string) {
    setEditing(employees.find((e) => e.id === id) ?? EMPTY)
  }

  async function handleSave() {
    if (!editing?.full_name) return
    try {
      await upsert.mutateAsync({
        id: editing.id,
        full_name: editing.full_name,
        position: editing.position || null,
        monthly_salary: Number(editing.monthly_salary ?? 0),
        monthly_norm_hours: Number(editing.monthly_norm_hours ?? 176),
        daily_norm_hours: Number(editing.daily_norm_hours ?? 8),
        active: editing.active ?? true,
      })
      setEditing(null)
    } catch (error) {
      alert(`Не удалось сохранить сотрудника: ${getErrorMessage(error)}`)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('Удалить сотрудника?')) return
    try {
      await del.mutateAsync(editing.id)
      setEditing(null)
    } catch (error) {
      alert(`Не удалось удалить сотрудника: ${getDeleteErrorMessage(error)}`)
    }
  }

  async function handleHoursChange(employee: Employee, hours: number) {
    try {
      await upsertHours.mutateAsync({
        employee_id: employee.id,
        month,
        hours_worked: hours,
        salary_snapshot: employee.monthly_salary,
        norm_hours_snapshot: employee.monthly_norm_hours,
      })
    } catch (error) {
      alert(`Не удалось сохранить часы: ${getErrorMessage(error)}`)
    }
  }

  const columns: DataTableColumn<Employee>[] = [
    { key: 'name', header: 'Имя', render: (e) => <span className="font-medium text-brand-ink">{e.full_name}</span> },
    { key: 'position', header: 'Должность', render: (e) => e.position || '—' },
    {
      key: 'active',
      header: 'Активен',
      render: (e) => (e.active ? <span className="text-green-700">Да</span> : <span className="text-brand-gray-dark">Нет</span>),
    },
    { key: 'daily_norm', header: 'Часы/день', render: (e) => e.daily_norm_hours },
    { key: 'monthly_norm', header: 'Часы/месяц', render: (e) => e.monthly_norm_hours },
    { key: 'salary', header: 'Оклад', render: (e) => formatMoney(e.monthly_salary) },
    {
      key: 'hours_worked',
      header: `Часы за ${monthLabel(month)}`,
      render: (e) => {
        const row = hoursRows.find((h) => h.employee_id === e.id)
        return (
          <div onClick={(ev) => ev.stopPropagation()}>
            <input
              type="number"
              placeholder="0"
              defaultValue={row ? Number(row.hours_worked) : ''}
              onFocus={(ev) => ev.target.select()}
              onBlur={(ev) => handleHoursChange(e, Number(ev.target.value) || 0)}
              className="w-20 border border-brand-border rounded-lg px-2 py-1 text-sm outline-none focus:border-brand-yellow"
            />
          </div>
        )
      },
    },
    {
      key: 'pay',
      header: 'Зарплата за месяц',
      render: (e) => {
        const row = hoursRows.find((h) => h.employee_id === e.id)
        const hours = row ? Number(row.hours_worked) : 0
        const pay = (e.monthly_salary * hours) / (e.monthly_norm_hours || 1)
        return <span className="font-semibold text-brand-ink">{formatMoney(pay)}</span>
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Сотрудники</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-brand-border rounded-full px-2 py-1.5">
            <button type="button" onClick={() => shiftMonth(-1)} className="text-brand-gray-dark px-1">
              ‹
            </button>
            <span className="text-xs font-medium text-brand-ink capitalize w-28 text-center">{monthLabel(month)}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="text-brand-gray-dark px-1">
              ›
            </button>
          </div>
          <input
            type="text"
            placeholder="Поиск по имени, должности…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-brand-border rounded-full px-4 py-2 text-sm w-56 outline-none focus:border-brand-yellow"
          />
          <button
            type="button"
            onClick={() => setEditing(EMPTY)}
            className="flex items-center gap-2 bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-full shadow-sm hover:brightness-95 active:scale-95 transition"
          >
            <span className="text-lg leading-none">+</span> Сотрудник
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-brand-gray-dark">Загрузка…</div>
      ) : (
        <DataTable
          columns={columns}
          items={employees}
          keyField={(e) => e.id}
          onRowClick={(e) => openEdit(e.id)}
          emptyLabel="Сотрудников пока нет"
        />
      )}

      <EntityFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Редактировать сотрудника' : 'Новый сотрудник'}
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
              disabled={upsert.isPending || !editing?.full_name}
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
              value={editing.full_name ?? ''}
              onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
            />
            <FormField
              label="Должность"
              value={editing.position ?? ''}
              onChange={(e) => setEditing({ ...editing, position: e.target.value })}
            />
            <FormField
              label="Оклад"
              money
              value={editing.monthly_salary ?? 0}
              onMoneyChange={(v) => setEditing({ ...editing, monthly_salary: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Часы нормы в день"
                type="number"
                value={editing.daily_norm_hours ?? 8}
                onChange={(e) => setEditing({ ...editing, daily_norm_hours: Number(e.target.value) })}
              />
              <FormField
                label="Часы нормы в месяц"
                type="number"
                value={editing.monthly_norm_hours ?? 176}
                onChange={(e) => setEditing({ ...editing, monthly_norm_hours: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-brand-ink cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={editing.active ?? true}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="accent-brand-yellow"
              />
              Активен
            </label>
          </>
        )}
      </EntityFormModal>
    </div>
  )
}
