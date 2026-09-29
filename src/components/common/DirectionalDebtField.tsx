import { MoneyInput } from './MoneyInput'

interface DirectionalDebtFieldProps {
  label: string
  /** Signed: positive = positiveLabel's direction, negative = negativeLabel's. */
  value: number
  onChange: (value: number) => void
  positiveLabel: string
  negativeLabel: string
}

// Old debt field only had a single positive number — no way to say the debt
// runs the other direction. This is a direction toggle (which of the two
// parties owes) plus a plain non-negative amount, combined into one signed
// number on the way out, so the existing debt math (opening_debt added
// straight into the balance) doesn't need to change at all.
export function DirectionalDebtField({ label, value, onChange, positiveLabel, negativeLabel }: DirectionalDebtFieldProps) {
  const isNegative = value < 0
  const amount = Math.abs(value)

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      <div className="flex gap-1 bg-brand-gray rounded-lg p-0.5 w-fit">
        <button
          type="button"
          onClick={() => onChange(amount)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            !isNegative ? 'bg-white shadow-sm text-brand-ink' : 'text-brand-gray-dark'
          }`}
        >
          {positiveLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(-amount)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            isNegative ? 'bg-white shadow-sm text-brand-ink' : 'text-brand-gray-dark'
          }`}
        >
          {negativeLabel}
        </button>
      </div>
      <MoneyInput
        value={amount}
        onChange={(v) => onChange(isNegative ? -v : v)}
        className="border border-brand-border rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-yellow w-40"
      />
    </div>
  )
}
