import { useState } from 'react'
import {
  CalendarCheck,
  CircleAlert,
  Clock3,
  LoaderCircle,
  PackageOpen,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import type {
  AddPurchaseInput,
  Estimate,
  PurchaseCycle,
  TrackedItem,
  UpdateActivePurchaseInput,
  UpdateCompletedPurchaseInput,
} from '../../types'
import { daysBetween, formatLongDate, todayISO } from '../../lib/dates'
import { Modal } from '../Modal'

interface LogPurchaseModalProps {
  item: TrackedItem
  active: PurchaseCycle | undefined
  onClose: () => void
  onSave: (input: AddPurchaseInput) => Promise<void>
}

export function LogPurchaseModal({ item, active, onClose, onSave }: LogPurchaseModalProps) {
  const [purchasedAt, setPurchasedAt] = useState(todayISO())
  const [quantity, setQuantity] = useState(String(active?.quantity ?? 1))
  const [duration, setDuration] = useState(String(active?.estimatedDurationDays ?? 30))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave({
        purchasedAt,
        quantity: Number(quantity),
        estimatedDurationDays: Number(duration),
        notes,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not log this purchase.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Log a purchase"
      subtitle={`${item.product.name} · ${item.unitLabel}`}
      size="small"
    >
      <div className="modal-callout">
        <CalendarCheck size={18} aria-hidden="true" />
        <div>
          {active ? (
            <>
              <strong>This closes the current cycle</strong>
              <p>
                The previous cycle is kept as <em>restocked</em> and is not used as consumption
                history. A new cycle starts on the purchase date.
              </p>
            </>
          ) : (
            <>
              <strong>This starts a new cycle</strong>
              <p>
                The purchase becomes active immediately. When it runs out, you can record the
                real date.
              </p>
            </>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="modal-form">
        <div className="form-grid two">
          <label className="field">
            <span>Purchase date</span>
            <input
              type="date"
              value={purchasedAt}
              max={todayISO()}
              onChange={(event) => setPurchasedAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="10000"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>How long should this quantity last?</span>
          <div className="field-with-suffix">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="3650"
              step="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
            <span>days</span>
          </div>
        </label>
        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Where it came from, price, anything useful…"
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            <CircleAlert size={15} aria-hidden="true" /> {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Plus size={17} aria-hidden="true" />
            )}
            {busy ? 'Saving…' : 'Start new cycle'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface ConsumedModalProps {
  item: TrackedItem
  active: PurchaseCycle
  onClose: () => void
  onSave: (endedAt: string, notes: string) => Promise<void>
}

export function ConsumedModal({ item, active, onClose, onSave }: ConsumedModalProps) {
  const [endedAt, setEndedAt] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const observed = endedAt >= active.purchasedAt ? daysBetween(active.purchasedAt, endedAt) : null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave(endedAt, notes)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not record this run-out.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record a run-out"
      subtitle="A real run-out date makes future ranges more useful."
      size="small"
    >
      <div className="modal-callout warm">
        <Clock3 size={18} aria-hidden="true" />
        <div>
          <strong>{formatLongDate(active.purchasedAt)}</strong>
          <p>
            Current active purchase: {active.quantity} {item.unitLabel}
            {active.quantity === 1 ? '' : 's'}. This cycle will be marked as consumed.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="modal-form">
        <label className="field">
          <span>When did it run out?</span>
          <input
            type="date"
            value={endedAt}
            min={active.purchasedAt}
            max={todayISO()}
            onChange={(event) => setEndedAt(event.target.value)}
            required
          />
        </label>
        {observed !== null ? (
          <div className="observed-duration">
            <span>Observed cycle</span>
            <strong>{observed} days</strong>
            <span>
              {observed === 0 ? 'Same day' : `for ${active.quantity} ${item.unitLabel}${active.quantity === 1 ? '' : 's'}`}
            </span>
          </div>
        ) : null}
        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Used faster than usual, spilled, guests…"
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            <CircleAlert size={15} aria-hidden="true" /> {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <PackageOpen size={17} aria-hidden="true" />
            )}
            {busy ? 'Saving…' : 'Mark as ran out'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface CorrectEstimateModalProps {
  item: TrackedItem
  active: PurchaseCycle
  estimate: Estimate | null
  onClose: () => void
  onSave: (input: UpdateActivePurchaseInput) => Promise<void>
}

export function CorrectEstimateModal({
  item,
  active,
  estimate,
  onClose,
  onSave,
}: CorrectEstimateModalProps) {
  const [purchasedAt, setPurchasedAt] = useState(active.purchasedAt)
  const [quantity, setQuantity] = useState(String(active.quantity))
  const [duration, setDuration] = useState(String(active.estimatedDurationDays))
  const [useOverride, setUseOverride] = useState(Boolean(active.manualEstimateDays))
  const [override, setOverride] = useState(
    String(active.manualEstimateDays ?? estimate?.expectedDurationDays ?? 30),
  )
  const [notes, setNotes] = useState(active.notes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave({
        purchasedAt,
        quantity: Number(quantity),
        estimatedDurationDays: Number(duration),
        manualEstimateDays: useOverride ? Number(override) : undefined,
        notes,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not correct this estimate.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Correct this cycle"
      subtitle={`${item.product.name} · ${active.quantity} ${item.unitLabel}`}
      size="medium"
    >
      <div className="modal-callout">
        <SlidersHorizontal size={18} aria-hidden="true" />
        <div>
          <strong>Correct the input, not just the date</strong>
          <p>
            Fix a purchase date or quantity if it was logged wrong. You can also pin this cycle's
            headline estimate if your history does not reflect a temporary change.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="modal-form">
        <div className="form-grid two">
          <label className="field">
            <span>Purchase date</span>
            <input
              type="date"
              value={purchasedAt}
              max={todayISO()}
              onChange={(event) => setPurchasedAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="10000"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Household duration estimate</span>
          <div className="field-with-suffix">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="3650"
              step="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
            <span>days</span>
          </div>
          <small>Used as the starting estimate when there is no completed history.</small>
        </label>

        <label className="check-setting">
          <input
            type="checkbox"
            checked={useOverride}
            onChange={(event) => setUseOverride(event.target.checked)}
          />
          <span>
            <strong>Pin a manual estimate for this cycle</strong>
            <small>Overrides the date calculated from history.</small>
          </span>
        </label>
        {useOverride ? (
          <label className="field">
            <span>This cycle should last</span>
            <div className="field-with-suffix">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="3650"
                step="1"
                value={override}
                onChange={(event) => setOverride(event.target.value)}
                required
              />
              <span>days</span>
            </div>
          </label>
        ) : null}

        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Why was the estimate corrected?"
          />
        </label>

        {error ? (
          <p className="form-error" role="alert">
            <CircleAlert size={15} aria-hidden="true" /> {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <SlidersHorizontal size={17} aria-hidden="true" />
            )}
            {busy ? 'Saving…' : 'Save correction'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface EditItemModalProps {
  item: TrackedItem
  onClose: () => void
  onSave: (details: {
    name: string
    brand: string
    barcode: string
    quantityLabel: string
    unitLabel: string
    notes: string
  }) => Promise<void>
}

export function EditItemModal({ item, onClose, onSave }: EditItemModalProps) {
  const [name, setName] = useState(item.product.name)
  const [brand, setBrand] = useState(item.product.brand)
  const [barcode, setBarcode] = useState(item.product.barcode)
  const [quantityLabel, setQuantityLabel] = useState(item.product.quantityLabel)
  const [unitLabel, setUnitLabel] = useState(item.unitLabel)
  const [notes, setNotes] = useState(item.notes)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave({ name, brand, barcode, quantityLabel, unitLabel, notes })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save changes.')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit item details" size="medium">
      <form onSubmit={submit} className="modal-form">
        <div className="form-grid two">
          <label className="field">
            <span>Product name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required />
          </label>
          <label className="field">
            <span>Brand</span>
            <input value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={160} />
          </label>
          <label className="field">
            <span>Barcode</span>
            <input value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={80} />
          </label>
          <label className="field">
            <span>Pack size</span>
            <input
              value={quantityLabel}
              onChange={(event) => setQuantityLabel(event.target.value)}
              maxLength={80}
              placeholder="e.g. 1 l"
            />
          </label>
          <label className="field">
            <span>Unit name</span>
            <input value={unitLabel} onChange={(event) => setUnitLabel(event.target.value)} maxLength={30} />
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={2000}
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            <CircleAlert size={15} aria-hidden="true" /> {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
            {busy ? 'Saving…' : 'Save details'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface EditCycleModalProps {
  item: TrackedItem
  purchase: PurchaseCycle
  onClose: () => void
  onSave: (input: UpdateCompletedPurchaseInput) => Promise<void>
  onDelete: () => Promise<void>
}

export function EditCycleModal({
  item,
  purchase,
  onClose,
  onSave,
  onDelete,
}: EditCycleModalProps) {
  const [purchasedAt, setPurchasedAt] = useState(purchase.purchasedAt)
  const [endedAt, setEndedAt] = useState(purchase.endedAt ?? todayISO())
  const [quantity, setQuantity] = useState(String(purchase.quantity))
  const [notes, setNotes] = useState(purchase.notes)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const observed = endedAt >= purchasedAt ? daysBetween(purchasedAt, endedAt) : null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave({ purchasedAt, endedAt, quantity: Number(quantity), notes })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this cycle.')
      setBusy(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setError('')
    try {
      await onDelete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this cycle.')
      setDeleting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit purchase cycle"
      subtitle={`${item.product.name} · past cycle`}
      size="small"
    >
      <form onSubmit={submit} className="modal-form">
        <div className="form-grid two">
          <label className="field">
            <span>Purchased</span>
            <input
              type="date"
              value={purchasedAt}
              max={todayISO()}
              onChange={(event) => setPurchasedAt(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Ran out / restocked</span>
            <input
              type="date"
              value={endedAt}
              min={purchasedAt}
              max={todayISO()}
              onChange={(event) => setEndedAt(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Quantity</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            max="10000"
            step="0.01"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>
        {observed !== null ? (
          <div className="observed-duration">
            <span>Cycle length</span>
            <strong>{observed} days</strong>
            <span>used for the estimate</span>
          </div>
        ) : null}
        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            maxLength={2000}
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            <CircleAlert size={15} aria-hidden="true" /> {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={busy || deleting}>
            {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
            {busy ? 'Saving…' : 'Save cycle'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>

      <div className="modal-danger-zone">
        {confirmDelete ? (
          <>
            <p>Delete this cycle permanently? This cannot be undone.</p>
            <div className="inline-actions">
              <button
                className="btn danger small"
                onClick={() => void remove()}
                disabled={deleting}
              >
                {deleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                {deleting ? 'Deleting…' : 'Yes, delete cycle'}
              </button>
              <button
                className="btn ghost small"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Keep it
              </button>
            </div>
          </>
        ) : (
          <button className="text-link danger-text" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} aria-hidden="true" /> Delete this cycle
          </button>
        )}
      </div>
    </Modal>
  )
}
