import { useState } from 'react'
import { BalanceChart } from './charts/BalanceChart'
import { FlowsChart } from './charts/FlowsChart'
import type { Projection } from './financialItemsApi'
import { formatCompactCurrency, formatCurrency, pluralize } from './format'

type ProjectionResultsProps = {
  projection: Projection
  colorFor: (itemId: string, index: number) => string
}

export function ProjectionResults({ projection, colorFor }: ProjectionResultsProps) {
  const [showTable, setShowTable] = useState(false)
  const totals = projection.totals
  const startYear = totals[0]
  const finalYear = totals[totals.length - 1]
  const peakYear = totals.reduce((peak, total) => (total.balanceCents > peak.balanceCents ? total : peak), startYear)
  const savingYears = projection.savingYears ?? 0
  const drawdownYears = projection.drawdownYears ?? 0
  const shortfallYears = totals.filter((total) => (total.unfundedWithdrawalCents ?? 0) > 0)
  const firstShortfallYear = shortfallYears[0]
  const totalShortfallCents = shortfallYears.reduce((sum, total) => sum + (total.unfundedWithdrawalCents ?? 0), 0)
  const hasDrawdown = totals.some((total) => total.phase === 'drawdown')
  const currency = projection.currency

  return (
    <div className="projection-results">
      <section className="projection-summary" aria-label="Projection summary">
        <h2 className="projection-headline">{headline()}</h2>
        <dl className="projection-facts">
          <div>
            <dt>Today</dt>
            <dd>{formatCompactCurrency(startYear.balanceCents, currency)}</dd>
          </div>
          <div>
            <dt>Peak, year {peakYear.year}</dt>
            <dd>{formatCompactCurrency(peakYear.balanceCents, currency)}</dd>
          </div>
          <div>
            <dt>At year {finalYear.year}</dt>
            <dd>{formatCompactCurrency(finalYear.balanceCents, currency)}</dd>
          </div>
        </dl>
        {firstShortfallYear ? (
          <p className="funding-status shortfall">
            <span aria-hidden="true">⚠ </span>
            <strong>Withdrawals run short starting in year {firstShortfallYear.year}</strong> (drawdown year{' '}
            {firstShortfallYear.year - savingYears}). {formatCurrency(totalShortfallCents, currency)} of planned withdrawals
            can't be covered over the projection.
          </p>
        ) : hasDrawdown ? (
          <p className="funding-status funded">
            <span aria-hidden="true">✓ </span>
            All planned withdrawals are fully funded through year {finalYear.year}.
          </p>
        ) : null}
      </section>

      <BalanceChart projection={projection} colorFor={colorFor} />
      <FlowsChart projection={projection} />

      <section className="yearly-table">
        <button
          type="button"
          className="disclosure"
          aria-expanded={showTable}
          aria-controls="yearly-table"
          onClick={() => setShowTable((current) => !current)}
        >
          {showTable ? 'Hide yearly table' : 'Show yearly table'}
        </button>
        {showTable ? <YearlyTable projection={projection} hasShortfall={Boolean(firstShortfallYear)} /> : null}
      </section>
    </div>
  )

  function headline() {
    if (firstShortfallYear) {
      const coveredYears = Math.max(0, firstShortfallYear.year - savingYears - 1)
      return coveredYears > 0
        ? `Your money covers ${coveredYears} of ${pluralize(drawdownYears, 'year')} of withdrawals.`
        : 'Your withdrawals run short in the first year of drawdown.'
    }
    if (hasDrawdown) {
      return drawdownYears === 1
        ? `Your money lasts the full year of drawdown, with ${formatCompactCurrency(finalYear.balanceCents, currency)} left.`
        : `Your money lasts all ${drawdownYears} years, with ${formatCompactCurrency(finalYear.balanceCents, currency)} left.`
    }
    return `You'd have ${formatCompactCurrency(finalYear.balanceCents, currency)} after ${pluralize(finalYear.year, 'year')}.`
  }
}

function YearlyTable({ projection, hasShortfall }: { projection: Projection; hasShortfall: boolean }) {
  const rows = projection.totals.flatMap((total) =>
    projection.items.map((item, itemIndex) => ({
      annualWithdrawalCents: total.withdrawalCents ?? 0,
      combinedBalanceCents: total.balanceCents,
      isFirstItemForYear: itemIndex === 0,
      item,
      shortfallCents: total.unfundedWithdrawalCents ?? 0,
      yearlyBalance: item.yearlyBalances.find((yearlyBalance) => yearlyBalance.year === total.year),
      year: total.year,
    })),
  )

  return (
    <div className="table-scroll" id="yearly-table">
      <table>
        <caption>Projection by year and item</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Phase</th>
            <th scope="col" className="num">Annual withdrawal</th>
            {hasShortfall ? <th scope="col" className="num">Shortfall</th> : null}
            <th scope="col">Item</th>
            <th scope="col" className="num">Contribution</th>
            <th scope="col" className="num">Withdrawal</th>
            <th scope="col" className="num">Growth</th>
            <th scope="col" className="num">Item balance</th>
            <th scope="col" className="num">Combined balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ annualWithdrawalCents, combinedBalanceCents, isFirstItemForYear, item, shortfallCents, yearlyBalance, year }) => {
            if (!yearlyBalance) {
              return null
            }

            return (
              <tr
                key={`${year}-${item.id || item.name}`}
                className={shortfallCents > 0 ? 'shortfall-row' : undefined}
              >
                <td>{isFirstItemForYear ? `Year ${year}` : ''}</td>
                <td>{isFirstItemForYear ? formatPhase(yearlyBalance.phase) : ''}</td>
                <td className="num">{isFirstItemForYear ? formatCurrency(annualWithdrawalCents, projection.currency) : ''}</td>
                {hasShortfall ? (
                  <td className="num">{isFirstItemForYear ? formatCurrency(shortfallCents, projection.currency) : ''}</td>
                ) : null}
                <td>{item.name}</td>
                <td className="num">{formatCurrency(yearlyBalance.contributionCents, projection.currency)}</td>
                <td className="num">{formatCurrency(yearlyBalance.withdrawalCents ?? 0, projection.currency)}</td>
                <td className="num">{formatCurrency(yearlyBalance.growthCents, projection.currency)}</td>
                <td className="num">{formatCurrency(yearlyBalance.balanceCents, projection.currency)}</td>
                <td className="num">{isFirstItemForYear ? formatCurrency(combinedBalanceCents, projection.currency) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function formatPhase(phase: string | undefined) {
  if (!phase) {
    return ''
  }
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}
