import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Supplier, SupplierDelivery } from '../types/db'

const KEY = ['suppliers']

export function useSuppliers(search?: string) {
  return useQuery({
    queryKey: [...KEY, search ?? ''],
    queryFn: async () => {
      let query = supabase.from('suppliers').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`name.ilike.%${search}%,supplies.ilike.%${search}%,phone.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return data as Supplier[]
    },
  })
}

export type SupplierInput = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>

export function useUpsertSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<SupplierInput> & { id?: string }) => {
      const { id, ...rest } = input
      if (id) {
        const { error } = await supabase.from('suppliers').update(rest).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase.from('suppliers').insert(rest).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSupplierDeliveries(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier_deliveries', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_deliveries')
        .select('*, raw_material:raw_materials(id,name,unit,code)')
        .eq('supplier_id', supplierId)
        .order('delivery_date', { ascending: false })
      if (error) throw error
      return data as (SupplierDelivery & {
        raw_material: { id: string; name: string; unit: string; code: string }
      })[]
    },
  })
}

export function useCreateDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      supplier_id: string
      raw_material_id: string
      qty: number
      unit_price?: number
      delivery_date?: string
    }) => {
      const total_cost = input.unit_price ? input.unit_price * input.qty : null
      const { error } = await supabase.from('supplier_deliveries').insert({
        ...input,
        total_cost,
      })
      if (error) throw error

      const { error: rpcError } = await supabase.rpc('increment_material_stock', {
        p_material_id: input.raw_material_id,
        p_qty: input.qty,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier_deliveries'] })
      qc.invalidateQueries({ queryKey: ['raw_materials'] })
      qc.invalidateQueries({ queryKey: ['material_shortage'] })
    },
  })
}
