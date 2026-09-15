import { useState } from 'react'
import { MoneyInput } from '../common/MoneyInput'
import { getErrorMessage, formatMoney } from '../../lib/formatters'
import {
  useDeleteEmployee,
  useEmployeeHours,
  useEmployees,
  useUpsertEmployee,
  useUpsertEmployeeHours,
} from '../../hooks/useEmployees'

function currentMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d)
}

export function PayrollWidget() {
  const [month, setMonth] = useState(currentMonthISO())
  const { data: employees = [] } = useEmployees()
  const { data: hoursRows = [] } = useEmployeeHours(month)
  const upsertEmployee = useUpsertEmployee()
  const deleteEmployee = useDeleteEmployee()
  const upsertHours = useUpsertEmployeeHours()

  const [addingName, setAddingName] = useState('')
  const [addingSalary, setAddingSalary] = useState(0)
  const [addingNormHours, setAddingNormHours] = useState(176)
  const [showAdd, setShowAdd] = useState(false)

  function shiftMonth(delta: number) {
    const d = new Date(month)
    d.setMonth(d.getMonth() + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }

  async function handleAddEmployee() {
    if (!addingName) return
    try {
      await upsertEmployee.mutateAsync({
        full_name: addingName,
        monthly_salary: addingSalary,
        monthly_norm_hours: addingNormHours,
        active: true,
      })
      setAddingName('')
      setAddingSalary(0)
      setAddingNormHours(176)
      setShowAdd(false)
    } catch (error) {
      alert(`Не удалось добавить сотрудника: ${getErrorMessage(error)}`)
    }
  }

  async function handleHoursChange(employeeId: string, salary: number, normHours: number, hours: number) {
    try {
      await upsertHours.mutateAsync({
        employee_id: employeeId,
        month,
        hours_worked: hours,
        salary_snapshot: salary,
        norm_hours_snapshot: normHours,
      })
    } catch (error) {
      alert(`Не удалось сохранить часы: ${getErrorMessage(error)}`)
    }
  }

  const totalPayroll = employees.reduce((sum, emp) => {
    const row = hoursRows.find((h) => h.employee_id === emp.id)
    if (!row) return sum
    const pay = (Number(row.salary_snapshot) * Number(row.hours_worked)) / (Number(row.norm_hours_snapshot) || 1)
    return sum + pay
  }, 0)

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm font-medium text-brand-ink">Зарплата сотрудников</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} className="text-brand-gray-dark px-1">
            ‹
          </button>
          <span className="text-xs font-medium text-brand-ink capitalize w-28 text-center">{monthLabel(month)}</span>
          <button type="button" onClick={() => shiftMonth(1)} className="text-brand-gray-dark px-1">
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {employees.map((emp) => {
          const row = hoursRows.find((h) => h.employee_id === emp.id)
          const hours = row ? Number(row.hours_worked) : 0
          const pay = (emp.monthly_salary * hours) / (emp.monthly_norm_hours || 1)
          return (
            <div key={emp.id} className="grid grid-cols-[1fr_90px_110px_36px] items-center gap-2 text-xs">
              <span className="text-brand-ink font-medium truncate">{emp.full_name}</span>
              <input
                type="number"
                placeholder="часы"
                defaultValue={hours || ''}
                onFocus={(e) => e.target.select()}
                onBlur={(e) =>
                  handleHoursChange(emp.id, emp.monthly_salary, emp.monthly_norm_hours, Number(e.target.value) || 0)
                }
                className="border border-brand-border rounded-lg px-2 py-1 text-xs outline-none focus:border-brand-yellow"
              />
              <span className="whitespace-nowrap font-semibold text-brand-ink">{formatMoney(pay)}</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Удалить сотрудника «${emp.full_name}»?`)) deleteEmployee.mutate(emp.id)
                }}
                className="text-brand-gray-dark hover:text-red-600"
              >
                ✕
              </button>
            </div>
          )
        })}
        {employees.length === 0 && <div className="text-xs text-brand-gray-dark">Сотрудников пока нет</div>}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-brand-border">
        <span className="text-xs text-brand-gray-dark">Итого за месяц</span>
        <span className="text-sm font-bold text-brand-ink">{formatMoney(totalPayroll)}</span>
      </div>

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="mt-3 text-xs font-semibold text-brand-yellow-dark hover:underline"
        >
          + добавить сотрудника
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Имя"
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            className="border border-brand-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-yellow"
          />
          <MoneyInput
            placeholder="Оклад"
            value={addingSalary}
            onChange={setAddingSalary}
            className="border border-brand-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-yellow"
          />
          <input
            type="number"
            placeholder="Норма часов"
            value={addingNormHours || ''}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setAddingNormHours(Number(e.target.value))}
            className="border border-brand-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-yellow"
          />
          <div className="col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-brand-gray-dark">
              Отмена
            </button>
            <button
              type="button"
              onClick={handleAddEmployee}
              disabled={!addingName}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-yellow text-brand-black disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
