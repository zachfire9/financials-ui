import { describe, expect, it } from 'vitest'
import { translateProjectionError } from './projectionErrors'

describe('translateProjectionError', () => {
  it('maps setting problems to field errors', () => {
    const result = translateProjectionError(
      'invalid projection request: savingYears must be between 0 and 75; savingYears and drawdownYears must include at least one projected year; annualWithdrawalCents is required when drawdownYears is greater than 0; annualWithdrawalInflationRateBasisPoints must be between 0 and 100000',
    )
    expect(result.fieldErrors).toEqual({
      savingYears: 'Enter a whole number of years from 0 to 75.',
      drawdownYears: 'Add at least one saving or drawdown year.',
      annualWithdrawal: 'Enter how much to withdraw each year, or set drawdown years to 0.',
      withdrawalInflationRate: 'Enter a percentage from 0 to 1,000.',
    })
    expect(result.messages).toEqual([])
  })

  it('names the account behind an item problem', () => {
    const result = translateProjectionError('invalid projection request: items[1].currency must be a 3-letter uppercase code such as USD', [
      'Brokerage',
      'Savings',
    ])
    expect(result.messages).toEqual(['“Savings” has an invalid currency code. Edit it in the accounts list.'])
    expect(translateProjectionError('invalid projection request: items[4].amountCents must be greater than or equal to 0').messages).toEqual([
      'Account 5 has an invalid current amount. Edit it in the accounts list.',
    ])
  })

  it('explains service failures without API jargon', () => {
    expect(translateProjectionError('Failed to fetch').messages).toEqual([
      'The projection service couldn’t be reached. Check that it’s running and try again.',
    ])
    expect(translateProjectionError('Request failed with status 502').messages).toEqual([
      'The projection service hit an error. Try again in a moment.',
    ])
    expect(translateProjectionError('missing or invalid access token').messages).toEqual([
      'The projection service didn’t accept this site’s access token.',
    ])
    expect(translateProjectionError('Request failed with status 429').messages).toEqual([
      'Too many requests in a short time. Wait a moment and try again.',
    ])
  })

  it('keeps unknown problems readable', () => {
    expect(translateProjectionError('invalid projection request: something new went wrong').messages).toEqual([
      'Something new went wrong.',
    ])
  })
})
