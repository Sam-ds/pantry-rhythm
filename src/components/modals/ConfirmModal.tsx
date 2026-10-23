import { useState } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { Modal } from '../Modal'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => Promise<void> | void
  danger?: boolean
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
  danger = false,
}: ConfirmModalProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={title} size="small">
      <div className={`modal-callout${danger ? ' danger' : ''}`}>
        <TriangleAlert size={18} aria-hidden="true" />
        <div>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-actions">
        <button
          className={`btn ${danger ? 'danger' : 'primary'}`}
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : null}
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button className="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
