export type FinancialItem = {
  id: string
  name: string
  amountCents: number
  currency: string
  annualReturnRateBasisPoints: number
  annualContributionCents: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type FinancialItemPayload = {
  name: string
  amountCents: number
  currency: string
  annualReturnRateBasisPoints: number
  annualContributionCents: number
  sortOrder: number
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
