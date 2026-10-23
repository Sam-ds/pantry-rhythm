import { useState } from 'react'
import { ArrowDownToLine, CircleAlert, LoaderCircle, Replace, ShieldAlert, Users } from 'lucide-react'
import type { ImportResult, SharePayload } from '../../types'
import { formatDateTime } from '../../lib/dates'
import { Modal } from '../Modal'

interface ImportModalProps {
  payload: SharePayload
  currentItemCount: number
  onClose: () => void
  onImport: (mode: 'merge' | 'replace') => Promise<ImportResult>
}

export function ImportModal({
  payload,
  currentItemCount,
  onClose,
  onImport,
}: ImportModalProps) {
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const purchaseCount = payload.items.reduce((total, item) => total + item.purchases.length, 0)
  const replacing = mode === 'replace'

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await onImport(mode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not import this household.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import a shared household"
      subtitle="Review what will be added before anything changes."
      size="small"
    >
      <div className="import-summary">
        <span className="import-summary-icon">
          <Users size={21} aria-hidden="true" />
        </span>
        <div>
          <strong>{payload.householdName}</strong>
          <p>
            {payload.items.length} {payload.items.length === 1 ? 'item' : 'items'} ·{' '}
            {purchaseCount} {purchaseCount === 1 ? 'purchase' : 'purchases'}
          </p>
          <small>Exported {formatDateTime(payload.exportedAt)}</small>
        </div>
      </div>

      <div className="import-modes" role="radiogroup" aria-label="Import method">
        <button
          className={`import-mode${mode === 'merge' ? ' active' : ''}`}
          onClick={() => setMode('merge')}
          role="radio"
          aria-checked={mode === 'merge'}
        >
          <ArrowDownToLine size={19} aria-hidden="true" />
          <span>
            <strong>Merge into this device</strong>
            <small>
              Add items that are not already here. Keep your current household and{' '}
              {currentItemCount} {currentItemCount === 1 ? 'item' : 'items'}.
            </small>
          </span>
        </button>
        <button
          className={`import-mode import-mode-danger${mode === 'replace' ? ' active' : ''}`}
          onClick={() => setMode('replace')}
          role="radio"
          aria-checked={mode === 'replace'}
        >
          <Replace size={19} aria-hidden="true" />
          <span>
            <strong>Replace this device's data</strong>
            <small>
              Delete the current {currentItemCount} {currentItemCount === 1 ? 'item' : 'items'} and
              use this household instead.
            </small>
          </span>
        </button>
      </div>

      {replacing ? (
        <div className="modal-callout danger">
          <ShieldAlert size={18} aria-hidden="true" />
          <div>
            <strong>This cannot be undone</strong>
            <p>Download a backup from the Share page first if you might want the current data.</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          <CircleAlert size={15} aria-hidden="true" /> {error}
        </p>
      ) : null}

      <div className="form-actions">
        <button
          className={`btn ${replacing ? 'danger' : 'primary'}`}
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
          {busy ? 'Importing…' : replacing ? 'Replace with shared data' : 'Merge shared data'}
        </button>
        <button className="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
