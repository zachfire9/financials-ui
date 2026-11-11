import { KeyboardEvent, useId, useState } from 'react'
import type { MortgageYear, Projection } from '../financialItemsApi'
import { formatCompactCurrency, formatCurrency } from '../format'
import { linearScale, mortgageColor, useElementWidth, yearTicks } from './chartUtils'

const height = 220
const margin = { top: 28, right: 24, bottom: 40, left: 68 }

// The mortgage balance falling to zero, marked where payments switch from
// salary to savings and where it's paid off.
export function MortgageChart({ projection }: { projection: Projection }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const titleId = useId()
  const mortgage = projection.mortgage
  if (!mortgage || mortgage.years.length === 0) {
    return null
  }

  const currency = projection.currency
  const payoffYear = mortgage.payoffYear
  const lastYear = payoffYear > 0 ? payoffYear : mortgage.years[mortgage.years.length - 1].year
  const years: MortgageYear[] = mortgage.years.filter((entry) => entry.year <= lastYear)
  const firstFromSavings = years.find((entry) => entry.paidFromSavings)
  const savingsStart = firstFromSavings ? firstFromSavings.year - 1 : null
  const owedAtEnd = years[years.length - 1].balanceCents

  const plotWidth = Math.max(120, width - margin.left - margin.right)
  const plotBottom = height - margin.bottom
  const y = linearScale(0, Math.max(...years.map((entry) => entry.balanceCents)), plotBottom, margin.top, 4)
  const x = (year: number) => margin.left + (lastYear === 0 ? 0 : (year / lastYear) * plotWidth)
  const line = years.map((entry, index) => `${index === 0 ? 'M' : 'L'}${x(entry.year)},${y(entry.balanceCents)}`).join(' ')
  const area = `${line} L${x(lastYear)},${plotBottom} L${x(0)},${plotBottom} Z`

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
  const tooltipLeft = active ? x(active.year) : 0
  const band = plotWidth / Math.max(1, years.length - 1)
  const payoffText = payoffYear > 0 ? `Paid off in year ${payoffYear}` : null
  const payoffOnLeft = payoffYear > 0 && x(payoffYear) - margin.left > plotWidth * 0.6

  return (
    <figure className="chart-card mortgage-chart" aria-labelledby={titleId}>
      <div className="chart-header">
        <div>
          <h3 id={titleId}>Mortgage</h3>
          <p className="chart-subtitle">
            {payoffYear > 0
              ? `Paid off in year ${payoffYear}.`
              : `${formatCurrency(owedAtEnd, currency)} still owed after year ${lastYear}.`}
            {savingsStart !== null
              ? ` Payments come from savings after year ${savingsStart}.`
              : payoffYear > 0
                ? ' Paid off before retirement, so savings never cover a payment.'
                : ''}
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label="Mortgage balance by year. Use the left and right arrow keys to read each year."
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <g className="chart-grid">
            {y.ticks.map((tick) => (
              <g key={tick}>
                <line x1={margin.left} x2={margin.left + plotWidth} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'baseline' : undefined} />
                <text x={margin.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">
                  {formatCompactCurrency(tick, currency)}
                </text>
              </g>
            ))}
            {yearTicks(lastYear).map((year) => (
              <text key={year} x={x(year)} y={plotBottom + 22} textAnchor="middle">
                {year}
              </text>
            ))}
            <text className="axis-title" x={margin.left + plotWidth} y={height - 2} textAnchor="end">
              Years from today
            </text>
          </g>

          {savingsStart !== null && savingsStart > 0 ? (
            <g className="transition-band">
              <line x1={x(savingsStart)} x2={x(savingsStart)} y1={margin.top} y2={plotBottom} />
            </g>
          ) : null}

          <path d={area} fill={mortgageColor} fillOpacity={0.12} />
          <path d={line} fill="none" stroke={mortgageColor} strokeWidth={2} strokeLinejoin="round" />

          {payoffText ? (
            <g className="phase-marker">
              <line x1={x(payoffYear)} x2={x(payoffYear)} y1={margin.top - 6} y2={plotBottom} />
              <text x={x(payoffYear) + (payoffOnLeft ? -8 : 8)} y={margin.top - 10} textAnchor={payoffOnLeft ? 'end' : 'start'}>
                {payoffText}
              </text>
            </g>
          ) : null}

          {active ? (
            <circle cx={x(active.year)} cy={y(active.balanceCents)} r={4.5} fill={mortgageColor} stroke="var(--surface)" strokeWidth={2} />
          ) : null}

          {years.map((entry, index) => (
            <rect
              key={entry.year}
              className="chart-hit-area"
              x={x(entry.year) - band / 2}
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
                <li>
                  <span className="tooltip-name">Owed</span>
                  <strong>{formatCompactCurrency(active.balanceCents, currency)}</strong>
                </li>
                {active.year > 0 ? (
                  <li>
                    <span className="tooltip-name">{active.paidFromSavings ? 'Paid from savings' : 'Paid from salary'}</span>
                    <strong>{formatCompactCurrency(active.paymentCents, currency)}</strong>
                  </li>
                ) : null}
                {active.year > 0 ? (
                  <li>
                    <span className="tooltip-name">Of which interest</span>
                    <strong>{formatCompactCurrency(active.interestCents, currency)}</strong>
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </figure>
  )
}
