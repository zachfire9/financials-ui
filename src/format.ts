// Shared money and rate formatting.

export function formatCurrency(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  } catch {
    // Intl throws on malformed currency codes; show plain text instead of
    // crashing the page.
    const amount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
    return `${amount} ${currency}`.trim()
  }
}

/** Whole-dollar amount, e.g. "$185,000" — for account balances in lists. */
export function formatWholeCurrency(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(cents / 100))
  } catch {
    return formatCurrency(cents, currency)
  }
}

/** Compact amount for chart axes, headlines and tooltips: "$1,640", "$850K", "$2.39M". */
export function formatCompactCurrency(cents: number, currency: string) {
  const dollars = cents / 100
  if (Math.abs(dollars) < 10_000) {
    return formatWholeCurrency(cents, currency)
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumSignificantDigits: 3,
    }).format(dollars)
  } catch {
    return formatCurrency(cents, currency)
  }
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatRate(basisPoints: number) {
  const percent = basisPoints / 100
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0$/, '')}%`
}
