'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff } from 'lucide-react'
import { usePreferences } from '../context/usePreferences'
import { goHubHref } from '@/lib/serviceHub'
import { speak, speakAll } from '@/lib/speech'
import { VOICE_HELP, bestMatch, parseVoiceCommand } from '@/lib/voiceCommands'

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

/** The page's words in pieces short enough for every browser's voice. */
function pieces(text: string, max = 220): string[] {
  const out: string[] = []
  for (const line of text.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
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

/** What a screen reader would call a control: its aria-label, its label, or its words. */
function nameOf(el: HTMLElement): string {
  const labelled = el.getAttribute('aria-label') || el.getAttribute('title')
  if (labelled) return labelled
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    return Array.from(el.labels || []).map((l) => l.textContent || '').join(' ') || el.getAttribute('placeholder') || ''
  }
  return el.textContent || ''
}

/**
 * Voice commands (Odosa, October 2026: "'voice command' & 'talk' with the app
 * to navigate it"; lib/voiceCommands.ts). Off unless chosen in Accessibility,
 * or by choosing low vision or blind there. While the microphone is on it
 * keeps listening: go to a page, go back, scroll, read the page, click a
 * button by its name, search ResourceHub, or ask the assistant; "help" says
 * all of these. Every answer is spoken. The browser's speech service hears
 * the audio (the privacy page says so); Autinerary keeps no recordings.
 */
export default function VoiceNavigation() {
  const { prefs } = usePreferences()
  const router = useRouter()
  const recognition = useRef<Recognition | null>(null)
  const on = useRef(false)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')

  const enabled = Boolean(prefs.accessibility.voiceNavigation)
  useEffect(() => () => { on.current = false; recognition.current?.abort() }, [])
  useEffect(() => {
    if (!enabled) {
      on.current = false
      recognition.current?.abort()
      setListening(false)
      setMessage('')
    }
  }, [enabled])

  if (!enabled) return null

  // Say it, unless spoken descriptions already say what was pressed.
  const tell = (text: string, alwaysSpeak = false) => {
    setMessage(text)
    if (alwaysSpeak || !prefs.accessibility.spokenDescriptions) speak(text)
  }

  const act = (said: string) => {
    const c = parseVoiceCommand(said)
    switch (c.kind) {
      case 'go': {
        if (c.to === 'next-step') {
          const open = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/milestones/"]')).find((a) => /open this step/i.test(a.textContent || ''))
          if (open) { tell('Opening your next step.', true); open.click(); return }
          tell('Opening your Path. Your next step is at the top: say "click open this step".', true)
          router.push('/path')
          return
        }
        tell(`Opening ${c.label}.`, true)
        if (c.to.startsWith('hub:')) window.location.href = goHubHref(c.to.slice(4))
        else router.push(c.to)
        return
      }
      case 'back': tell('Going back.', true); router.back(); return
      case 'scroll': {
        const h = window.innerHeight * 0.8
        if (c.dir === 'top') window.scrollTo({ top: 0, behavior: 'smooth' })
        else if (c.dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        else window.scrollBy({ top: c.dir === 'down' ? h : -h, behavior: 'smooth' })
        setMessage(`Scrolled ${c.dir}.`)
        return
      }
      case 'read': {
        const main = (document.querySelector('main') as HTMLElement | null) || document.body
        setMessage('Reading the page. Say "stop" to stop.')
        speakAll(pieces(window.getSelection?.()?.toString() || main.innerText))
        return
      }
      case 'stop': window.speechSynthesis?.cancel(); setMessage('Stopped.'); return
      case 'help': tell(VOICE_HELP, true); return
      case 'where': {
        const h1 = document.querySelector('h1')?.textContent?.trim()
        tell(`${h1 || document.title}.`, true)
        return
      }
      case 'click': {
        const controls = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], summary'))
          .filter((el) => el.offsetParent !== null && !el.closest('[data-speech-exempt="true"]'))
          .map((el) => ({ el, name: nameOf(el) }))
        const found = bestMatch(c.name, controls)
        if (!found) { tell(`I couldn't find "${c.name}" on this page. Say "read this page" to hear what's here.`, true); return }
        found.el.focus()
        found.el.click()
        tell(`Pressed ${found.name.trim().slice(0, 80)}.`)
        return
      }
      case 'search':
        tell(`Searching ResourceHub for ${c.query}.`, true)
        window.location.href = goHubHref(`/search?ai=1&q=${encodeURIComponent(c.query)}`)
        return
      case 'ask':
        tell('Asking the assistant. The answer will be read aloud.', true)
        router.push(`/assistant?q=${encodeURIComponent(c.question)}&voice=1`)
        return
      default:
        tell(`I heard "${c.heard}", but don't know that one. Say "help" to hear what you can say.`, true)
    }
  }

  const start = () => {
    const speechWindow = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Constructor) { tell('Voice commands don’t work in this browser. Chrome, Edge and Safari support them.', true); return }
    const instance = new Constructor()
    recognition.current = instance
    instance.lang = 'en-US'
    instance.continuous = true
    instance.interimResults = false
    // Browsers stop listening after a silence: start again while it is on.
    instance.onend = () => {
      if (on.current) {
        try { instance.start() } catch { on.current = false; setListening(false) }
      } else setListening(false)
    }
    instance.onerror = (event) => {
      if (event?.error === 'no-speech' || event?.error === 'aborted') return
      on.current = false
      setListening(false)
      tell('The microphone is unavailable, or blocked for this site.', true)
    }
    instance.onresult = (event) => {
      const result = event.results[event.results.length - 1]
      const said = result?.[0]?.transcript || ''
      if (said.trim()) act(said)
    }
    try {
      instance.start()
      on.current = true
      setListening(true)
      tell('Listening. Say "help" to hear what you can say.', true)
    } catch {
      tell('Unable to start the microphone.', true)
    }
  }

  const toggle = () => {
    if (listening) {
      on.current = false
      recognition.current?.abort()
      setListening(false)
      setMessage('')
      return
    }
    start()
  }

  return (
    <div data-info-exempt="true" data-speech-exempt="true" className="relative">
      <button type="button" onClick={toggle} aria-label={listening ? 'Stop voice commands' : 'Start voice commands'} aria-pressed={listening} title="Voice commands (English)" className="rounded-lg p-2">
        {listening ? <MicOff className="h-5 w-5 text-red-600" /> : <Mic className="h-5 w-5" />}
      </button>
      {message && (
        <div className="fixed left-4 right-4 top-24 z-[90] rounded-lg border bg-white p-3 text-sm shadow-lg sm:left-auto sm:w-80">
          <p role="status">{message}</p>
          <button type="button" className="mt-2 underline" onClick={() => { setMessage(''); window.speechSynthesis?.cancel() }}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
