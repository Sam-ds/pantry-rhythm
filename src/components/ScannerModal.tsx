import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Keyboard, LoaderCircle, ShieldCheck } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'
import { Modal } from './Modal'

interface ScannerModalProps {
  open: boolean
  onClose: () => void
  onDetected: (barcode: string) => void
}

const FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
]

/**
 * Camera scanning needs a secure page and a camera stream. The native
 * BarcodeDetector is used where it exists (Android Chrome, ChromeOS); every
 * other browser, including Chrome and Safari on iOS, uses the bundled ZXing
 * decoder instead.
 */
export function canUseCameraScanner(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

export function ScannerModal({ open, onClose, onDetected }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fallbackRef = useRef<IScannerControls | null>(null)
  const callbackRef = useRef(onDetected)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [error, setError] = useState('')

  useEffect(() => {
    callbackRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let timer: number | undefined
    let handled = false

    const stop = () => {
      if (timer) window.clearTimeout(timer)
      fallbackRef.current?.stop()
      fallbackRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const accept = (rawValue: string) => {
      if (handled) return
      if (rawValue.replace(/\D/g, '').length < 6) return
      handled = true
      stop()
      callbackRef.current(rawValue)
    }

    const start = async () => {
      setStatus('starting')
      setError('')

      if (!canUseCameraScanner()) {
        setStatus('error')
        setError(
          window.isSecureContext === false
            ? 'Camera access needs the secure (https) version of this page. Enter the barcode manually instead.'
            : 'Camera access is not available in this browser. Enter the barcode manually instead.',
        )
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        if (window.BarcodeDetector) {
          const supported = await window.BarcodeDetector.getSupportedFormats()
          const formats = FORMATS.filter((format) => supported.includes(format))
          const detector = new window.BarcodeDetector(
            formats.length > 0 ? { formats } : undefined,
          )

          setStatus('scanning')

          const scan = async () => {
            if (cancelled || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              const barcode = codes.find(
                (code) => code.rawValue.replace(/\D/g, '').length >= 6,
              )
              if (barcode) {
                accept(barcode.rawValue)
                return
              }
            } catch {
              // Some browsers reject a frame while the camera is still warming up.
            }
            if (!cancelled) timer = window.setTimeout(scan, 450)
          }
          scan()
          return
        }

        // iOS Safari/Chrome, Firefox, and desktop Chrome on Windows have no
        // BarcodeDetector. ZXing decodes the same video frames on device.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
          await Promise.all([import('@zxing/browser'), import('@zxing/library')])

        if (cancelled) return

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 220,
        })

        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) accept(result.getText())
        })
        if (cancelled) {
          controls.stop()
          return
        }
        fallbackRef.current = controls
        setStatus('scanning')
      } catch (caught) {
        if (cancelled) return
        const name = caught instanceof DOMException ? caught.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError(
            'Camera permission was blocked. Allow camera access in your browser settings, or enter the barcode manually.',
          )
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('No camera was found. You can enter the barcode manually.')
        } else {
          setError(
            'The camera could not start. Enter the barcode manually or try again in a secure browser context.',
          )
        }
        setStatus('error')
      }
    }

    void start()
    return () => {
      cancelled = true
      stop()
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scan a barcode"
      subtitle="Hold the barcode inside the frame. Frames are processed on this device."
      size="small"
    >
      <div className="scanner-frame">
        {status === 'error' ? (
          <div className="scanner-error">
            <span className="scanner-error-icon">
              <CameraOff size={27} aria-hidden="true" />
            </span>
            <p>{error}</p>
            <button className="btn secondary small" onClick={onClose}>
              <Keyboard size={15} aria-hidden="true" /> Enter it manually
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="scanner-video"
              muted
              playsInline
              aria-label="Camera viewfinder"
            />
            <div className="scanner-overlay" aria-hidden="true">
              <span className="scanner-corner top-left" />
              <span className="scanner-corner top-right" />
              <span className="scanner-corner bottom-left" />
              <span className="scanner-corner bottom-right" />
              {status === 'scanning' ? <span className="scanner-line" /> : null}
            </div>
            {status === 'starting' ? (
              <div className="scanner-status">
                <LoaderCircle className="spin" size={18} aria-hidden="true" /> Starting camera…
              </div>
            ) : null}
            {status === 'scanning' ? (
              <div className="scanner-status">
                <Camera size={17} aria-hidden="true" /> Looking for a barcode…
              </div>
            ) : null}
          </>
        )}
      </div>
      <p className="scanner-privacy">
        <ShieldCheck size={14} aria-hidden="true" /> No photo or video is saved or uploaded.
      </p>
    </Modal>
  )
}
