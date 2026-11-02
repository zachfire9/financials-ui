// Keeps an ephemeral (browser-owned) session in localStorage so a refresh or
// accidental tab close doesn't lose the user's items. Every storage call is
// wrapped: if storage is blocked (some private-browsing modes) or the saved
// data is corrupt, the app behaves as if nothing was saved.

import type { FinancialItem } from './financialItemsApi'
import { importedItemProblems } from './itemValidation'

export const savedSessionKey = 'financials.session.v1'

export type SavedProjectionForm = {
  savingYears: string
  drawdownYears: string
  annualWithdrawal: string
  withdrawalInflationRate: string
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
        ? form
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
