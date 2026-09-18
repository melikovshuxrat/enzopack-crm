import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Order, OrderMaterialConsumption, OrderStatus } from '../types/db'

const KEY = ['orders']

export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: [...KEY, status ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, client:clients(id,name,company,logo_url), product:finished_products(id,code,name,photo_url)')
        .order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)
      const { data, error } = await query
      if (error) throw error
      return data as Order[]
    },
  })
}

export function useClientOrders(clientId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'by_client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, product:finished_products(id,code,name,photo_url)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Order[]
    },
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      client_id: string
      product_id: string
      quantity: number
      delivery_date: string | null
      unit_price: number
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('create_order_with_consumption', {
        p_client_id: input.client_id,
        p_product_id: input.product_id,
        p_quantity: input.quantity,
        p_delivery_date: input.delivery_date,
        p_unit_price: input.unit_price,
        p_notes: input.notes ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['raw_materials'] })
      qc.invalidateQueries({ queryKey: ['material_shortage'] })
      qc.invalidateQueries({ queryKey: ['dashboard_kpi'] })
    },
  })
}

export function useOrderMaterialConsumption(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order_material_consumption', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_material_consumption')
        .select('*, raw_material:raw_materials(id,code,name,unit,stock_qty)')
        .eq('order_id', orderId)
      if (error) throw error
      return data as OrderMaterialConsumption[]
    },
  })
}

export function useCreateOrderWithCalculator() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      client_id: string
      product_id: string
      quantity: number
      delivery_date: string | null
      unit_price: number
      notes?: string
      consumption: { raw_material_id: string; qty_consumed: number }[]
    }) => {
      const { data, error } = await supabase.rpc('create_order_with_planned_consumption', {
        p_client_id: input.client_id,
        p_product_id: input.product_id,
        p_quantity: input.quantity,
        p_delivery_date: input.delivery_date,
        p_unit_price: input.unit_price,
        p_notes: input.notes ?? null,
        p_consumption: input.consumption,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['dashboard_kpi'] })
    },
  })
}

export function useUpdateOrderDetails() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      orderId: string
      client_id: string
      delivery_date: string | null
      unit_price: number
      notes: string | null
    }) => {
      const { orderId, ...rest } = input
      const { error } = await supabase.from('orders').update(rest).eq('id', orderId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase.rpc('update_order_status', {
        p_order_id: input.orderId,
        p_new_status: input.status,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['raw_materials'] })
      qc.invalidateQueries({ queryKey: ['finished_products'] })
      qc.invalidateQueries({ queryKey: ['material_shortage'] })
      qc.invalidateQueries({ queryKey: ['dashboard_kpi'] })
      qc.invalidateQueries({ queryKey: ['production_trend'] })
      qc.invalidateQueries({ queryKey: ['finance_transactions'] })
      qc.invalidateQueries({ queryKey: ['cash_balance'] })
      qc.invalidateQueries({ queryKey: ['client_balances'] })
      qc.invalidateQueries({ queryKey: ['order_payments'] })
      qc.invalidateQueries({ queryKey: ['order_paid'] })
    },
  })
}
