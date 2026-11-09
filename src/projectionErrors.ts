// Turns projection API errors into plain language. Problems that belong to a
// projection setting become field errors; the rest become a short message.

export type ProjectionField =
  | 'savingYears'
  | 'drawdownYears'
  | 'annualWithdrawal'
  | 'withdrawalInflationRate'
  | 'gapWithdrawal'
  | 'personName0'
  | 'personYears0'
  | 'personName1'
  | 'personYears1'

export const maximumProjectionYears = 75
export const maximumInflationPercent = 1000

export const projectionMessages = {
  years: `Enter a whole number of years from 0 to ${maximumProjectionYears}.`,
  noYears: 'Add at least one saving or drawdown year.',
  personName: 'Enter a name.',
  withdrawalRequired: 'Enter how much to withdraw each year, or set drawdown years to 0.',
  dollarAmount: 'Enter a dollar amount like 1,000 or 1000.50.',
  inflation: 'Enter a percentage of 0 or more, like 3.',
  inflationRange: `Enter a percentage from 0 to ${maximumInflationPercent.toLocaleString('en-US')}.`,
}

const accountFieldNames: Record<string, string> = {
  name: 'name',
  amountCents: 'current amount',
  currency: 'currency code',
  annualReturnRateBasisPoints: 'annual return',
  drawdownAnnualReturnRateBasisPoints: 'drawdown return',
  annualContributionCents: 'annual contribution',
  sortOrder: 'position in the list',
  ownerId: 'owner',
}

export type TranslatedProjectionError = {
  fieldErrors: Partial<Record<ProjectionField, string>>
  messages: string[]
}

/**
 * @param message the error message from the API client
 * @param accountNames account names in the order they were sent, used to name
 *   the account behind an "items[N]" problem
 */
export function translateProjectionError(message: string, accountNames: string[] = []): TranslatedProjectionError {
  const result: TranslatedProjectionError = { fieldErrors: {}, messages: [] }
  const prefix = 'invalid projection request: '

  if (!message.startsWith(prefix)) {
    result.messages.push(translateServiceError(message))
    return result
  }

  for (const problem of message.slice(prefix.length).split('; ')) {
    const item = /^items\[(\d+)\]\.(\w+)/.exec(problem)
    const person = /^people\[([01])\]\.(\w+)/.exec(problem)
    if (item) {
      const index = Number(item[1])
      const account = accountNames[index] ? `“${accountNames[index]}”` : `Account ${index + 1}`
      const field = accountFieldNames[item[2]] ?? item[2]
      result.messages.push(`${account} has an invalid ${field}. Edit it in the accounts list.`)
    } else if (person && (person[2] === 'savingYears' || person[2] === 'name')) {
      const field = (person[2] === 'name' ? `personName${person[1]}` : `personYears${person[1]}`) as ProjectionField
      result.fieldErrors[field] = person[2] === 'name' ? projectionMessages.personName : projectionMessages.years
    } else if (/^gapAnnualWithdrawalCents/.test(problem)) {
      result.fieldErrors.gapWithdrawal = projectionMessages.dollarAmount
    } else if (/^savingYears must be between/.test(problem)) {
      result.fieldErrors.savingYears = projectionMessages.years
    } else if (/^drawdownYears must be between/.test(problem)) {
      result.fieldErrors.drawdownYears = projectionMessages.years
    } else if (/must include at least one projected year/.test(problem)) {
      result.fieldErrors.drawdownYears = projectionMessages.noYears
    } else if (/^annualWithdrawalCents is required/.test(problem)) {
      result.fieldErrors.annualWithdrawal = projectionMessages.withdrawalRequired
    } else if (/^annualWithdrawalCents must be/.test(problem)) {
      result.fieldErrors.annualWithdrawal = projectionMessages.dollarAmount
    } else if (/^annualWithdrawalInflationRateBasisPoints must be between/.test(problem)) {
      result.fieldErrors.withdrawalInflationRate = projectionMessages.inflationRange
    } else if (/^items are required/.test(problem)) {
      result.messages.push('Add at least one account before calculating.')
    } else if (/^all items must use the same currency/.test(problem)) {
      result.messages.push('All accounts need the same currency to be projected together.')
    } else {
      result.messages.push(asSentence(problem))
    }
  }
  return result
}

function translateServiceError(message: string) {
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'The projection service couldn’t be reached. Check that it’s running and try again.'
  }
  if (/access token/i.test(message)) {
    return 'The projection service didn’t accept this site’s access token.'
  }
  if (/status 429|too many requests/i.test(message)) {
    return 'Too many requests in a short time. Wait a moment and try again.'
  }
  if (/^Request failed with status 5\d\d/.test(message)) {
    return 'The projection service hit an error. Try again in a moment.'
  }
  return asSentence(message)
}

function asSentence(text: string) {
  const trimmed = text.trim()
  if (trimmed === '') {
    return 'Something went wrong. Try again.'
  }
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`
}
