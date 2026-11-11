// A fixed-rate mortgage: what's owed today, the APR and the monthly
// principal-and-interest payment. Payments come from salary until retirement
// and from savings after; the projection API does the amortization, and
// payoffMonths gives a quick preview while typing.

import type { ProjectionMortgage } from './financialItemsApi'
import { formatCurrency } from './format'
import { parseHundredths } from './numberInput'

export type MortgageForm = {
  balance: string
  rate: string
  payment: string
}

export type MortgageField = keyof MortgageForm
export type MortgageErrors = Partial<Record<MortgageField, string>>

export const emptyMortgage: MortgageForm = { balance: '', rate: '', payment: '' }

const maximumRateBasisPoints = 10000

export function monthlyInterestCents(balanceCents: number, rateBasisPoints: number) {
  return Math.floor((balanceCents * rateBasisPoints + 60000) / 120000)
}

// Months until paid off with the same rounding as the API, or null if the
// payment never gets there (or it would take over 100 years).
export function payoffMonths(mortgage: ProjectionMortgage) {
  let balance = mortgage.balanceCents
  for (let month = 1; month <= 1200; month++) {
    const interest = monthlyInterestCents(balance, mortgage.annualRateBasisPoints)
    balance = balance + interest - Math.min(mortgage.monthlyPaymentCents, balance + interest)
    if (balance <= 0) return month
  }
  return null
}

export function validateMortgage(form: MortgageForm, currency: string): { mortgage: ProjectionMortgage | null; errors: MortgageErrors } {
  const errors: MortgageErrors = {}
  const balanceCents = parseHundredths(form.balance)
  const rate = parseHundredths(form.rate)
  const paymentCents = parseHundredths(form.payment)
  if (balanceCents === null || balanceCents === 0) errors.balance = 'Enter what’s left on the mortgage, like 250,000.'
  if (rate === null || rate > maximumRateBasisPoints) errors.rate = 'Enter the APR as a percentage, like 6.5.'
  if (paymentCents === null || paymentCents === 0) errors.payment = 'Enter the monthly payment, like 1,800.'
  if (!errors.balance && !errors.rate && !errors.payment) {
    const interest = monthlyInterestCents(balanceCents as number, rate as number)
    if ((paymentCents as number) <= interest) {
      errors.payment = `The payment needs to be more than the monthly interest (${formatCurrency(interest, currency)}).`
    }
  }
  if (Object.keys(errors).length > 0) return { mortgage: null, errors }
  return {
    mortgage: { balanceCents: balanceCents as number, annualRateBasisPoints: rate as number, monthlyPaymentCents: paymentCents as number },
    errors,
  }
}

export function mortgageFromSaved(saved: unknown): MortgageForm | null {
  if (!saved || typeof saved !== 'object') return null
  const form = saved as Record<string, unknown>
  return typeof form.balance === 'string' && typeof form.rate === 'string' && typeof form.payment === 'string'
    ? { balance: form.balance, rate: form.rate, payment: form.payment }
    : null
}
