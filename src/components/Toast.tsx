import { useEffect } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'

export interface ToastMessage {
  id: number
  text: string
  tone: 'success' | 'error'
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, 4_500)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      {toast.tone === 'success' ? (
        <CheckCircle2 size={19} aria-hidden="true" />
      ) : (
        <CircleAlert size={19} aria-hidden="true" />
      )}
      <span>{toast.text}</span>
      <button className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss message">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}
