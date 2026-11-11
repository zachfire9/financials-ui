import type { ExpenseErrors, ExpenseField, ExpenseForm } from './expenses'
import { maximumExpenses, totalExpensesCents } from './expenses'
import { formatCurrency } from './format'

type ExpenseEditorProps = {
  expenses: ExpenseForm[]
  errors: ExpenseErrors
  currency: string
  inflationPlaceholder: string
  onChange: (id: string, field: ExpenseField, value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

// A row per expense: name, yearly amount, an optional inflation rate of its
// own and an optional "first N years of retirement".
export function ExpenseEditor({ expenses, errors, currency, inflationPlaceholder, onChange, onAdd, onRemove }: ExpenseEditorProps) {
  return (
    <div className="expense-editor">
      <div className="expense-row expense-headings" aria-hidden="true">
        <span>Expense</span>
        <span>Per year</span>
        <span>Inflation (%)</span>
        <span>For the first</span>
        <span />
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
              {input('years', `${label}: number of years`, { inputMode: 'numeric', placeholder: 'All', shortLabel: 'For the first' })}
              <span aria-hidden="true">years</span>
            </div>
            <button type="button" className="text-button" onClick={() => onRemove(expense.id)} aria-label={`Remove ${label}`}>
              Remove
            </button>
          </div>
        )
      })}
      <div className="expense-footer">
        <button type="button" className="text-button" onClick={onAdd} disabled={expenses.length >= maximumExpenses}>
          Add expense
        </button>
        <span className="expense-total">
          Total: <strong>{formatCurrency(totalExpensesCents(expenses), currency)}</strong> a year in today’s dollars
        </span>
      </div>
      <p className="field-help">
        Leave inflation blank to use the plan’s rate, and years blank to include the expense every year of retirement.
      </p>
    </div>
  )
}
