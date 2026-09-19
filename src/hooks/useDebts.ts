import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Balance {
  total: number
  paid: number
  /** Positive: they owe us / we owe supplier. Negative: overpaid, the other side owes us. */
  debt: number
}

// Plain objects, not Maps: the React Query cache is persisted to localStorage
// as JSON, and a Map would come back as {} and crash on .get()/.values().
export type BalanceMap = Record<string, Balance>

function toBalances(totals: Record<string, number>, paid: Record<string, number>): BalanceMap {
  const result: BalanceMap = {}
  for (const id of new Set([...Object.keys(totals), ...Object.keys(paid)])) {
    const total = totals[id] ?? 0
    const p = paid[id] ?? 0
    result[id] = { total, paid: p, debt: total - p }
  }
  return result
}

export function useClientBalances() {
  return useQuery({
    queryKey: ['client_balances'],
    queryFn: async () => {
      const [{ data: orders, error: ordersError }, { data: txs, error: txError }] = await Promise.all([
        supabase.from('orders').select('client_id, total_amount').neq('status', 'cancelled'),
        supabase
          .from('finance_transactions')
          .select('related_client_id, amount')
          .eq('type', 'income')
          .not('related_client_id', 'is', null),
      ])
      if (ordersError) throw ordersError
      if (txError) throw txError

      const totals: Record<string, number> = {}
      for (const o of orders ?? []) {
        totals[o.client_id] = (totals[o.client_id] ?? 0) + Number(o.total_amount)
      }
      const paid: Record<string, number> = {}
      for (const t of txs ?? []) {
        if (!t.related_client_id) continue
        paid[t.related_client_id] = (paid[t.related_client_id] ?? 0) + Number(t.amount)
      }
      return toBalances(totals, paid)
    },
  })
}

export function useSupplierBalances() {
  return useQuery({
    queryKey: ['supplier_balances'],
    queryFn: async () => {
      const [{ data: deliveries, error: delError }, { data: txs, error: txError }] = await Promise.all([
        supabase.from('supplier_deliveries').select('supplier_id, total_cost'),
        supabase
          .from('finance_transactions')
          .select('related_supplier_id, amount')
          .eq('type', 'expense')
          .not('related_supplier_id', 'is', null),
      ])
      if (delError) throw delError
      if (txError) throw txError

      const totals: Record<string, number> = {}
      for (const d of deliveries ?? []) {
        if (d.total_cost == null) continue
        totals[d.supplier_id] = (totals[d.supplier_id] ?? 0) + Number(d.total_cost)
      }
      const paid: Record<string, number> = {}
      for (const t of txs ?? []) {
        if (!t.related_supplier_id) continue
        paid[t.related_supplier_id] = (paid[t.related_supplier_id] ?? 0) + Number(t.amount)
      }
      return toBalances(totals, paid)
    },
  })
}

/** Sum of income payments per order, for a given client — used to annotate an order-history list without one query per row. */
export function useOrderPayments(clientId: string | undefined) {
  return useQuery({
    queryKey: ['order_payments', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('related_order_id, amount')
        .eq('type', 'income')
        .eq('related_client_id', clientId as string)
      if (error) throw error
      const map: Record<string, number> = {}
      for (const t of data ?? []) {
        if (!t.related_order_id) continue
        map[t.related_order_id] = (map[t.related_order_id] ?? 0) + Number(t.amount)
      }
      return map
    },
  })
}

/** Sum of income payments recorded for a single order — used in the order detail view. */
export function useOrderPaid(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order_paid', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('type', 'income')
        .eq('related_order_id', orderId as string)
      if (error) throw error
      return (data ?? []).reduce((s, t) => s + Number(t.amount), 0)
    },
  })
}

export interface SupplierPayment {
  id: string
  amount: number
  transaction_date: string
  description: string | null
}

/** Individual expense payments recorded against a supplier — used in the Finance debts drill-down. */
export function useSupplierPayments(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier_payments', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('id, amount, transaction_date, description')
        .eq('type', 'expense')
        .eq('related_supplier_id', supplierId as string)
        .order('transaction_date', { ascending: false })
      if (error) throw error
      return data as SupplierPayment[]
    },
  })
}
