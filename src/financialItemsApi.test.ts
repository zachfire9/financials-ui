import { describe, expect, it } from 'vitest'
import { buildRequestHeaders, normalizeApiBaseUrl, normalizeAccessToken } from './financialItemsApi'

describe('API base URL configuration', () => {
  it('defaults to the local Vite proxy path when no deployed API URL is configured', () => {
    expect(normalizeApiBaseUrl(undefined)).toBe('/api')
    expect(normalizeApiBaseUrl('   ')).toBe('/api')
  })

  it('removes a trailing slash from deployed API Gateway URLs', () => {
    expect(normalizeApiBaseUrl('https://example.execute-api.us-east-1.amazonaws.com/')).toBe(
      'https://example.execute-api.us-east-1.amazonaws.com',
    )
  })

  it('keeps path-style proxy base URLs stable for local development', () => {
    expect(normalizeApiBaseUrl('/api/')).toBe('/api')
  })
})

describe('API access token configuration', () => {
  it('normalizes blank access tokens to undefined', () => {
    expect(normalizeAccessToken(undefined)).toBeUndefined()
    expect(normalizeAccessToken('   ')).toBeUndefined()
  })

  it('trims configured access tokens', () => {
    expect(normalizeAccessToken('  example-token  ')).toBe('example-token')
  })

  it('adds the deployed access header when a token is configured', () => {
    expect(buildRequestHeaders({ 'Content-Type': 'application/json' }, 'example-token')).toEqual({
      'Content-Type': 'application/json',
      'X-Financials-Access-Token': 'example-token',
    })
  })

  it('does not add an access header when no token is configured', () => {
    expect(buildRequestHeaders({ 'Content-Type': 'application/json' }, undefined)).toEqual({
      'Content-Type': 'application/json',
    })
  })
})
