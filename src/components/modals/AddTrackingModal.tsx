import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle, PackagePlus, ShieldCheck } from 'lucide-react'
import type { CreateItemInput, ProductCandidate } from '../../types'
import { todayISO } from '../../lib/dates'
import { Modal } from '../Modal'
import { ProductThumb } from '../ProductThumb'

interface AddTrackingModalProps {
  product: ProductCandidate
  onClose: () => void
  onCreate: (input: CreateItemInput) => Promise<void>
}

const presets = [7, 14, 30, 60, 90]

export function AddTrackingModal({ product, onClose, onCreate }: AddTrackingModalProps) {
  const [purchasedAt, setPurchasedAt] = useState(todayISO())
  const [quantity, setQuantity] = useState('1')
  const [unitLabel, setUnitLabel] = useState('item')
  const [duration, setDuration] = useState('30')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPurchasedAt(todayISO())
    setQuantity('1')
    setUnitLabel('item')
    setDuration('30')
    setNotes('')
    setError('')
  }, [product.barcode, product.name])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onCreate({
        product,
        unitLabel,
        notes,
        firstPurchase: {
          purchasedAt,
          quantity: Number(quantity),
          estimatedDurationDays: Number(duration),
          notes: '',
        },
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add to your pantry"
      subtitle="Your purchase details are stored only in this browser."
      size="medium"
    >
      <div className="selected-product">
        <ProductThumb src={product.imageUrl} name={product.name} size="medium" />
        <div>
          <strong>{product.name}</strong>
          <span>{product.brand || 'No brand'}</span>
          {product.barcode ? <code>{product.barcode}</code> : <span>Manual product</span>}
        </div>
        <span className={`source-pill${product.source === 'openfoodfacts' ? '' : ' manual'}`}>
          {product.source === 'openfoodfacts' ? 'Open Food Facts' : 'Manual'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="modal-form">
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
          <label className="field">
            <span>Unit name</span>
            <input
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              placeholder="carton, bag, roll"
              maxLength={30}
            />
          </label>
          <label className="field">
            <span>How long should this last?</span>
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
        </div>

        <div className="duration-presets">
          <span>Quick estimate</span>
          {presets.map((days) => (
            <button
              type="button"
              key={days}
              className={duration === String(days) ? 'active' : ''}
              onClick={() => setDuration(String(days))}
            >
              {days} days
            </button>
          ))}
        </div>

        <label className="field">
          <span>Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Who uses it, where it's kept, anything to remember…"
            rows={3}
            maxLength={2000}
          />
        </label>

        <p className="form-hint">
          <ShieldCheck size={14} aria-hidden="true" /> The first estimate is a starting point.
          Log real run-outs to make the range more useful.
        </p>

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
              <PackagePlus size={17} aria-hidden="true" />
            )}
            {busy ? 'Adding…' : 'Start tracking'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
