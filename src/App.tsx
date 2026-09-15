import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import {
  calculateProjection,
  createFinancialItem,
  deleteFinancialItem,
  FinancialItem,
  FinancialItemPayload,
  listFinancialItems,
  Projection,
  updateFinancialItem,
} from './financialItemsApi'

const emptyForm = {
  name: '',
  amount: '',
  currency: 'USD',
  annualReturnRate: '',
  annualContribution: '',
}

type FormState = typeof emptyForm

function App() {
  const [items, setItems] = useState<FinancialItem[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [projectionYears, setProjectionYears] = useState('10')
  const [projection, setProjection] = useState<Projection | null>(null)
  const [isCalculatingProjection, setIsCalculatingProjection] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [staleMessage, setStaleMessage] = useState<string | null>(null)
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null)

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
      setItems(nextItems.sort(compareFinancialItems))
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
      if (editingItemId && editingItem) {
        const updatedItem = await updateFinancialItem(
          editingItemId,
          formToPayload(form, editingItem.sortOrder),
        )
        setItems((currentItems) =>
          currentItems
            .map((item) => (item.id === updatedItem.id ? updatedItem : item))
            .sort(compareFinancialItems),
        )
      } else {
        const createdItem = await createFinancialItem(formToPayload(form, nextSortOrder(items)))
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
    })
  }

  function resetForm() {
    setEditingItemId(null)
    setForm(emptyForm)
  }

  function handleDragStart(item: FinancialItem) {
    setDraggingItemId(item.id)
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
  }

  function handleDrop(targetItem: FinancialItem) {
    if (!draggingItemId || draggingItemId === targetItem.id) {
      setDraggingItemId(null)
      return
    }

    const previousItems = items
    const draggedItem = items.find((item) => item.id === draggingItemId)
    if (!draggedItem) {
      setDraggingItemId(null)
      return
    }

    const withoutDraggedItem = items.filter((item) => item.id !== draggingItemId)
    const targetIndex = withoutDraggedItem.findIndex((item) => item.id === targetItem.id)
    const nextItems = [...withoutDraggedItem]
    nextItems.splice(targetIndex, 0, draggedItem)
    const renumberedItems = nextItems.map((item, index) => ({ ...item, sortOrder: index }))

    setDraggingItemId(null)
    setItems(renumberedItems)
    void persistReorderedItems(renumberedItems, previousItems)
  }

  async function persistReorderedItems(nextItems: FinancialItem[], previousItems: FinancialItem[]) {
    setErrorMessage(null)
    setStaleMessage(null)

    try {
      for (const item of nextItems) {
        await updateFinancialItem(item.id, itemToPayload(item))
      }
    } catch (error) {
      setItems(previousItems)
      setErrorMessage(`Could not save the new item order. ${getErrorMessage(error)}`)
    }
  }

  async function handleProjectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCalculatingProjection(true)
    setErrorMessage(null)
    setProjectionMessage(null)

    try {
      const nextProjection = await calculateProjection({ years: Number.parseInt(projectionYears, 10) })
      setProjection(nextProjection)
    } catch (error) {
      const message = getErrorMessage(error)
      if (projection) {
        setProjectionMessage(`Projection is updating. Showing the last successful projection. ${message}`)
      } else {
        setErrorMessage(message)
      }
    } finally {
      setIsCalculatingProjection(false)
    }
  }

  return (
    <main className="app-shell">
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
                placeholder="10000.00"
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
              Annual return (%)
              <input
                inputMode="decimal"
                value={form.annualReturnRate}
                onChange={(event) => setForm({ ...form, annualReturnRate: event.target.value })}
                placeholder="7.00"
                required
              />
            </label>
            <label>
              Annual contribution
              <input
                inputMode="decimal"
                value={form.annualContribution}
                onChange={(event) => setForm({ ...form, annualContribution: event.target.value })}
                placeholder="3000.00"
                required
              />
            </label>
          </div>

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
              {items.length > 1 ? <p className="panel-help">Drag items to reorder them.</p> : null}
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
              <li
                key={item.id}
                className={item.id === draggingItemId ? 'item-card dragging' : 'item-card'}
                draggable
                onDragStart={() => handleDragStart(item)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(item)}
              >
                <div className="item-summary">
                  <span className="drag-handle" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {formatCurrency(item.amountCents, item.currency)} · {formatRate(item.annualReturnRateBasisPoints)} return ·{' '}
                      {formatCurrency(item.annualContributionCents, item.currency)} annual contribution
                    </p>
                  </div>
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

        <section className="projection-panel" aria-labelledby="projection-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Repository-backed projection</p>
              <h2 id="projection-heading">Projection preview</h2>
              <p className="panel-help">Calculate whole-year totals from the current saved financial items.</p>
            </div>
          </div>

          <form className="projection-controls" onSubmit={handleProjectionSubmit}>
            <label>
              Projection years
              <input
                inputMode="numeric"
                min="1"
                max="75"
                required
                value={projectionYears}
                onChange={(event) => setProjectionYears(event.target.value)}
              />
            </label>
            <button type="submit" disabled={isCalculatingProjection || items.length === 0}>
              {isCalculatingProjection ? 'Calculating…' : 'Calculate projection'}
            </button>
          </form>

          {items.length === 0 ? (
            <p className="empty-state">Add financial items before calculating a repository-backed projection.</p>
          ) : null}
          {projectionMessage ? <p className="status-message warning">{projectionMessage}</p> : null}

          {projection ? <ProjectionResults projection={projection} /> : null}
        </section>
      </section>
    </main>
  )
}

function ProjectionResults({ projection }: { projection: Projection }) {
  const finalYear = projection.totals[projection.totals.length - 1]

  return (
    <div className="projection-results">
      <div className="projection-summary-card">
        <p className="eyebrow">Final projected total</p>
        <p className="projection-total">{formatCurrency(finalYear.balanceCents, projection.currency)}</p>
        <p>
          Year {finalYear.year} with {formatCurrency(finalYear.contributionCents, projection.currency)} annual contributions and{' '}
          {formatCurrency(finalYear.growthCents, projection.currency)} growth in the final year.
        </p>
      </div>

      <div className="table-scroll">
        <table>
          <caption>Projection by item and year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Item</th>
              <th scope="col">Contribution</th>
              <th scope="col">Growth</th>
              <th scope="col">Balance</th>
            </tr>
          </thead>
          <tbody>
            {projection.items.flatMap((item) =>
              item.yearlyBalances.map((yearlyBalance) => (
                <tr key={`${item.id || item.name}-${yearlyBalance.year}`}>
                  <td>Year {yearlyBalance.year}</td>
                  <td>{item.name}</td>
                  <td>{formatCurrency(yearlyBalance.contributionCents, projection.currency)}</td>
                  <td>{formatCurrency(yearlyBalance.growthCents, projection.currency)}</td>
                  <td>{formatCurrency(yearlyBalance.balanceCents, projection.currency)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formToPayload(form: FormState, sortOrder: number): FinancialItemPayload {
  return {
    name: form.name.trim(),
    amountCents: dollarsToCents(form.amount),
    currency: form.currency.trim().toUpperCase(),
    annualReturnRateBasisPoints: percentToBasisPoints(form.annualReturnRate),
    annualContributionCents: dollarsToCents(form.annualContribution),
    sortOrder,
  }
}

function itemToPayload(item: FinancialItem): FinancialItemPayload {
  return {
    name: item.name,
    amountCents: item.amountCents,
    currency: item.currency,
    annualReturnRateBasisPoints: item.annualReturnRateBasisPoints,
    annualContributionCents: item.annualContributionCents,
    sortOrder: item.sortOrder,
  }
}

function compareFinancialItems(left: FinancialItem, right: FinancialItem) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }
  return left.id.localeCompare(right.id)
}

function nextSortOrder(items: FinancialItem[]) {
  if (items.length === 0) {
    return 0
  }
  return Math.max(...items.map((item) => item.sortOrder)) + 1
}

function dollarsToCents(value: string) {
  return Math.round(Number.parseFloat(value || '0') * 100)
}

function centsToDollarsInput(value: number) {
  return (value / 100).toFixed(2)
}

function percentToBasisPoints(value: string) {
  return Math.round(Number.parseFloat(value || '0') * 100)
}

function basisPointsToPercentInput(value: number) {
  return (value / 100).toFixed(2)
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
