import { describe, expect, it } from 'vitest'
import { parseHundredths, parseWholeNumber } from './numberInput'

describe('parseHundredths', () => {
  it.each([
    ['1000', 100000],
    ['1,000', 100000],
    ['$1,500.25', 150025],
    [' 1 000.5 ', 100050],
    ['.75', 75],
    ['12.', 1200],
    ['0', 0],
    ['7%', 700],
    ['7.25 %', 725],
  ])('parses %s as %d hundredths', (input, expected) => {
    expect(parseHundredths(input)).toBe(expected)
  })

  it('rounds past the second decimal half away from zero without floating-point error', () => {
    expect(parseHundredths('1.005')).toBe(101)
    expect(parseHundredths('1.004')).toBe(100)
    expect(parseHundredths('19.999')).toBe(2000)
    expect(parseHundredths('-1.005', { allowNegative: true })).toBe(-101)
  })

  it('accepts negatives only when allowed', () => {
    expect(parseHundredths('-2.5')).toBeNull()
    expect(parseHundredths('-2.5', { allowNegative: true })).toBe(-250)
    expect(parseHundredths('-0', { allowNegative: true })).toBe(0)
  })

  it.each(['', '   ', 'abc', '1.2.3', '12abc', '$', '-', '.', '1e3', '--1', '1-'])('rejects %j', (input) => {
    expect(parseHundredths(input, { allowNegative: true })).toBeNull()
  })
})

describe('parseWholeNumber', () => {
  it('parses whole numbers within range', () => {
    expect(parseWholeNumber('0', 0, 75)).toBe(0)
    expect(parseWholeNumber(' 30 ', 0, 75)).toBe(30)
    expect(parseWholeNumber('75', 0, 75)).toBe(75)
  })

  it.each(['', '10.5', '-1', '76', 'ten', '1e1'])('rejects %j', (input) => {
    expect(parseWholeNumber(input, 0, 75)).toBeNull()
  })
})
