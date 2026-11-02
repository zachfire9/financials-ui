import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Thrower(): never {
  throw new Error('render failure')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows a recoverable message instead of a blank page when rendering throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Healthy content</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('Healthy content')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
