import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable, type DataTableColumn } from '../components/common/DataTable'
import { EntityFormModal } from '../components/common/EntityFormModal'
import { FormField } from '../components/common/FormField'
import { formatMoney, getDeleteErrorMessage, getErrorMessage } from '../lib/formatters'
import {
  useAllEmployeeDailyHours,
  useAllEmployeeHoursHistory,
  useAllEmployeePayments,
  useCreateEmployeePayment,
  useDeleteEmployee,
  useEmployeeDailyHours,
  useEmployees,
  useUpsertEmployee,
  useUpsertEmployeeDailyHours,
} from '../hooks/useEmployees'
import type { Employee, EmployeePaymentType, StaffType } from '../types/db'

const EMPTY: Partial<Employee> = {
  full_name: '',
  position: '',
  monthly_salary: 0,
  monthly_norm_hours: 176,
  daily_norm_hours: 8,
  staff_type: 'regular',
}

const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  regular: 'Обычный',
  management: 'Управленческий',
}

const FILTER_MODES = [
  { key: 'month', label: 'Месяц' },
  { key: 'year', label: 'Год' },
  { key: 'day', label: 'День' },
  { key: 'period', label: 'Период' },
] as const

type FilterMode = (typeof FILTER_MODES)[number]['key']

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function monthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [compactView, setCompactView] = useState(false)
  const { data: employees = [], isLoading } = useEmployees(search)
  const upsert = useUpsertEmployee()
  const del = useDeleteEmployee()
  const [editing, setEditing] = useState<Partial<Employee> | null>(null)
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null)

  const now = new Date()
  const [filterMode, setFilterMode] = useState<FilterMode>('month')
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
  const [filterDay, setFilterDay] = useState(todayISO())
  const [filterFrom, setFilterFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [filterTo, setFilterTo] = useState(todayISO())

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  const { from, to } = useMemo(() => {
    if (filterMode === 'year') return { from: `${filterYear}-01-01`, to: `${filterYear}-12-31` }
    if (filterMode === 'month') {
      const last = lastDayOfMonth(filterYear, filterMonth)
      return { from: `${filterYear}-${pad2(filterMonth)}-01`, to: `${filterYear}-${pad2(filterMonth)}-${pad2(last)}` }
    }
    if (filterMode === 'day') return { from: filterDay, to: filterDay }
    return { from: filterFrom, to: filterTo }
  }, [filterMode, filterYear, filterMonth, filterDay, filterFrom, filterTo])

  const { data: allDailyHours = [] } = useAllEmployeeDailyHours(from, to)
  const { data: allHoursHistory = [] } = useAllEmployeeHoursHistory()
  const { data: allPayments = [] } = useAllEmployeePayments()

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
        staff_type: editing.staff_type ?? 'regular',
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

  function payForEmployeeInRange(employee: Employee): { hours: number; pay: number } {
    const rows = allDailyHours.filter((h) => h.employee_id === employee.id)
    const byMonth = new Map<string, number>()
    for (const row of rows) {
      const key = monthKey(row.work_date)
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(row.hours))
    }
    let totalHours = 0
    let totalPay = 0
    for (const hoursInMonth of byMonth.values()) {
      totalHours += hoursInMonth
      totalPay += (employee.monthly_salary * hoursInMonth) / (employee.monthly_norm_hours || 1)
    }
    return { hours: totalHours, pay: totalPay }
  }

  const columns: DataTableColumn<Employee>[] = [
    { key: 'name', header: 'Имя', render: (e) => <span className="font-medium text-brand-ink">{e.full_name}</span> },
    { key: 'position', header: 'Должность', render: (e) => e.position || '—' },
    { key: 'staff_type', header: 'Тип', render: (e) => STAFF_TYPE_LABELS[e.staff_type] },
    { key: 'daily_norm', header: 'Часы/день', render: (e) => e.daily_norm_hours },
    { key: 'monthly_norm', header: 'Часы/месяц', render: (e) => e.monthly_norm_hours },
    { key: 'salary', header: 'Оклад', render: (e) => formatMoney(e.monthly_salary) },
    {
      key: 'days',
      header: 'Часы по дням',
      render: (e) => (
        <DayStrip
          employeeId={e.id}
          from={from}
          to={to}
          rows={allDailyHours.filter((h) => h.employee_id === e.id)}
          onOpen={() => setDetailEmployee(e)}
        />
      ),
    },
    {
      key: 'pay',
      header: 'Зарплата за период',
      render: (e) => {
        const { hours, pay } = payForEmployeeInRange(e)
        return (
          <div>
            <div className="font-semibold text-brand-ink">{formatMoney(pay)}</div>
            <div className="text-[10px] text-brand-gray-dark">{hours.toFixed(1)} ч</div>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-brand-ink">Сотрудники</h1>
        <div className="flex items-center gap-2">
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

      <div className="flex flex-wrap items-center gap-2 mb-4 bg-white border border-brand-border rounded-xl p-3">
        <div className="flex gap-1 bg-brand-gray rounded-lg p-0.5">
          {FILTER_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setFilterMode(m.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                filterMode === m.key ? 'bg-white shadow-sm text-brand-ink' : 'text-brand-gray-dark'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {filterMode === 'year' && (
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="border border-brand-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand-yellow"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}

        {filterMode === 'month' && (
          <>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="border border-brand-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand-yellow"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="border border-brand-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand-yellow"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        )}

        {filterMode === 'day' && (
          <input
            type="date"
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="border border-brand-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-brand-yellow"
          />
        )}

        {filterMode === 'period' && (
          <div className="flex items-center gap-1 border border-brand-border rounded-lg px-2 py-1">
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="text-sm outline-none bg-transparent"
            />
            <span className="text-brand-gray-dark text-sm">—</span>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="text-sm outline-none bg-transparent"
            />
          </div>
        )}

        {filterMode === 'month' && (
          <div className="flex gap-1 bg-brand-gray rounded-lg p-0.5 ml-auto">
            <button
              type="button"
              onClick={() => setCompactView(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                !compactView ? 'bg-white shadow-sm text-brand-ink' : 'text-brand-gray-dark'
              }`}
            >
              Обычный вид
            </button>
            <button
              type="button"
              onClick={() => setCompactView(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                compactView ? 'bg-white shadow-sm text-brand-ink' : 'text-brand-gray-dark'
              }`}
            >
              Уместить всё
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-brand-gray-dark">Загрузка…</div>
      ) : filterMode === 'month' ? (
        <>
          <EmployeeJournalTable
            employees={employees.filter((e) => e.staff_type !== 'management')}
            year={filterYear}
            month={filterMonth}
            dailyHours={allDailyHours}
            hoursHistory={allHoursHistory}
            payments={allPayments}
            onEditEmployee={(e) => openEdit(e.id)}
            compact={compactView}
          />
          {(() => {
            const management = employees.filter((e) => e.staff_type === 'management')
            if (management.length === 0) return null
            return (
              <div className="mt-8">
                <div className="text-sm font-semibold text-brand-ink mb-2">Управленческий персонал</div>
                <EmployeeJournalTable
                  employees={management}
                  year={filterYear}
                  month={filterMonth}
                  dailyHours={allDailyHours}
                  hoursHistory={allHoursHistory}
                  payments={allPayments}
                  onEditEmployee={(e) => openEdit(e.id)}
                  compact={compactView}
                  stickyHeader={false}
                />
              </div>
            )
          })()}
        </>
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
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-brand-ink">Тип персонала</span>
              <div className="flex gap-1 bg-brand-gray rounded-lg p-0.5 w-fit">
                {(Object.keys(STAFF_TYPE_LABELS) as StaffType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditing({ ...editing, staff_type: t })}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      (editing.staff_type ?? 'regular') === t ? 'bg-white shadow-sm text-brand-ink' : 'text-brand-gray-dark'
                    }`}
                  >
                    {STAFF_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </label>
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
          </>
        )}
      </EntityFormModal>

      {detailEmployee && (
        <EmployeeHoursCard
          employee={detailEmployee}
          initialMonth={monthKey(from)}
          onClose={() => setDetailEmployee(null)}
        />
      )}
    </div>
  )
}

function DayStrip({
  from,
  to,
  rows,
  onOpen,
}: {
  employeeId: string
  from: string
  to: string
  rows: { work_date: string; hours: number }[]
  onOpen: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    const list: string[] = []
    const start = new Date(from)
    const end = new Date(to)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      list.push(d.toISOString().slice(0, 10))
    }
    return list
  }, [from, to])

  const hoursByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r.work_date, Number(r.hours))
    return map
  }, [rows])

  useEffect(() => {
    todayRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' as ScrollBehavior })
  }, [from, to])

  const today = todayISO()

  return (
    <div
      ref={scrollRef}
      onClick={onOpen}
      className="flex gap-1 overflow-x-auto max-w-[220px] py-0.5 cursor-pointer scrollbar-thin"
      title="Открыть журнал по дням"
    >
      {days.map((day) => {
        const isToday = day === today
        const h = hoursByDay.get(day)
        return (
          <div
            key={day}
            ref={isToday ? todayRef : undefined}
            className={`flex-shrink-0 w-8 h-9 rounded-md flex flex-col items-center justify-center text-[9px] leading-tight ${
              isToday ? 'bg-brand-yellow text-brand-black font-semibold' : 'bg-brand-gray text-brand-ink'
            }`}
          >
            <span className="opacity-60">{Number(day.slice(8, 10))}</span>
            <span className="font-semibold">{h ? h : '·'}</span>
          </div>
        )
      })}
    </div>
  )
}

function EmployeeHoursCard({
  employee,
  initialMonth,
  onClose,
}: {
  employee: Employee
  initialMonth: string
  onClose: () => void
}) {
  const [month, setMonth] = useState(initialMonth)
  const [year, monthNum] = month.split('-').map(Number)
  const last = lastDayOfMonth(year, monthNum)
  const monthFrom = `${month}-01`
  const monthTo = `${month}-${pad2(last)}`

  const { data: rows = [] } = useEmployeeDailyHours(employee.id, monthFrom, monthTo)
  const upsertDaily = useUpsertEmployeeDailyHours()

  const hoursByDay = useMemo(() => {
    const map = new Map<number, number>()
    for (const r of rows) map.set(Number(r.work_date.slice(8, 10)), Number(r.hours))
    return map
  }, [rows])

  const totalHours = Array.from(hoursByDay.values()).reduce((s, h) => s + h, 0)
  const pay = (employee.monthly_salary * totalHours) / (employee.monthly_norm_hours || 1)

  function shiftMonth(delta: number) {
    const d = new Date(year, monthNum - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }

  async function saveDay(day: number, hours: number) {
    const work_date = `${month}-${pad2(day)}`
    try {
      await upsertDaily.mutateAsync({ employee_id: employee.id, work_date, hours })
    } catch (error) {
      alert(`Не удалось сохранить часы: ${getErrorMessage(error)}`)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-brand-ink">{employee.full_name}</div>
            {employee.position && <div className="text-xs text-brand-gray-dark">{employee.position}</div>}
          </div>
          <div className="flex items-center gap-1 bg-brand-gray rounded-full px-2 py-1">
            <button type="button" onClick={() => shiftMonth(-1)} className="text-brand-gray-dark px-1">
              ‹
            </button>
            <span className="text-xs font-medium text-brand-ink capitalize w-28 text-center">{monthLabel(month)}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="text-brand-gray-dark px-1">
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {Array.from({ length: last }, (_, i) => i + 1).map((day) => (
            <label key={day} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-brand-gray-dark">{day}</span>
              <input
                type="number"
                min={0}
                max={24}
                step="0.5"
                defaultValue={hoursByDay.get(day) || ''}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => saveDay(day, Number(e.target.value) || 0)}
                className="w-full border border-brand-border rounded-md px-1 py-1 text-xs text-center outline-none focus:border-brand-yellow appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 bg-brand-gray rounded-xl p-3 text-xs">
          <div>
            <div className="text-brand-gray-dark">Отработано</div>
            <div className="font-semibold text-brand-ink">{totalHours.toFixed(1)} ч</div>
          </div>
          <div>
            <div className="text-brand-gray-dark">Норма</div>
            <div className="font-semibold text-brand-ink">{employee.monthly_norm_hours} ч</div>
          </div>
          <div>
            <div className="text-brand-gray-dark">Зарплата</div>
            <div className="font-semibold text-brand-ink">{formatMoney(pay)}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 rounded-lg text-sm font-semibold bg-brand-yellow text-brand-black hover:brightness-95 transition"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}

interface JournalEmployeeRow {
  employee: Employee
  hoursByDay: Map<number, number>
  totalHours: number
  earnedThisMonth: number
  debtBeforeMonth: number
  advanceThisMonth: number
  payoutThisMonth: number
  debtAfterMonth: number
}

function EmployeeJournalTable({
  employees,
  year,
  month,
  dailyHours,
  hoursHistory,
  payments,
  onEditEmployee,
  compact = false,
  stickyHeader = true,
}: {
  employees: Employee[]
  year: number
  month: number
  dailyHours: { employee_id: string; work_date: string; hours: number }[]
  hoursHistory: { employee_id: string; month: string; hours_worked: number; salary_snapshot: number; norm_hours_snapshot: number }[]
  payments: { employee_id: string; payment_date: string; type: EmployeePaymentType; amount: number }[]
  onEditEmployee: (employee: Employee) => void
  /** "Уместить всё" — shrinks columns to fit the whole month without horizontal scroll. */
  compact?: boolean
  /** Second (management) table doesn't need its own header pinned — it's short. */
  stickyHeader?: boolean
}) {
  const upsertDaily = useUpsertEmployeeDailyHours()
  const createPayment = useCreateEmployeePayment()
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const monthKeySel = `${year}-${pad2(month)}`
  const monthStart = `${monthKeySel}-01`
  const days = lastDayOfMonth(year, month)
  const today = todayISO()

  const rows: JournalEmployeeRow[] = useMemo(() => {
    return employees.map((employee) => {
      const hoursByDay = new Map<number, number>()
      for (const h of dailyHours) {
        if (h.employee_id !== employee.id) continue
        if (monthKey(h.work_date) !== monthKeySel) continue
        hoursByDay.set(Number(h.work_date.slice(8, 10)), Number(h.hours))
      }
      const totalHours = Array.from(hoursByDay.values()).reduce((s, h) => s + h, 0)

      let earnedThisMonth = 0
      let earnedBeforeMonth = 0
      for (const row of hoursHistory) {
        if (row.employee_id !== employee.id) continue
        // salary_snapshot is the configured monthly salary at that time, not
        // hours-adjusted pay — the actual accrual is salary × hours/norm,
        // same formula already used in payForEmployeeInRange/EmployeeHoursCard.
        const accrued = (Number(row.salary_snapshot) * Number(row.hours_worked)) / (Number(row.norm_hours_snapshot) || 1)
        const rowMonthKey = row.month.slice(0, 7)
        if (rowMonthKey === monthKeySel) earnedThisMonth += accrued
        else if (rowMonthKey < monthKeySel) earnedBeforeMonth += accrued
      }

      let paidBeforeMonth = 0
      let advanceThisMonth = 0
      let payoutThisMonth = 0
      for (const p of payments) {
        if (p.employee_id !== employee.id) continue
        if (p.payment_date < monthStart) {
          paidBeforeMonth += Number(p.amount)
        } else if (p.payment_date.slice(0, 7) === monthKeySel) {
          if (p.type === 'advance') advanceThisMonth += Number(p.amount)
          else payoutThisMonth += Number(p.amount)
        }
      }

      const debtBeforeMonth = earnedBeforeMonth - paidBeforeMonth
      const debtAfterMonth = debtBeforeMonth + earnedThisMonth - advanceThisMonth - payoutThisMonth

      return { employee, hoursByDay, totalHours, earnedThisMonth, debtBeforeMonth, advanceThisMonth, payoutThisMonth, debtAfterMonth }
    })
  }, [employees, dailyHours, hoursHistory, payments, monthKeySel, monthStart])

  function focusCell(day: number, rowIndex: number) {
    inputRefs.current.get(`${day}-${rowIndex}`)?.focus()
  }

  async function saveDay(employeeId: string, day: number, hours: number) {
    const work_date = `${monthKeySel}-${pad2(day)}`
    try {
      await upsertDaily.mutateAsync({ employee_id: employeeId, work_date, hours })
    } catch (error) {
      alert(`Не удалось сохранить часы: ${getErrorMessage(error)}`)
    }
  }

  if (employees.length === 0) {
    return <div className="text-brand-gray-dark py-10 text-center">Сотрудников пока нет</div>
  }

  // "Уместить всё": table-layout:fixed + no explicit width on day columns —
  // the browser splits whatever space is left after the fixed-width columns
  // evenly between them, so the whole month fits without horizontal scroll.
  const dayThClass = compact
    ? 'px-0.5 py-1 font-medium text-[10px]'
    : 'px-1 py-2 font-medium min-w-[44px]'
  const trailingThClass = compact
    ? 'px-1 py-1 font-medium text-[10px] whitespace-normal leading-tight w-14'
    : 'px-3 py-2 font-medium whitespace-nowrap'
  const dayTdPad = compact ? 'p-0.5' : 'p-1'
  const dayInputClass = compact ? 'w-full h-7 text-[10px]' : 'w-10 h-9 text-sm'
  const trailingTdClass = compact ? 'px-1 py-1 text-[10px]' : 'px-3 py-1.5'
  const stickyTop = stickyHeader ? 'sticky top-14' : ''

  return (
    // No overflow-x-auto: reproduced in an isolated test page that an
    // overflow-x container becomes sticky's scroll-offset reference, so a
    // non-zero `top` (clearing the site nav) shifted the header down into
    // the table instead of pinning it — confirmed fixed by removing this
    // and letting the page itself scroll horizontally when the table is wide.
    <div className="border border-brand-border rounded-xl bg-white">
      <table className={`border-separate border-spacing-0 text-xs w-full ${compact ? 'table-fixed' : ''}`}>
        {/* top-14: offsets under the site nav (sticky top-0, h-14, z-30) so
            the journal's own header stays visible while scrolling down —
            skipped entirely when stickyHeader=false (second, short table). */}
        <thead>
          <tr className="bg-brand-gray text-brand-gray-dark">
            <th className={`sticky left-0 ${stickyTop} z-20 bg-brand-gray px-2 py-2 font-medium w-9`}>№</th>
            <th
              className={`sticky left-9 ${stickyTop} z-20 bg-brand-gray px-3 py-2 text-left font-medium ${
                compact ? 'w-28 truncate' : 'whitespace-nowrap'
              }`}
            >
              Сотрудник
            </th>
            {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
              <th
                key={day}
                className={`${stickyTop} z-10 ${dayThClass} ${`${monthKeySel}-${pad2(day)}` === today ? 'bg-brand-yellow-light text-brand-ink' : 'bg-brand-gray'}`}
              >
                {day}
              </th>
            ))}
            <th className={`${stickyTop} z-10 bg-brand-gray ${trailingThClass}`}>Часы</th>
            <th className={`${stickyTop} z-10 bg-brand-gray ${trailingThClass}`}>Долг на начало</th>
            <th className={`${stickyTop} z-10 bg-brand-gray ${trailingThClass}`}>Начислено</th>
            <th className={`${stickyTop} z-10 bg-brand-gray ${trailingThClass}`}>Аванс</th>
            <th className={`${stickyTop} z-10 bg-brand-gray ${trailingThClass}`}>На руки</th>
            <th className={`${stickyTop} z-10 bg-brand-gray ${trailingThClass}`}>Долг на конец</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.employee.id} className="border-t border-brand-border">
              <td className="sticky left-0 bg-white px-2 py-1.5 text-center">
                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-black/5 text-brand-gray-dark text-[10px] font-medium">
                  {rowIndex + 1}
                </span>
              </td>
              <td
                className={`sticky left-9 bg-white px-3 py-1.5 cursor-pointer hover:underline ${compact ? 'truncate' : 'whitespace-nowrap'}`}
                onClick={() => onEditEmployee(row.employee)}
              >
                <div className="font-medium text-brand-ink truncate">{row.employee.full_name}</div>
                {!compact && row.employee.position && (
                  <div className="text-[10px] text-brand-gray-dark">{row.employee.position}</div>
                )}
              </td>
              {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
                const isToday = `${monthKeySel}-${pad2(day)}` === today
                return (
                  <td key={day} className={dayTdPad}>
                    {/* A visible "cell" box (translucent fill, rounded), not a
                        bare number — matches the Google Sheets look asked for. */}
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${day}-${rowIndex}`, el)
                        else inputRefs.current.delete(`${day}-${rowIndex}`)
                      }}
                      type="number"
                      min={0}
                      max={24}
                      step="0.5"
                      defaultValue={row.hoursByDay.get(day) || ''}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => saveDay(row.employee.id, day, Number(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                          focusCell(day, rowIndex + 1)
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                          focusCell(day, rowIndex - 1)
                        } else if (e.key === 'ArrowLeft') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                          focusCell(day - 1, rowIndex)
                        } else if (e.key === 'ArrowRight') {
                          e.preventDefault()
                          ;(e.target as HTMLInputElement).blur()
                          focusCell(day + 1, rowIndex)
                        }
                      }}
                      className={`${dayInputClass} rounded-lg text-center font-medium outline-none border transition appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 ${
                        isToday
                          ? 'bg-brand-yellow-light/60 border-brand-yellow/40'
                          : 'bg-black/[0.04] border-black/5 hover:bg-black/[0.07]'
                      } focus:bg-white focus:border-brand-yellow`}
                    />
                  </td>
                )
              })}
              <td className={`${trailingTdClass} text-center font-medium whitespace-nowrap`}>{row.totalHours.toFixed(1)}</td>
              <td className={`${trailingTdClass} text-center whitespace-nowrap ${row.debtBeforeMonth > 0 ? 'text-red-600' : 'text-brand-gray-dark'}`}>
                {row.debtBeforeMonth !== 0 ? formatMoney(row.debtBeforeMonth) : '—'}
              </td>
              <td className={`${trailingTdClass} text-center font-medium whitespace-nowrap`}>{formatMoney(row.earnedThisMonth)}</td>
              <td className={`${trailingTdClass} text-center whitespace-nowrap relative`}>
                <PayoutCell
                  amount={row.advanceThisMonth}
                  compact={compact}
                  onSave={(amount, comment) =>
                    createPayment.mutateAsync({
                      employee_id: row.employee.id,
                      payment_date: todayISO(),
                      type: 'advance',
                      amount,
                      comment,
                    })
                  }
                />
              </td>
              <td className={`${trailingTdClass} text-center whitespace-nowrap relative`}>
                <PayoutCell
                  amount={row.payoutThisMonth}
                  compact={compact}
                  onSave={(amount, comment) =>
                    createPayment.mutateAsync({
                      employee_id: row.employee.id,
                      payment_date: todayISO(),
                      type: 'payout',
                      amount,
                      comment,
                    })
                  }
                />
              </td>
              <td className={`${trailingTdClass} text-center font-semibold whitespace-nowrap ${row.debtAfterMonth > 0 ? 'text-red-600' : 'text-green-700'}`}>
                {formatMoney(row.debtAfterMonth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PayoutCell({
  amount,
  onSave,
  compact = false,
}: {
  amount: number
  onSave: (amount: number, comment: string | null) => Promise<void>
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (value <= 0) return
    setSaving(true)
    try {
      await onSave(value, comment || null)
      setValue(0)
      setComment('')
      setOpen(false)
    } catch (error) {
      alert(`Не удалось сохранить: ${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? 'flex flex-col items-center text-[10px] mx-auto text-brand-ink hover:text-brand-yellow-dark' : 'flex items-center gap-1 mx-auto text-brand-ink hover:text-brand-yellow-dark'}
        title="Добавить"
      >
        <span>{amount > 0 ? formatMoney(amount) : '—'}</span>
        <span className="text-brand-yellow-dark font-bold">+</span>
      </button>
    )
  }

  return (
    <div
      className={
        compact
          ? 'absolute z-30 right-0 top-full mt-1 flex flex-col gap-1 items-stretch bg-white border border-brand-border shadow-lg rounded-lg p-1.5 min-w-[110px]'
          : 'flex flex-col gap-1 items-stretch bg-brand-gray rounded-lg p-1.5 min-w-[110px]'
      }
    >
      <input
        type="number"
        placeholder="Сумма"
        value={value || ''}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setValue(Number(e.target.value))}
        className="border border-brand-border rounded px-1 py-0.5 text-xs outline-none focus:border-brand-yellow"
      />
      <input
        type="text"
        placeholder="Причина"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="border border-brand-border rounded px-1 py-0.5 text-xs outline-none focus:border-brand-yellow"
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={value <= 0 || saving}
          className="flex-1 text-xs font-semibold px-1.5 py-0.5 rounded bg-brand-yellow text-brand-black disabled:opacity-50"
        >
          ОК
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs px-1.5 py-0.5 rounded text-brand-gray-dark hover:bg-white"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
