import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Employee, EmployeeHours } from '../types/db'

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
