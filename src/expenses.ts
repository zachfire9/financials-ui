// Itemized retirement expenses. Amounts are yearly, in today's dollars; an
// expense can have its own inflation rate and a range of retirement years
// (year 1 = the first year of retirement), such as health insurance before
// Medicare or long-term care later on. Their total replaces the single
// annual withdrawal.

import type { ProjectionExpense } from './financialItemsApi'
import { parseHundredths, parseWholeNumber } from './numberInput'

export type ExpenseForm = {
  id: string
  name: string
  amount: string
  inflationRate: string
  fromYear: string
  toYear: string
}

export type ExpenseField = 'name' | 'amount' | 'inflationRate' | 'fromYear' | 'toYear'
export type ExpenseErrors = Record<string, Partial<Record<ExpenseField, string>>>

export const maximumExpenses = 30
const maximumExpenseYears = 75
const maximumInflationBasisPoints = 10000

const presetNames = ['Housing', 'Food', 'Healthcare', 'Travel', 'Taxes', 'Other']

// The starting list when someone first itemizes. The current single amount
// goes into "Other" so the total doesn't change until they split it up.
export function presetExpenses(currentAmount: string): ExpenseForm[] {
  return presetNames.map((name, index) => ({
    id: `expense-${index + 1}`,
    name,
    amount: name === 'Other' ? currentAmount : '',
    inflationRate: '',
    fromYear: '',
    toYear: '',
  }))
}

export function emptyExpense(id: string): ExpenseForm {
  return { id, name: '', amount: '', inflationRate: '', fromYear: '', toYear: '' }
}

export function nextExpenseId(expenses: ExpenseForm[]) {
  const highest = expenses.reduce((max, expense) => {
    const number = Number(expense.id.replace('expense-', ''))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 0)
  return `expense-${highest + 1}`
}

// Total per year in today's dollars, counting only amounts that parse.
export function totalExpensesCents(expenses: ExpenseForm[]) {
  return expenses.reduce((sum, expense) => sum + (expense.amount.trim() === '' ? 0 : parseHundredths(expense.amount) ?? 0), 0)
}

// Total for one year of retirement (1 = the first), counting expenses whose
// range includes it. Ranges that don't parse yet count as open.
export function totalExpensesForYearCents(expenses: ExpenseForm[], year: number) {
  return totalExpensesCents(
    expenses.filter((expense) => {
      const from = parseWholeNumber(expense.fromYear, 1, maximumExpenseYears) ?? 1
      const to = parseWholeNumber(expense.toYear, 1, maximumExpenseYears)
      return year >= from && (to === null || year <= to)
    }),
  )
}

export function hasExpenseRanges(expenses: ExpenseForm[]) {
  return expenses.some((expense) => expense.fromYear.trim() !== '' || expense.toYear.trim() !== '')
}

export function validateExpenses(expenses: ExpenseForm[]): { expenses: ProjectionExpense[] | null; errors: ExpenseErrors } {
  const errors: ExpenseErrors = {}
  const parsed: ProjectionExpense[] = []
  for (const expense of expenses) {
    const rowErrors: Partial<Record<ExpenseField, string>> = {}
    const name = expense.name.trim()
    const amountCents = expense.amount.trim() === '' ? 0 : parseHundredths(expense.amount)
    const inflation = expense.inflationRate.trim() === '' ? undefined : parseHundredths(expense.inflationRate)
    const fromYear = expense.fromYear.trim() === '' ? 0 : parseWholeNumber(expense.fromYear, 1, maximumExpenseYears)
    const toYear = expense.toYear.trim() === '' ? 0 : parseWholeNumber(expense.toYear, 1, maximumExpenseYears)
    if (name === '') rowErrors.name = 'Enter a name.'
    if (amountCents === null) rowErrors.amount = 'Enter a dollar amount like 1,000 or 1000.50.'
    if (inflation === null || (inflation !== undefined && inflation > maximumInflationBasisPoints)) {
      rowErrors.inflationRate = 'Enter a percentage from 0 to 100, or leave it blank.'
    }
    if (fromYear === null) rowErrors.fromYear = 'Enter a year from 1 to 75, or leave it blank.'
    if (toYear === null) rowErrors.toYear = 'Enter a year from 1 to 75, or leave it blank.'
    if (fromYear && toYear && toYear < fromYear) rowErrors.toYear = 'The last year can’t be before the first.'
    if (Object.keys(rowErrors).length > 0) {
      errors[expense.id] = rowErrors
      continue
    }
    parsed.push({
      id: expense.id,
      name,
      annualAmountCents: amountCents as number,
      ...(inflation !== undefined && inflation !== null ? { inflationRateBasisPoints: inflation } : {}),
      ...(fromYear ? { fromYear } : {}),
      ...(toYear ? { toYear } : {}),
    })
  }
  return Object.keys(errors).length > 0 ? { expenses: null, errors } : { expenses: parsed, errors }
}

// Restores saved expenses, dropping anything malformed. Sessions saved
// before year ranges had "years" (the first N years), which becomes the
// last year of the range.
export function expensesFromSaved(saved: unknown): ExpenseForm[] | null {
  if (!Array.isArray(saved)) return null
  const text = (value: unknown) => (typeof value === 'string' ? value : null)
  const expenses = saved.flatMap((entry): ExpenseForm[] => {
    if (!entry || typeof entry !== 'object') return []
    const expense = entry as Record<string, unknown>
    const [id, name, amount, inflationRate] = [expense.id, expense.name, expense.amount, expense.inflationRate].map(text)
    if (id === null || name === null || amount === null || inflationRate === null) return []
    return [{ id, name, amount, inflationRate, fromYear: text(expense.fromYear) ?? '', toYear: text(expense.toYear) ?? text(expense.years) ?? '' }]
  })
  return expenses.length > 0 ? expenses.slice(0, maximumExpenses) : null
}
