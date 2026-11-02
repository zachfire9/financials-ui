// Strict parsing for the app's number fields.
//
// parseFloat/parseInt read up to the first character they don't understand
// ("1,000" -> 1, "$5" -> NaN), so these helpers accept common formatting
// ($, %, thousands commas, spaces) and otherwise return null instead of guessing.

const decimalPattern = /^(-)?(\d*)(?:\.(\d*))?$/
const wholeNumberPattern = /^\d+$/

type DecimalOptions = {
  allowNegative?: boolean
}

/**
 * Parses a decimal like "1,000.50", "$1,000", "7%" or "-2.5" and returns it
 * multiplied by 100 as an integer (dollars -> cents, percent -> basis points).
 * Digits past the second decimal place are rounded half away from zero.
 * Returns null for blank or invalid input, or a negative when not allowed.
 */
export function parseHundredths(value: string, { allowNegative = false }: DecimalOptions = {}): number | null {
  const normalized = value.trim().replace(/[\s$%,]/g, '')
  const match = decimalPattern.exec(normalized)
  if (!match) {
    return null
  }

  const [, minus, wholeDigits = '', fractionDigits = ''] = match
  if (wholeDigits === '' && fractionDigits === '') {
    return null
  }
  if (minus && !allowNegative) {
    return null
  }

  const whole = Number(wholeDigits || '0')
  const hundredths = Number(fractionDigits.slice(0, 2).padEnd(2, '0'))
  const roundUp = fractionDigits.length > 2 && Number(fractionDigits[2]) >= 5 ? 1 : 0
  const magnitude = whole * 100 + hundredths + roundUp
  if (!Number.isSafeInteger(magnitude)) {
    return null
  }

  return minus && magnitude !== 0 ? -magnitude : magnitude
}

/**
 * Parses a whole number within [min, max]. Thousands commas and surrounding
 * spaces are allowed; decimals, signs and other text are not.
 */
export function parseWholeNumber(value: string, min: number, max: number): number | null {
  const normalized = value.trim().replace(/,/g, '')
  if (!wholeNumberPattern.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)
  if (parsed < min || parsed > max) {
    return null
  }
  return parsed
}
