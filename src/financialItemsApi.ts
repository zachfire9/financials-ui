export type FinancialItem = {
  id: string
  name: string
  amountCents: number
  currency: string
  annualReturnRateBasisPoints: number
  drawdownAnnualReturnRateBasisPoints?: number
  annualContributionCents: number
  inflateAnnualContribution: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type FinancialItemPayload = {
  name: string
  amountCents: number
  currency: string
  annualReturnRateBasisPoints: number
  drawdownAnnualReturnRateBasisPoints?: number
  annualContributionCents: number
  inflateAnnualContribution: boolean
  sortOrder: number
}

export type ProjectionRequest = {
  years?: number
  savingYears?: number
  drawdownYears?: number
  annualWithdrawalCents?: number
  annualWithdrawalInflationRateBasisPoints?: number
  items?: FinancialItemPayload[]
}

export type ProjectionPhase = 'starting' | 'saving' | 'drawdown'

export type YearlyBalance = {
  year: number
  phase?: ProjectionPhase
  balanceCents: number
  contributionCents: number
  withdrawalCents?: number
  growthCents: number
  unfundedWithdrawalCents?: number
}

export type ProjectedItem = {
  id: string
  name: string
  startingAmountCents: number
  annualReturnRateBasisPoints: number
  drawdownAnnualReturnRateBasisPoints?: number
  annualContributionCents: number
  inflateAnnualContribution: boolean
  yearlyBalances: YearlyBalance[]
}

export type Projection = {
  years: number
  savingYears?: number
  drawdownYears?: number
  currency: string
  items: ProjectedItem[]
  totals: YearlyBalance[]
}

export type FinancialItemsBackup = {
  schemaVersion: number
  exportedAt: string
  items: FinancialItem[]
}

type ApiErrorBody = {
  error?: string
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_FINANCIALS_API_BASE_URL)

export async function listFinancialItems(): Promise<FinancialItem[]> {
  return request<FinancialItem[]>('/financial-items')
}

export async function createFinancialItem(payload: FinancialItemPayload): Promise<FinancialItem> {
  return request<FinancialItem>('/financial-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateFinancialItem(id: string, payload: FinancialItemPayload): Promise<FinancialItem> {
  return request<FinancialItem>(`/financial-items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteFinancialItem(id: string): Promise<void> {
  await request<void>(`/financial-items/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function exportFinancialItemsBackup(): Promise<FinancialItemsBackup> {
  return request<FinancialItemsBackup>('/financial-items/backup')
}

export async function importFinancialItemsBackup(payload: FinancialItemsBackup): Promise<FinancialItem[]> {
  return request<FinancialItem[]>('/financial-items/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function calculateProjection(payload: ProjectionRequest): Promise<Projection> {
  return request<Projection>('/projections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init)

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody
    if (body.error) {
      return body.error
    }
  } catch {
    // Fall back to the generic status message below when the body is not JSON.
  }

  return `Request failed with status ${response.status}`
}

function normalizeApiBaseUrl(value: string | undefined) {
  const base = value?.trim() || '/api'
  return base.endsWith('/') ? base.slice(0, -1) : base
}
