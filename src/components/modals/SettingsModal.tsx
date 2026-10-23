import { useState } from 'react'
import {
  CircleAlert,
  Database,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Modal } from '../Modal'

interface SettingsModalProps {
  householdName: string
  itemCount: number
  purchaseCount: number
  onClose: () => void
  onSave: (householdName: string) => Promise<void>
  onShowAbout: () => void
  onShowShare: () => void
  onClearData: () => void
}

export function SettingsModal({
  householdName,
  itemCount,
  purchaseCount,
  onClose,
  onSave,
  onShowAbout,
  onShowShare,
  onClearData,
}: SettingsModalProps) {
  const [name, setName] = useState(householdName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    setSaved(false)
    try {
      await onSave(name)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1_800)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the household name.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Settings"
      subtitle="A local-first household, no account attached."
      size="small"
    >
      <form onSubmit={submit} className="modal-form">
        <label className="field">
          <span>Household name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Our household"
            maxLength={160}
          />
        </label>
        <div className="local-data-summary">
          <Database size={18} aria-hidden="true" />
          <div>
            <strong>Stored on this device</strong>
            <p>
              {itemCount} {itemCount === 1 ? 'item' : 'items'} · {purchaseCount}{' '}
              {purchaseCount === 1 ? 'purchase' : 'purchases'} in IndexedDB.
            </p>
          </div>
        </div>
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
              <Save size={17} aria-hidden="true" />
            )}
            {busy ? 'Saving…' : saved ? 'Saved' : 'Save name'}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>

      <div className="settings-links">
        <button className="settings-link" onClick={onShowShare}>
          <QrCode size={18} aria-hidden="true" />
          <span>
            <strong>Share &amp; backup</strong>
            <small>QR code, link, JSON export and import</small>
          </span>
        </button>
        <button className="settings-link" onClick={onShowAbout}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            <strong>About &amp; privacy</strong>
            <small>How estimates and local storage work</small>
          </span>
        </button>
      </div>

      <div className="settings-privacy">
        <LockKeyhole size={16} aria-hidden="true" />
        <p>
          No sign-in or cloud sync. Clearing browser data for this site removes the household, so
          download a backup if it matters.
        </p>
      </div>

      <div className="modal-danger-zone">
        <button className="text-link danger-text" onClick={onClearData}>
          <Trash2 size={14} aria-hidden="true" /> Clear all local data
        </button>
      </div>
    </Modal>
  )
}
