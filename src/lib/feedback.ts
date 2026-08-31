import type { CardOutcome } from '../game/round'

let audioContext: AudioContext | null = null

const getAudioContext = () => {
  audioContext ??= new AudioContext()
  return audioContext
}

export const primeFeedbackAudio = async (enabled: boolean) => {
  if (!enabled) {
    return
  }

  const context = getAudioContext()
  if (context.state === 'suspended') {
    await context.resume()
  }
}

export const playPositionReadyFeedback = (hapticsEnabled: boolean) => {
  if (hapticsEnabled && 'vibrate' in navigator) {
    navigator.vibrate([55, 45, 100])
  }
}

export const playFeedback = (
  outcome: CardOutcome,
  soundEnabled: boolean,
  hapticsEnabled: boolean,
) => {
  if (hapticsEnabled && 'vibrate' in navigator) {
    navigator.vibrate(outcome === 'correct' ? 60 : [35, 45, 35])
  }

  if (!soundEnabled) {
    return
  }

  const context = getAudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const startAt = context.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(
    outcome === 'correct' ? 620 : 240,
    startAt,
  )
  oscillator.frequency.exponentialRampToValueAtTime(
    outcome === 'correct' ? 880 : 170,
    startAt + 0.1,
  )
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + 0.13)
}