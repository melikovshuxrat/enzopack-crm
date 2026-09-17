import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { FinanceTransaction } from '../types/db'

const KEY = ['finance_transactions']

export function useFinanceTransactions(type?: 'income' | 'expense', from?: string, to?: string) {
  return useQuery({
    queryKey: [...KEY, type ?? 'all', from ?? '', to ?? ''],
    queryFn: async () => {
      let query = supabase
        .from('finance_transactions')
        .select('*, related_client:clients(id,name), related_supplier:suppliers(id,name), related_order:orders(id)')
        .order('transaction_date', { ascending: false })
      if (type) query = query.eq('type', type)
      if (from) query = query.gte('transaction_date', from)
      if (to) query = query.lte('transaction_date', to)
      const { data, error } = await query
      if (error) throw error
      return data as (FinanceTransaction & {
        related_client: { id: string; name: string } | null
        related_supplier: { id: string; name: string } | null
      })[]
    },
  })
}

export function useCashBalance() {
  return useQuery({
    queryKey: ['cash_balance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('finance_transactions').select('type, amount')
      if (error) throw error
      const income = data.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = data.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      return { income, expense, balance: income - expense }
    },
  })
}

export function useFinanceSummary(from: string, to: string) {
  return useQuery({
    queryKey: ['finance_summary', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('type, amount')
        .gte('transaction_date', from)
        .lte('transaction_date', to)
      if (error) throw error
      const income = data.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = data.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      return { income, expense, net: income - expense }
    },
  })
}

export type FinanceTransactionInput = Omit<FinanceTransaction, 'id' | 'created_at'>

export function useCreateFinanceTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<FinanceTransactionInput>) => {
      const { error } = await supabase.from('finance_transactions').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
    },
  })
}

export function useDeleteFinanceTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('finance_transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
    },
  })
}
