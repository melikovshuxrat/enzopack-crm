import type { InputHTMLAttributes, ReactNode } from 'react'
import { MoneyInput } from './MoneyInput'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  suffix?: ReactNode
  /** Renders a formatted-thousands money input instead of a plain number input. */
  money?: boolean
  onMoneyChange?: (value: number) => void
}

export function FormField({
  label,
  error,
  suffix,
  className,
  type,
  onFocus,
  money,
  value,
  onMoneyChange,
  ...rest
}: FormFieldProps) {
  const inputClassName = `w-full border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow-light transition ${className ?? ''}`
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      <div className="flex items-center gap-2">
        {money ? (
          <MoneyInput
            value={Number(value ?? 0)}
            onChange={(v) => onMoneyChange?.(v)}
            className={inputClassName}
          />
        ) : (
          <input
            {...rest}
            type={type}
            value={value}
            onFocus={(e) => {
              if (type === 'number') e.target.select()
              onFocus?.(e)
            }}
            className={inputClassName}
          />
        )}
        {suffix}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}
