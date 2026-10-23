type AudioContextConstructor = new () => AudioContext

let context: AudioContext | null = null

/**
 * Returns the shared audio context, creating it lazily. iOS only lets a context
 * start from a user gesture, so callers should prime it from the tap that opens
 * the scanner.
 */
function getAudioContext(): AudioContext | null {
  if (context && context.state === 'closed') context = null
  if (context) return context

  const scope = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor
    webkitAudioContext?: AudioContextConstructor
  }
  const Constructor = scope.AudioContext ?? scope.webkitAudioContext
  if (!Constructor) return null

  try {
    context = new Constructor()
  } catch {
    return null
  }
  return context
}

/**
 * Call from a click/tap handler so a later confirmation chime is allowed to
 * play on iOS, where audio needs to be unlocked by a gesture.
 */
export function primeScanSound(): void {
  const audio = getAudioContext()
  if (audio?.state === 'suspended') {
    void audio.resume().catch(() => {})
  }
}

/**
 * A short two-note chime plus a light vibration when a barcode is decoded.
 * Everything is synthesised locally; no audio file is downloaded.
 */
export function playScanSuccess(): void {
  const audio = getAudioContext()
  if (!audio) return
  if (audio.state === 'suspended') {
    void audio.resume().catch(() => {})
  }

  const start = audio.currentTime
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, start)
  oscillator.frequency.setValueAtTime(1318.5, start + 0.075)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24)

  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + 0.26)

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(35)
  }
}
