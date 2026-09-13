import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from './App'

describe('App shell', () => {
  it('explains the first UI milestone', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /financials planner/i })).toBeInTheDocument()
    expect(screen.getByText(/connect to the financial-items api/i)).toBeInTheDocument()
    expect(screen.getByText(/vite \+ react \+ typescript/i)).toBeInTheDocument()
  })
})
