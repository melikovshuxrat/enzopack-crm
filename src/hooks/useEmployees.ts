import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Employee, EmployeeDailyHours, EmployeeHours } from '../types/db'

const KEY = ['employees']

export function useEmployees(search?: string) {
  return useQuery({
    queryKey: [...KEY, search ?? ''],
    queryFn: async () => {
      let query = supabase.from('employees').select('*').order('full_name', { ascending: true })
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,position.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return data as Employee[]
    },
  })
}

export type EmployeeInput = Omit<Employee, 'id' | 'created_at' | 'updated_at'>

export function useUpsertEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<EmployeeInput> & { id?: string }) => {
      const { id, ...rest } = input
      if (id) {
        const { error } = await supabase.from('employees').update(rest).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('employees').insert(rest).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useEmployeeHours(month: string) {
  return useQuery({
    queryKey: ['employee_hours', month],
    enabled: !!month,
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_hours').select('*').eq('month', month)
      if (error) throw error
      return data as EmployeeHours[]
    },
  })
}

export function useEmployeeDailyHours(employeeId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['employee_daily_hours', employeeId, from, to],
    enabled: !!employeeId && !!from && !!to,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_daily_hours')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', from)
        .lte('work_date', to)
      if (error) throw error
      return data as EmployeeDailyHours[]
    },
  })
}

/** All daily-hours rows for every employee in a date range, in one query —
 * used by the employees list so each row's day-strip doesn't need its own
 * request per employee. */
export function useAllEmployeeDailyHours(from: string, to: string) {
  return useQuery({
    queryKey: ['employee_daily_hours', 'all', from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_daily_hours')
        .select('*')
        .gte('work_date', from)
        .lte('work_date', to)
      if (error) throw error
      return data as EmployeeDailyHours[]
    },
  })
}

export function useUpsertEmployeeDailyHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employee_id: string; work_date: string; hours: number }) => {
      const { error } = await supabase
        .from('employee_daily_hours')
        .upsert(input, { onConflict: 'employee_id,work_date' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee_daily_hours'] })
      qc.invalidateQueries({ queryKey: ['employee_hours'] })
    },
  })
}

export function useUpsertEmployeeHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      employee_id: string
      month: string
      hours_worked: number
      salary_snapshot: number
      norm_hours_snapshot: number
    }) => {
      const { error } = await supabase
        .from('employee_hours')
        .upsert(input, { onConflict: 'employee_id,month' })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['employee_hours', variables.month] })
    },
  })
}
