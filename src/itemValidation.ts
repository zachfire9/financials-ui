// Validation shared by backup import and the saved browser session. Mirrors the
// API's rules so bad data is rejected with a clear message instead of loading
// something that can't be displayed or projected.

export const currencyCodePattern = /^[A-Z]{3}$/

const minimumReturnRateBasisPoints = -10000
const maximumReturnRateBasisPoints = 100000
const maximumOwnerIDLength = 64

// Checks one imported backup item against the same rules the API enforces, so
// a hand-edited or corrupted file is rejected with a clear message instead of
// loading data that can't be displayed or projected.
export function importedItemProblems(item: unknown, index: number): string[] {
  const label = `Item ${index + 1}:`
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return [`${label} must be an object.`]
  }

  const value = item as Record<string, unknown>
  const problems: string[] = []
  const isInteger = (field: string) => Number.isInteger(value[field])
  const isMissing = (field: string) => value[field] === undefined || value[field] === null

  if (typeof value.name !== 'string' || value.name.trim() === '') {
    problems.push(`${label} name is required.`)
  }
  if (!isInteger('amountCents') || (value.amountCents as number) < 0) {
    problems.push(`${label} amountCents must be a whole number of cents, 0 or more.`)
  }
  if (typeof value.currency !== 'string' || !currencyCodePattern.test(value.currency)) {
    problems.push(`${label} currency must be a 3-letter code such as USD.`)
  }
  for (const field of ['annualReturnRateBasisPoints', 'drawdownAnnualReturnRateBasisPoints']) {
    if (field === 'drawdownAnnualReturnRateBasisPoints' && isMissing(field)) {
      continue
    }
    const rate = value[field] as number
    if (!isInteger(field) || rate < minimumReturnRateBasisPoints || rate > maximumReturnRateBasisPoints) {
      problems.push(
        `${label} ${field} must be a whole number from ${minimumReturnRateBasisPoints} to ${maximumReturnRateBasisPoints}.`,
      )
    }
  }
  if (!isInteger('annualContributionCents') || (value.annualContributionCents as number) < 0) {
    problems.push(`${label} annualContributionCents must be a whole number of cents, 0 or more.`)
  }
  if (!isMissing('sortOrder') && (!isInteger('sortOrder') || (value.sortOrder as number) < 0)) {
    problems.push(`${label} sortOrder must be a whole number, 0 or more.`)
  }
  if (!isMissing('inflateAnnualContribution') && typeof value.inflateAnnualContribution !== 'boolean') {
    problems.push(`${label} inflateAnnualContribution must be true or false.`)
  }
  if (
    !isMissing('ownerId') &&
    (typeof value.ownerId !== 'string' || value.ownerId.length > maximumOwnerIDLength || value.ownerId.trim() !== value.ownerId)
  ) {
    problems.push(`${label} ownerId must be text of at most ${maximumOwnerIDLength} characters.`)
  }

  return problems
}
