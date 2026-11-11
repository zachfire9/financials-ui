// Itemized retirement expenses. Amounts are yearly, in today's dollars; an
// expense can have its own inflation rate and can be limited to the first N
// years of retirement. Their total replaces the single annual withdrawal.

import type { ProjectionExpense } from './financialItemsApi'
import { parseHundredths, parseWholeNumber } from './numberInput'

export type ExpenseForm = {
  id: string
  name: string
  amount: string
  inflationRate: string
  years: string
}

export type ExpenseField = 'name' | 'amount' | 'inflationRate' | 'years'
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
    years: '',
  }))
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

export function validateExpenses(expenses: ExpenseForm[]): { expenses: ProjectionExpense[] | null; errors: ExpenseErrors } {
  const errors: ExpenseErrors = {}
  const parsed: ProjectionExpense[] = []
  for (const expense of expenses) {
    const rowErrors: Partial<Record<ExpenseField, string>> = {}
    const name = expense.name.trim()
    const amountCents = expense.amount.trim() === '' ? 0 : parseHundredths(expense.amount)
    const inflation = expense.inflationRate.trim() === '' ? undefined : parseHundredths(expense.inflationRate)
    const years = expense.years.trim() === '' ? 0 : parseWholeNumber(expense.years, 1, maximumExpenseYears)
    if (name === '') rowErrors.name = 'Enter a name.'
    if (amountCents === null) rowErrors.amount = 'Enter a dollar amount like 1,000 or 1000.50.'
    if (inflation === null || (inflation !== undefined && inflation > maximumInflationBasisPoints)) {
      rowErrors.inflationRate = 'Enter a percentage from 0 to 100, or leave it blank.'
    }
    if (years === null) rowErrors.years = 'Enter 1 to 75 years, or leave it blank for all years.'
    if (Object.keys(rowErrors).length > 0) {
      errors[expense.id] = rowErrors
      continue
    }
    parsed.push({
      id: expense.id,
      name,
      annualAmountCents: amountCents as number,
      ...(inflation !== undefined && inflation !== null ? { inflationRateBasisPoints: inflation } : {}),
      ...(years ? { years: years as number } : {}),
    })
  }
  return Object.keys(errors).length > 0 ? { expenses: null, errors } : { expenses: parsed, errors }
}

// Restores saved expenses, dropping anything malformed.
export function expensesFromSaved(saved: unknown): ExpenseForm[] | null {
  if (!Array.isArray(saved)) return null
  const expenses = saved.filter(
    (expense): expense is ExpenseForm =>
      Boolean(expense) &&
      typeof expense === 'object' &&
      ['id', 'name', 'amount', 'inflationRate', 'years'].every((key) => typeof (expense as Record<string, unknown>)[key] === 'string'),
  )
  return expenses.length > 0 ? expenses.slice(0, maximumExpenses) : null
}
