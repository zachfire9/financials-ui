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
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    window.localStorage.clear()
  })

  it('runs ephemeral sessions from imported browser-owned data without loading or saving repository items', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByText(/ephemeral session mode/i)).toBeInTheDocument()
    expect(screen.getByText(/saved in this browser only/i)).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /save account/i }))

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
    fireEvent.click(screen.getByRole('button', { name: /save account/i }))

    await screen.findByText('Account D renamed')
    expect(within(screen.getByRole('complementary')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
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

  it('rejects an imported backup with invalid items and keeps the current session', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)

    addSessionItem('Existing account')
    await screen.findByText('Existing account')

    const backup = {
      schemaVersion: 1,
      exportedAt: '2026-01-03T00:00:00Z',
      items: [
        exampleItem,
        { ...exampleItem, id: 'item_000002', name: 'Broken item', currency: 'US', amountCents: undefined },
      ],
    }
    const file = new File([JSON.stringify(backup)], 'financials-backup.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText(/import json backup/i), { target: { files: [file] } })

    const error = await screen.findByText(/could not import backup/i)
    expect(error).toHaveTextContent('Item 2: amountCents must be a whole number of cents, 0 or more.')
    expect(error).toHaveTextContent('Item 2: currency must be a 3-letter code such as USD.')
    expect(screen.getByText('Existing account')).toBeInTheDocument()
    expect(screen.queryByText('Example brokerage')).not.toBeInTheDocument()
  })

  it('restores an ephemeral session saved in this browser after a reload', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    const firstVisit = render(<App />)
    addSessionItem('Account A')
    addSessionItem('Account B')
    await screen.findByText('Account B')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account B' }))
    fireEvent.change(screen.getByLabelText(/saving years/i), { target: { value: '20' } })
    firstVisit.unmount()

    const exportItems = stubBackupDownload()
    render(<App />)

    expect(screen.getByText('Restored 1 item saved in this browser.')).toBeInTheDocument()
    expect(screen.getByText('Account A')).toBeInTheDocument()
    expect(screen.queryByText('Account B')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/saving years/i)).toHaveValue('20')

    // The ID counter is restored too, so the deleted item's ID isn't reused.
    addSessionItem('Account C')
    await screen.findByText('Account C')
    expect((await exportItems()).map((item) => item.id)).toEqual(['session-item-1', 'session-item-3'])
  })

  it('ignores corrupt or invalid saved sessions', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    for (const saved of [
      '{not json',
      JSON.stringify({ version: 2, items: [] }),
      JSON.stringify({
        version: 1,
        items: [{ ...exampleItem, id: 'session-item-1', currency: 'US' }],
        projectionForm: { savingYears: '10', drawdownYears: '0', annualWithdrawal: '0.00', withdrawalInflationRate: '3.00' },
        lastSessionItemNumber: 1,
      }),
    ]) {
      window.localStorage.setItem('financials.session.v1', saved)
      const view = render(<App />)
      expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument()
      expect(screen.queryByText(/restored/i)).not.toBeInTheDocument()
      view.unmount()
    }
  })

  it('keeps working when browser storage is blocked', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    render(<App />)
    addSessionItem('Account A')

    expect(await screen.findByText('Account A')).toBeInTheDocument()
  })

  it('clears the saved ephemeral session only after confirmation', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    render(<App />)
    addSessionItem('Account A')
    await screen.findByText('Account A')

    fireEvent.click(screen.getByRole('button', { name: 'Clear session' }))
    expect(screen.getByText('Account A')).toBeInTheDocument()
    expect(window.localStorage.getItem('financials.session.v1')).toContain('Account A')

    fireEvent.click(screen.getByRole('button', { name: 'Clear session' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Account A')).not.toBeInTheDocument()
    expect(screen.getByText('Session cleared. Nothing is saved in this browser.')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('financials.session.v1') ?? '{}').items).toEqual([])
  })

  it('does not save API-backed items in browser storage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse([exampleItem])))

    render(<App />)

    expect(await screen.findByText('Example brokerage')).toBeInTheDocument()
    expect(window.localStorage.getItem('financials.session.v1')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear session' })).not.toBeInTheDocument()
  })

  it('flags a projection as out of date when items change after calculating', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse(exampleProjection)))

    render(<App />)
    addSessionItem('Account A')
    addSessionItem('Account B')
    await screen.findByText('Account B')

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))
    await openYearlyTable()
    expect(screen.queryByText(/items changed since this projection/i)).not.toBeInTheDocument()

    // Reordering doesn't change the projection's inputs.
    const cards = screen.getAllByRole('listitem')
    fireEvent.dragStart(cards[1])
    fireEvent.drop(cards[0])
    expect(screen.queryByText(/items changed since this projection/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Account A' }))
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /save account/i }))

    expect(await screen.findByText('Your items changed since this projection. Recalculate to update.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))
    await waitFor(() => expect(screen.queryByText(/items changed since this projection/i)).not.toBeInTheDocument())
  })

  it('keeps each account’s chart color when another account is deleted', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    addSessionItem('Account A')
    addSessionItem('Account B')
    addSessionItem('Account C')
    await screen.findByText('Account C')

    const swatchColor = (name: string) =>
      (screen.getByRole('heading', { level: 3, name }).closest('li')?.querySelector('.account-swatch') as HTMLElement).style.background
    const before = { b: swatchColor('Account B'), c: swatchColor('Account C') }
    expect(new Set([swatchColor('Account A'), before.b, before.c]).size).toBe(3)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account A' }))
    expect(swatchColor('Account B')).toBe(before.b)
    expect(swatchColor('Account C')).toBe(before.c)

    // A new account takes the freed color instead of repeating one in use.
    addSessionItem('Account D')
    await screen.findByText('Account D')
    expect(new Set([swatchColor('Account B'), swatchColor('Account C'), swatchColor('Account D')]).size).toBe(3)
  })

  it('sends item IDs with ephemeral projections so charts can match account colors', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Account A')
    await screen.findByText('Account A')
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(requestBodyAt(fetchMock, 0).items).toEqual([expect.objectContaining({ id: 'session-item-1', name: 'Account A' })])
  })

  it('plans for two people retiring at different times', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Alex 401k')
    addSessionItem('Joint brokerage')
    await screen.findByText('Joint brokerage')
    expect(screen.queryByLabelText('Owner')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Two of us, retiring at different times'))
    expect(screen.queryByLabelText(/saving years/i)).not.toBeInTheDocument()
    const first = screen.getByRole('group', { name: 'Person 1' })
    const second = screen.getByRole('group', { name: 'Person 2' })
    fireEvent.change(within(first).getByLabelText('Name'), { target: { value: 'Alex' } })
    fireEvent.change(within(first).getByLabelText('Years until retiring'), { target: { value: '2' } })
    fireEvent.change(within(second).getByLabelText('Name'), { target: { value: 'Sam' } })
    fireEvent.change(within(second).getByLabelText('Years until retiring'), { target: { value: '5' } })
    const gap = screen.getByRole('region', { name: 'While one of you still works' })
    expect(gap).toHaveTextContent('In years 3–5, Alex is retired and Sam is still working.')
    fireEvent.change(within(gap).getByLabelText('Withdrawal per year'), { target: { value: '20,000' } })
    const retired = screen.getByRole('region', { name: 'Once you’ve both retired' })
    expect(retired).toHaveTextContent('Starts in year 6.')
    fireEvent.change(within(retired).getByLabelText('For how many years'), { target: { value: '3' } })
    fireEvent.change(within(retired).getByLabelText('Withdrawal per year'), { target: { value: '50,000' } })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Alex 401k' }))
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'person-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(await screen.findByText('Owner: Alex')).toBeInTheDocument()
    expect(screen.getByText('Owner: Joint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = requestBodyAt(fetchMock, 0)
    expect(body).toEqual(
      expect.objectContaining({
        people: [
          { id: 'person-1', name: 'Alex', savingYears: 2 },
          { id: 'person-2', name: 'Sam', savingYears: 5 },
        ],
        gapAnnualWithdrawalCents: 2000000,
        drawdownYears: 3,
        annualWithdrawalCents: 5000000,
      }),
    )
    expect(body.savingYears).toBeUndefined()
    expect(body.items[0]).toEqual(expect.objectContaining({ name: 'Alex 401k', ownerId: 'person-1' }))
    expect(body.items[1].ownerId).toBeUndefined()
  })

  it('remembers the household plan in this browser', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    const firstVisit = render(<App />)
    fireEvent.click(screen.getByLabelText('Two of us, retiring at different times'))
    fireEvent.change(within(screen.getByRole('group', { name: 'Person 2' })).getByLabelText('Name'), { target: { value: 'Sam' } })
    fireEvent.change(within(screen.getByRole('group', { name: 'Person 2' })).getByLabelText('Years until retiring'), { target: { value: '4' } })
    fireEvent.change(within(screen.getByRole('region', { name: 'While one of you still works' })).getByLabelText('Withdrawal per year'), {
      target: { value: '1,500' },
    })
    firstVisit.unmount()

    render(<App />)
    expect(screen.getByLabelText('Two of us, retiring at different times')).toBeChecked()
    expect(within(screen.getByRole('group', { name: 'Person 2' })).getByLabelText('Name')).toHaveValue('Sam')
    expect(within(screen.getByRole('region', { name: 'While one of you still works' })).getByLabelText('Withdrawal per year')).toHaveValue('1,500')
  })

  it('explains when both people retire in the same year', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    fireEvent.click(screen.getByLabelText('Two of us, retiring at different times'))
    const gap = screen.getByRole('region', { name: 'While one of you still works' })
    expect(gap).toHaveTextContent('You both retire after year 10, so there are no years in between.')
    expect(within(gap).queryByLabelText('Withdrawal per year')).not.toBeInTheDocument()
  })

  it('checks each person’s settings before calculating', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Account A')
    await screen.findByText('Account A')
    fireEvent.click(screen.getByLabelText('Two of us, retiring at different times'))
    const first = screen.getByRole('group', { name: 'Person 1' })
    fireEvent.change(within(first).getByLabelText('Name'), { target: { value: ' ' } })
    fireEvent.change(within(first).getByLabelText('Years until retiring'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await within(first).findByText('Enter a name.')).toBeInTheDocument()
    expect(within(first).getByText('Enter a whole number of years from 0 to 75.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends each account’s withdrawal order and availability', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Brokerage' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '1000.00' } })
    fireEvent.change(screen.getByLabelText(/^annual return/i), { target: { value: '5.00' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '0.00' } })
    fireEvent.change(screen.getByLabelText('Withdraw'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Available'), { target: { value: 'year' } })
    fireEvent.change(screen.getByLabelText('Available after year'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))
    expect(await screen.findByText('Withdrawn first, available after year 5.')).toBeInTheDocument()

    addSessionItem('Savings')
    await screen.findByText('Savings')
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = requestBodyAt(fetchMock, 0)
    expect(body.items[0]).toEqual(expect.objectContaining({ name: 'Brokerage', withdrawalPriority: 1, withdrawalAvailableAfterYear: 5 }))
    expect(body.items[1].withdrawalPriority).toBeUndefined()
    expect(body.items[1].withdrawalAvailableAfterYear).toBeUndefined()
  })

  it('defaults an owned account to being available once its owner retires', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    addSessionItem('Sam 401k')
    await screen.findByText('Sam 401k')
    fireEvent.click(screen.getByLabelText('Two of us, retiring at different times'))
    fireEvent.change(within(screen.getByRole('group', { name: 'Person 2' })).getByLabelText('Name'), { target: { value: 'Sam' } })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Sam 401k' }))
    fireEvent.change(screen.getByLabelText('Owner'), { target: { value: 'person-2' } })
    const availability = screen.getByLabelText('Available')
    expect(within(availability).getByRole('option', { name: 'When Sam retires' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(await screen.findByText('Available once Sam retires.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Sam 401k' }))
    fireEvent.change(screen.getByLabelText('Available'), { target: { value: 'now' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }))
    expect(await screen.findByText('Available anytime.')).toBeInTheDocument()
  })

  it('checks the year an account becomes available', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Brokerage' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '1000.00' } })
    fireEvent.change(screen.getByLabelText(/^annual return/i), { target: { value: '5.00' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '0.00' } })
    fireEvent.change(screen.getByLabelText('Available'), { target: { value: 'year' } })
    fireEvent.change(screen.getByLabelText('Available after year'), { target: { value: 'soon' } })
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

    expect(await screen.findByText('Enter a whole number of years from 0 to 150.')).toBeInTheDocument()
    expect(screen.queryByText('Withdrawn first')).not.toBeInTheDocument()
  })

  it('itemizes retirement expenses into the withdrawal', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Savings')
    await screen.findByText('Savings')
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText(/^annual withdrawal/i), { target: { value: '40,000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Itemize expenses' }))

    expect(screen.getByLabelText('Other per year')).toHaveValue('40,000')
    fireEvent.change(screen.getByLabelText('Healthcare per year'), { target: { value: '12,000' } })
    fireEvent.change(screen.getByLabelText('Healthcare inflation (%)'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Travel per year'), { target: { value: '10,000' } })
    fireEvent.change(screen.getByLabelText('Travel: last year of retirement'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Healthcare: first year of retirement'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Taxes' }))
    // Healthcare starts in year 20, so the first year is Travel + Other.
    expect(screen.getByText('$50,000.00', { selector: '.itemized-total' })).toBeInTheDocument()
    expect(screen.getByText(/It changes as expenses start and stop\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = requestBodyAt(fetchMock, 0)
    expect(body.annualWithdrawalCents).toBe(0)
    expect(body.expenses).toEqual([
      { id: 'expense-1', name: 'Housing', annualAmountCents: 0 },
      { id: 'expense-2', name: 'Food', annualAmountCents: 0 },
      { id: 'expense-3', name: 'Healthcare', annualAmountCents: 1200000, inflationRateBasisPoints: 500, fromYear: 20 },
      { id: 'expense-4', name: 'Travel', annualAmountCents: 1000000, toYear: 10 },
      { id: 'expense-6', name: 'Other', annualAmountCents: 4000000 },
    ])
  })

  it('shows the plan\u2019s last retirement year as the default end of a range', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    addSessionItem('Savings')
    await screen.findByText('Savings')
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Itemize expenses' }))

    expect(screen.getByLabelText('Travel: last year of retirement')).toHaveAttribute('placeholder', '30')
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '' } })
    expect(screen.getByLabelText('Travel: last year of retirement')).not.toHaveAttribute('placeholder')
  })

  it('checks each expense before calculating', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Savings')
    await screen.findByText('Savings')
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Itemize expenses' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }))
    fireEvent.change(screen.getByLabelText('Travel: last year of retirement'), { target: { value: 'ten' } })
    fireEvent.change(screen.getByLabelText('Healthcare: first year of retirement'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Healthcare: last year of retirement'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('Enter a year from 1 to 75, or leave it blank.')).toBeInTheDocument()
    expect(screen.getByText('The last year can’t be before the first.')).toBeInTheDocument()
    expect(screen.getByText('Enter a name.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('includes a mortgage and previews when it’s paid off', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(exampleProjection))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Savings')
    await screen.findByText('Savings')
    fireEvent.change(screen.getByLabelText(/saving years/i), { target: { value: '10' } })
    fireEvent.click(screen.getByLabelText('Include a mortgage'))
    fireEvent.change(screen.getByLabelText('Left to pay'), { target: { value: '250,000' } })
    fireEvent.change(screen.getByLabelText('APR (%)'), { target: { value: '6.5' } })
    fireEvent.change(screen.getByLabelText('Monthly payment'), { target: { value: '1,800' } })

    expect(screen.getByText('At this payment it’s paid off in about 22 years, so savings cover 12 years of payments.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(requestBodyAt(fetchMock, 0).mortgage).toEqual({ balanceCents: 25000000, annualRateBasisPoints: 650, monthlyPaymentCents: 180000 })
  })

  it('shows the mortgage next to retirement spending instead of asking for it again', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    fireEvent.change(screen.getByLabelText(/saving years/i), { target: { value: '10' } })
    fireEvent.click(screen.getByLabelText('Include a mortgage'))
    fireEvent.change(screen.getByLabelText('Left to pay'), { target: { value: '250,000' } })
    fireEvent.change(screen.getByLabelText('APR (%)'), { target: { value: '6.5' } })
    fireEvent.change(screen.getByLabelText('Monthly payment'), { target: { value: '1,800' } })

    expect(screen.getByText(/Plus your mortgage payment until year 22\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Itemize expenses' }))
    const mortgageRow = screen.getByRole('group', { name: 'Mortgage, added automatically' })
    expect(mortgageRow).toHaveTextContent('$21,600 a year')
    expect(mortgageRow).toHaveTextContent('Added automatically until it’s paid off in year 22.')
    expect(screen.getByText(/a year in today’s dollars, plus your mortgage/)).toBeInTheDocument()
    expect(screen.getByText(/put only property tax, insurance and upkeep under Housing/)).toBeInTheDocument()
  })

  it('says nothing is added when the mortgage is paid off before retirement', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    render(<App />)
    fireEvent.change(screen.getByLabelText(/saving years/i), { target: { value: '30' } })
    fireEvent.click(screen.getByLabelText('Include a mortgage'))
    fireEvent.change(screen.getByLabelText('Left to pay'), { target: { value: '250,000' } })
    fireEvent.change(screen.getByLabelText('APR (%)'), { target: { value: '6.5' } })
    fireEvent.change(screen.getByLabelText('Monthly payment'), { target: { value: '1,800' } })
    fireEvent.click(screen.getByRole('button', { name: 'Itemize expenses' }))

    expect(screen.getByRole('group', { name: 'Mortgage, added automatically' })).toHaveTextContent(
      'Paid off in year 22, before retirement, so nothing is added.',
    )
  })

  it('explains when a mortgage payment doesn’t cover the interest', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    addSessionItem('Savings')
    await screen.findByText('Savings')
    fireEvent.click(screen.getByLabelText('Include a mortgage'))
    fireEvent.change(screen.getByLabelText('Left to pay'), { target: { value: '250,000' } })
    fireEvent.change(screen.getByLabelText('APR (%)'), { target: { value: '6.5' } })
    fireEvent.change(screen.getByLabelText('Monthly payment'), { target: { value: '1,000' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('The payment needs to be more than the monthly interest ($1,354.17).')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('carries over expenses saved with the older “first N years” setting', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())
    window.localStorage.setItem(
      'financials.session.v1',
      JSON.stringify({
        version: 1,
        items: [],
        projectionForm: {
          savingYears: '10',
          drawdownYears: '20',
          annualWithdrawal: '0.00',
          withdrawalInflationRate: '3.00',
          itemizeExpenses: true,
          expenses: [{ id: 'expense-1', name: 'Travel', amount: '9,000', inflationRate: '', years: '8' }],
        },
        lastSessionItemNumber: 0,
      }),
    )

    render(<App />)
    expect(screen.getByLabelText('Travel: first year of retirement')).toHaveValue('')
    expect(screen.getByLabelText('Travel: last year of retirement')).toHaveValue('8')
  })

  it('remembers itemized expenses and the mortgage in this browser', async () => {
    vi.stubEnv('VITE_FINANCIALS_SESSION_MODE', 'ephemeral')
    vi.stubGlobal('fetch', vi.fn())

    const firstVisit = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Itemize expenses' }))
    fireEvent.change(screen.getByLabelText('Travel per year'), { target: { value: '9,000' } })
    fireEvent.click(screen.getByLabelText('Include a mortgage'))
    fireEvent.change(screen.getByLabelText('Left to pay'), { target: { value: '120,000' } })
    firstVisit.unmount()

    render(<App />)
    expect(screen.getByLabelText('Travel per year')).toHaveValue('9,000')
    expect(screen.getByLabelText('Include a mortgage')).toBeChecked()
    expect(screen.getByLabelText('Left to pay')).toHaveValue('120,000')
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
    expect(within(itemCard).getByText('$12,500')).toBeInTheDocument()
    expect(within(itemCard).getByText('Grows 7% a year, 4% in drawdown.')).toBeInTheDocument()
    expect(within(itemCard).getByText('Adds $3,000 a year, rising with inflation.')).toBeInTheDocument()
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

  it('scrolls the account form into view and focuses its name when Edit is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([secondItem])))
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<App />)
    const edit = await screen.findByRole('button', { name: /edit example savings/i })
    fireEvent.click(edit)

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('form', { name: /edit example savings/i }))
    expect(screen.getByLabelText(/^name/i)).toHaveFocus()

    // A second click on the same account scrolls again.
    fireEvent.click(edit)
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
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
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

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
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

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
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

    expect(await screen.findByText('Enter a dollar amount like 1,000 or 1000.50.')).toBeInTheDocument()
    expect(screen.getByText('Enter a percentage like 7 or -2.5.')).toBeInTheDocument()
    expect(screen.getByLabelText(/current amount/i)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '2,500' } })
    expect(screen.queryByText('Enter a dollar amount like 1,000 or 1000.50.')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/current amount/i)).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('Enter a percentage like 7 or -2.5.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^annual return \(%\)$/i), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

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

  it('rejects a currency that is not a 3-letter code', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Example account' } })
    fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText(/^currency$/i), { target: { value: 'us' } })
    fireEvent.change(screen.getByLabelText(/^annual return \(%\)$/i), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /add account/i }))

    expect(await screen.findByText('Use a 3-letter currency code like USD.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^currency$/i)).toHaveValue('US')
    expect(screen.getByLabelText(/^currency$/i)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows plain-text amounts instead of crashing on an unknown currency format', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(jsonResponse({ ...exampleProjection, currency: 'U$' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /calculate projection/i }))

    await openYearlyTable()
    expect(screen.getAllByText('3,389.56 U$').length).toBeGreaterThan(0)
  })

  it('asks for a withdrawal amount instead of sending drawdown years with no withdrawal', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([exampleItem]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/drawdown years/i), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText(/^annual withdrawal$/i), { target: { value: '0.00' } })
    fireEvent.click(await screen.findByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('Enter how much to withdraw each year, or set drawdown years to 0.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^annual withdrawal$/i)).toHaveAttribute('aria-invalid', 'true')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText(/saving years/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/drawdown years/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(await screen.findByText('Add at least one saving or drawdown year.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('explains projection errors from the API in plain language', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem]))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'invalid projection request: all items must use the same currency; annualWithdrawalCents is required when drawdownYears is greater than 0' }, 400),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /calculate projection/i }))

    expect(
      await screen.findByText('Couldn’t calculate the projection. All accounts need the same currency to be projected together.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Enter how much to withdraw each year, or set drawdown years to 0.')).toBeInTheDocument()
    expect(screen.queryByText(/invalid projection request/i)).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: /save account/i }))

    await screen.findByText('Example down payment')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/financial-items/item_000001', expect.objectContaining({ method: 'PUT' }))

    fireEvent.click(screen.getByRole('button', { name: /delete example down payment/i }))

    await waitFor(() => expect(screen.queryByText('Example down payment')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/financial-items/item_000001', { method: 'DELETE' })
    expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument()
  })

  it('reorders existing items by dragging and dropping item cards', async () => {
    const reorderedFirst = { ...secondItem, sortOrder: 0 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([exampleItem, secondItem]))
      .mockResolvedValueOnce(jsonResponse(reorderedFirst))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const brokerage = await screen.findByText('Example brokerage')
    const savings = screen.getByText('Example savings')
    fireEvent.dragStart(savings.closest('li')!)
    fireEvent.dragOver(brokerage.closest('li')!)
    fireEvent.drop(brokerage.closest('li')!)

    // Example brokerage already had position 1 and keeps it, so only the
    // moved account is saved.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/financial-items/item_000002',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"sortOrder":0'),
      }),
    )
    expect(requestBodyAt(fetchMock, 1)).toEqual({
      name: 'Example savings',
      amountCents: 1000000,
      currency: 'USD',
      annualReturnRateBasisPoints: 450,
      annualContributionCents: 120000,
      inflateAnnualContribution: false,
      sortOrder: 0,
    })
    expect(within(screen.getByRole('complementary')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Example savings',
      'Example brokerage',
    ])
  })

  it('saves only the accounts whose position changed when reordering', async () => {
    const first = { ...exampleItem, id: 'item_000001', name: 'Account A', sortOrder: 0 }
    const second = { ...secondItem, id: 'item_000002', name: 'Account B', sortOrder: 1 }
    const third = { ...secondItem, id: 'item_000003', name: 'Account C', sortOrder: 2 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([first, second, third]))
      .mockImplementation(async (_url: string, init?: RequestInit) => jsonResponse(JSON.parse(String(init?.body ?? '{}'))))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const accountB = await screen.findByText('Account B')
    fireEvent.dragStart(screen.getByText('Account C').closest('li')!)
    fireEvent.drop(accountB.closest('li')!)

    // Account A keeps position 0, so only C (now 1) and B (now 2) are sent.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls.slice(1).map(([url]) => url)).toEqual([
      '/api/financial-items/item_000003',
      '/api/financial-items/item_000002',
    ])
    expect(requestBodyAt(fetchMock, 1)).toMatchObject({ name: 'Account C', sortOrder: 1 })
    expect(requestBodyAt(fetchMock, 2)).toMatchObject({ name: 'Account B', sortOrder: 2 })
    expect(within(screen.getByRole('complementary')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Account A',
      'Account C',
      'Account B',
    ])
  })

  it('shows the saved order when a reorder fails partway', async () => {
    const first = { ...exampleItem, id: 'item_000001', name: 'Account A', sortOrder: 0 }
    const second = { ...secondItem, id: 'item_000002', name: 'Account B', sortOrder: 1 }
    const third = { ...secondItem, id: 'item_000003', name: 'Account C', sortOrder: 2 }
    // The server saved C at position 1 before the second update failed, so
    // B and C now share position 1 there.
    const savedOnServer = [first, { ...third, sortOrder: 1 }, second]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([first, second, third]))
      .mockResolvedValueOnce(jsonResponse({ ...third, sortOrder: 1 }))
      .mockResolvedValueOnce(jsonResponse({ error: 'storage unavailable' }, 500))
      .mockResolvedValueOnce(jsonResponse(savedOnServer))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const accountB = await screen.findByText('Account B')
    fireEvent.dragStart(screen.getByText('Account C').closest('li')!)
    fireEvent.drop(accountB.closest('li')!)

    expect(
      await screen.findByText('Couldn’t save the new order. storage unavailable Showing the order that’s saved.'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/financial-items', undefined)
    expect(within(screen.getByRole('complementary')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Account A',
      'Account B',
      'Account C',
    ])
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
    fireEvent.change(screen.getByLabelText(/^inflation \(%\)$/i), { target: { value: '3.00' } })
    expect(screen.getByLabelText(/^inflation \(%\)$/i)).toHaveAccessibleDescription(
      'Raises withdrawals and linked contributions each year.',
    )
    expect(screen.getByLabelText(/^annual withdrawal$/i)).toHaveAccessibleDescription('In today’s dollars; grows with inflation.')
    expect(screen.queryByLabelText(/grow contributions by withdrawal inflation/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    await openYearlyTable()
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
    await openYearlyTable()

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
    await openYearlyTable()
    expect(screen.queryByText(/fully funded|withdrawals run short/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Shortfall' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /calculate projection/i }))

    expect(
      await screen.findByText(
        'Couldn’t update the projection. Projection service unavailable. Showing your last projection until then.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('$3,389.56').length).toBeGreaterThan(0)
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function openYearlyTable() {
  fireEvent.click(await screen.findByRole('button', { name: 'Show yearly table' }))
  expect(await screen.findByText('Projection by year and item')).toBeInTheDocument()
}

function addSessionItem(name: string) {
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/current amount/i), { target: { value: '1000.00' } })
  fireEvent.change(screen.getByLabelText(/^annual return/i), { target: { value: '5.00' } })
  fireEvent.change(screen.getByLabelText(/annual contribution/i), { target: { value: '0.00' } })
  fireEvent.click(screen.getByRole('button', { name: /add account/i }))
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
