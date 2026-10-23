import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn()
const stop = vi.fn()
const setFrequency = vi.fn()
const setGain = vi.fn()
const rampGain = vi.fn()
const resume = vi.fn(() => Promise.resolve())
const vibrate = vi.fn()

class FakeAudioContext {
  state: AudioContextState = 'running'
  currentTime = 2
  destination = {}
  resume = resume

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: setFrequency },
      connect: vi.fn(),
      start,
      stop,
    }
  }

  createGain() {
    return {
      gain: { setValueAtTime: setGain, exponentialRampToValueAtTime: rampGain },
      connect: vi.fn(),
    }
  }
}

class SuspendedAudioContext extends FakeAudioContext {
  state: AudioContextState = 'suspended'
}

describe('scan feedback', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('navigator', { vibrate })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('plays a short two-note chime and vibrates once', async () => {
    const { playScanSuccess } = await import('./scanFeedback')
    playScanSuccess()

    expect(start).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledWith(2.26)
    expect(setFrequency).toHaveBeenNthCalledWith(1, 880, 2)
    expect(setFrequency).toHaveBeenNthCalledWith(2, 1318.5, 2.075)
    expect(rampGain).toHaveBeenCalledTimes(2)
    expect(vibrate).toHaveBeenCalledWith(35)
  })

  it('resumes a suspended context and still plays', async () => {
    vi.stubGlobal('AudioContext', SuspendedAudioContext)
    const { primeScanSound, playScanSuccess } = await import('./scanFeedback')

    primeScanSound()
    playScanSuccess()

    expect(resume).toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('stays silent instead of throwing without Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { playScanSuccess } = await import('./scanFeedback')

    expect(() => playScanSuccess()).not.toThrow()
    expect(start).not.toHaveBeenCalled()
  })
})
