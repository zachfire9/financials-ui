import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ProjectionResults } from './ProjectionResults'
import type { Projection, YearlyBalance } from './financialItemsApi'

type Flow = Partial<Pick<YearlyBalance, 'contributionCents' | 'withdrawalCents' | 'growthCents' | 'unfundedWithdrawalCents'>>

function year(yearNumber: number, phase: YearlyBalance['phase'], balanceCents: number, flow: Flow = {}): YearlyBalance {
  return {
    year: yearNumber,
    phase,
    balanceCents,
    contributionCents: flow.contributionCents ?? 0,
    withdrawalCents: flow.withdrawalCents ?? 0,
    growthCents: flow.growthCents ?? 0,
    unfundedWithdrawalCents: flow.unfundedWithdrawalCents ?? 0,
  }
}

function projectionWith(items: Array<{ id: string; name: string; balances: YearlyBalance[] }>, savingYears: number, drawdownYears: number): Projection {
  const years = items[0].balances.map((balance) => balance.year)
  const totals = years.map((yearNumber, index) => {
    const entries = items.map((item) => item.balances[index])
    return {
      ...year(yearNumber, entries[0].phase, 0),
      balanceCents: entries.reduce((sum, entry) => sum + entry.balanceCents, 0),
      contributionCents: entries.reduce((sum, entry) => sum + entry.contributionCents, 0),
      withdrawalCents: entries.reduce((sum, entry) => sum + (entry.withdrawalCents ?? 0), 0),
      growthCents: entries.reduce((sum, entry) => sum + entry.growthCents, 0),
      unfundedWithdrawalCents: entries.reduce((sum, entry) => sum + (entry.unfundedWithdrawalCents ?? 0), 0),
    }
  })
  return {
    years: years[years.length - 1],
    savingYears,
    drawdownYears,
    currency: 'USD',
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      startingAmountCents: item.balances[0].balanceCents,
      annualReturnRateBasisPoints: 500,
      annualContributionCents: 0,
      inflateAnnualContribution: false,
      yearlyBalances: item.balances,
    })),
    totals,
  }
}

const fundedProjection = projectionWith(
  [
    {
      id: 'a',
      name: 'Brokerage',
      balances: [
        year(0, 'starting', 100000),
        year(1, 'saving', 160000, { contributionCents: 50000, growthCents: 10000 }),
        year(2, 'drawdown', 130000, { withdrawalCents: 40000, growthCents: 10000 }),
      ],
    },
    {
      id: 'b',
      name: 'Savings',
      balances: [
        year(0, 'starting', 50000),
        year(1, 'saving', 52000, { growthCents: 2000 }),
        year(2, 'drawdown', 34000, { withdrawalCents: 20000, growthCents: 2000 }),
      ],
    },
  ],
  1,
  1,
)

const shortProjection = projectionWith(
  [
    {
      id: 'a',
      name: 'Brokerage',
      balances: [
        year(0, 'starting', 10000),
        year(1, 'drawdown', 2000, { withdrawalCents: 8000 }),
        year(2, 'drawdown', 0, { withdrawalCents: 2000, unfundedWithdrawalCents: 6000 }),
        year(3, 'drawdown', 0, { unfundedWithdrawalCents: 8000 }),
      ],
    },
  ],
  0,
  3,
)

const colorFor = (_id: string, index: number) => ['#2a78d6', '#eb6834'][index] ?? '#8a8f8d'

describe('ProjectionResults', () => {
  afterEach(() => cleanup())

  it('leads with how long the money lasts', () => {
    render(<ProjectionResults projection={fundedProjection} colorFor={colorFor} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your money lasts the full year of drawdown, with $1,640 left.')
    expect(screen.getByText('Peak, year 1')).toBeInTheDocument()

    cleanup()
    render(<ProjectionResults projection={shortProjection} colorFor={colorFor} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your money covers 1 of 3 years of withdrawals.')
    // The balance only falls, so "Peak" would just repeat "Today".
    expect(screen.queryByText(/^Peak/)).not.toBeInTheDocument()
  })

  it('describes saving-only projections by their final balance', () => {
    const savingOnly = projectionWith(
      [{ id: 'a', name: 'Brokerage', balances: [year(0, 'starting', 100000), year(1, 'saving', 2500000, { contributionCents: 2400000 })] }],
      1,
      0,
    )
    render(<ProjectionResults projection={savingOnly} colorFor={colorFor} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent("You'd have $25K after 1 year.")
  })

  it('labels the balance chart with accounts, the drawdown start and any shortfall', () => {
    const { container } = render(<ProjectionResults projection={fundedProjection} colorFor={colorFor} />)
    const balanceChart = screen.getByRole('figure', { name: 'Balance over time' })

    expect(within(within(balanceChart).getByRole('list', { name: 'Accounts' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Brokerage',
      'Savings',
    ])
    expect(container.querySelector('.phase-marker text')).toHaveTextContent('Withdrawals start after year 1')
    expect(container.querySelector('.shortfall-label')).toBeNull()

    cleanup()
    const short = render(<ProjectionResults projection={shortProjection} colorFor={colorFor} />)
    expect(short.container.querySelector('.shortfall-label')).toHaveTextContent('Runs short from year 2')
  })

  it.each([
    [360, 'beside the marker on the left'],
    [280, 'with the shortfall label on a second line'],
  ])('keeps the drawdown and shortfall labels apart at %ipx (%s)', (width) => {
    // Recreates a phone-width chart: drawdown starts early (year 10 of 40) and
    // the money runs short from year 36, so both labels want the right side.
    const balances: YearlyBalance[] = []
    for (let yearNumber = 0; yearNumber <= 40; yearNumber++) {
      const phase = yearNumber === 0 ? 'starting' : yearNumber <= 10 ? 'saving' : 'drawdown'
      const balance = yearNumber < 36 ? 1_000_000 - Math.abs(yearNumber - 10) * 30_000 : 0
      balances.push(year(yearNumber, phase, balance, { unfundedWithdrawalCents: yearNumber >= 36 ? 50_000 : 0 }))
    }
    const narrow = projectionWith([{ id: 'a', name: 'Everything', balances }], 10, 30)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect)

    const { container } = render(<ProjectionResults projection={narrow} colorFor={colorFor} />)
    const phaseLabel = container.querySelector('.phase-marker text') as SVGTextElement
    const shortfallLabel = container.querySelector('.shortfall-label') as SVGTextElement
    expect(phaseLabel).toHaveTextContent('Drawdown starts')
    expect(shortfallLabel).toHaveTextContent('⚠ Short from year 36')

    // Estimated label extents (12px text, ~7px per character).
    const extent = (label: SVGTextElement) => {
      const x = Number(label.getAttribute('x'))
      const textWidth = (label.textContent ?? '').length * 7
      return label.getAttribute('text-anchor') === 'end' ? [x - textWidth, x] : [x, x + textWidth]
    }
    const [phaseStart, phaseEnd] = extent(phaseLabel)
    const [shortfallStart] = extent(shortfallLabel)
    const sameRow = phaseLabel.getAttribute('y') === shortfallLabel.getAttribute('y')
    expect(phaseStart).toBeGreaterThanOrEqual(0)
    if (sameRow) {
      expect(phaseEnd).toBeLessThan(shortfallStart)
    }
    if (width === 280) {
      expect(sameRow).toBe(false)
    }
    vi.restoreAllMocks()
  })

  it('keeps both labels on the top row when there is room', () => {
    const { container } = render(<ProjectionResults projection={shortProjection} colorFor={colorFor} />)
    expect(container.querySelector('.shortfall-label')?.getAttribute('y')).toBe('20')

    cleanup()
    const wide = render(<ProjectionResults projection={fundedProjection} colorFor={colorFor} />)
    expect(wide.container.querySelector('.phase-marker text')?.getAttribute('y')).toBe('20')
  })

  it('switches between the stacked total and per-account lines', () => {
    const { container } = render(<ProjectionResults projection={fundedProjection} colorFor={colorFor} />)
    const total = screen.getByRole('button', { name: 'Total' })
    const byAccount = screen.getByRole('button', { name: 'By account' })

    expect(total).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelectorAll('.balance-chart .chart-reveal path[fill-opacity]')).toHaveLength(2)

    fireEvent.click(byAccount)
    expect(byAccount).toHaveAttribute('aria-pressed', 'true')
    expect(total).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelectorAll('.balance-chart .chart-reveal path[fill-opacity]')).toHaveLength(0)
    expect(container.querySelectorAll('.balance-chart .chart-reveal path')).toHaveLength(2)
  })

  it('reads each year of the balance chart from the keyboard', () => {
    render(<ProjectionResults projection={fundedProjection} colorFor={colorFor} />)
    const plot = screen.getByRole('group', { name: /balance by year/i })

    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    const tooltip = plot.querySelector('.chart-tooltip') as HTMLElement
    expect(tooltip).toHaveClass('visible')
    expect(tooltip).toHaveTextContent('Year 0')
    expect(tooltip).toHaveTextContent('Total$1,500.00')

    fireEvent.keyDown(plot, { key: 'End' })
    expect(tooltip).toHaveTextContent('Year 2')
    expect(tooltip).toHaveTextContent('Drawdown')
    expect(tooltip).toHaveTextContent('Total$1,640.00')

    fireEvent.keyDown(plot, { key: 'Escape' })
    expect(tooltip).not.toHaveClass('visible')
  })

  it('shows money in and out each year, including shortfalls', () => {
    render(<ProjectionResults projection={shortProjection} colorFor={colorFor} />)
    const flows = screen.getByRole('figure', { name: 'Money in and out each year' })
    expect(within(within(flows).getByRole('list', { name: 'Flows' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Withdrawals',
      '⚠ Shortfall',
    ])

    const plot = within(flows).getByRole('group', { name: /money in and out by year/i })
    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    fireEvent.keyDown(plot, { key: 'ArrowRight' })
    const tooltip = plot.querySelector('.chart-tooltip') as HTMLElement
    expect(tooltip).toHaveTextContent('Year 2')
    expect(tooltip).toHaveTextContent('Withdrawals-$20')
    expect(tooltip).toHaveTextContent('⚠ Shortfall$60')
  })

  it('describes the years when one of you has retired and the other still works', () => {
    const household = {
      ...projectionWith(
        [
          {
            id: 'a',
            name: 'Brokerage',
            balances: [
              year(0, 'starting', 100000),
              year(1, 'saving', 120000, { contributionCents: 20000 }),
              year(2, 'transition', 125000, { contributionCents: 10000, withdrawalCents: 5000 }),
              year(3, 'transition', 130000, { contributionCents: 10000, withdrawalCents: 5000 }),
              year(4, 'drawdown', 110000, { withdrawalCents: 20000 }),
            ],
          },
        ],
        1,
        1,
      ),
      transitionYears: 2,
    }
    const people = [
      { id: 'person-1', name: 'Alex', savingYears: 1 },
      { id: 'person-2', name: 'Sam', savingYears: 3 },
    ]
    const { container } = render(<ProjectionResults projection={household} colorFor={colorFor} people={people} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your money lasts the full year after you’ve both retired, with $1,100 left.')
    expect(screen.getByText('Alex retires after year 1 and Sam after year 3.')).toBeInTheDocument()
    expect(container.querySelector('.phase-marker text')).toHaveTextContent('Both retired after year 3')
    expect(container.querySelector('.transition-band rect')).not.toBeNull()
    expect(screen.getByText(/Shaded years: one of you has retired and Sam is still working\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show yearly table' }))
    expect(within(screen.getByRole('table')).getAllByText('One retired')).toHaveLength(2)
  })

  it('says when the money runs short before you have both retired', () => {
    const household = {
      ...projectionWith(
        [
          {
            id: 'a',
            name: 'Savings',
            balances: [
              year(0, 'starting', 10000),
              year(1, 'transition', 2000, { withdrawalCents: 8000 }),
              year(2, 'transition', 0, { withdrawalCents: 2000, unfundedWithdrawalCents: 6000 }),
              year(3, 'drawdown', 0, { unfundedWithdrawalCents: 9000 }),
            ],
          },
        ],
        0,
        1,
      ),
      transitionYears: 2,
    }
    const people = [
      { id: 'person-1', name: 'Alex', savingYears: 0 },
      { id: 'person-2', name: 'Sam', savingYears: 2 },
    ]
    render(<ProjectionResults projection={household} colorFor={colorFor} people={people} />)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your money runs short in year 2, while Sam is still working.')
    expect(screen.getByText(/while Sam is still working\)/)).toBeInTheDocument()
  })

  it('keeps the yearly table one click away', () => {
    render(<ProjectionResults projection={fundedProjection} colorFor={colorFor} />)
    const toggle = screen.getByRole('button', { name: 'Show yearly table' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Hide yearly table' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('table', { name: 'Projection by year and item' })).toBeInTheDocument()
  })
})
