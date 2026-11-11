import type { ExpenseErrors, ExpenseField, ExpenseForm } from './expenses'
import { hasExpenseRanges, maximumExpenses, totalExpensesCents, totalExpensesForYearCents } from './expenses'
import { formatCurrency } from './format'

type ExpenseEditorProps = {
  expenses: ExpenseForm[]
  errors: ExpenseErrors
  currency: string
  inflationPlaceholder: string
  // The plan's number of retirement years, shown as the default last year of
  // a range. Null when it isn't a valid number yet (the box is left blank).
  lastYear?: number | null
  onChange: (id: string, field: ExpenseField, value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  // When the plan has a mortgage: what to say about its payments, which the
  // projection adds on its own, so they shouldn't be entered as an expense.
  mortgage?: { amount: string; summary: string } | null
}

// A row per expense: name, yearly amount, an optional inflation rate of its
// own and an optional range of retirement years.
export function ExpenseEditor({
  expenses,
  errors,
  currency,
  inflationPlaceholder,
  lastYear = null,
  onChange,
  onAdd,
  onRemove,
  mortgage = null,
}: ExpenseEditorProps) {
  // Blank until the plan has a valid number of retirement years.
  const lastYearPlaceholder = lastYear && lastYear > 0 ? String(lastYear) : undefined
  return (
    <div className="expense-editor">
      <p className="field-help expense-intro">
        Leave inflation blank to use the plan’s rate. Year 1 is your first year of retirement: leave the years blank for all of
        retirement, or set a range, like 1 to 4 for health insurance before Medicare or 25 onward for long-term care.
        {mortgage ? ' Your mortgage payment is added automatically, so put only property tax, insurance and upkeep under Housing.' : ''}
      </p>
      <div className="expense-row expense-headings" aria-hidden="true">
        <span>Expense</span>
        <span>Per year</span>
        <span>Inflation (%)</span>
        <span>Years of retirement</span>
        {/* Invisible, so this column is as wide as the Remove buttons below. */}
        <span className="expense-heading-spacer">Remove</span>
      </div>
      {expenses.map((expense, index) => {
        const rowErrors = errors[expense.id] ?? {}
        const label = expense.name.trim() || `expense ${index + 1}`
        const errorId = (field: ExpenseField) => `expense-${expense.id}-${field}-error`
        const input = (
          field: ExpenseField,
          ariaLabel: string,
          props: { inputMode: 'text' | 'decimal' | 'numeric'; placeholder?: string; shortLabel?: string },
        ) => (
          <div className="expense-cell">
            {props.shortLabel ? (
              <span className="expense-cell-label" aria-hidden="true">
                {props.shortLabel}
              </span>
            ) : null}
            <input
              aria-label={ariaLabel}
              inputMode={props.inputMode}
              placeholder={props.placeholder}
              value={expense[field]}
              onChange={(event) => onChange(expense.id, field, event.target.value)}
              aria-invalid={rowErrors[field] ? true : undefined}
              aria-describedby={rowErrors[field] ? errorId(field) : undefined}
            />
            {rowErrors[field] ? (
              <span className="field-error" id={errorId(field)}>
                {rowErrors[field]}
              </span>
            ) : null}
          </div>
        )
        return (
          <div className="expense-row" key={expense.id}>
            {input('name', `Expense ${index + 1} name`, { inputMode: 'text' })}
            {input('amount', `${label} per year`, { inputMode: 'decimal', placeholder: '0', shortLabel: 'Per year' })}
            {input('inflationRate', `${label} inflation (%)`, { inputMode: 'decimal', placeholder: inflationPlaceholder, shortLabel: 'Inflation (%)' })}
            <div className="expense-years">
              {input('fromYear', `${label}: first year of retirement`, { inputMode: 'numeric', placeholder: '1', shortLabel: 'Years' })}
              <span aria-hidden="true">to</span>
              {input('toYear', `${label}: last year of retirement`, { inputMode: 'numeric', placeholder: lastYearPlaceholder, shortLabel: '\u00a0' })}
            </div>
            <button type="button" className="text-button" onClick={() => onRemove(expense.id)} aria-label={`Remove ${label}`}>
              Remove
            </button>
          </div>
        )
      })}
      {mortgage ? (
        <div className="expense-row expense-mortgage" role="group" aria-label="Mortgage, added automatically">
          <span className="expense-mortgage-name">Mortgage</span>
          <span className="expense-mortgage-amount">{mortgage.amount}</span>
          <span className="expense-mortgage-summary">{mortgage.summary}</span>
        </div>
      ) : null}
      <div className="expense-footer">
        <button type="button" className="outline-button" onClick={onAdd} disabled={expenses.length >= maximumExpenses}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 1.5v9M1.5 6h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Add expense
        </button>
        {hasExpenseRanges(expenses) ? (
          <span className="expense-total">
            First year of retirement: <strong>{formatCurrency(totalExpensesForYearCents(expenses, 1), currency)}</strong> in today’s
            dollars{mortgage ? ', plus your mortgage' : ''}. It changes as expenses start and stop.
          </span>
        ) : (
          <span className="expense-total">
            Total: <strong>{formatCurrency(totalExpensesCents(expenses), currency)}</strong> a year in today’s dollars
            {mortgage ? ', plus your mortgage' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
