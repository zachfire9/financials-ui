import { Component, ErrorInfo, ReactNode } from 'react'
import { clearSavedSession } from './savedSession'

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
          <div className="form-actions">
            <button type="button" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                clearSavedSession()
                window.location.reload()
              }}
            >
              Clear saved session and reload
            </button>
          </div>
          <p>If reloading shows this again, clearing the session saved in this browser removes the data causing it.</p>
        </section>
      </main>
    )
  }
}
