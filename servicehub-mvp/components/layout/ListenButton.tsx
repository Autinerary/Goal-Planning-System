'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Square, Volume2 } from 'lucide-react'

// Browsers' better voices ("Microsoft Aria Online (Natural)", "Samantha (Enhanced)"), as the app picks them.
const NATURAL = /natural|neural|enhanced|premium|online|google/i

function chunks(text: string, max = 220): string[] {
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

/**
 * "Listen to this page" (the planning note, October 2026, Goal 10: "make the
 * site audible"): the page's main content, or the words selected, read by
 * the browser. The app's Settings, Accessibility, can turn it off and set the
 * speed; both reach ResourceHub through the hand-off (lib/a11y.ts:
 * data-listen, data-speech-rate). Nothing speaks until it is pressed.
 */
export default function ListenButton({ className = '' }: { className?: string }) {
  const pathname = usePathname()
  const [can, setCan] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    setCan(typeof window !== 'undefined' && 'speechSynthesis' in window && document.documentElement.dataset.listen !== 'off')
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [pathname])

  if (!can) return null

  const listen = () => {
    const synth = window.speechSynthesis
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    const selected = window.getSelection?.()?.toString().trim()
    const text = selected || (document.querySelector('main') as HTMLElement | null)?.innerText || ''
    const parts = chunks(text)
    if (!parts.length) return
    const speed = document.documentElement.dataset.speechRate
    const rate = speed === 'slow' ? 0.8 : speed === 'fast' ? 1.2 : 1
    const lang = document.documentElement.lang || 'en'
    const voice = synth
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0]))
      .sort((a, b) => Number(NATURAL.test(b.name)) - Number(NATURAL.test(a.name)))[0]
    synth.cancel()
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p)
      u.rate = rate
      if (voice) u.voice = voice
      if (i === parts.length - 1) {
        u.onend = () => setSpeaking(false)
        u.onerror = () => setSpeaking(false)
      }
      synth.speak(u)
    })
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      onClick={listen}
      aria-pressed={speaking}
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
      {speaking ? 'Stop' : 'Listen to this page'}
    </button>
  )
}
