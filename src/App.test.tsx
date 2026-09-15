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

const secondItem = {
  id: 'item_000002',
  name: 'Example savings',
  amountCents: 1000000,
  currency: 'USD',
  annualReturnRateBasisPoints: 450,
  annualContributionCents: 120000,
  sortOrder: 2,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
}

const exampleProjection = {
  years: 2,
  currency: 'USD',
  items: [
    {
      id: 'item_000001',
      name: 'Example brokerage',
      startingAmountCents: 125000,
      annualReturnRateBasisPoints: 700,
      annualContributionCents: 30000,
      yearlyBalances: [
        { year: 0, balanceCents: 125000, contributionCents: 0, growthCents: 0 },
        { year: 1, balanceCents: 163750, contributionCents: 30000, growthCents: 8750 },
        { year: 2, balanceCents: 205213, contributionCents: 30000, growthCents: 11463 },
      ],
    },
    {
      id: 'item_000002',
      name: 'Example savings',
      startingAmountCents: 100000,
      annualReturnRateBasisPoints: 450,
      annualContributionCents: 12000,
      yearlyBalances: [
        { year: 0, balanceCents: 100000, contributionCents: 0, growthCents: 0 },
        { year: 1, balanceCents: 116500, contributionCents: 12000, growthCents: 4500 },
        { year: 2, balanceCents: 133743, contributionCents: 12000, growthCents: 5243 },
      ],
    },
  ],
  totals: [
    { year: 0, balanceCents: 225000, contributionCents: 0, growthCents: 0 },
    { year: 1, balanceCents: 280250, contributionCents: 42000, growthCents: 13250 },
    { year: 2, balanceCents: 338956, contributionCents: 42000, growthCents: 16706 },
  ],
}

describe('Financial items app', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads financial items without the intro hero container', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([exampleItem]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.queryByText(/manage fake\/example financial planning inputs/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/step 8: financial items crud/i)).not.toBeInTheDocument()
    expect(await screen.findByText('Example brokerage')).toBeInTheDocument()
    const itemCard = screen.getByRole('listitem')
    expect(within(itemCard).getByText(/\$12,500\.00/)).toBeInTheDocument()
    expect(within(itemCard).getByText(/7\.00%/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/financial-items', undefined)
  })

  it('shows human dollar inputs and percent labeling when editing API-backed cents values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([secondItem]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /edit example savings/i }))

    expect(screen.getByLabelText(/current amount/i)).toHaveValue('10000.00')
    expect(screen.getByLabelText(/annual return \(%\)/i)).toHaveValue('4.50')
    expect(screen.queryByLabelText(/sort order/i)).not.toBeInTheDocument()
  })

  it('creates a financial item with the form payload expected by the API', async () => {
    const createdItem = { ...exampleItem, id: 'item_000003', name: 'Example emergency fund', sortOrder: 0 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdItem, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Example emergency fund' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '2500.00' } })
    fireEvent.change(screen.getByLabelText(/annual return \(%\)/i), { target: { value: '5.5' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '1200.00' } })
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))

    await screen.findByText('Example emergency fund')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/financial-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Example emergency fund',
        amountCents: 250000,
        currency: 'USD',
        annualReturnRateBasisPoints: 550,
        annualContributionCents: 120000,
        sortOrder: 0,
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
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '15000.00' } })
    fireEvent.click(screen.getByRole('button', { name: /save item/i }))

    await screen.findByText('Example down payment')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/financial-items/item_000001', expect.objectContaining({ method: 'PUT' }))

    fireEvent.click(screen.getByRole('button', { name: /delete example down payment/i }))

    await waitFor(() => expect(screen.queryByText('Example down payment')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/financial-items/item_000001', { method: 'DELETE' })
    expect(screen.getByText(/no financial items yet/i)).toBeInTheDocument()
  })

  it('reorders existing items by dragging and dropping item cards', async () => {
    const reorderedFirst = { ...secondItem, sortOrder: 0 }
    const reorderedSecond = { ...exampleItem, sortOrder: 1 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem, secondItem]))
      .mockResolvedValueOnce(jsonResponse(reorderedFirst))
      .mockResolvedValueOnce(jsonResponse(reorderedSecond))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const brokerage = await screen.findByText('Example brokerage')
    const savings = screen.getByText('Example savings')
    fireEvent.dragStart(savings.closest('li')!)
    fireEvent.dragOver(brokerage.closest('li')!)
    fireEvent.drop(brokerage.closest('li')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/financial-items/item_000002',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"sortOrder":0'),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/financial-items/item_000001',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"sortOrder":1'),
      }),
    )
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

  it('calculates a repository-backed projection grouped by year with item and combined balances', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/projection years/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('Projection by year and item')).toBeInTheDocument()
    expect(screen.queryByText('Projection totals')).not.toBeInTheDocument()
    expect(screen.queryByText(/example brokerage ends at/i)).not.toBeInTheDocument()

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Year',
      'Item',
      'Contribution',
      'Growth',
      'Item balance',
      'Combined balance',
    ])

    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows.map((row) => row.textContent)).toEqual([
      'Year 0Example brokerage$0.00$0.00$1,250.00$2,250.00',
      'Year 0Example savings$0.00$0.00$1,000.00$2,250.00',
      'Year 1Example brokerage$300.00$87.50$1,637.50$2,802.50',
      'Year 1Example savings$120.00$45.00$1,165.00$2,802.50',
      'Year 2Example brokerage$300.00$114.63$2,052.13$3,389.56',
      'Year 2Example savings$120.00$52.43$1,337.43$3,389.56',
    ])

    const brokerageYearTwoRow = screen.getByRole('row', {
      name: 'Year 2 Example brokerage $300.00 $114.63 $2,052.13 $3,389.56',
    })
    expect(within(brokerageYearTwoRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Year 2',
      'Example brokerage',
      '$300.00',
      '$114.63',
      '$2,052.13',
      '$3,389.56',
    ])

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ years: 2 }),
    })
  })

  it('keeps the last successful projection visible when recalculation fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse(exampleProjection))
      .mockResolvedValueOnce(jsonResponse({ error: 'projection service unavailable' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /calculate projection/i }))
    expect(await screen.findByText('Projection by year and item')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText(/projection is updating/i)).toBeInTheDocument()
    expect(screen.getAllByText('$3,389.56').length).toBeGreaterThan(0)
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
