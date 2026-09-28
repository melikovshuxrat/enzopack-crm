interface KpiCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'income' | 'expense'
  onClick?: () => void
}

const TONE_CLASSES: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-white border-brand-border',
  warning: 'bg-brand-yellow-light border-brand-yellow/60',
  income: 'bg-green-50 border-green-100',
  expense: 'bg-red-50 border-red-100',
}

export function KpiCard({ label, value, hint, tone = 'default', onClick }: KpiCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex-1 min-w-[200px] text-left rounded-2xl border p-5 shadow-[0_1px_2px_rgba(20,18,15,0.04)] transition hover:shadow-[0_4px_16px_rgba(20,18,15,0.08)] ${
        onClick ? 'cursor-pointer hover:brightness-95 active:scale-[0.98]' : ''
      } ${TONE_CLASSES[tone]}`}
    >
      <div className="text-sm text-brand-gray-dark font-medium">{label}</div>
      <div className="text-3xl font-extrabold text-brand-ink mt-1.5 tracking-tight">{value}</div>
      {hint && <div className="text-xs text-brand-gray-dark mt-1.5">{hint}</div>}
      {onClick && <div className="text-[11px] text-brand-yellow-dark font-semibold mt-1">Показать детали →</div>}
    </Tag>
  )
}
