import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  calculateProjection,
  createFinancialItem,
  deleteFinancialItem,
  exportFinancialItemsBackup,
  FinancialItem,
  FinancialItemPayload,
  FinancialItemsBackup,
  importFinancialItemsBackup,
  listFinancialItems,
  Projection,
  updateFinancialItem,
} from './financialItemsApi'
import { parseHundredths, parseWholeNumber } from './numberInput'

const emptyForm = {
  name: '',
  amount: '',
  currency: 'USD',
  annualReturnRate: '',
  drawdownAnnualReturnRate: '',
  annualContribution: '',
  inflateAnnualContribution: false,
}

type FormState = typeof emptyForm

type ItemField = 'amount' | 'currency' | 'annualReturnRate' | 'drawdownAnnualReturnRate' | 'annualContribution'
type ProjectionField = 'savingYears' | 'drawdownYears' | 'annualWithdrawal' | 'withdrawalInflationRate'
type FieldErrors<Field extends string> = Partial<Record<Field, string>>

const maximumProjectionYears = 75
const dollarAmountError = 'Enter a dollar amount like 1,000 or 1000.50.'
const signedPercentError = 'Enter a percentage like 7 or -2.5.'
const percentError = 'Enter a percentage of 0 or more, like 3.'
const yearsError = `Enter a whole number of years from 0 to ${maximumProjectionYears}.`
const currencyError = 'Use a 3-letter currency code like USD.'
const currencyCodePattern = /^[A-Z]{3}$/

function App() {
  const isEphemeralSession = isEphemeralSessionMode()
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
  const [projection, setProjection] = useState<Projection | null>(null)
  const [isCalculatingProjection, setIsCalculatingProjection] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [staleMessage, setStaleMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null)
  const [itemFieldErrors, setItemFieldErrors] = useState<FieldErrors<ItemField>>({})
  const [projectionFieldErrors, setProjectionFieldErrors] = useState<FieldErrors<ProjectionField>>({})
  // Highest session-item number handed out in this browser session, so IDs of
  // deleted items are never reused.
  const lastSessionItemNumber = useRef(0)

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, items],
  )

  useEffect(() => {
    if (isEphemeralSession) {
      setIsLoading(false)
      return
    }
    void loadItems()
  }, [isEphemeralSession])

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
      if (isEphemeralSession) {
        downloadJSONBackup(backupFromItems(items))
        setBackupMessage('Session JSON exported. Keep real financial backup JSON out of git.')
        return
      }

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
      const backup = JSON.parse(text) as FinancialItemsBackup
      if (isEphemeralSession) {
        const importedItems = backupItemsFromJSON(backup)
        setItems(importedItems.sort(compareFinancialItems))
        setProjection(null)
        resetForm()
        setBackupMessage('Backup imported into this browser session. Refreshing or closing the browser loses unsaved changes unless you export JSON again.')
        return
      }

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
    const { payload, errors } = validateItemForm(form, editingItem ? editingItem.sortOrder : nextSortOrder(items))
    setItemFieldErrors(errors)
    if (!payload) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setStaleMessage(null)

    try {
      if (editingItemId && editingItem) {
        if (isEphemeralSession) {
          const updatedItem = localItemFromPayload(payload, editingItem.id, editingItem.createdAt)
          setItems((currentItems) =>
            currentItems
              .map((item) => (item.id === updatedItem.id ? updatedItem : item))
              .sort(compareFinancialItems),
          )
        } else {
          const updatedItem = await updateFinancialItem(editingItemId, payload)
          setItems((currentItems) =>
            currentItems
              .map((item) => (item.id === updatedItem.id ? updatedItem : item))
              .sort(compareFinancialItems),
          )
        }
      } else {
        if (isEphemeralSession) {
          const createdItem = localItemFromPayload(payload, issueSessionItemID(items))
          setItems((currentItems) => [...currentItems, createdItem].sort(compareFinancialItems))
        } else {
          const createdItem = await createFinancialItem(payload)
          setItems((currentItems) => [...currentItems, createdItem].sort(compareFinancialItems))
        }
      }
      resetForm()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  function issueSessionItemID(currentItems: FinancialItem[]) {
    const next = Math.max(lastSessionItemNumber.current, highestSessionItemNumber(currentItems)) + 1
    lastSessionItemNumber.current = next
    return sessionItemID(next)
  }

  function updateItemField(field: ItemField, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
    setItemFieldErrors((currentErrors) => withoutField(currentErrors, field))
  }

  function updateProjectionField(field: ProjectionField, value: string, setValue: (value: string) => void) {
    setValue(value)
    setProjectionFieldErrors((currentErrors) => withoutField(currentErrors, field))
  }

  async function handleDelete(item: FinancialItem) {
    setErrorMessage(null)
    setStaleMessage(null)

    try {
      if (!isEphemeralSession) {
        await deleteFinancialItem(item.id)
      }
      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id))
      if (editingItemId === item.id) {
        resetForm()
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  function startEditing(item: FinancialItem) {
    setItemFieldErrors({})
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
      inflateAnnualContribution: item.inflateAnnualContribution,
    })
  }

  function resetForm() {
    setItemFieldErrors({})
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
    if (!isEphemeralSession) {
      void persistReorderedItems(renumberedItems, previousItems)
    }
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
    const { request: projectionInputs, errors } = validateProjectionForm({
      savingYears: projectionSavingYears,
      drawdownYears: projectionDrawdownYears,
      annualWithdrawal: projectionAnnualWithdrawal,
      withdrawalInflationRate: projectionWithdrawalInflationRate,
    })
    setProjectionFieldErrors(errors)
    if (!projectionInputs) {
      return
    }

    setIsCalculatingProjection(true)
    setErrorMessage(null)
    setProjectionMessage(null)

    try {
      const projectionRequest = {
        ...projectionInputs,
        ...(isEphemeralSession ? { items: items.map(itemToPayload) } : {}),
      }
      const nextProjection = await calculateProjection(projectionRequest)
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
            <div className="form-field">
              <label>
                Current amount
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => updateItemField('amount', event.target.value)}
                  placeholder="10000.00"
                  required
                  aria-invalid={itemFieldErrors.amount ? true : undefined}
                  aria-describedby={itemFieldErrors.amount ? 'amount-error' : undefined}
                />
              </label>
              <FieldError id="amount-error" message={itemFieldErrors.amount} />
            </div>
            <div className="form-field">
              <label>
                Currency
                <input
                  value={form.currency}
                  onChange={(event) => updateItemField('currency', event.target.value.toUpperCase())}
                  maxLength={3}
                  required
                  aria-invalid={itemFieldErrors.currency ? true : undefined}
                  aria-describedby={itemFieldErrors.currency ? 'currency-error' : undefined}
                />
              </label>
              <FieldError id="currency-error" message={itemFieldErrors.currency} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>
                Annual return (%)
                <input
                  inputMode="decimal"
                  value={form.annualReturnRate}
                  onChange={(event) => updateItemField('annualReturnRate', event.target.value)}
                  placeholder="7.00"
                  required
                  aria-invalid={itemFieldErrors.annualReturnRate ? true : undefined}
                  aria-describedby={itemFieldErrors.annualReturnRate ? 'annual-return-error' : undefined}
                />
              </label>
              <FieldError id="annual-return-error" message={itemFieldErrors.annualReturnRate} />
            </div>
            <div className="form-field">
              <label>
                Drawdown return (%)
                <input
                  inputMode="decimal"
                  value={form.drawdownAnnualReturnRate}
                  onChange={(event) => updateItemField('drawdownAnnualReturnRate', event.target.value)}
                  placeholder="Uses annual return when blank"
                  aria-invalid={itemFieldErrors.drawdownAnnualReturnRate ? true : undefined}
                  aria-describedby={itemFieldErrors.drawdownAnnualReturnRate ? 'drawdown-return-error' : undefined}
                />
                <span className="field-help">Uses annual return when blank.</span>
              </label>
              <FieldError id="drawdown-return-error" message={itemFieldErrors.drawdownAnnualReturnRate} />
            </div>
            <div className="form-field">
              <label>
                Annual contribution
                <input
                  inputMode="decimal"
                  value={form.annualContribution}
                  onChange={(event) => updateItemField('annualContribution', event.target.value)}
                  placeholder="3000.00"
                  required
                  aria-invalid={itemFieldErrors.annualContribution ? true : undefined}
                  aria-describedby={itemFieldErrors.annualContribution ? 'annual-contribution-error' : undefined}
                />
              </label>
              <FieldError id="annual-contribution-error" message={itemFieldErrors.annualContribution} />
            </div>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={form.inflateAnnualContribution}
                onChange={(event) => setForm({ ...form, inflateAnnualContribution: event.target.checked })}
              />
              Grow this item’s contribution with inflation (uses the projection’s Inflation rate)
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
              <p className="eyebrow">{isEphemeralSession ? 'Ephemeral session mode' : 'API-backed list'}</p>
              <h2 id="items-heading">Financial items</h2>
              {isEphemeralSession ? (
                <p className="panel-help">Refreshing or closing the browser loses unsaved changes unless you export JSON again.</p>
              ) : null}
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
              {!isEphemeralSession ? (
                <button type="button" className="secondary" onClick={() => void loadItems()}>
                  Refresh
                </button>
              ) : null}
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
                      {item.inflateAnnualContribution ? ' · contribution grows with inflation' : ''}
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
              <p className="eyebrow">{isEphemeralSession ? 'Browser-owned projection' : 'Repository-backed projection'}</p>
              <h2 id="projection-heading">Projection preview</h2>
              <p className="panel-help">
                {isEphemeralSession
                  ? 'Calculate saving and drawdown years from the financial items currently in this browser session.'
                  : 'Calculate saving and drawdown years from the current saved financial items.'}
              </p>
            </div>
          </div>

          <form className="projection-controls" onSubmit={handleProjectionSubmit}>
            <div className="form-field">
              <label>
                Saving years
                <input
                  inputMode="numeric"
                  min="0"
                  max="75"
                  required
                  value={projectionSavingYears}
                  onChange={(event) => updateProjectionField('savingYears', event.target.value, setProjectionSavingYears)}
                  aria-invalid={projectionFieldErrors.savingYears ? true : undefined}
                  aria-describedby={projectionFieldErrors.savingYears ? 'saving-years-error' : undefined}
                />
              </label>
              <FieldError id="saving-years-error" message={projectionFieldErrors.savingYears} />
            </div>
            <div className="form-field">
              <label>
                Drawdown years
                <input
                  inputMode="numeric"
                  min="0"
                  max="75"
                  required
                  value={projectionDrawdownYears}
                  onChange={(event) => updateProjectionField('drawdownYears', event.target.value, setProjectionDrawdownYears)}
                  aria-invalid={projectionFieldErrors.drawdownYears ? true : undefined}
                  aria-describedby={projectionFieldErrors.drawdownYears ? 'drawdown-years-error' : undefined}
                />
              </label>
              <FieldError id="drawdown-years-error" message={projectionFieldErrors.drawdownYears} />
            </div>
            <div className="form-field">
              <label>
                Annual withdrawal
                <input
                  inputMode="decimal"
                  value={projectionAnnualWithdrawal}
                  onChange={(event) => updateProjectionField('annualWithdrawal', event.target.value, setProjectionAnnualWithdrawal)}
                  placeholder="60000.00"
                  required
                  aria-invalid={projectionFieldErrors.annualWithdrawal ? true : undefined}
                  aria-describedby={
                    projectionFieldErrors.annualWithdrawal ? 'annual-withdrawal-help annual-withdrawal-error' : 'annual-withdrawal-help'
                  }
                />
              </label>
              <span className="field-help" id="annual-withdrawal-help">
                In today’s dollars; grows with inflation.
              </span>
              <FieldError id="annual-withdrawal-error" message={projectionFieldErrors.annualWithdrawal} />
            </div>
            <div className="form-field">
              <label>
                Inflation (%)
                <input
                  inputMode="decimal"
                  value={projectionWithdrawalInflationRate}
                  onChange={(event) =>
                    updateProjectionField('withdrawalInflationRate', event.target.value, setProjectionWithdrawalInflationRate)
                  }
                  placeholder="3.00"
                  required
                  aria-invalid={projectionFieldErrors.withdrawalInflationRate ? true : undefined}
                  aria-describedby={
                    projectionFieldErrors.withdrawalInflationRate ? 'inflation-help withdrawal-inflation-error' : 'inflation-help'
                  }
                />
              </label>
              <span className="field-help" id="inflation-help">
                Grows withdrawals each year, and contributions marked “grow with inflation”.
              </span>
              <FieldError id="withdrawal-inflation-error" message={projectionFieldErrors.withdrawalInflationRate} />
            </div>
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
  const shortfallYears = projection.totals.filter((total) => (total.unfundedWithdrawalCents ?? 0) > 0)
  const firstShortfallYear = shortfallYears[0]
  const totalShortfallCents = shortfallYears.reduce((sum, total) => sum + (total.unfundedWithdrawalCents ?? 0), 0)
  const hasDrawdown = projection.totals.some((total) => total.phase === 'drawdown')
  const rows = projection.totals.flatMap((total) =>
    projection.items.map((item, itemIndex) => ({
      annualWithdrawalCents: total.withdrawalCents ?? 0,
      combinedBalanceCents: total.balanceCents,
      isFirstItemForYear: itemIndex === 0,
      item,
      shortfallCents: total.unfundedWithdrawalCents ?? 0,
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
        {firstShortfallYear ? (
          <p className="funding-status shortfall">
            <span aria-hidden="true">⚠ </span>
            <strong>Withdrawals run short starting in year {firstShortfallYear.year}</strong> (drawdown year{' '}
            {firstShortfallYear.year - (projection.savingYears ?? 0)}).{' '}
            {formatCurrency(totalShortfallCents, projection.currency)} of planned withdrawals can't be covered over the
            projection.
          </p>
        ) : hasDrawdown ? (
          <p className="funding-status funded">
            <span aria-hidden="true">✓ </span>
            All planned withdrawals are fully funded through year {finalYear.year}.
          </p>
        ) : null}
      </div>

      <div className="table-scroll">
        <table>
          <caption>Projection by year and item</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Phase</th>
              <th scope="col">Annual withdrawal</th>
              {firstShortfallYear ? <th scope="col">Shortfall</th> : null}
              <th scope="col">Item</th>
              <th scope="col">Contribution</th>
              <th scope="col">Withdrawal</th>
              <th scope="col">Growth</th>
              <th scope="col">Item balance</th>
              <th scope="col">Combined balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ annualWithdrawalCents, combinedBalanceCents, isFirstItemForYear, item, shortfallCents, yearlyBalance, year }) => {
              if (!yearlyBalance) {
                return null
              }

              return (
                <tr key={`${year}-${item.id || item.name}`} className={shortfallCents > 0 ? 'shortfall-row' : undefined}>
                  <td>{isFirstItemForYear ? `Year ${year}` : ''}</td>
                  <td>{isFirstItemForYear ? formatPhase(yearlyBalance.phase) : ''}</td>
                  <td>{isFirstItemForYear ? formatCurrency(annualWithdrawalCents, projection.currency) : ''}</td>
                  {firstShortfallYear ? (
                    <td>{isFirstItemForYear ? formatCurrency(shortfallCents, projection.currency) : ''}</td>
                  ) : null}
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

function backupItemsFromJSON(backup: FinancialItemsBackup) {
  if (!backup || !Array.isArray(backup.items)) {
    throw new Error('Backup JSON must include an items array.')
  }
  const problems = backup.items.flatMap((item, index) => importedItemProblems(item, index))
  if (problems.length > 0) {
    const shown = problems.slice(0, 3).join(' ')
    throw new Error(problems.length > 3 ? `${shown} (and ${problems.length - 3} more problems)` : shown)
  }

  // Keep each ID the first time it appears. Missing or repeated IDs get new
  // numbers above the highest session-item number in the file.
  const seenIDs = new Set<string>()
  let lastSessionItemNumber = highestSessionItemNumber(backup.items)
  return backup.items.map((item, index) => ({
    ...item,
    id: (() => {
      const id = typeof item.id === 'string' ? item.id.trim() : ''
      if (id !== '' && !seenIDs.has(id)) {
        seenIDs.add(id)
        return id
      }
      lastSessionItemNumber += 1
      const freshID = sessionItemID(lastSessionItemNumber)
      seenIDs.add(freshID)
      return freshID
    })(),
    drawdownAnnualReturnRateBasisPoints: item.drawdownAnnualReturnRateBasisPoints ?? undefined,
    inflateAnnualContribution: item.inflateAnnualContribution ?? false,
    sortOrder: item.sortOrder ?? index,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }))
}

const minimumReturnRateBasisPoints = -10000
const maximumReturnRateBasisPoints = 100000

// Checks one imported backup item against the same rules the API enforces, so
// a hand-edited or corrupted file is rejected with a clear message instead of
// loading data that can't be displayed or projected.
function importedItemProblems(item: unknown, index: number): string[] {
  const label = `Item ${index + 1}:`
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return [`${label} must be an object.`]
  }

  const value = item as Record<string, unknown>
  const problems: string[] = []
  const isInteger = (field: string) => Number.isInteger(value[field])
  const isMissing = (field: string) => value[field] === undefined || value[field] === null

  if (typeof value.name !== 'string' || value.name.trim() === '') {
    problems.push(`${label} name is required.`)
  }
  if (!isInteger('amountCents') || (value.amountCents as number) < 0) {
    problems.push(`${label} amountCents must be a whole number of cents, 0 or more.`)
  }
  if (typeof value.currency !== 'string' || !currencyCodePattern.test(value.currency)) {
    problems.push(`${label} currency must be a 3-letter code such as USD.`)
  }
  for (const field of ['annualReturnRateBasisPoints', 'drawdownAnnualReturnRateBasisPoints']) {
    if (field === 'drawdownAnnualReturnRateBasisPoints' && isMissing(field)) {
      continue
    }
    const rate = value[field] as number
    if (!isInteger(field) || rate < minimumReturnRateBasisPoints || rate > maximumReturnRateBasisPoints) {
      problems.push(
        `${label} ${field} must be a whole number from ${minimumReturnRateBasisPoints} to ${maximumReturnRateBasisPoints}.`,
      )
    }
  }
  if (!isInteger('annualContributionCents') || (value.annualContributionCents as number) < 0) {
    problems.push(`${label} annualContributionCents must be a whole number of cents, 0 or more.`)
  }
  if (!isMissing('sortOrder') && (!isInteger('sortOrder') || (value.sortOrder as number) < 0)) {
    problems.push(`${label} sortOrder must be a whole number, 0 or more.`)
  }
  if (!isMissing('inflateAnnualContribution') && typeof value.inflateAnnualContribution !== 'boolean') {
    problems.push(`${label} inflateAnnualContribution must be true or false.`)
  }

  return problems
}

function backupFromItems(items: FinancialItem[]): FinancialItemsBackup {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    items,
  }
}

function localItemFromPayload(payload: FinancialItemPayload, id: string, createdAt = new Date().toISOString()): FinancialItem {
  const now = new Date().toISOString()
  return {
    id,
    name: payload.name,
    amountCents: payload.amountCents,
    currency: payload.currency,
    annualReturnRateBasisPoints: payload.annualReturnRateBasisPoints,
    drawdownAnnualReturnRateBasisPoints: payload.drawdownAnnualReturnRateBasisPoints,
    annualContributionCents: payload.annualContributionCents,
    inflateAnnualContribution: payload.inflateAnnualContribution,
    sortOrder: payload.sortOrder,
    createdAt,
    updatedAt: now,
  }
}

const sessionItemIDPattern = /^session-item-(\d+)$/

function sessionItemID(sessionItemNumber: number) {
  return `session-item-${sessionItemNumber}`
}

function highestSessionItemNumber(items: Array<{ id?: unknown }>) {
  return items.reduce((highest, item) => {
    const match = typeof item.id === 'string' ? sessionItemIDPattern.exec(item.id.trim()) : null
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
}

function isEphemeralSessionMode() {
  return import.meta.env.VITE_FINANCIALS_SESSION_MODE?.trim().toLowerCase() === 'ephemeral'
}

function validateItemForm(
  form: FormState,
  sortOrder: number,
): { payload: FinancialItemPayload | null; errors: FieldErrors<ItemField> } {
  const errors: FieldErrors<ItemField> = {}
  const amountCents = parseHundredths(form.amount)
  const annualReturnRateBasisPoints = parseHundredths(form.annualReturnRate, { allowNegative: true })
  const hasDrawdownRate = form.drawdownAnnualReturnRate.trim() !== ''
  const drawdownAnnualReturnRateBasisPoints = hasDrawdownRate
    ? parseHundredths(form.drawdownAnnualReturnRate, { allowNegative: true })
    : null
  const annualContributionCents = parseHundredths(form.annualContribution)
  const currency = form.currency.trim().toUpperCase()

  if (amountCents === null) errors.amount = dollarAmountError
  if (!currencyCodePattern.test(currency)) errors.currency = currencyError
  if (annualReturnRateBasisPoints === null) errors.annualReturnRate = signedPercentError
  if (hasDrawdownRate && drawdownAnnualReturnRateBasisPoints === null) errors.drawdownAnnualReturnRate = signedPercentError
  if (annualContributionCents === null) errors.annualContribution = dollarAmountError

  if (amountCents === null || annualReturnRateBasisPoints === null || annualContributionCents === null || Object.keys(errors).length > 0) {
    return { payload: null, errors }
  }

  const payload: FinancialItemPayload = {
    name: form.name.trim(),
    amountCents,
    currency,
    annualReturnRateBasisPoints,
    annualContributionCents,
    inflateAnnualContribution: form.inflateAnnualContribution,
    sortOrder,
  }
  if (drawdownAnnualReturnRateBasisPoints !== null) {
    payload.drawdownAnnualReturnRateBasisPoints = drawdownAnnualReturnRateBasisPoints
  }

  return { payload, errors }
}

type ProjectionInputs = {
  savingYears: number
  drawdownYears: number
  annualWithdrawalCents: number
  annualWithdrawalInflationRateBasisPoints: number
}

function validateProjectionForm(
  values: Record<ProjectionField, string>,
): { request: ProjectionInputs | null; errors: FieldErrors<ProjectionField> } {
  const errors: FieldErrors<ProjectionField> = {}
  const savingYears = parseWholeNumber(values.savingYears, 0, maximumProjectionYears)
  const drawdownYears =
    values.drawdownYears.trim() === '' ? 0 : parseWholeNumber(values.drawdownYears, 0, maximumProjectionYears)
  const annualWithdrawalCents = parseHundredths(values.annualWithdrawal)
  const annualWithdrawalInflationRateBasisPoints = parseHundredths(values.withdrawalInflationRate)

  if (savingYears === null) errors.savingYears = yearsError
  if (drawdownYears === null) errors.drawdownYears = yearsError
  if (annualWithdrawalCents === null) errors.annualWithdrawal = dollarAmountError
  if (annualWithdrawalInflationRateBasisPoints === null) errors.withdrawalInflationRate = percentError

  if (savingYears === null || drawdownYears === null || annualWithdrawalCents === null || annualWithdrawalInflationRateBasisPoints === null) {
    return { request: null, errors }
  }

  return {
    request: { savingYears, drawdownYears, annualWithdrawalCents, annualWithdrawalInflationRateBasisPoints },
    errors,
  }
}

function withoutField<Field extends string>(errors: FieldErrors<Field>, field: Field): FieldErrors<Field> {
  if (!(field in errors)) {
    return errors
  }
  const next = { ...errors }
  delete next[field]
  return next
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span className="field-error" id={id}>
      {message}
    </span>
  ) : null
}

function itemToPayload(item: FinancialItem): FinancialItemPayload {
  const payload: FinancialItemPayload = {
    name: item.name,
    amountCents: item.amountCents,
    currency: item.currency,
    annualReturnRateBasisPoints: item.annualReturnRateBasisPoints,
    annualContributionCents: item.annualContributionCents,
    inflateAnnualContribution: item.inflateAnnualContribution,
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

function centsToDollarsInput(value: number) {
  return (value / 100).toFixed(2)
}

function basisPointsToPercentInput(value: number) {
  return (value / 100).toFixed(2)
}

function formatCurrency(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  } catch {
    // Intl throws on malformed currency codes; show plain text instead of
    // crashing the page.
    const amount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
    return `${amount} ${currency}`.trim()
  }
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
