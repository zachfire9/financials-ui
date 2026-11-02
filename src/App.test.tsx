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

const shortfallProjection = {
  years: 3,
  savingYears: 0,
  drawdownYears: 3,
  currency: 'USD',
  items: [
    {
      id: 'item_000001',
      name: 'Example brokerage',
      startingAmountCents: 8000,
      annualReturnRateBasisPoints: 0,
      annualContributionCents: 0,
      yearlyBalances: [
        { year: 0, phase: 'starting', balanceCents: 8000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 1, phase: 'drawdown', balanceCents: 1333, contributionCents: 0, withdrawalCents: 6667, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 2, phase: 'drawdown', balanceCents: 0, contributionCents: 0, withdrawalCents: 1333, growthCents: 0, unfundedWithdrawalCents: 5334 },
        { year: 3, phase: 'drawdown', balanceCents: 0, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 5000 },
      ],
    },
    {
      id: 'item_000002',
      name: 'Example savings',
      startingAmountCents: 4000,
      annualReturnRateBasisPoints: 0,
      annualContributionCents: 0,
      yearlyBalances: [
        { year: 0, phase: 'starting', balanceCents: 4000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 1, phase: 'drawdown', balanceCents: 667, contributionCents: 0, withdrawalCents: 3333, growthCents: 0, unfundedWithdrawalCents: 0 },
        { year: 2, phase: 'drawdown', balanceCents: 0, contributionCents: 0, withdrawalCents: 667, growthCents: 0, unfundedWithdrawalCents: 2666 },
        { year: 3, phase: 'drawdown', balanceCents: 0, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 5000 },
      ],
    },
  ],
  totals: [
    { year: 0, phase: 'starting', balanceCents: 12000, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 0 },
    { year: 1, phase: 'drawdown', balanceCents: 2000, contributionCents: 0, withdrawalCents: 10000, growthCents: 0, unfundedWithdrawalCents: 0 },
    { year: 2, phase: 'drawdown', balanceCents: 0, contributionCents: 0, withdrawalCents: 2000, growthCents: 0, unfundedWithdrawalCents: 8000 },
    { year: 3, phase: 'drawdown', balanceCents: 0, contributionCents: 0, withdrawalCents: 0, growthCents: 0, unfundedWithdrawalCents: 10000 },
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

  it('keeps ephemeral item IDs unique after deleting and adding items', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())
    const exportItems = stubBackupDownload()

    render(<App />)

    addSessionItem('Account A')
    addSessionItem('Account B')
    addSessionItem('Account C')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Account A' }))
    addSessionItem('Account D')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Account D' }))
    expect(screen.getByLabelText(/name/i)).toHaveValue('Account D')
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Account D renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save item/i }))

    await screen.findByText('Account D renamed')
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Account B',
      'Account C',
      'Account D renamed',
    ])

    const exported = await exportItems()
    expect(exported.map((item) => item.id)).toEqual(['session-item-2', 'session-item-3', 'session-item-4'])
  })

  it('does not reuse the newest ephemeral item ID after it is deleted', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())
    const exportItems = stubBackupDownload()

    render(<App />)

    addSessionItem('Account A')
    addSessionItem('Account B')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Account B' }))
    addSessionItem('Account C')

    await screen.findByText('Account C')
    const exported = await exportItems()
    expect(exported.map((item) => item.id)).toEqual(['session-item-1', 'session-item-3'])
  })

  it('assigns fresh IDs to imported ephemeral items with missing or duplicate IDs', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())
    const exportItems = stubBackupDownload()

    render(<App />)

    const backup = {
      schemaVersion: 1,
      exportedAt: '2026-01-03T00:00:00Z',
      items: [
        { ...exampleItem, id: 'session-item-2', name: 'Imported first', sortOrder: 0 },
        { ...exampleItem, id: '', name: 'Imported missing ID', sortOrder: 1 },
        { ...exampleItem, id: 'session-item-2', name: 'Imported duplicate ID', sortOrder: 2 },
        { ...exampleItem, id: 'item_000009', name: 'Imported API item', sortOrder: 3 },
      ],
    }
    const file = new File([JSON.stringify(backup)], 'financials-backup.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText(/import json backup/i), { target: { files: [file] } })
    expect(await screen.findByText(/backup imported into this browser session/i)).toBeInTheDocument()

    addSessionItem('Added after import')
    await screen.findByText('Added after import')

    const exported = await exportItems()
    expect(exported.map((item) => [item.name, item.id])).toEqual([
      ['Imported first', 'session-item-2'],
      ['Imported missing ID', 'session-item-3'],
      ['Imported duplicate ID', 'session-item-4'],
      ['Imported API item', 'item_000009'],
      ['Added after import', 'session-item-5'],
    ])
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

  it('accepts formatted dollar and percent input when creating an item', async () => {
    const createdItem = { ...exampleItem, id: 'item_000003', name: 'Example formatted input', sortOrder: 0 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdItem, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Example formatted input' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '$1,000' } })
    fireEvent.change(screen.getByLabelText(/^annual return \(%\)$/i), { target: { value: '7%' } })
    fireEvent.change(screen.getByLabelText(/drawdown return \(%\)/i), { target: { value: '-2.5' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '1.005' } })
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))

    await screen.findByText('Example formatted input')
    expect(requestBodyAt(fetchMock, 1)).toMatchObject({
      amountCents: 100000,
      annualReturnRateBasisPoints: 700,
      drawdownAnnualReturnRateBasisPoints: -250,
      annualContributionCents: 101,
    })
  })

  it('shows a field error instead of sending an invalid amount', async () => {
    const createdItem = { ...exampleItem, id: 'item_000003', name: 'Example fixed input', sortOrder: 0 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(createdItem, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Example fixed input' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText(/^annual return \(%\)$/i), { target: { value: 'seven' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))

    expect(await screen.findByText('Enter a dollar amount like 1,000 or 1000.50.')).toBeInTheDocument()
    expect(screen.getByText('Enter a percentage like 7 or -2.5.')).toBeInTheDocument()
    expect(screen.getByLabelText(/current amount/i)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '2,500' } })
    expect(screen.queryByText('Enter a dollar amount like 1,000 or 1000.50.')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/current amount/i)).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('Enter a percentage like 7 or -2.5.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^annual return \(%\)$/i), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))

    await screen.findByText('Example fixed input')
    expect(requestBodyAt(fetchMock, 1)).toMatchObject({ amountCents: 250000, annualReturnRateBasisPoints: 700 })
  })

  it('rejects fractional projection years without calling the API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/saving years/i), { target: { value: '10.5' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('Enter a whole number of years from 0 to 75.')).toBeInTheDocument()
    expect(screen.getByLabelText(/saving years/i)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText(/saving years/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/annual withdrawal/i), { target: { value: '$60,000' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(requestBodyAt(fetchMock, 1)).toEqual({
      savingYears: 2,
      drawdownYears: 0,
      annualWithdrawalCents: 6000000,
      annualWithdrawalInflationRateBasisPoints: 300,
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
    expect(screen.getByText(/all planned withdrawals are fully funded through year 3/i)).toBeInTheDocument()
    expect(screen.queryByText(/withdrawals run short/i)).not.toBeInTheDocument()

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

  it('highlights drawdown years where planned withdrawals cannot be covered', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem, secondItem]))
      .mockResolvedValueOnce(jsonResponse(shortfallProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /calculate projection/i }))
    expect(await screen.findByText('Projection by year and item')).toBeInTheDocument()

    const status = screen.getByText(/withdrawals run short starting in year 2/i).closest('p')
    expect(status).toHaveClass('funding-status', 'shortfall')
    expect(status).toHaveTextContent('(drawdown year 2)')
    expect(status).toHaveTextContent("$180.00 of planned withdrawals can't be covered over the projection.")
    expect(screen.queryByText(/fully funded/i)).not.toBeInTheDocument()

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Year',
      'Phase',
      'Annual withdrawal',
      'Shortfall',
      'Item',
      'Contribution',
      'Withdrawal',
      'Growth',
      'Item balance',
      'Combined balance',
    ])

    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows.map((row) => row.className)).toEqual([
      '',
      '',
      '',
      '',
      'shortfall-row',
      'shortfall-row',
      'shortfall-row',
      'shortfall-row',
    ])
    expect(within(bodyRows[4]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Year 2',
      'Drawdown',
      '$20.00',
      '$80.00',
      'Example brokerage',
      '$0.00',
      '$13.33',
      '$0.00',
      '$0.00',
      '$0.00',
    ])
    expect(within(bodyRows[5]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '',
      '',
      '',
      '',
      'Example savings',
      '$0.00',
      '$6.67',
      '$0.00',
      '$0.00',
      '',
    ])
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
    expect(screen.queryByText(/fully funded|withdrawals run short/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Shortfall' })).not.toBeInTheDocument()

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

function addSessionItem(name: string) {
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '1000.00' } })
  fireEvent.change(screen.getByLabelText(/^annual return/i), { target: { value: '5.00' } })
  fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '0.00' } })
  fireEvent.click(screen.getByRole('button', { name: /add item/i }))
}

function stubBackupDownload() {
  const blobs: Blob[] = []
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:financial-backup'
    }),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  return async () => {
    fireEvent.click(screen.getByRole('button', { name: /export json backup/i }))
    await waitFor(() => expect(blobs.length).toBeGreaterThan(0))
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blobs[blobs.length - 1])
    })
    const backup = JSON.parse(text) as { items: Array<{ id: string; name: string }> }
    return backup.items
  }
}

function requestBodyAt(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  return JSON.parse((fetchMock.mock.calls[callIndex][1] as RequestInit).body as string)
}
