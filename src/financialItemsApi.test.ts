import { describe, expect, it } from 'vitest'
import { normalizeApiBaseUrl } from './financialItemsApi'

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
