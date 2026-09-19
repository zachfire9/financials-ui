import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import {
  calculateProjection,
  createFinancialItem,
  deleteFinancialItem,
  exportFinancialItemsBackup,
  FinancialItem,
  FinancialItemPayload,
  importFinancialItemsBackup,
  listFinancialItems,
  Projection,
  updateFinancialItem,
} from './financialItemsApi'

const emptyForm = {
  name: '',
  amount: '',
  currency: 'USD',
  annualReturnRate: '',
  drawdownAnnualReturnRate: '',
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
  const [projectionSavingYears, setProjectionSavingYears] = useState('10')
  const [projectionDrawdownYears, setProjectionDrawdownYears] = useState('0')
  const [projectionAnnualWithdrawal, setProjectionAnnualWithdrawal] = useState('0.00')
  const [projectionWithdrawalInflationRate, setProjectionWithdrawalInflationRate] = useState('3.00')
  const [inflateAnnualContributions, setInflateAnnualContributions] = useState(false)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [isCalculatingProjection, setIsCalculatingProjection] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [staleMessage, setStaleMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
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

  async function handleBackupExport() {
    setBackupMessage(null)
    setErrorMessage(null)

    try {
      const backup = await exportFinancialItemsBackup()
      downloadJSONBackup(backup)
      setBackupMessage('Backup exported. Keep real financial backup JSON out of git.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleBackupImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setBackupMessage(null)
    setErrorMessage(null)
    setStaleMessage(null)

    try {
      const text = await readTextFile(file)
      const backup = JSON.parse(text)
      const importedItems = await importFinancialItemsBackup(backup)
      setItems(importedItems.sort(compareFinancialItems))
      setProjection(null)
      setBackupMessage('Backup imported. Financial items and projections were refreshed.')
    } catch (error) {
      setErrorMessage(`Could not import backup. ${getErrorMessage(error)}`)
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
      drawdownAnnualReturnRate:
        item.drawdownAnnualReturnRateBasisPoints === undefined
          ? ''
          : basisPointsToPercentInput(item.drawdownAnnualReturnRateBasisPoints),
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
      const nextProjection = await calculateProjection({
        savingYears: Number.parseInt(projectionSavingYears, 10),
        drawdownYears: Number.parseInt(projectionDrawdownYears || '0', 10),
        annualWithdrawalCents: dollarsToCents(projectionAnnualWithdrawal),
        annualWithdrawalInflationRateBasisPoints: percentToBasisPoints(projectionWithdrawalInflationRate),
        inflateAnnualContributions,
      })
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
              Drawdown return (%)
              <input
                inputMode="decimal"
                value={form.drawdownAnnualReturnRate}
                onChange={(event) => setForm({ ...form, drawdownAnnualReturnRate: event.target.value })}
                placeholder="Uses annual return when blank"
              />
              <span className="field-help">Uses annual return when blank.</span>
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
            <div className="panel-actions">
              <button type="button" className="secondary" onClick={() => void handleBackupExport()}>
                Export JSON backup
              </button>
              <label className="file-button">
                Import JSON backup
                <input type="file" accept="application/json,.json" onChange={(event) => void handleBackupImport(event)} />
              </label>
              <button type="button" className="secondary" onClick={() => void loadItems()}>
                Refresh
              </button>
            </div>
          </div>

          {isLoading ? <p className="status-message">Loading financial items…</p> : null}
          {staleMessage ? <p className="status-message warning">{staleMessage}</p> : null}
          {backupMessage ? <p className="status-message">{backupMessage}</p> : null}

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
                      {formatDrawdownReturn(item)} · {formatCurrency(item.annualContributionCents, item.currency)} annual contribution
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
              <p className="panel-help">Calculate saving and drawdown years from the current saved financial items.</p>
            </div>
          </div>

          <form className="projection-controls" onSubmit={handleProjectionSubmit}>
            <label>
              Saving years
              <input
                inputMode="numeric"
                min="0"
                max="75"
                required
                value={projectionSavingYears}
                onChange={(event) => setProjectionSavingYears(event.target.value)}
              />
            </label>
            <label>
              Drawdown years
              <input
                inputMode="numeric"
                min="0"
                max="75"
                required
                value={projectionDrawdownYears}
                onChange={(event) => setProjectionDrawdownYears(event.target.value)}
              />
            </label>
            <label>
              Annual withdrawal
              <input
                inputMode="decimal"
                value={projectionAnnualWithdrawal}
                onChange={(event) => setProjectionAnnualWithdrawal(event.target.value)}
                placeholder="60000.00"
                required
              />
            </label>
            <label>
              Withdrawal inflation (%)
              <input
                inputMode="decimal"
                value={projectionWithdrawalInflationRate}
                onChange={(event) => setProjectionWithdrawalInflationRate(event.target.value)}
                placeholder="3.00"
                required
              />
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={inflateAnnualContributions}
                onChange={(event) => setInflateAnnualContributions(event.target.checked)}
              />
              Grow contributions by withdrawal inflation
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
  const rows = projection.totals.flatMap((total) =>
    projection.items.map((item, itemIndex) => ({
      annualWithdrawalCents: total.withdrawalCents ?? 0,
      combinedBalanceCents: total.balanceCents,
      isFirstItemForYear: itemIndex === 0,
      item,
      yearlyBalance: item.yearlyBalances.find((yearlyBalance) => yearlyBalance.year === total.year),
      year: total.year,
    })),
  )

  return (
    <div className="projection-results">
      <div className="projection-summary-card">
        <p className="eyebrow">Final projected total</p>
        <p className="projection-total">{formatCurrency(finalYear.balanceCents, projection.currency)}</p>
        <p>
          Year {finalYear.year} with {formatCurrency(finalYear.contributionCents, projection.currency)} contributions,{' '}
          {formatCurrency(finalYear.withdrawalCents ?? 0, projection.currency)} withdrawals, and{' '}
          {formatCurrency(finalYear.growthCents, projection.currency)} growth in the final year.
        </p>
      </div>

      <div className="table-scroll">
        <table>
          <caption>Projection by year and item</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Phase</th>
              <th scope="col">Annual withdrawal</th>
              <th scope="col">Item</th>
              <th scope="col">Contribution</th>
              <th scope="col">Withdrawal</th>
              <th scope="col">Growth</th>
              <th scope="col">Item balance</th>
              <th scope="col">Combined balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ annualWithdrawalCents, combinedBalanceCents, isFirstItemForYear, item, yearlyBalance, year }) => {
              if (!yearlyBalance) {
                return null
              }

              return (
                <tr key={`${year}-${item.id || item.name}`}>
                  <td>{isFirstItemForYear ? `Year ${year}` : ''}</td>
                  <td>{isFirstItemForYear ? formatPhase(yearlyBalance.phase) : ''}</td>
                  <td>{isFirstItemForYear ? formatCurrency(annualWithdrawalCents, projection.currency) : ''}</td>
                  <td>{item.name}</td>
                  <td>{formatCurrency(yearlyBalance.contributionCents, projection.currency)}</td>
                  <td>{formatCurrency(yearlyBalance.withdrawalCents ?? 0, projection.currency)}</td>
                  <td>{formatCurrency(yearlyBalance.growthCents, projection.currency)}</td>
                  <td>{formatCurrency(yearlyBalance.balanceCents, projection.currency)}</td>
                  <td>{isFirstItemForYear ? formatCurrency(combinedBalanceCents, projection.currency) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function downloadJSONBackup(backup: unknown) {
  const contents = JSON.stringify(backup, null, 2)
  const blob = new Blob([contents, '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `financials-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsText(file)
  })
}

function formToPayload(form: FormState, sortOrder: number): FinancialItemPayload {
  const payload: FinancialItemPayload = {
    name: form.name.trim(),
    amountCents: dollarsToCents(form.amount),
    currency: form.currency.trim().toUpperCase(),
    annualReturnRateBasisPoints: percentToBasisPoints(form.annualReturnRate),
    annualContributionCents: dollarsToCents(form.annualContribution),
    sortOrder,
  }

  if (form.drawdownAnnualReturnRate.trim() !== '') {
    payload.drawdownAnnualReturnRateBasisPoints = percentToBasisPoints(form.drawdownAnnualReturnRate)
  }

  return payload
}

function itemToPayload(item: FinancialItem): FinancialItemPayload {
  const payload: FinancialItemPayload = {
    name: item.name,
    amountCents: item.amountCents,
    currency: item.currency,
    annualReturnRateBasisPoints: item.annualReturnRateBasisPoints,
    annualContributionCents: item.annualContributionCents,
    sortOrder: item.sortOrder,
  }

  if (item.drawdownAnnualReturnRateBasisPoints !== undefined) {
    payload.drawdownAnnualReturnRateBasisPoints = item.drawdownAnnualReturnRateBasisPoints
  }

  return payload
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

function formatDrawdownReturn(item: FinancialItem) {
  if (item.drawdownAnnualReturnRateBasisPoints === undefined) {
    return `${formatRate(item.annualReturnRateBasisPoints)} drawdown return (uses annual return)`
  }

  return `${formatRate(item.drawdownAnnualReturnRateBasisPoints)} drawdown return`
}

function formatPhase(phase: string | undefined) {
  if (!phase) {
    return ''
  }
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default App
