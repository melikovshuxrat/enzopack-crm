interface KpiCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'income' | 'expense'
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-white border-brand-border',
  warning: 'bg-brand-yellow-light border-brand-yellow/60',
  income: 'bg-green-50 border-green-100',
  expense: 'bg-red-50 border-red-100',
}

export function KpiCard({ label, value, hint, tone = 'default' }: KpiCardProps) {
  return (
    <div
      className={`flex-1 min-w-[200px] rounded-2xl border p-5 shadow-[0_1px_2px_rgba(20,18,15,0.04)] transition hover:shadow-[0_4px_16px_rgba(20,18,15,0.08)] ${TONE_CLASSES[tone]}`}
    >
      <div className="text-sm text-brand-gray-dark font-medium">{label}</div>
      <div className="text-3xl font-extrabold text-brand-ink mt-1.5 tracking-tight">{value}</div>
      {hint && <div className="text-xs text-brand-gray-dark mt-1.5">{hint}</div>}
    </div>
  )
}
