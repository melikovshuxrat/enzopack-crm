import { useEffect, useState, type InputHTMLAttributes } from 'react'

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

function formatDigits(digits: string): string {
  if (!digits) return ''
  return new Intl.NumberFormat('ru-RU').format(Number(digits))
}

// Plain <input type="number"> shows a raw string of digits with no thousands
// separator while typing, which is unreadable for large сум amounts. This
// keeps a formatted "250 000"-style display in the field itself, while
// onChange still reports a plain number — same contract as a number input.
export function MoneyInput({ value, onChange, className, ...rest }: MoneyInputProps) {
  const [text, setText] = useState(() => formatDigits(value ? String(value) : ''))

  useEffect(() => {
    const currentDigits = text.replace(/\D/g, '')
    if (Number(currentDigits || 0) !== value) {
      setText(value ? formatDigits(String(value)) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setText(formatDigits(digits))
    onChange(digits ? Number(digits) : 0)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={handleChange}
      className={className}
      {...rest}
    />
  )
}
