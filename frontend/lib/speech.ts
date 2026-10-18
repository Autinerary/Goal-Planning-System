// Speaking aloud, with the voice, speed and volume chosen in Settings →
// Accessibility (Riipen Labs, Group 11: "let users choose a more
// natural-sounding AI voice, or adjust or mute audio. Voices can feel
// unnatural or overwhelming to first-time users"). Every place that speaks
// goes through here: spoken descriptions, the voice-guided intro and voice
// navigation's confirmations.

import { loadPreferences } from '@/lib/preferences'

export const SPEECH_RATES = [
  { id: 0.8, label: 'Slower' },
  { id: 1, label: 'Normal' },
  { id: 1.2, label: 'Faster' },
] as const

export const SPEECH_VOLUMES = [
  { id: 0.5, label: 'Quieter' },
  { id: 1, label: 'Normal' },
] as const

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Names browsers give their better voices ("Microsoft Aria Online (Natural)",
// "Samantha (Enhanced)", "Google UK English Female"): listed first.
const NATURAL = /natural|neural|enhanced|premium|online|google/i

/** The voices for a language, more natural-sounding ones first. */
export function voicesFor(language: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const base = (language || 'en').split('-')[0].toLowerCase()
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith(base))
    .sort((a, b) => Number(NATURAL.test(b.name)) - Number(NATURAL.test(a.name)) || a.name.localeCompare(b.name))
}

export function isNaturalVoice(voice: SpeechSynthesisVoice): boolean {
  return NATURAL.test(voice.name)
}

/** The browser's voices, waiting for them once if they are still loading. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([])
  const now = window.speechSynthesis.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
}

function utteranceFor(text: string): SpeechSynthesisUtterance {
  const prefs = loadPreferences()
  const a = prefs.accessibility
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = prefs.language
  utterance.rate = a.speechRate || 1
  utterance.volume = a.speechVolume ?? 1
  if (a.voiceName) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.name === a.voiceName)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
  }
  return utterance
}

/** Speak, replacing anything already being said. Returns the utterance. */
export function speak(text: string): SpeechSynthesisUtterance | null {
  if (!speechSupported() || !text) return null
  const utterance = utteranceFor(text)
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return utterance
}

/**
 * Text in pieces short enough for every browser to read (some stop a long
 * utterance after about 15 seconds): by line, then by sentence.
 */
export function speechChunks(text: string, max = 220): string[] {
  const out: string[] = []
  for (const line of text.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    if (line.length <= max) {
      out.push(line)
      continue
    }
    let piece = ''
    for (const sentence of line.match(/[^.!?]+[.!?]*\s*/g) || [line]) {
      if ((piece + sentence).length > max && piece) {
        out.push(piece.trim())
        piece = ''
      }
      piece += sentence
    }
    if (piece.trim()) out.push(piece.trim())
  }
  return out
}

/** Reads several pieces in order, replacing anything being said; `onEnd` runs after the last one, or when stopped. */
export function speakAll(chunks: string[], onEnd?: () => void): void {
  if (!speechSupported() || !chunks.length) return onEnd?.()
  window.speechSynthesis.cancel()
  chunks.forEach((chunk, i) => {
    const u = utteranceFor(chunk)
    if (i === chunks.length - 1) {
      u.onend = () => onEnd?.()
      u.onerror = () => onEnd?.()
    }
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}
