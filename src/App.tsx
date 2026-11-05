import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { accountColors, otherAccountColor } from './charts/chartUtils'
import { formatCurrency, formatRate, formatWholeCurrency, pluralize } from './format'
import { parseHundredths, parseWholeNumber } from './numberInput'
import { ProjectionResults } from './ProjectionResults'
import {
  maximumInflationPercent,
  maximumProjectionYears,
  projectionMessages,
  translateProjectionError,
  type ProjectionField,
} from './projectionErrors'
import { currencyCodePattern, importedItemProblems } from './itemValidation'
import { clearSavedSession, loadSavedSession, saveSession } from './savedSession'

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
type FieldErrors<Field extends string> = Partial<Record<Field, string>>

const defaultProjectionForm = {
  savingYears: '10',
  drawdownYears: '0',
  annualWithdrawal: '0.00',
  withdrawalInflationRate: '3.00',
}

const dollarAmountError = 'Enter a dollar amount like 1,000 or 1000.50.'
const signedPercentError = 'Enter a percentage like 7 or -2.5.'
const currencyError = 'Use a 3-letter currency code like USD.'

function App() {
  const isEphemeralSession = isEphemeralSessionMode()
  // Ephemeral sessions are restored from this browser's storage, if saved.
  const [restoredSession] = useState(() => (isEphemeralSession ? loadSavedSession() : null))
  const [items, setItems] = useState<FinancialItem[]>(() => [...(restoredSession?.items ?? [])].sort(compareFinancialItems))
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [projectionSavingYears, setProjectionSavingYears] = useState(
    restoredSession?.projectionForm.savingYears ?? defaultProjectionForm.savingYears,
  )
  const [projectionDrawdownYears, setProjectionDrawdownYears] = useState(
    restoredSession?.projectionForm.drawdownYears ?? defaultProjectionForm.drawdownYears,
  )
  const [projectionAnnualWithdrawal, setProjectionAnnualWithdrawal] = useState(
    restoredSession?.projectionForm.annualWithdrawal ?? defaultProjectionForm.annualWithdrawal,
  )
  const [projectionWithdrawalInflationRate, setProjectionWithdrawalInflationRate] = useState(
    restoredSession?.projectionForm.withdrawalInflationRate ?? defaultProjectionForm.withdrawalInflationRate,
  )
  const [projection, setProjection] = useState<Projection | null>(null)
  const [isCalculatingProjection, setIsCalculatingProjection] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [staleMessage, setStaleMessage] = useState<string | null>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(() =>
    restoredSession && restoredSession.items.length > 0
      ? `Restored ${restoredSession.items.length} ${restoredSession.items.length === 1 ? 'item' : 'items'} saved in this browser.`
      : null,
  )
  // Signature of the items the current projection was calculated from, so the
  // results can be flagged as out of date when items change afterwards.
  const [projectionItemsSignature, setProjectionItemsSignature] = useState<string | null>(null)
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null)
  const [itemFieldErrors, setItemFieldErrors] = useState<FieldErrors<ItemField>>({})
  const [projectionFieldErrors, setProjectionFieldErrors] = useState<FieldErrors<ProjectionField>>({})
  // Highest session-item number handed out in this browser session, so IDs of
  // deleted items are never reused.
  const lastSessionItemNumber = useRef(restoredSession?.lastSessionItemNumber ?? 0)

  // Each account keeps its color slot for the whole session, so deleting or
  // reordering accounts never repaints the others in the charts.
  const colorSlots = useRef(new Map<string, number>())
  const assignedColorSlots = useMemo(() => {
    const slots = colorSlots.current
    const currentIDs = new Set(items.map((item) => item.id))
    for (const id of [...slots.keys()]) {
      if (!currentIDs.has(id)) {
        slots.delete(id)
      }
    }
    for (const item of items) {
      if (!slots.has(item.id)) {
        const used = new Set(slots.values())
        let slot = 0
        while (used.has(slot)) {
          slot += 1
        }
        slots.set(item.id, slot)
      }
    }
    return new Map(slots)
  }, [items])
  const colorFor = useCallback(
    (itemId: string, index: number) => {
      const slot = assignedColorSlots.get(itemId) ?? index
      return slot < accountColors.length ? accountColors[slot] : otherAccountColor
    },
    [assignedColorSlots],
  )

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, items],
  )

  useEffect(() => {
    if (!isEphemeralSession) {
      return
    }
    saveSession({
      version: 1,
      items,
      projectionForm: {
        savingYears: projectionSavingYears,
        drawdownYears: projectionDrawdownYears,
        annualWithdrawal: projectionAnnualWithdrawal,
        withdrawalInflationRate: projectionWithdrawalInflationRate,
      },
      lastSessionItemNumber: Math.max(lastSessionItemNumber.current, highestSessionItemNumber(items)),
    })
  }, [
    isEphemeralSession,
    items,
    projectionSavingYears,
    projectionDrawdownYears,
    projectionAnnualWithdrawal,
    projectionWithdrawalInflationRate,
  ])

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
        setBackupMessage('Backup imported into this browser session.')
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

  function handleClearSession() {
    const confirmed = window.confirm(
      'Clear all items saved in this browser? This can’t be undone. Export a JSON backup first if you want to keep them.',
    )
    if (!confirmed) {
      return
    }
    clearSavedSession()
    lastSessionItemNumber.current = 0
    setItems([])
    setProjection(null)
    setProjectionItemsSignature(null)
    setProjectionSavingYears(defaultProjectionForm.savingYears)
    setProjectionDrawdownYears(defaultProjectionForm.drawdownYears)
    setProjectionAnnualWithdrawal(defaultProjectionForm.annualWithdrawal)
    setProjectionWithdrawalInflationRate(defaultProjectionForm.withdrawalInflationRate)
    setProjectionFieldErrors({})
    setErrorMessage(null)
    resetForm()
    setBackupMessage('Session cleared. Nothing is saved in this browser.')
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

    // Only accounts whose position changed need saving.
    const previousSortOrders = new Map(previousItems.map((item) => [item.id, item.sortOrder]))
    const movedItems = nextItems.filter((item) => previousSortOrders.get(item.id) !== item.sortOrder)

    try {
      for (const item of movedItems) {
        await updateFinancialItem(item.id, itemToPayload(item))
      }
    } catch (error) {
      // Some updates may already be saved, so show the order the server
      // actually has instead of guessing.
      const reason = getErrorMessage(error)
      try {
        const savedItems = await listFinancialItems()
        setItems(savedItems.sort(compareFinancialItems))
        setErrorMessage(`Couldn’t save the new order. ${reason} Showing the order that’s saved.`)
      } catch {
        setItems(previousItems)
        setErrorMessage(`Couldn’t save the new order. ${reason} Refresh to see the order that’s saved.`)
      }
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
        ...(isEphemeralSession ? { items: items.map((item) => ({ id: item.id, ...itemToPayload(item) })) } : {}),
      }
      const itemsSignature = signatureForProjection(items)
      const nextProjection = await calculateProjection(projectionRequest)
      setProjection(nextProjection)
      setProjectionItemsSignature(itemsSignature)
    } catch (error) {
      const { fieldErrors, messages } = translateProjectionError(
        getErrorMessage(error),
        items.map((item) => item.name),
      )
      setProjectionFieldErrors((current) => ({ ...current, ...fieldErrors }))
      const reason =
        messages.length > 0 ? messages.join(' ') : 'Fix the highlighted settings and calculate again.'
      if (projection) {
        setProjectionMessage(`Couldn’t update the projection. ${reason} Showing your last projection until then.`)
      } else {
        setErrorMessage(`Couldn’t calculate the projection. ${reason}`)
      }
    } finally {
      setIsCalculatingProjection(false)
    }
  }

  const accountsTotalCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  const accountsCurrency = items[0]?.currency ?? 'USD'
  const projectionIsStale =
    projection !== null && projectionItemsSignature !== null && signatureForProjection(items) !== projectionItemsSignature

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Financials Planner</h1>
        </header>

        <section className="accounts" aria-labelledby="items-heading">
          <div className="accounts-heading">
            <h2 id="items-heading">Accounts</h2>
            {items.length > 0 ? (
              <p className="accounts-total">
                <span className="visually-hidden">Total today </span>
                {formatWholeCurrency(accountsTotalCents, accountsCurrency)}
              </p>
            ) : null}
          </div>
          {isEphemeralSession ? (
            <p className="sidebar-note">
              <span className="visually-hidden">Ephemeral session mode. </span>
              Saved in this browser only. Use Export JSON to back up or move to another device.
            </p>
          ) : null}

          {isLoading ? <p className="sidebar-status">Loading accounts…</p> : null}
          {staleMessage ? <p className="sidebar-status warning">{staleMessage}</p> : null}
          {backupMessage ? <p className="sidebar-status">{backupMessage}</p> : null}

          {!isLoading && items.length === 0 ? (
            <p className="accounts-empty">No accounts yet. Add your first one below to start a projection.</p>
          ) : null}

          <ul className="item-list">
            {items.map((item, index) => (
              <li
                key={item.id}
                className={[
                  'item-card',
                  item.id === draggingItemId ? 'dragging' : '',
                  item.id === editingItemId ? 'editing' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onDragStart={() => handleDragStart(item)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(item)}
              >
                <span className="account-swatch" style={{ background: colorFor(item.id, index) }} aria-hidden="true" />
                <div className="account-body">
                  <div className="account-title">
                    <h3>{item.name}</h3>
                    <p className="account-amount">
                      {item.amountCents % 100 === 0
                        ? formatWholeCurrency(item.amountCents, item.currency)
                        : formatCurrency(item.amountCents, item.currency)}
                    </p>
                  </div>
                  <p className="account-details">{describeGrowth(item)}</p>
                  <p className="account-details">{describeContribution(item)}</p>
                  <div className="item-actions">
                    <button type="button" className="text-button" aria-label={`Edit ${item.name}`} onClick={() => startEditing(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-button danger"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => void handleDelete(item)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {items.length > 1 ? <p className="sidebar-hint">Drag accounts to reorder them.</p> : null}
        </section>

        <form className="item-form" onSubmit={handleSubmit} aria-labelledby="item-form-heading">
          <h2 id="item-form-heading">{editingItem ? `Edit ${editingItem.name}` : 'Add an account'}</h2>

          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Example: Roth IRA"
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
                  placeholder="10,000"
                  required
                  aria-invalid={itemFieldErrors.amount ? true : undefined}
                  aria-describedby={itemFieldErrors.amount ? 'amount-error' : undefined}
                />
              </label>
              <FieldError id="amount-error" message={itemFieldErrors.amount} />
            </div>
            <div className="form-field narrow">
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
                  placeholder="7"
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
                  placeholder="Same"
                  aria-invalid={itemFieldErrors.drawdownAnnualReturnRate ? true : undefined}
                  aria-describedby={
                    itemFieldErrors.drawdownAnnualReturnRate ? 'drawdown-return-help drawdown-return-error' : 'drawdown-return-help'
                  }
                />
              </label>
              <span className="field-help" id="drawdown-return-help">
                Uses annual return when blank.
              </span>
              <FieldError id="drawdown-return-error" message={itemFieldErrors.drawdownAnnualReturnRate} />
            </div>
          </div>

          <div className="form-field">
            <label>
              Annual contribution
              <input
                inputMode="decimal"
                value={form.annualContribution}
                onChange={(event) => updateItemField('annualContribution', event.target.value)}
                placeholder="6,000"
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

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={isSaving}>
              {editingItem ? 'Save account' : 'Add account'}
            </button>
            {editingItem ? (
              <button type="button" className="ghost-button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <div className="sidebar-actions">
          <button type="button" className="ghost-button" onClick={() => void handleBackupExport()}>
            Export JSON backup
          </button>
          <label className="ghost-button file-button">
            Import JSON backup
            <input type="file" accept="application/json,.json" onChange={(event) => void handleBackupImport(event)} />
          </label>
          {!isEphemeralSession ? (
            <button type="button" className="ghost-button" onClick={() => void loadItems()}>
              Refresh
            </button>
          ) : null}
          {isEphemeralSession ? (
            <button type="button" className="ghost-button" onClick={handleClearSession}>
              Clear session
            </button>
          ) : null}
        </div>
      </aside>

      <main className="workspace">
        <form className="projection-controls" onSubmit={handleProjectionSubmit} aria-label="Projection settings">
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
          <div className="form-field wide">
            <label>
              Annual withdrawal
              <input
                inputMode="decimal"
                value={projectionAnnualWithdrawal}
                onChange={(event) => updateProjectionField('annualWithdrawal', event.target.value, setProjectionAnnualWithdrawal)}
                placeholder="60,000"
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
          <div className="form-field wide">
            <label>
              Inflation (%)
              <input
                inputMode="decimal"
                value={projectionWithdrawalInflationRate}
                onChange={(event) =>
                  updateProjectionField('withdrawalInflationRate', event.target.value, setProjectionWithdrawalInflationRate)
                }
                placeholder="3"
                required
                aria-invalid={projectionFieldErrors.withdrawalInflationRate ? true : undefined}
                aria-describedby={
                  projectionFieldErrors.withdrawalInflationRate ? 'inflation-help withdrawal-inflation-error' : 'inflation-help'
                }
              />
            </label>
            <span className="field-help" id="inflation-help">
              Raises withdrawals and linked contributions each year.
            </span>
            <FieldError id="withdrawal-inflation-error" message={projectionFieldErrors.withdrawalInflationRate} />
          </div>
          <button type="submit" className="primary-button calculate-button" disabled={isCalculatingProjection || items.length === 0}>
            {isCalculatingProjection ? 'Calculating…' : 'Calculate projection'}
          </button>
        </form>

        {errorMessage ? (
          <p className="banner error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {projectionMessage ? <p className="banner warning">{projectionMessage}</p> : null}
        {projectionIsStale ? (
          <p className="banner warning">Your items changed since this projection. Recalculate to update.</p>
        ) : null}

        {projection ? (
          <div className={projectionIsStale ? 'results-frame stale' : 'results-frame'}>
            <ProjectionResults projection={projection} colorFor={colorFor} />
          </div>
        ) : (
          <section className="projection-empty" aria-label="No projection yet">
            <h2>See how long your money lasts.</h2>
            <p>
              {items.length === 0
                ? 'Add your accounts on the left, then set how many years you’ll save and draw down.'
                : 'Set how many years you’ll save and draw down, then calculate your projection.'}
            </p>
          </section>
        )}
      </main>
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
    throw new Error(problems.length > 3 ? `${shown} (and ${pluralize(problems.length - 3, 'more problem', 'more problems')})` : shown)
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

  if (savingYears === null) errors.savingYears = projectionMessages.years
  if (drawdownYears === null) errors.drawdownYears = projectionMessages.years
  if (annualWithdrawalCents === null) errors.annualWithdrawal = projectionMessages.dollarAmount
  if (annualWithdrawalInflationRateBasisPoints === null) errors.withdrawalInflationRate = projectionMessages.inflation

  // The same rules the projection API enforces, so they show up next to the
  // field instead of as an API error.
  if (savingYears !== null && drawdownYears !== null && savingYears + drawdownYears === 0) {
    errors.drawdownYears = projectionMessages.noYears
  }
  if (drawdownYears !== null && drawdownYears > 0 && annualWithdrawalCents === 0) {
    errors.annualWithdrawal = projectionMessages.withdrawalRequired
  }
  if (annualWithdrawalInflationRateBasisPoints !== null && annualWithdrawalInflationRateBasisPoints > maximumInflationPercent * 100) {
    errors.withdrawalInflationRate = projectionMessages.inflationRange
  }

  if (
    savingYears === null ||
    drawdownYears === null ||
    annualWithdrawalCents === null ||
    annualWithdrawalInflationRateBasisPoints === null ||
    Object.keys(errors).length > 0
  ) {
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

// Identifies the inputs a projection depends on. Order and timestamps are
// ignored, so reordering items doesn't mark a projection as out of date.
function signatureForProjection(items: FinancialItem[]) {
  return JSON.stringify(
    items
      .map((item) => {
        const { sortOrder: _sortOrder, ...inputs } = itemToPayload(item)
        return { id: item.id, ...inputs }
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  )
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





function describeGrowth(item: FinancialItem) {
  const growth = `Grows ${formatRate(item.annualReturnRateBasisPoints)} a year`
  if (
    item.drawdownAnnualReturnRateBasisPoints === undefined ||
    item.drawdownAnnualReturnRateBasisPoints === item.annualReturnRateBasisPoints
  ) {
    return `${growth}, the same in drawdown.`
  }
  return `${growth}, ${formatRate(item.drawdownAnnualReturnRateBasisPoints)} in drawdown.`
}

function describeContribution(item: FinancialItem) {
  if (item.annualContributionCents <= 0) {
    return 'No yearly contribution.'
  }
  const amount = formatWholeCurrency(item.annualContributionCents, item.currency)
  return item.inflateAnnualContribution
    ? `Adds ${amount} a year, rising with inflation.`
    : `Adds ${amount} a year.`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default App
