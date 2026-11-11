import { useState } from 'react'
import { BalanceChart } from './charts/BalanceChart'
import { ExpensesChart } from './charts/ExpensesChart'
import { FlowsChart } from './charts/FlowsChart'
import { MortgageChart } from './charts/MortgageChart'
import type { Projection, ProjectionPerson } from './financialItemsApi'
import { formatCompactCurrency, formatCurrency, pluralize } from './format'
import { displayName, firstToRetire, lastToRetire } from './household'

type ProjectionResultsProps = {
  projection: Projection
  colorFor: (itemId: string, index: number) => string
  // The household people the projection was calculated with, if any.
  people?: ProjectionPerson[] | null
}

export function ProjectionResults({ projection, colorFor, people = null }: ProjectionResultsProps) {
  const [showTable, setShowTable] = useState(false)
  const totals = projection.totals
  const startYear = totals[0]
  const finalYear = totals[totals.length - 1]
  const peakYear = totals.reduce((peak, total) => (total.balanceCents > peak.balanceCents ? total : peak), startYear)
  const savingYears = projection.savingYears ?? 0
  const drawdownYears = projection.drawdownYears ?? 0
  const transitionYears = projection.transitionYears ?? 0
  // Full withdrawals start after this year; it equals savingYears unless people
  // retire at different times.
  const bothRetiredAfter = savingYears + transitionYears
  const stillWorking = people ? lastToRetire(people) : null
  const retiredFirst = people ? firstToRetire(people) : null
  const stillWorkingName = stillWorking ? displayName(stillWorking.name) : 'one of you'
  const shortfallYears = totals.filter((total) => (total.unfundedWithdrawalCents ?? 0) > 0)
  const firstShortfallYear = shortfallYears[0]
  const totalShortfallCents = shortfallYears.reduce((sum, total) => sum + (total.unfundedWithdrawalCents ?? 0), 0)
  const hasWithdrawals = totals.some(
    (total) => total.phase === 'drawdown' || (total.phase === 'transition' && (total.withdrawalCents ?? 0) > 0),
  )
  // Money that existed but couldn't be withdrawn in the first short year, for
  // example a 401(k) of someone still working.
  const lockedAtShortfallCents = firstShortfallYear?.lockedBalanceCents ?? 0
  const shortfallWhileWorking = Boolean(firstShortfallYear) && transitionYears > 0 && firstShortfallYear.year <= bothRetiredAfter
  const currency = projection.currency

  return (
    <div className="projection-results">
      <section className="projection-summary" aria-label="Projection summary">
        <h2 className="projection-headline">{headline()}</h2>
        {transitionYears > 0 && retiredFirst && stillWorking ? (
          <p className="projection-timeline">
            {displayName(retiredFirst.name)} retires after year {retiredFirst.savingYears} and {displayName(stillWorking.name)} after
            year {stillWorking.savingYears}.
          </p>
        ) : null}
        <dl className="projection-facts">
          <div>
            <dt>Today</dt>
            <dd>{formatCompactCurrency(startYear.balanceCents, currency)}</dd>
          </div>
          {peakYear.year > 0 ? (
            <div>
              <dt>Peak, year {peakYear.year}</dt>
              <dd>{formatCompactCurrency(peakYear.balanceCents, currency)}</dd>
            </div>
          ) : null}
          <div>
            <dt>At year {finalYear.year}</dt>
            <dd>{formatCompactCurrency(finalYear.balanceCents, currency)}</dd>
          </div>
          {projection.mortgage ? (
            <div>
              <dt>Mortgage</dt>
              <dd>{projection.mortgage.payoffYear > 0 ? `Paid off, year ${projection.mortgage.payoffYear}` : 'Not paid off'}</dd>
            </div>
          ) : null}
        </dl>
        {firstShortfallYear ? (
          <p className="funding-status shortfall">
            <span aria-hidden="true">⚠ </span>
            <strong>Withdrawals run short starting in year {firstShortfallYear.year}</strong> (
            {shortfallWhileWorking
              ? `while ${stillWorkingName} is still working`
              : `drawdown year ${firstShortfallYear.year - bothRetiredAfter}`}
            ). {formatCurrency(totalShortfallCents, currency)} of planned withdrawals can't be covered over the projection.
            {lockedAtShortfallCents > 0
              ? ` That year, ${formatCurrency(lockedAtShortfallCents, currency)} was still in accounts you can’t withdraw from yet.`
              : ''}
          </p>
        ) : hasWithdrawals ? (
          <p className="funding-status funded">
            <span aria-hidden="true">✓ </span>
            All planned withdrawals are fully funded through year {finalYear.year}.
          </p>
        ) : null}
      </section>

      <BalanceChart projection={projection} colorFor={colorFor} stillWorkingName={stillWorking ? stillWorkingName : null} />
      <FlowsChart projection={projection} />
      <ExpensesChart projection={projection} />
      <MortgageChart projection={projection} />

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
    const left = formatCompactCurrency(finalYear.balanceCents, currency)
    const afterBoth = transitionYears > 0 ? ' after you’ve both retired' : ''
    if (firstShortfallYear) {
      if (shortfallWhileWorking) {
        return `Your money runs short in year ${firstShortfallYear.year}, while ${stillWorkingName} is still working.`
      }
      const coveredYears = Math.max(0, firstShortfallYear.year - bothRetiredAfter - 1)
      if (coveredYears > 0) {
        return `Your money covers ${coveredYears} of ${pluralize(drawdownYears, 'year')} of withdrawals${afterBoth}.`
      }
      return transitionYears > 0
        ? 'Your withdrawals run short in the first year after you’ve both retired.'
        : 'Your withdrawals run short in the first year of drawdown.'
    }
    if (hasWithdrawals && drawdownYears > 0) {
      if (transitionYears > 0) {
        return drawdownYears === 1
          ? `Your money lasts the full year after you’ve both retired, with ${left} left.`
          : `Your money lasts all ${drawdownYears} years after you’ve both retired, with ${left} left.`
      }
      return drawdownYears === 1
        ? `Your money lasts the full year of drawdown, with ${left} left.`
        : `Your money lasts all ${drawdownYears} years, with ${left} left.`
    }
    return `You'd have ${formatCompactCurrency(finalYear.balanceCents, currency)} after ${pluralize(finalYear.year, 'year')}.`
  }
}

function YearlyTable({ projection, hasShortfall }: { projection: Projection; hasShortfall: boolean }) {
  const mortgageByYear = new Map((projection.mortgage?.years ?? []).map((entry) => [entry.year, entry]))
  const hasMortgage = mortgageByYear.size > 0
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
            {hasMortgage ? <th scope="col" className="num">Mortgage owed</th> : null}
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
                {hasMortgage ? (
                  <td className="num">
                    {isFirstItemForYear ? formatCurrency(mortgageByYear.get(year)?.balanceCents ?? 0, projection.currency) : ''}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function formatPhase(phase: string | undefined) {
  if (!phase) {
    return ''
  }
  if (phase === 'transition') {
    return 'One retired'
  }
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}
