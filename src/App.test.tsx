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
  drawdownAnnualReturnRateBasisPoints: 400,
  annualContributionCents: 300000,
  inflateAnnualContribution: true,
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
  inflateAnnualContribution: false,
  sortOrder: 2,
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
}

const exampleProjection = {
  years: 2,
  savingYears: 2,
  drawdownYears: 0,
  currency: 'USD',
  items: [
    {
      id: 'item_000001',
      name: 'Example brokerage',
      startingAmountCents: 125000,
      annualReturnRateBasisPoints: 700,
      annualContributionCents: 30000,
      yearlyBalances: [
        { year: 0, phase: 'starting', balanceCents: 125000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 1, phase: 'saving', balanceCents: 163750, contributionCents: 30000, withdrawalCents: 0, growthCents: 8750, unfundedWithdrawalCents: 0 },
        { year: 2, phase: 'saving', balanceCents: 205213, contributionCents: 30000, withdrawalCents: 0, growthCents: 11463, unfundedWithdrawalCents: 0 },
      ],
    },
    {
      id: 'item_000002',
      name: 'Example savings',
      startingAmountCents: 100000,
      annualReturnRateBasisPoints: 450,
      annualContributionCents: 12000,
      yearlyBalances: [
        { year: 0, phase: 'starting', balanceCents: 100000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 1, phase: 'saving', balanceCents: 116500, contributionCents: 12000, withdrawalCents: 0, growthCents: 4500, unfundedWithdrawalCents: 0 },
        { year: 2, phase: 'saving', balanceCents: 133743, contributionCents: 12000, withdrawalCents: 0, growthCents: 5243, unfundedWithdrawalCents: 0 },
      ],
    },
  ],
  totals: [
    { year: 0, phase: 'starting', balanceCents: 225000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
    { year: 1, phase: 'saving', balanceCents: 280250, contributionCents: 42000, withdrawalCents: 0, growthCents: 13250, unfundedWithdrawalCents: 0 },
    { year: 2, phase: 'saving', balanceCents: 338956, contributionCents: 42000, withdrawalCents: 0, growthCents: 16706, unfundedWithdrawalCents: 0 },
  ],
}

const drawdownProjection = {
  years: 3,
  savingYears: 1,
  drawdownYears: 2,
  currency: 'USD',
  items: [
    {
      id: 'item_000001',
      name: 'Example brokerage',
      startingAmountCents: 20000000,
      annualReturnRateBasisPoints: 0,
      drawdownAnnualReturnRateBasisPoints: 0,
      annualContributionCents: 100000,
      yearlyBalances: [
        { year: 0, phase: 'starting', balanceCents: 20000000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 1, phase: 'saving', balanceCents: 20100000, contributionCents: 100000, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 2, phase: 'drawdown', balanceCents: 13920000, contributionCents: 0, withdrawalCents: 6180000, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 3, phase: 'drawdown', balanceCents: 7554600, contributionCents: 0, withdrawalCents: 6365400, growthCents: 0, unfundedWithdrawalCents: 0 },
      ],
    },
  ],
  totals: [
    { year: 0, phase: 'starting', balanceCents: 20000000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
    { year: 1, phase: 'saving', balanceCents: 20100000, contributionCents: 100000, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
    { year: 2, phase: 'drawdown', balanceCents: 13920000, contributionCents: 0, withdrawalCents: 6180000, growthCents: 0, unfundedWithdrawalCents: 0 },
    { year: 3, phase: 'drawdown', balanceCents: 7554600, contributionCents: 0, withdrawalCents: 6365400, growthCents: 0, unfundedWithdrawalCents: 0 },
  ],
}

describe('Financial items app', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('runs ephemeral sessions from imported browser-owned data without loading or saving repository items', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByText(/ephemeral session mode/i)).toBeInTheDocument()
    expect(screen.getByText(/refreshing or closing the browser loses unsaved changes/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()

    const input = screen.getByLabelText(/import json backup/i)
    const file = new File([
      JSON.stringify({ schemaVersion: 1, exportedAt: '2026-01-03T00:00:00Z', items: [exampleItem] }),
    ], 'financials-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/backup imported into this browser session/i)).toBeInTheDocument()
    expect(screen.getByText('Example brokerage')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /edit example brokerage/i }))
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Example browser-only account' } })
    fireEvent.click(screen.getByRole('button', { name: /save item/i }))

    expect(await screen.findByText('Example browser-only account')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(requestBodyAt(fetchMock, 0)).toMatchObject({
      savingYears: 10,
      drawdownYears: 0,
      annualWithdrawalCents: 0,
      annualWithdrawalInflationRateBasisPoints: 300,
      items: [
        expect.objectContaining({
          name: 'Example browser-only account',
          amountCents: 1250000,
          inflateAnnualContribution: true,
        }),
      ],
    })
  })

  it('exports ephemeral browser-owned data without calling the backup API', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const createObjectURL = vi.fn().mockReturnValue('blob:financial-backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const input = screen.getByLabelText(/import json backup/i)
    const file = new File([
      JSON.stringify({ schemaVersion: 1, exportedAt: '2026-01-03T00:00:00Z', items: [secondItem] }),
    ], 'financials-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('Example savings')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /export json backup/i }))

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await screen.findByText(/session JSON exported/i)).toBeInTheDocument()
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
    expect(within(itemCard).getByText(/7\.00% return/)).toBeInTheDocument()
    expect(within(itemCard).getByText(/4\.00% drawdown return/)).toBeInTheDocument()
    expect(within(itemCard).getByText(/contribution grows with inflation/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/financial-items', undefined)
  })

  it('shows human dollar inputs and percent labeling when editing API-backed cents values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([secondItem]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /edit example savings/i }))

    expect(screen.getByLabelText(/current amount/i)).toHaveValue('10000.00')
    expect(screen.getByLabelText(/^annual return \(%\)$/i)).toHaveValue('4.50')
    expect(screen.getByLabelText(/drawdown return \(%\)/i)).toHaveValue('')
    expect(screen.getByLabelText(/grow this item.+contribution/i)).not.toBeChecked()
    expect(screen.getByText(/uses annual return when blank/i)).toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText(/^annual return \(%\)$/i), { target: { value: '5.5' } })
    fireEvent.change(screen.getByLabelText(/drawdown return \(%\)/i), { target: { value: '3.25' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '1200.00' } })
    fireEvent.click(screen.getByLabelText(/grow this item.+contribution/i))
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))

    await screen.findByText('Example emergency fund')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/financial-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    })
    expect(requestBodyAt(fetchMock, 1)).toEqual({
      name: 'Example emergency fund',
      amountCents: 250000,
      currency: 'USD',
      annualReturnRateBasisPoints: 550,
      drawdownAnnualReturnRateBasisPoints: 325,
      annualContributionCents: 120000,
      inflateAnnualContribution: true,
      sortOrder: 0,
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
    expect(requestBodyAt(fetchMock, 2)).toEqual({
      name: 'Example brokerage',
      amountCents: 1250000,
      currency: 'USD',
      annualReturnRateBasisPoints: 700,
      drawdownAnnualReturnRateBasisPoints: 400,
      annualContributionCents: 300000,
      inflateAnnualContribution: true,
      sortOrder: 1,
    })
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

  it('calculates a repository-backed drawdown projection with phase and withdrawal controls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse(drawdownProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/saving years/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/annual withdrawal/i), { target: { value: '60000.00' } })
    fireEvent.change(screen.getByLabelText(/withdrawal inflation \(%\)/i), { target: { value: '3.00' } })
    expect(screen.queryByLabelText(/grow contributions by withdrawal inflation/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('Projection by year and item')).toBeInTheDocument()
    expect(screen.queryByText('Projection totals')).not.toBeInTheDocument()
    expect(screen.queryByText(/example brokerage ends at/i)).not.toBeInTheDocument()

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Year',
      'Phase',
      'Annual withdrawal',
      'Item',
      'Contribution',
      'Withdrawal',
      'Growth',
      'Item balance',
      'Combined balance',
    ])

    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows.map((row) => row.textContent)).toEqual([
      'Year 0Starting$0.00Example brokerage$0.00$0.00$0.00$200,000.00$200,000.00',
      'Year 1Saving$0.00Example brokerage$1,000.00$0.00$0.00$201,000.00$201,000.00',
      'Year 2Drawdown$61,800.00Example brokerage$0.00$61,800.00$0.00$139,200.00$139,200.00',
      'Year 3Drawdown$63,654.00Example brokerage$0.00$63,654.00$0.00$75,546.00$75,546.00',
    ])

    const brokerageYearThreeRow = screen.getByRole('row', {
      name: 'Year 3 Drawdown $63,654.00 Example brokerage $0.00 $63,654.00 $0.00 $75,546.00 $75,546.00',
    })
    expect(within(brokerageYearThreeRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Year 3',
      'Drawdown',
      '$63,654.00',
      'Example brokerage',
      '$0.00',
      '$63,654.00',
      '$0.00',
      '$75,546.00',
      '$75,546.00',
    ])

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/projections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        savingYears: 1,
        drawdownYears: 2,
        annualWithdrawalCents: 6000000,
        annualWithdrawalInflationRateBasisPoints: 300,
      }),
    })
  })

  it('exports and imports JSON backups for financial items', async () => {
    const backup = {
      schemaVersion: 1,
      exportedAt: '2026-01-03T00:00:00Z',
      items: [exampleItem],
    }
    const createObjectURL = vi.fn().mockReturnValue('blob:financial-backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse(backup))
      .mockResolvedValueOnce(jsonResponse([secondItem]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText('Example brokerage')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /export json backup/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/financial-items/backup', undefined))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(await screen.findByText(/backup exported/i)).toBeInTheDocument()

    const input = screen.getByLabelText(/import json backup/i)
    const file = new File([JSON.stringify(backup)], 'financials-backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/backup imported/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/financial-items/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backup),
    })
    expect(screen.getByText('Example savings')).toBeInTheDocument()
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

function requestBodyAt(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  return JSON.parse((fetchMock.mock.calls[callIndex][1] as RequestInit).body as string)
}
