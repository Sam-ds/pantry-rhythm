import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  FileJson,
  Link2,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  ScanLine,
  Share2,
  Upload,
} from 'lucide-react'
import type { SharePayload, TrackedItem } from '../types'
import {
  decodeShareToken,
  encodeSharePayload,
  isQrFriendly,
  makeSharePayload,
  makeShareUrl,
  normalizeSharePayload,
  readShareTokenFromHash,
  shareSizeLabel,
  ShareDataError,
} from '../lib/share'
import { todayISO } from '../lib/dates'

interface ShareViewProps {
  items: TrackedItem[]
  householdName: string
  onImportPayload: (payload: SharePayload) => void
  onToast: (message: string, tone?: 'success' | 'error') => void
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function downloadJson(payload: SharePayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `pantry-rhythm-${todayISO()}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function ShareView({
  items,
  householdName,
  onImportPayload,
  onToast,
}: ShareViewProps) {
  const [token, setToken] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrError, setQrError] = useState('')
  const [copied, setCopied] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const payload = useMemo(() => makeSharePayload(items, householdName), [items, householdName])
  const totalPurchases = items.reduce((total, item) => total + item.purchases.length, 0)
  const nativeShareAvailable =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    let cancelled = false
    setQrError('')
    setQrDataUrl('')
    setToken('')
    setShareUrl('')

    const generate = async () => {
      try {
        const encoded = await encodeSharePayload(payload)
        if (cancelled) return
        const url = makeShareUrl(encoded)
        setToken(encoded)
        setShareUrl(url)
        if (!isQrFriendly(url)) {
          setQrError(
            'This household has too much data for a reliable QR code. Copy the link or download a JSON backup instead.',
          )
          return
        }
        try {
          const dataUrl = await QRCode.toDataURL(url, {
            errorCorrectionLevel: 'L',
            margin: 2,
            width: 360,
            color: { dark: '#173f35', light: '#fffdf8' },
          })
          if (!cancelled) setQrDataUrl(dataUrl)
        } catch {
          if (!cancelled) {
            setQrError(
              'The QR code could not be rendered. The link below still contains your data.',
            )
          }
        }
      } catch (error) {
        if (!cancelled) {
          setQrError(
            error instanceof Error ? error.message : 'Could not prepare the share link.',
          )
        }
      }
    }

    void generate()
    return () => {
      cancelled = true
    }
  }, [payload])

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await copyText(shareUrl)
      setCopied(true)
      onToast('Share link copied. Anyone with it can read this household data.')
      window.setTimeout(() => setCopied(false), 2_200)
    } catch {
      onToast('Could not copy automatically. Select the link text and copy it.', 'error')
    }
  }

  const handleNativeShare = async () => {
    if (!shareUrl) return
    try {
      await navigator.share({
        title: 'Pantry Rhythm household',
        text: 'A local-first pantry list and restock estimate from my household.',
        url: shareUrl,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      onToast('The system share sheet could not open. Copy the link instead.', 'error')
    }
  }

  const importPasted = async () => {
    const value = pasteValue.trim()
    if (!value) return
    setImportError('')
    setImporting(true)
    try {
      if (value.startsWith('{')) {
        const parsed = JSON.parse(value)
        onImportPayload(normalizeSharePayload(parsed))
      } else {
        let tokenValue = value
        if (value.includes('#')) {
          const hash = value.slice(value.indexOf('#'))
          tokenValue = readShareTokenFromHash(hash) ?? value
        } else if (value.includes('share=')) {
          tokenValue = new URLSearchParams(value.split('?')[1]?.split('#')[0]).get('share') ?? value
        }
        const decoded = await decodeShareToken(tokenValue)
        onImportPayload(decoded)
      }
      setPasteValue('')
    } catch (error) {
      setImportError(
        error instanceof ShareDataError || error instanceof SyntaxError
          ? error.message
          : 'That does not look like a Pantry Rhythm link or backup.',
      )
    } finally {
      setImporting(false)
    }
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    setImportError('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      onImportPayload(normalizeSharePayload(parsed))
    } catch (error) {
      setImportError(
        error instanceof ShareDataError || error instanceof SyntaxError
          ? error.message
          : 'This file is not a valid Pantry Rhythm backup.',
      )
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="page share-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Share &amp; backup</p>
          <h1>Take your pantry with you</h1>
          <p className="page-subtitle">
            Links and QR codes are created in this browser. There is no upload step.
          </p>
        </div>
      </header>

      <div className="share-grid">
        <section className="qr-card">
          <div className="qr-card-heading">
            <div>
              <span className="eyebrow">Household QR</span>
              <h2>Scan to import</h2>
            </div>
            <span className="qr-count">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {qrDataUrl ? (
            <div className="qr-frame">
              <img src={qrDataUrl} alt="QR code containing this household's Pantry Rhythm data" />
            </div>
          ) : qrError ? (
            <div className="qr-unavailable">
              <QrCode size={40} aria-hidden="true" />
              <p>{qrError}</p>
            </div>
          ) : (
            <div className="qr-loading">
              <LoaderCircle className="spin" size={24} aria-hidden="true" />
              <span>Preparing QR…</span>
            </div>
          )}

          <div className="share-warning">
            <LockKeyhole size={15} aria-hidden="true" />
            <p>
              The QR and link contain your household data. Only share them with people you trust.
              Anyone who has the link can read it.
            </p>
          </div>

          <div className="share-stat-row">
            <span>
              <strong>{items.length}</strong> items
            </span>
            <span>
              <strong>{totalPurchases}</strong> purchases
            </span>
            <span>
              <strong>{shareUrl ? `${Math.ceil(shareUrl.length / 1024)} KB` : '—'}</strong> link
            </span>
          </div>
        </section>

        <section className="panel share-link-card">
          <div className="share-link-heading">
            <span className="share-link-icon">
              <Link2 size={20} aria-hidden="true" />
            </span>
            <div>
              <h2>Copy a share link</h2>
              <p>
                The data lives in the part of the URL after <code>#</code>, which browsers do
                not send to the web server hosting this app.
              </p>
            </div>
          </div>

          <label className="field share-url-field">
            <span>Share URL</span>
            <textarea
              readOnly
              value={shareUrl || 'Preparing…'}
              rows={3}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>

          <div className="share-actions">
            <button className="btn primary" onClick={() => void handleCopy()} disabled={!shareUrl}>
              {copied ? <Check size={17} aria-hidden="true" /> : <Clipboard size={17} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {nativeShareAvailable ? (
              <button
                className="btn secondary"
                onClick={() => void handleNativeShare()}
                disabled={!shareUrl}
              >
                <Share2 size={17} aria-hidden="true" /> Share…
              </button>
            ) : null}
            <button
              className="btn ghost"
              onClick={() => {
                downloadJson(payload)
                onToast('Backup downloaded as a JSON file.')
              }}
            >
              <Download size={17} aria-hidden="true" /> Backup JSON
            </button>
          </div>

          <div className="share-size-line">
            <span>{shareUrl ? shareSizeLabel(shareUrl) : ''}</span>
            {token ? <code>{token.slice(0, 28)}…</code> : null}
          </div>

          <div className="share-divider" />

          <div className="import-block">
            <div className="import-heading">
              <span className="share-link-icon">
                <Upload size={19} aria-hidden="true" />
              </span>
              <div>
                <h2>Import a household</h2>
                <p>Open a Pantry Rhythm link, paste a token, or choose a JSON backup.</p>
              </div>
            </div>

            <label className="field">
              <span>Share link or token</span>
              <textarea
                value={pasteValue}
                onChange={(event) => setPasteValue(event.target.value)}
                placeholder="https://…/#share=1.…"
                rows={3}
              />
            </label>
            <div className="import-actions">
              <button
                className="btn secondary"
                onClick={() => void importPasted()}
                disabled={!pasteValue.trim() || importing}
              >
                {importing ? (
                  <LoaderCircle className="spin" size={16} aria-hidden="true" />
                ) : (
                  <ScanLine size={16} aria-hidden="true" />
                )}
                {importing ? 'Reading…' : 'Open link'}
              </button>
              <button className="btn ghost" onClick={() => fileInput.current?.click()}>
                <FileJson size={16} aria-hidden="true" /> Choose backup file
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => void importFile(event.target.files?.[0])}
              />
            </div>
            {importError ? (
              <p className="form-error" role="alert">
                <AlertTriangle size={15} aria-hidden="true" /> {importError}
              </p>
            ) : null}
            <p className="import-note">
              You'll be asked whether to merge the imported items into this device or replace
              what is here. Nothing is overwritten automatically.
            </p>
          </div>
        </section>

        <aside className="share-aside">
          <div className="insight-card">
            <span className="insight-icon">
              <QrCode size={19} aria-hidden="true" />
            </span>
            <h2>QR capacity</h2>
            <p>
              QR codes can hold a limited amount of data. If your household grows too large for
              a reliable scan, the app keeps the link and JSON backup available.
            </p>
          </div>
          <div className="insight-card insight-muted">
            <span className="insight-icon">
              <LockKeyhole size={19} aria-hidden="true" />
            </span>
            <h2>Local by design</h2>
            <p>
              Pantry Rhythm has no accounts or cloud database. Sharing is an explicit export
              from your device, not a sync feature.
            </p>
          </div>
          <div className="insight-card insight-warm">
            <span className="insight-icon">
              <Download size={19} aria-hidden="true" />
            </span>
            <h2>Keep a backup</h2>
            <p>
              Browser storage can be cleared by you, your browser, or device cleanup tools.
              Download a JSON backup after big changes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
