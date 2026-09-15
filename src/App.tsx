import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  createFinancialItem,
  deleteFinancialItem,
  FinancialItem,
  FinancialItemPayload,
  listFinancialItems,
  updateFinancialItem,
} from './financialItemsApi'

const emptyForm = {
  name: '',
  amount: '',
  currency: 'USD',
  annualReturnRate: '',
  annualContribution: '',
  sortOrder: '0',
}

type FormState = typeof emptyForm

function App() {
  const [items, setItems] = useState<FinancialItem[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [staleMessage, setStaleMessage] = useState<string | null>(null)

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, items],
  )

  useEffect(() => {
    void loadItems()
  }, [])

  async function loadItems() {
    setIsLoading(items.length === 0)
    setStaleMessage(null)
    setErrorMessage(null)

    try {
      const nextItems = await listFinancialItems()
      setItems(nextItems)
    } catch (error) {
      const message = getErrorMessage(error)
      if (items.length > 0) {
        setStaleMessage(`Data is updating. Showing the last successful list. ${message}`)
      } else {
        setErrorMessage(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)
    setStaleMessage(null)

    try {
      const payload = formToPayload(form)
      if (editingItemId) {
        const updatedItem = await updateFinancialItem(editingItemId, payload)
        setItems((currentItems) =>
          currentItems.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
        )
      } else {
        const createdItem = await createFinancialItem(payload)
        setItems((currentItems) => [...currentItems, createdItem].sort(compareFinancialItems))
      }
      resetForm()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(item: FinancialItem) {
    setErrorMessage(null)
    setStaleMessage(null)

    try {
      await deleteFinancialItem(item.id)
      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id))
      if (editingItemId === item.id) {
        resetForm()
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  function startEditing(item: FinancialItem) {
    setEditingItemId(item.id)
    setForm({
      name: item.name,
      amount: centsToDollarsInput(item.amountCents),
      currency: item.currency,
      annualReturnRate: basisPointsToPercentInput(item.annualReturnRateBasisPoints),
      annualContribution: centsToDollarsInput(item.annualContributionCents),
      sortOrder: String(item.sortOrder),
    })
  }

  function resetForm() {
    setEditingItemId(null)
    setForm(emptyForm)
  }

  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="app-title">
        <p className="eyebrow">Step 8: Financial items CRUD</p>
        <h1 id="app-title">Financials Planner</h1>
        <p className="lede">
          Manage fake/example financial planning inputs through the local Financials API.
        </p>
      </section>

      <section className="content-grid" aria-label="Financial items workspace">
        <form className="item-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">{editingItem ? 'Edit item' : 'Add item'}</p>
            <h2>{editingItem ? `Editing ${editingItem.name}` : 'Financial item details'}</h2>
          </div>

          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Example brokerage"
              required
            />
          </label>

          <div className="form-row">
            <label>
              Current amount
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="12500"
                required
              />
            </label>
            <label>
              Currency
              <input
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
                maxLength={3}
                required
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Annual return
              <input
                inputMode="decimal"
                value={form.annualReturnRate}
                onChange={(event) => setForm({ ...form, annualReturnRate: event.target.value })}
                placeholder="7"
                required
              />
            </label>
            <label>
              Annual contribution
              <input
                inputMode="decimal"
                value={form.annualContribution}
                onChange={(event) => setForm({ ...form, annualContribution: event.target.value })}
                placeholder="3000"
                required
              />
            </label>
          </div>

          <label>
            Sort order
            <input
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              required
            />
          </label>

          {errorMessage ? <p className="status-message error">{errorMessage}</p> : null}

          <div className="form-actions">
            <button type="submit" disabled={isSaving}>
              {editingItem ? 'Save item' : 'Add item'}
            </button>
            {editingItem ? (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <section className="items-panel" aria-labelledby="items-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">API-backed list</p>
              <h2 id="items-heading">Financial items</h2>
            </div>
            <button type="button" className="secondary" onClick={() => void loadItems()}>
              Refresh
            </button>
          </div>

          {isLoading ? <p className="status-message">Loading financial items…</p> : null}
          {staleMessage ? <p className="status-message warning">{staleMessage}</p> : null}

          {!isLoading && items.length === 0 ? (
            <p className="empty-state">No financial items yet. Add an example planning input to get started.</p>
          ) : null}

          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id} className="item-card">
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {formatCurrency(item.amountCents, item.currency)} · {formatRate(item.annualReturnRateBasisPoints)} return ·{' '}
                    {formatCurrency(item.annualContributionCents, item.currency)} annual contribution
                  </p>
                </div>
                <div className="item-actions">
                  <button type="button" className="secondary" onClick={() => startEditing(item)}>
                    Edit {item.name}
                  </button>
                  <button type="button" className="danger" onClick={() => void handleDelete(item)}>
                    Delete {item.name}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}

function formToPayload(form: FormState): FinancialItemPayload {
  return {
    name: form.name.trim(),
    amountCents: dollarsToCents(form.amount),
    currency: form.currency.trim().toUpperCase(),
    annualReturnRateBasisPoints: percentToBasisPoints(form.annualReturnRate),
    annualContributionCents: dollarsToCents(form.annualContribution),
    sortOrder: Number.parseInt(form.sortOrder, 10),
  }
}

function compareFinancialItems(left: FinancialItem, right: FinancialItem) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }
  return left.id.localeCompare(right.id)
}

function dollarsToCents(value: string) {
  return Math.round(Number.parseFloat(value || '0') * 100)
}

function centsToDollarsInput(value: number) {
  return (value / 100).toFixed(2).replace(/\.00$/, '')
}

function percentToBasisPoints(value: string) {
  return Math.round(Number.parseFloat(value || '0') * 100)
}

function basisPointsToPercentInput(value: number) {
  return (value / 100).toFixed(2).replace(/\.00$/, '')
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

function formatRate(basisPoints: number) {
  return `${(basisPoints / 100).toFixed(2)}%`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default App
