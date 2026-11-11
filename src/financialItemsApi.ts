export type FinancialItem = {
  id: string
  name: string
  amountCents: number
  currency: string
  annualReturnRateBasisPoints: number
  drawdownAnnualReturnRateBasisPoints?: number
  annualContributionCents: number
  inflateAnnualContribution: boolean
  ownerId?: string
  withdrawalPriority?: number
  withdrawalAvailableAfterYear?: number
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
  ownerId?: string
  // 1 = first, 2 (or omitted) = normal, 3 = last.
  withdrawalPriority?: number
  // Last year the account can't be withdrawn from. Omitted: when its owner
  // retires (household plan) or anytime.
  withdrawalAvailableAfterYear?: number
  sortOrder: number
}

export type ProjectionRequest = {
  years?: number
  savingYears?: number
  drawdownYears?: number
  annualWithdrawalCents?: number
  annualWithdrawalInflationRateBasisPoints?: number
  people?: ProjectionPerson[]
  gapAnnualWithdrawalCents?: number
  expenses?: ProjectionExpense[]
  mortgage?: ProjectionMortgage
  items?: Array<FinancialItemPayload & { id?: string }>
}

export type ProjectionPhase = 'starting' | 'saving' | 'transition' | 'drawdown'

export type YearlyBalance = {
  year: number
  phase?: ProjectionPhase
  balanceCents: number
  contributionCents: number
  withdrawalCents?: number
  growthCents: number
  unfundedWithdrawalCents?: number
  // Balance in accounts that couldn't be withdrawn from that year.
  lockedBalanceCents?: number
}

export type ProjectedItem = {
  id: string
  name: string
  startingAmountCents: number
  annualReturnRateBasisPoints: number
  drawdownAnnualReturnRateBasisPoints?: number
  annualContributionCents: number
  inflateAnnualContribution: boolean
  ownerId?: string
  yearlyBalances: YearlyBalance[]
}

// One category of retirement spending, per year in today's dollars.
export type ProjectionExpense = {
  id?: string
  name: string
  annualAmountCents: number
  inflationRateBasisPoints?: number
  // A range of drawdown years (1 = first year of retirement), inclusive;
  // omitted ends are open.
  fromYear?: number
  toYear?: number
}

export type ProjectionMortgage = {
  balanceCents: number
  annualRateBasisPoints: number
  monthlyPaymentCents: number
}

export type MortgageYear = {
  year: number
  balanceCents: number
  paymentCents: number
  interestCents: number
  paidFromSavings: boolean
}

export type YearlySpending = {
  year: number
  expensesCents: number
  mortgagePaymentCents: number
}

// A household member with their own retirement year (years from today).
export type ProjectionPerson = {
  id: string
  name: string
  savingYears: number
}

export type Projection = {
  years: number
  savingYears?: number
  transitionYears?: number
  drawdownYears?: number
  mortgage?: { payoffYear: number; years: MortgageYear[] }
  spending?: YearlySpending[]
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
const apiAccessToken = normalizeAccessToken(import.meta.env.VITE_FINANCIALS_ACCESS_TOKEN)

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
  const headers = buildRequestHeaders(init?.headers, apiAccessToken)
  const requestInit = headers ? { ...init, headers } : init
  const response = await fetch(`${apiBaseUrl}${path}`, requestInit)

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

export function normalizeApiBaseUrl(value: string | undefined) {
  const base = value?.trim() || '/api'
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export function normalizeAccessToken(value: string | undefined) {
  const token = value?.trim()
  return token === '' ? undefined : token
}

export function buildRequestHeaders(headers: HeadersInit | undefined, accessToken: string | undefined) {
  if (!headers && !accessToken) {
    return undefined
  }

  let requestHeaders: Record<string, string>
  if (headers instanceof Headers) {
    requestHeaders = Object.fromEntries(headers.entries())
  } else if (Array.isArray(headers)) {
    requestHeaders = Object.fromEntries(headers)
  } else {
    requestHeaders = { ...(headers ?? {}) }
  }

  if (accessToken) {
    requestHeaders['X-Financials-Access-Token'] = accessToken
  }
  return requestHeaders
}
