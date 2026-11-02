import { Component, ErrorInfo, ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

// Shows a recoverable message instead of a blank page if rendering throws.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Financials Planner crashed while rendering', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="app-shell">
        <section className="crash-panel" role="alert">
          <h2>Something went wrong</h2>
          <p>The page hit an unexpected error. Reloading usually fixes it.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </section>
      </main>
    )
  }
}
