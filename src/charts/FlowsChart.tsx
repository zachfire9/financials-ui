import { KeyboardEvent, useId, useState } from 'react'
import type { Projection } from '../financialItemsApi'
import { formatCompactCurrency } from '../format'
import { barSegmentPath, flowColors, linearScale, useElementWidth, yearTicks } from './chartUtils'

type FlowKey = keyof typeof flowColors

const flowLabels: Record<FlowKey, string> = {
  contributions: 'Contributions',
  growth: 'Growth',
  withdrawals: 'Withdrawals',
  shortfall: 'Shortfall',
}

const height = 260
const margin = { top: 16, right: 20, bottom: 40, left: 68 }
const segmentGap = 2

type YearFlows = {
  year: number
  contributions: number
  growth: number
  withdrawals: number
  shortfall: number
}

export function FlowsChart({ projection }: { projection: Projection }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const titleId = useId()
  const currency = projection.currency
  const years: YearFlows[] = projection.totals
    .filter((total) => total.year > 0)
    .map((total) => ({
      year: total.year,
      contributions: total.contributionCents,
      growth: total.growthCents,
      withdrawals: total.withdrawalCents ?? 0,
      shortfall: total.unfundedWithdrawalCents ?? 0,
    }))
  if (years.length === 0) {
    return null
  }

  const lastYear = years[years.length - 1].year
  const presentFlows = (Object.keys(flowColors) as FlowKey[]).filter((key) =>
    years.some((entry) => (key === 'growth' ? entry.growth !== 0 : entry[key] > 0)),
  )

  const upward = (entry: YearFlows) => entry.contributions + Math.max(0, entry.growth)
  const downward = (entry: YearFlows) => entry.withdrawals + entry.shortfall + Math.max(0, -entry.growth)
  const plotWidth = Math.max(120, width - margin.left - margin.right)
  const plotBottom = height - margin.bottom
  const y = linearScale(-Math.max(0, ...years.map(downward)), Math.max(0, ...years.map(upward)), plotBottom, margin.top, 4)
  const band = plotWidth / years.length
  const barWidth = Math.max(2, Math.min(24, band - 3))
  const centerX = (index: number) => margin.left + band * index + band / 2
  const zero = y(0)

  function segmentsFor(entry: YearFlows) {
    const up: Array<[FlowKey, number]> = [
      ['contributions', entry.contributions],
      ['growth', Math.max(0, entry.growth)],
    ]
    const down: Array<[FlowKey, number]> = [
      ['growth', Math.max(0, -entry.growth)],
      ['withdrawals', entry.withdrawals],
      ['shortfall', entry.shortfall],
    ]
    const shapes: Array<{ key: string; flow: FlowKey; d: string }> = []
    const visibleUp = up.filter(([, value]) => value > 0)
    let cursor = zero
    visibleUp.forEach(([flow, value], index) => {
      const segmentHeight = Math.max(1, zero - y(value) - (index > 0 ? segmentGap : 0))
      const top = cursor - segmentHeight - (index > 0 ? segmentGap : 0)
      shapes.push({
        key: `up-${flow}`,
        flow,
        d: barSegmentPath(-barWidth / 2, top, barWidth, segmentHeight, index === visibleUp.length - 1 ? 'top' : 'none'),
      })
      cursor = top
    })
    const visibleDown = down.filter(([, value]) => value > 0)
    cursor = zero
    visibleDown.forEach(([flow, value], index) => {
      const segmentHeight = Math.max(1, y(-value) - zero - (index > 0 ? segmentGap : 0))
      const top = cursor + (index > 0 ? segmentGap : 0)
      shapes.push({
        key: `down-${flow}`,
        flow,
        d: barSegmentPath(-barWidth / 2, top, barWidth, segmentHeight, index === visibleDown.length - 1 ? 'bottom' : 'none'),
      })
      cursor = top + segmentHeight
    })
    return shapes
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
  const tooltipLeft = activeIndex === null ? 0 : centerX(activeIndex)
  const ticksByYear = new Set(yearTicks(lastYear))

  return (
    <figure className="chart-card flows-chart" aria-labelledby={titleId}>
      <div className="chart-header">
        <div>
          <h3 id={titleId}>Money in and out each year</h3>
          <p className="chart-subtitle">Contributions and growth add to your balance. Withdrawals take from it.</p>
        </div>
      </div>

      <ul className="chart-legend" aria-label="Flows">
        {presentFlows.map((flow) => (
          <li key={flow}>
            <span className="legend-swatch" style={{ background: flowColors[flow] }} aria-hidden="true" />
            {flow === 'shortfall' ? '⚠ ' : ''}
            {flowLabels[flow]}
          </li>
        ))}
      </ul>

      <div
        ref={containerRef}
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label="Money in and out by year. Use the left and right arrow keys to read each year."
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
            {years.map((entry, index) =>
              ticksByYear.has(entry.year) ? (
                <text key={entry.year} x={centerX(index)} y={plotBottom + 22} textAnchor="middle">
                  {entry.year}
                </text>
              ) : null,
            )}
            <text className="axis-title" x={margin.left + plotWidth} y={height - 2} textAnchor="end">
              Years from today
            </text>
          </g>

          <g className="chart-reveal" key={`${years.length}-${projection.totals[projection.totals.length - 1]?.balanceCents}`}>
            {years.map((entry, index) => (
              <g
                key={entry.year}
                transform={`translate(${centerX(index)},0)`}
                className={activeIndex === index ? 'bar active' : activeIndex === null ? 'bar' : 'bar dimmed'}
              >
                {segmentsFor(entry).map((shape) => (
                  <path key={shape.key} d={shape.d} fill={flowColors[shape.flow]} />
                ))}
              </g>
            ))}
          </g>

          {years.map((entry, index) => (
            <rect
              key={entry.year}
              className="chart-hit-area"
              x={margin.left + band * index}
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
                {presentFlows.map((flow) => {
                  const value = flow === 'growth' ? active.growth : active[flow]
                  if (value === 0) {
                    return null
                  }
                  const signed = flow === 'withdrawals' ? -value : value
                  return (
                    <li key={flow} className={flow === 'shortfall' ? 'tooltip-shortfall' : undefined}>
                      <span className="tooltip-key" style={{ background: flowColors[flow] }} aria-hidden="true" />
                      <span className="tooltip-name">
                        {flow === 'shortfall' ? '⚠ Shortfall' : flowLabels[flow]}
                      </span>
                      <strong>{formatCompactCurrency(signed, currency)}</strong>
                    </li>
                  )
                })}
                <li className="tooltip-total">
                  <span className="tooltip-name">Net change</span>
                  <strong>{formatCompactCurrency(active.contributions + active.growth - active.withdrawals, currency)}</strong>
                </li>
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </figure>
  )
}
