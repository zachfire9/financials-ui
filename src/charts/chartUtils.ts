import { useEffect, useRef, useState } from 'react'

// Account colors: the validated categorical palette, in fixed slot order.
// Validated against the chart surface (#fcfdfc): adjacent CVD ΔE >= 9.1,
// normal-vision ΔE >= 19.6. Aqua, yellow and magenta sit below 3:1 contrast,
// so every chart pairs color with a legend, labels and the yearly table.
export const accountColors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

// Accounts past the eighth share one neutral color instead of a generated hue.
export const otherAccountColor = '#8a8f8d'

// Money in and out each year. Validated as a set: adjacent CVD ΔE >= 16.9,
// normal-vision ΔE >= 19.2.
export const flowColors = {
  contributions: '#256abf',
  growth: '#6da7ec',
  withdrawals: '#eb6834',
  shortfall: '#a12a2a',
}

// The mortgage balance, a lone series on its own chart. Validated on the
// chart surface: lightness, chroma and >= 3:1 contrast pass.
export const mortgageColor = '#a8611c'

export type LinearScale = {
  (value: number): number
  ticks: number[]
}

/** Maps [0, max] onto [rangeStart, rangeEnd] with rounded, human tick values. */
export function linearScale(min: number, max: number, rangeStart: number, rangeEnd: number, tickCount = 5): LinearScale {
  const ticks = niceTicks(min, max, tickCount)
  const domainMin = ticks[0]
  const domainMax = ticks[ticks.length - 1]
  const span = domainMax - domainMin || 1
  const scale = ((value: number) => rangeStart + ((value - domainMin) / span) * (rangeEnd - rangeStart)) as LinearScale
  scale.ticks = ticks
  return scale
}

export function niceTicks(min: number, max: number, count: number) {
  if (max <= min) {
    return min === 0 ? [0, 1] : [Math.min(0, min), Math.max(0, min) || 1]
  }
  const rawStep = (max - min) / Math.max(1, count)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((multiple) => multiple * magnitude).find((candidate) => candidate >= rawStep) ?? 10 * magnitude
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6)
  }
  return ticks
}

/** Year ticks that stay readable from a 5-year to a 75-year projection. */
export function yearTicks(lastYear: number) {
  const step = lastYear <= 12 ? 1 : lastYear <= 30 ? 5 : 10
  const ticks: number[] = []
  for (let year = 0; year <= lastYear; year += step) {
    ticks.push(year)
  }
  return ticks
}

/** Tracks an element's width so SVG charts can draw at real pixel size. */
export function useElementWidth<T extends HTMLElement>(fallback = 760) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const measure = () => {
      const measured = element.getBoundingClientRect().width
      if (measured > 0) {
        setWidth(Math.round(measured))
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

/**
 * A bar segment with 4px rounding only on its outer data end; the end at the
 * baseline (or against the neighboring segment) stays square.
 */
export function barSegmentPath(x: number, y: number, width: number, height: number, roundedEnd: 'top' | 'bottom' | 'none') {
  const r = Math.min(4, width / 2, height)
  if (roundedEnd === 'none' || r <= 0) {
    return `M${x},${y}h${width}v${height}h${-width}Z`
  }
  if (roundedEnd === 'top') {
    return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
  }
  return `M${x},${y}H${x + width}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x + r}Q${x},${y + height} ${x},${y + height - r}Z`
}
