import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { DEFAULT_DATE_RANGE } from '../components/common/DateRangeFilter'

// Warms the React Query cache for the pages a user lands on right after the
// intro splash (Dashboard, Orders, Clients, warehouses), so the fetch runs
// during the ~2.4s splash animation instead of after it. Each entry mirrors
// the queryKey + queryFn of the matching hook (useOrders, useClients, etc.)
// — keep them in sync if those hooks' default query shape changes.
export function prefetchInitialData(queryClient: QueryClient) {
  const jobs = [
    queryClient.prefetchQuery({
      queryKey: ['orders', 'all'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('orders')
          .select('*, client:clients(id,name,company,logo_url), product:finished_products(id,code,name,photo_url)')
          .order('created_at', { ascending: false })
        if (error) throw error
        return data
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['clients'],
      queryFn: async () => {
        const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return data
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['raw_materials', ''],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('raw_materials')
          .select('*, supplier:suppliers(id,name)')
          .order('code', { ascending: true })
        if (error) throw error
        return data
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['finished_products', ''],
      queryFn: async () => {
        const { data, error } = await supabase.from('finished_products').select('*').order('code', { ascending: true })
        if (error) throw error
        return data
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ['dashboard_kpi', DEFAULT_DATE_RANGE.from, DEFAULT_DATE_RANGE.to],
      queryFn: async () => {
        const { data, error } = await supabase
          .rpc('dashboard_kpi', { p_from: DEFAULT_DATE_RANGE.from, p_to: DEFAULT_DATE_RANGE.to })
          .single()
        if (error) throw error
        return data
      },
    }),
  ]

  // Prefetch is best-effort — a failed warm-up (e.g. offline) must never
  // block the app from rendering; the real hooks will just fetch normally.
  return Promise.allSettled(jobs)
}
