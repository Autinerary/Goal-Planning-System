// Small "bubble wrap pop" feedback sound played when a task is checked off
// (Liam's suggestion). Synthesized with the Web Audio API so we don't need to
// ship an audio file. Respects the user's reduced-motion/sound preference and
// is a no-op on the server or in browsers without AudioContext support.

import { loadPreferences } from '@/lib/preferences'

let sharedContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return null
  if (!sharedContext) sharedContext = new Ctx()
  return sharedContext
}

/**
 * True when the user wants task sounds. Sourced from the accessibility
 * preferences (`soundEffects`), and also suppressed when they've asked to
 * reduce motion — so the toggle in Settings → Accessibility controls it.
 */
export function isTaskSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const a = loadPreferences().accessibility
    return !!a.soundEffects && !a.reduceMotion
  } catch {
    return true
  }
}

/** Plays a quick, gentle "pop" — like popping a bubble wrap bubble. */
export function playTaskCompleteSound() {
  if (!isTaskSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.12)
  } catch {
    // Ignore playback errors (e.g. autoplay policy before first interaction).
  }
}
