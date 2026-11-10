import { KeyboardEvent, PointerEvent, useId, useMemo, useState } from 'react'
import type { Projection } from '../financialItemsApi'
import { formatCompactCurrency, formatCurrency } from '../format'
import { linearScale, useElementWidth, yearTicks } from './chartUtils'

type View = 'stacked' | 'lines'

type BalanceChartProps = {
  projection: Projection
  colorFor: (itemId: string, index: number) => string
  // Who is still working during the transition years, for the chart subtitle.
  stillWorkingName?: string | null
}

const height = 340
const margin = { top: 36, right: 20, bottom: 40, left: 68 }

export function BalanceChart({ projection, colorFor, stillWorkingName = null }: BalanceChartProps) {
  const [view, setView] = useState<View>('stacked')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const titleId = useId()
  const currency = projection.currency
  const totals = projection.totals
  const lastYear = Math.max(1, totals[totals.length - 1]?.year ?? 1)
  const savingYears = projection.savingYears ?? 0
  const transitionYears = projection.transitionYears ?? 0
  // Full withdrawals start after this year. Between savingYears and here, one
  // person has retired and the other is still working.
  const bothRetiredAfter = savingYears + transitionYears
  const drawdownYears = projection.drawdownYears ?? 0
  const firstShortfall = totals.find((total) => (total.unfundedWithdrawalCents ?? 0) > 0)

  const series = useMemo(
    () =>
      projection.items.map((item, index) => ({
        key: item.id || `${item.name}-${index}`,
        name: item.name,
        color: colorFor(item.id, index),
        values: totals.map((total) => item.yearlyBalances.find((balance) => balance.year === total.year)?.balanceCents ?? 0),
      })),
    [projection, colorFor, totals],
  )

  // Running totals for the stacked view: stacks[s][i] is the top of band s at year i.
  const stacks = useMemo(() => {
    const running = totals.map(() => 0)
    return series.map((entry) =>
      entry.values.map((value, index) => {
        running[index] += Math.max(0, value)
        return running[index]
      }),
    )
  }, [series, totals])

  const plotWidth = Math.max(120, width - margin.left - margin.right)
  const plotBottom = height - margin.bottom
  const x = (year: number) => margin.left + (year / lastYear) * plotWidth
  const maxValue =
    view === 'stacked'
      ? Math.max(0, ...totals.map((total) => total.balanceCents))
      : Math.max(0, ...series.flatMap((entry) => entry.values))
  const y = linearScale(0, maxValue, plotBottom, margin.top, 5)

  const bandPaths = series.map((entry, s) => {
    const top = stacks[s].map((value, i) => `${x(totals[i].year)},${y(value)}`)
    const bottom = (s === 0 ? totals.map(() => 0) : stacks[s - 1])
      .map((value, i) => `${x(totals[i].year)},${y(value)}`)
      .reverse()
    return { area: `M${top.join('L')}L${bottom.join('L')}Z`, edge: `M${top.join('L')}` }
  })
  const linePaths = series.map((entry) => `M${entry.values.map((value, i) => `${x(totals[i].year)},${y(value)}`).join('L')}`)

  const active = activeIndex === null ? null : totals[activeIndex]
  const markerValues = (index: number) => (view === 'stacked' ? stacks.map((stack) => stack[index]) : series.map((entry) => entry.values[index]))

  function indexFromPointer(event: PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - bounds.left) / Math.max(1, bounds.width)
    const year = Math.round(Math.min(1, Math.max(0, ratio)) * lastYear)
    const index = totals.findIndex((total) => total.year === year)
    return index === -1 ? null : index
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const lastIndex = totals.length - 1
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

  // Annotation labels share the row above the plot. Widths are estimated
  // generously (~7px per character at 12px) so labels never overlap. The
  // drawdown label goes beside its marker on whichever side has room; if it
  // can only fit on the side where the shortfall label sits, the shortfall
  // label drops to a second line inside the shaded zone.
  const compact = width < 560
  const plotRight = margin.left + plotWidth
  const shortfallText = firstShortfall
    ? compact ? `⚠ Short from year ${firstShortfall.year}` : `⚠ Runs short from year ${firstShortfall.year}`
    : ''
  const charWidth = 7
  const labelGap = 8
  const shortfallLabelWidth = shortfallText.length * charWidth
  const phaseText =
    transitionYears > 0
      ? compact ? 'Both retired' : `Both retired after year ${bothRetiredAfter}`
      : compact ? 'Drawdown starts' : `Withdrawals start after year ${savingYears}`
  const phaseLabelWidth = phaseText.length * charWidth
  const phaseX = x(bothRetiredAfter)
  const shortfallLabelStart = firstShortfall ? plotRight - shortfallLabelWidth : plotRight
  const phaseFitsRight = phaseX + labelGap + phaseLabelWidth <= plotRight
  const phaseFitsLeft = phaseX - labelGap - phaseLabelWidth >= labelGap
  const phaseRightClearOfShortfall = phaseX + labelGap + phaseLabelWidth + 16 <= shortfallLabelStart
  const phaseLabelOnRight = phaseFitsRight && (phaseRightClearOfShortfall || !phaseFitsLeft)
  const labelRowY = margin.top - 16
  const shortfallOnSecondLine =
    Boolean(firstShortfall) && bothRetiredAfter > 0 && drawdownYears > 0 && phaseLabelOnRight && !phaseRightClearOfShortfall
  const shortfallLabelY = shortfallOnSecondLine ? margin.top + 16 : labelRowY
  const shortfallLabelX = shortfallOnSecondLine ? plotRight - 6 : plotRight

  const tooltipLeft = active ? x(active.year) : 0
  const tooltipOnLeft = tooltipLeft > width * 0.6

  return (
    <figure className="chart-card balance-chart" aria-labelledby={titleId}>
      <div className="chart-header">
        <div>
          <h3 id={titleId}>Balance over time</h3>
          <p className="chart-subtitle">
            {view === 'stacked' ? 'All accounts stacked into your total.' : 'Each account on its own line.'}
            {transitionYears > 0
              ? ` Shaded years: one of you has retired${stillWorkingName ? ` and ${stillWorkingName} is still working` : ''}.`
              : ''}
          </p>
        </div>
        <div className="view-toggle" role="group" aria-label="Chart view">
          <button type="button" aria-pressed={view === 'stacked'} onClick={() => setView('stacked')}>
            Total
          </button>
          <button type="button" aria-pressed={view === 'lines'} onClick={() => setView('lines')}>
            By account
          </button>
        </div>
      </div>

      <ul className="chart-legend" aria-label="Accounts">
        {series.map((entry) => (
          <li key={entry.key}>
            <span className={view === 'stacked' ? 'legend-swatch' : 'legend-line'} style={{ background: entry.color }} aria-hidden="true" />
            {entry.name}
          </li>
        ))}
      </ul>

      <div
        ref={containerRef}
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label="Balance by year. Use the left and right arrow keys to read each year."
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {firstShortfall ? (
            <g className="shortfall-zone">
              <rect
                x={x(Math.max(0, firstShortfall.year - 1))}
                y={margin.top}
                width={Math.max(0, margin.left + plotWidth - x(Math.max(0, firstShortfall.year - 1)))}
                height={plotBottom - margin.top}
              />
            </g>
          ) : null}

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

          <g className="chart-reveal" key={`${view}-${totals.length}-${totals[totals.length - 1]?.balanceCents}`}>
            {view === 'stacked'
              ? series.map((entry, s) => (
                  <g key={entry.key}>
                    <path d={bandPaths[s].area} fill={entry.color} fillOpacity={0.2} />
                    <path d={bandPaths[s].edge} fill="none" stroke={entry.color} strokeWidth={2} strokeLinejoin="round" />
                  </g>
                ))
              : series.map((entry, s) => (
                  <path key={entry.key} d={linePaths[s]} fill="none" stroke={entry.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
          </g>

          {transitionYears > 0 ? (
            <g className="transition-band">
              <rect x={x(savingYears)} y={margin.top} width={x(bothRetiredAfter) - x(savingYears)} height={plotBottom - margin.top} />
              <line x1={x(savingYears)} x2={x(savingYears)} y1={margin.top} y2={plotBottom} />
            </g>
          ) : null}

          {bothRetiredAfter > 0 && drawdownYears > 0 ? (
            <g className="phase-marker">
              <line x1={phaseX} x2={phaseX} y1={margin.top - 8} y2={plotBottom} />
              <text x={phaseX + (phaseLabelOnRight ? 8 : -8)} y={labelRowY} textAnchor={phaseLabelOnRight ? 'start' : 'end'}>
                {phaseText}
              </text>
            </g>
          ) : null}

          {firstShortfall ? (
            <text className="shortfall-label" x={shortfallLabelX} y={shortfallLabelY} textAnchor="end">
              {shortfallText}
            </text>
          ) : null}

          {active && activeIndex !== null ? (
            <g className="crosshair">
              <line x1={x(active.year)} x2={x(active.year)} y1={margin.top} y2={plotBottom} />
              {markerValues(activeIndex).map((value, s) => (
                <circle key={series[s].key} cx={x(active.year)} cy={y(value)} r={4.5} fill={series[s].color} />
              ))}
            </g>
          ) : null}

          <rect
            className="chart-hit-area"
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotBottom - margin.top}
            onPointerMove={(event) => setActiveIndex(indexFromPointer(event))}
            onPointerLeave={() => setActiveIndex(null)}
          />
        </svg>

        <div
          className={`chart-tooltip${active ? ' visible' : ''}${tooltipOnLeft ? ' left' : ''}`}
          style={{ left: tooltipLeft, top: margin.top }}
          aria-live="polite"
        >
          {active && activeIndex !== null ? (
            <>
              <p className="tooltip-title">
                Year {active.year}
                <span>
                  {active.phase === 'drawdown'
                    ? 'Drawdown'
                    : active.phase === 'transition'
                      ? 'One retired'
                      : active.phase === 'saving'
                        ? 'Saving'
                        : 'Today'}
                </span>
              </p>
              <ul>
                {[...series].reverse().map((entry) => (
                  <li key={entry.key}>
                    <span className="tooltip-key" style={{ background: entry.color }} aria-hidden="true" />
                    <span className="tooltip-name">{entry.name}</span>
                    <strong>{formatCompactCurrency(entry.values[activeIndex], currency)}</strong>
                  </li>
                ))}
                <li className="tooltip-total">
                  <span className="tooltip-name">Total</span>
                  <strong>{formatCurrency(active.balanceCents, currency)}</strong>
                </li>
                {(active.unfundedWithdrawalCents ?? 0) > 0 ? (
                  <li className="tooltip-shortfall">
                    <span className="tooltip-name">⚠ Short this year</span>
                    <strong>{formatCompactCurrency(active.unfundedWithdrawalCents ?? 0, currency)}</strong>
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
