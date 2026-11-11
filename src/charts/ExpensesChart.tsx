import { KeyboardEvent, useId, useState } from 'react'
import type { Projection } from '../financialItemsApi'
import { formatCompactCurrency, formatWholeCurrency } from '../format'
import { accountColors, barSegmentPath, linearScale, mortgageColor, otherAccountColor, useElementWidth, yearTicks } from './chartUtils'

const height = 260
const margin = { top: 16, right: 20, bottom: 40, left: 68 }
const segmentGap = 2
// Past this many expenses, the rest share one gray "Everything else" series
// rather than a generated hue.
const maximumColoredExpenses = accountColors.length - 1

type Series = { key: string; name: string; color: string }

type YearSpending = {
  year: number
  amounts: Map<string, number>
  mortgage: number
  total: number
}

// Each itemized expense per retirement year, in future dollars, stacked so the
// bars show both what each costs and how the total grows with inflation. The
// mortgage payment sits on top, striped, since it's fixed rather than inflated.
// It spans the whole projection, like the other charts, so years line up.
export function ExpensesChart({ projection }: { projection: Projection }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const titleId = useId()
  const patternId = `${useId()}-mortgage`
  const spending = projection.spending ?? []
  if (!spending.some((entry) => (entry.expenses?.length ?? 0) > 0)) {
    return null
  }

  const currency = projection.currency
  const lastYear = projection.totals[projection.totals.length - 1]?.year ?? spending[spending.length - 1].year

  // Series in the order expenses were entered. Each year lists its expenses
  // in that order, so an expense that starts later goes in right after the
  // one before it in the first year it appears.
  const expenseSeries: Series[] = []
  for (const entry of spending) {
    let insertAt = 0
    for (const expense of entry.expenses ?? []) {
      const key = expense.id || expense.name
      const existing = expenseSeries.findIndex((item) => item.key === key)
      if (existing === -1) {
        expenseSeries.splice(insertAt, 0, { key, name: expense.name, color: '' })
        insertAt += 1
      } else {
        insertAt = existing + 1
      }
    }
  }
  const foldsExtra = expenseSeries.length > accountColors.length
  const coloredCount = foldsExtra ? maximumColoredExpenses : expenseSeries.length
  const seriesKeyFor = new Map<string, string>()
  expenseSeries.forEach((series, index) => {
    seriesKeyFor.set(series.key, index < coloredCount ? series.key : 'everything-else')
    series.color = accountColors[index] ?? otherAccountColor
  })
  const series: Series[] = expenseSeries.slice(0, coloredCount)
  if (foldsExtra) {
    series.push({ key: 'everything-else', name: 'Everything else', color: otherAccountColor })
  }

  const years: YearSpending[] = spending
    .filter((entry) => (entry.expenses?.length ?? 0) > 0)
    .map((entry) => {
      const amounts = new Map<string, number>()
      for (const expense of entry.expenses ?? []) {
        const key = seriesKeyFor.get(expense.id || expense.name) ?? 'everything-else'
        amounts.set(key, (amounts.get(key) ?? 0) + expense.amountCents)
      }
      return { year: entry.year, amounts, mortgage: entry.mortgagePaymentCents, total: entry.expensesCents + entry.mortgagePaymentCents }
    })
  const hasMortgage = years.some((entry) => entry.mortgage > 0)
  const first = years[0]
  const last = years[years.length - 1]

  const plotWidth = Math.max(120, width - margin.left - margin.right)
  const plotBottom = height - margin.bottom
  const y = linearScale(0, Math.max(...years.map((entry) => entry.total)), plotBottom, margin.top, 4)
  // One band per projection year, so bars sit under the same years as the
  // charts above.
  const band = plotWidth / Math.max(1, lastYear)
  const barWidth = Math.max(2, Math.min(24, band - 3))
  const centerX = (year: number) => margin.left + band * (year - 1) + band / 2

  function segmentsFor(entry: YearSpending) {
    const parts: Array<{ key: string; value: number; fill: string }> = series
      .map((item) => ({ key: item.key, value: entry.amounts.get(item.key) ?? 0, fill: item.color }))
      .filter((part) => part.value > 0)
    if (entry.mortgage > 0) {
      parts.push({ key: 'mortgage', value: entry.mortgage, fill: `url(#${patternId})` })
    }
    let cursor = y(0)
    return parts.map((part, index) => {
      const gap = index > 0 ? segmentGap : 0
      const segmentHeight = Math.max(1, y(0) - y(part.value) - gap)
      const top = cursor - segmentHeight - gap
      cursor = top
      return {
        key: part.key,
        fill: part.fill,
        d: barSegmentPath(-barWidth / 2, top, barWidth, segmentHeight, index === parts.length - 1 ? 'top' : 'none'),
      }
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const lastIndex = years.length - 1
    const current = activeIndex ?? -1
    const next =
      event.key === 'ArrowRight' ? Math.min(lastIndex, current + 1)
      : event.key === 'ArrowLeft' ? Math.max(0, current === -1 ? lastIndex : current - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? lastIndex
      : null
    if (next !== null) {
      event.preventDefault()
      setActiveIndex(next)
    } else if (event.key === 'Escape') {
      setActiveIndex(null)
    }
  }

  const active = activeIndex === null ? null : years[activeIndex]
  const tooltipLeft = active ? centerX(active.year) : 0
  const growth =
    years.length > 1
      ? ` ${formatWholeCurrency(first.total, currency)} in year ${first.year}, ${formatWholeCurrency(last.total, currency)} by year ${last.year}.`
      : ''

  return (
    <figure className="chart-card expenses-chart" aria-labelledby={titleId}>
      <div className="chart-header">
        <div>
          <h3 id={titleId}>Retirement expenses</h3>
          <p className="chart-subtitle">
            Each expense per year in future dollars, grown by its inflation rate.{growth}
          </p>
        </div>
      </div>

      <ul className="chart-legend" aria-label="Expenses">
        {series.map((item) => (
          <li key={item.key}>
            <span className="legend-swatch" style={{ background: item.color }} aria-hidden="true" />
            {item.name}
          </li>
        ))}
        {hasMortgage ? (
          <li>
            <span className="legend-swatch legend-swatch-mortgage" aria-hidden="true" />
            Mortgage
          </li>
        ) : null}
      </ul>

      <div
        ref={containerRef}
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label="Retirement expenses by year. Use the left and right arrow keys to read each year."
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={mortgageColor} fillOpacity={0.22} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={mortgageColor} strokeWidth="3" />
            </pattern>
          </defs>
          <g className="chart-grid">
            {y.ticks.map((tick) => (
              <g key={tick}>
                <line x1={margin.left} x2={margin.left + plotWidth} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'baseline' : undefined} />
                <text x={margin.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">
                  {formatCompactCurrency(tick, currency)}
                </text>
              </g>
            ))}
            {yearTicks(lastYear)
              .filter((year) => year > 0)
              .map((year) => (
                <text key={year} x={centerX(year)} y={plotBottom + 22} textAnchor="middle">
                  {year}
                </text>
              ))}
            <text className="axis-title" x={margin.left + plotWidth} y={height - 2} textAnchor="end">
              Years from today
            </text>
          </g>

          <g className="chart-reveal" key={`${years.length}-${last.total}`}>
            {years.map((entry, index) => (
              <g
                key={entry.year}
                transform={`translate(${centerX(entry.year)},0)`}
                className={activeIndex === index ? 'bar active' : activeIndex === null ? 'bar' : 'bar dimmed'}
              >
                {segmentsFor(entry).map((shape) => (
                  <path key={shape.key} d={shape.d} fill={shape.fill} />
                ))}
              </g>
            ))}
          </g>

          {years.map((entry, index) => (
            <rect
              key={entry.year}
              className="chart-hit-area"
              x={centerX(entry.year) - band / 2}
              y={margin.top}
              width={band}
              height={plotBottom - margin.top}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerLeave={() => setActiveIndex(null)}
            />
          ))}
        </svg>

        <div
          className={`chart-tooltip${active ? ' visible' : ''}${tooltipLeft > width * 0.6 ? ' left' : ''}`}
          style={{ left: tooltipLeft, top: margin.top }}
          aria-live="polite"
        >
          {active ? (
            <>
              <p className="tooltip-title">Year {active.year}</p>
              <ul>
                {series.map((item) => {
                  const value = active.amounts.get(item.key) ?? 0
                  return value > 0 ? (
                    <li key={item.key}>
                      <span className="tooltip-key" style={{ background: item.color }} aria-hidden="true" />
                      <span className="tooltip-name">{item.name}</span>
                      <strong>{formatWholeCurrency(value, currency)}</strong>
                    </li>
                  ) : null
                })}
                {active.mortgage > 0 ? (
                  <li>
                    <span className="tooltip-key legend-swatch-mortgage" aria-hidden="true" />
                    <span className="tooltip-name">Mortgage</span>
                    <strong>{formatWholeCurrency(active.mortgage, currency)}</strong>
                  </li>
                ) : null}
                <li className="tooltip-total">
                  <span className="tooltip-name">Total</span>
                  <strong>{formatWholeCurrency(active.total, currency)}</strong>
                </li>
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </figure>
  )
}
