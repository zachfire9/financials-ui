// Keeps an ephemeral (browser-owned) session in localStorage so a refresh or
// accidental tab close doesn't lose the user's items. Every storage call is
// wrapped: if storage is blocked (some private-browsing modes) or the saved
// data is corrupt, the app behaves as if nothing was saved.

import type { FinancialItem } from './financialItemsApi'
import type { ExpenseForm } from './expenses'
import type { PersonForm } from './household'
import type { MortgageForm } from './mortgage'
import { importedItemProblems } from './itemValidation'

export const savedSessionKey = 'financials.session.v1'

export type SavedProjectionForm = {
  savingYears: string
  drawdownYears: string
  annualWithdrawal: string
  withdrawalInflationRate: string
  // Added with the household plan; sessions saved before it don't have them.
  householdPlan?: boolean
  people?: PersonForm[]
  gapWithdrawal?: string
  // Added with itemized expenses and the mortgage.
  itemizeExpenses?: boolean
  expenses?: ExpenseForm[]
  mortgageEnabled?: boolean
  mortgage?: MortgageForm
}

export type SavedSession = {
  version: 1
  items: FinancialItem[]
  projectionForm: SavedProjectionForm
  lastSessionItemNumber: number
}

export function loadSavedSession(): SavedSession | null {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(savedSessionKey)
  } catch {
    return null
  }
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SavedSession>
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) {
      return null
    }
    if (parsed.items.some((item, index) => importedItemProblems(item, index).length > 0)) {
      return null
    }
    const form = parsed.projectionForm
    const projectionForm: SavedProjectionForm | null =
      form &&
      typeof form.savingYears === 'string' &&
      typeof form.drawdownYears === 'string' &&
      typeof form.annualWithdrawal === 'string' &&
      typeof form.withdrawalInflationRate === 'string'
        ? {
            savingYears: form.savingYears,
            drawdownYears: form.drawdownYears,
            annualWithdrawal: form.annualWithdrawal,
            withdrawalInflationRate: form.withdrawalInflationRate,
            householdPlan: typeof form.householdPlan === 'boolean' ? form.householdPlan : undefined,
            people: Array.isArray(form.people) ? form.people : undefined,
            gapWithdrawal: typeof form.gapWithdrawal === 'string' ? form.gapWithdrawal : undefined,
            itemizeExpenses: typeof form.itemizeExpenses === 'boolean' ? form.itemizeExpenses : undefined,
            expenses: Array.isArray(form.expenses) ? form.expenses : undefined,
            mortgageEnabled: typeof form.mortgageEnabled === 'boolean' ? form.mortgageEnabled : undefined,
            mortgage: form.mortgage && typeof form.mortgage === 'object' ? form.mortgage : undefined,
          }
        : null
    if (!projectionForm) {
      return null
    }

    const items = parsed.items.filter(
      (item): item is FinancialItem => typeof item.id === 'string' && item.id.trim() !== '',
    )
    if (items.length !== parsed.items.length || new Set(items.map((item) => item.id)).size !== items.length) {
      return null
    }

    return {
      version: 1,
      items,
      projectionForm,
      lastSessionItemNumber: Number.isSafeInteger(parsed.lastSessionItemNumber) ? (parsed.lastSessionItemNumber as number) : 0,
    }
  } catch {
    return null
  }
}

export function saveSession(session: SavedSession) {
  try {
    window.localStorage.setItem(savedSessionKey, JSON.stringify(session))
  } catch {
    // Storage blocked or full: keep working without persistence.
  }
}

export function clearSavedSession() {
  try {
    window.localStorage.removeItem(savedSessionKey)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
