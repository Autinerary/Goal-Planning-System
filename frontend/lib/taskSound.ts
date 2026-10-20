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

/**
 * A short "page turn" / paper rustle, played when a submission is processed
 * (Liam: "for every submission for the journey, it makes a page turning/paper
 * sound to signify it processed"). Synthesized as a burst of band-passed noise
 * with a quick swell-and-decay envelope — no audio file needed.
 *
 * Respects the same sound preference as the task pop.
 */
export function playPageTurnSound() {
  if (!isTaskSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime
    const duration = 0.32

    // White-noise source — the raw material of a paper rustle.
    const frames = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // Band-pass sweeping upward gives the "swish" of a page being turned.
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(700, now)
    filter.frequency.linearRampToValueAtTime(2600, now + duration * 0.6)
    filter.frequency.linearRampToValueAtTime(1200, now + duration)

    // Soft swell then fall, so it reads as a rustle rather than a click.
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.07)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.start(now)
    source.stop(now + duration)
  } catch {
    // Ignore playback errors (e.g. autoplay policy before first interaction).
  }
}

/**
 * A friendly car horn, "beep beep", when a step is done on the Race view
 * (Liam, October 2026: "a car with the person inside of it? And when there
 * is a task done it beeps?"). Two short soft square-wave notes, quieter
 * than a real horn. Respects the same sound preference as the task pop.
 */
export function playCarBeep() {
  if (!isTaskSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    for (const [start, length] of [[0, 0.12], [0.18, 0.16]] as const) {
      const osc = ctx.createOscillator()
      const tone = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      osc.type = 'square'
      tone.type = 'square'
      osc.frequency.setValueAtTime(440, now + start)
      // A second voice a little higher gives the two-tone of a car horn.
      tone.frequency.setValueAtTime(554, now + start)
      filter.type = 'lowpass'
      filter.frequency.value = 1800
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.06, now + start + 0.015)
      gain.gain.setValueAtTime(0.06, now + start + length - 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
      osc.connect(filter)
      tone.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      tone.start(now + start)
      osc.stop(now + start + length + 0.02)
      tone.stop(now + start + length + 0.02)
    }
  } catch {
    // Ignore playback errors (e.g. autoplay policy before first interaction).
  }
}
