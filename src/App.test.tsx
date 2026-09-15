import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from './App'

const exampleItem = {
  id: 'item_000001',
  name: 'Example brokerage',
  amountCents: 1250000,
  currency: 'USD',
  annualReturnRateBasisPoints: 700,
  annualContributionCents: 300000,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('Financial items app', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads and renders financial items from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([exampleItem]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByRole('heading', { name: /financials planner/i })).toBeInTheDocument()
    expect(await screen.findByText('Example brokerage')).toBeInTheDocument()
    const itemCard = screen.getByRole('listitem')
    expect(within(itemCard).getByText(/\$12,500\.00/)).toBeInTheDocument()
    expect(within(itemCard).getByText(/7\.00%/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/financial-items', undefined)
  })

  it('creates a financial item with the form payload expected by the API', async () => {
    const createdItem = { ...exampleItem, id: 'item_000002', name: 'Example savings' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdItem, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Example savings' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '2500' } })
    fireEvent.change(screen.getByLabelText(/annual return/i), { target: { value: '5.5' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText(/sort order/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))

    await screen.findByText('Example savings')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/financial-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Example savings',
        amountCents: 250000,
        currency: 'USD',
        annualReturnRateBasisPoints: 550,
        annualContributionCents: 120000,
        sortOrder: 2,
      }),
    })
  })

  it('updates and deletes existing financial items', async () => {
    const updatedItem = { ...exampleItem, name: 'Example down payment', amountCents: 1500000 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse(updatedItem))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /edit example brokerage/i }))
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Example down payment' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /save item/i }))

    await screen.findByText('Example down payment')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/financial-items/item_000001', expect.objectContaining({ method: 'PUT' }))

    fireEvent.click(screen.getByRole('button', { name: /delete example down payment/i }))

    await waitFor(() => expect(screen.queryByText('Example down payment')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/financial-items/item_000001', { method: 'DELETE' })
    expect(screen.getByText(/no financial items yet/i)).toBeInTheDocument()
  })

  it('keeps the last successful list visible when a refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary outage' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText('Example brokerage')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    expect(await screen.findByText(/data is updating/i)).toBeInTheDocument()
    expect(screen.getByText('Example brokerage')).toBeInTheDocument()
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
