export type OrderStatus =
  | 'processing'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  processing: 'В обработке',
  in_progress: 'В процессе',
  ready: 'Готово',
  delivered: 'Доставлено',
  cancelled: 'Отменён',
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'processing',
  'in_progress',
  'ready',
  'delivered',
]

export interface Client {
  id: string
  name: string
  company: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  supplies: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RawMaterial {
  id: string
  code: string
  name: string
  unit: string
  supplier_id: string | null
  unit_price: number
  stock_qty: number
  format: string | null
  grammage: number | null
  created_at: string
  updated_at: string
  supplier?: Pick<Supplier, 'id' | 'name'> | null
}

export interface FinishedProduct {
  id: string
  code: string
  name: string
  sale_price: number
  stock_qty: number
  cost_price: number
  created_at: string
  updated_at: string
}

export interface ProductBomRow {
  id: string
  product_id: string
  raw_material_id: string
  qty_per_unit: number
  raw_material?: Pick<RawMaterial, 'id' | 'code' | 'name' | 'unit' | 'stock_qty'>
}

export interface OrderMaterialConsumption {
  id: string
  order_id: string
  raw_material_id: string
  qty_consumed: number
  applied: boolean
  created_at: string
  raw_material?: Pick<RawMaterial, 'id' | 'code' | 'name' | 'unit' | 'stock_qty'>
}

export interface Order {
  id: string
  client_id: string
  product_id: string
  quantity: number
  delivery_date: string | null
  status: OrderStatus
  unit_price: number
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
  client?: Pick<Client, 'id' | 'name' | 'company'>
  product?: Pick<FinishedProduct, 'id' | 'code' | 'name'>
}

export interface FinanceTransaction {
  id: string
  type: 'income' | 'expense'
  category: string | null
  amount: number
  related_order_id: string | null
  related_supplier_id: string | null
  related_client_id: string | null
  description: string | null
  transaction_date: string
  created_at: string
}

export interface SupplierDelivery {
  id: string
  supplier_id: string
  raw_material_id: string
  qty: number
  unit_price: number | null
  total_cost: number | null
  delivery_date: string
  created_at: string
}

export interface MaterialShortage {
  id: string
  code: string
  name: string
  unit: string
  stock_qty: number
  is_short: boolean
  shortage_qty: number
}

export interface ProductionTrendPoint {
  day: string
  produced_qty: number
}

export interface DashboardKpi {
  produced_qty: number
  orders_count: number
  active_orders: number
  revenue: number
  shortage_materials_count: number
}

export type DieStatus = 'active' | 'in_repair' | 'retired'

export const DIE_STATUS_LABELS: Record<DieStatus, string> = {
  active: 'В работе',
  in_repair: 'В ремонте',
  retired: 'Списан',
}

export interface Die {
  id: string
  code: string
  name: string
  for_product_id: string | null
  purchase_date: string | null
  status: DieStatus
  notes: string | null
  created_at: string
  updated_at: string
  for_product?: Pick<FinishedProduct, 'id' | 'code' | 'name'> | null
}

export interface TechCard {
  id: string
  order_id: string
  client_id: string
  product_id: string
  die_id: string | null
  input_snapshot: Record<string, unknown>
  result_snapshot: Record<string, unknown>
  settings_snapshot: Record<string, unknown>
  total_cost: number
  unit_cost: number
  sale_price_vat: number
  margin_pct: number | null
  created_at: string
  die?: Pick<Die, 'id' | 'code' | 'name'> | null
}

export type FinishedGoodsMovementType = 'produced' | 'shipped' | 'adjustment'

export const FINISHED_GOODS_MOVEMENT_LABELS: Record<FinishedGoodsMovementType, string> = {
  produced: 'Произведено',
  shipped: 'Отгружено',
  adjustment: 'Корректировка',
}

export interface FinishedGoodsMovement {
  id: string
  product_id: string
  order_id: string | null
  movement_type: FinishedGoodsMovementType
  qty: number
  movement_date: string
  notes: string | null
  created_at: string
}

export interface Employee {
  id: string
  full_name: string
  position: string | null
  monthly_salary: number
  monthly_norm_hours: number
  daily_norm_hours: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface EmployeeHours {
  id: string
  employee_id: string
  month: string
  hours_worked: number
  salary_snapshot: number
  norm_hours_snapshot: number
  notes: string | null
  created_at: string
}

export interface EmployeeDailyHours {
  id: string
  employee_id: string
  work_date: string
  hours: number
  created_at: string
  updated_at: string
}
