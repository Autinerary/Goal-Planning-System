'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Leaf, Square, Volume2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { loadPreferences, saveAccessibility } from '@/lib/preferences'
import { speakAll, speechChunks, speechSupported, stopSpeaking } from '@/lib/speech'
import { noteFor, normIds, today } from '@/lib/positive'

const NORMS_KEY = 'autinerary_note_norms'

/** The words someone selected, or the page's main content, as it is read on screen. */
function textToRead(): string {
  const selected = window.getSelection?.()?.toString().trim()
  if (selected) return selected
  const main = document.querySelector('main')
  return (main as HTMLElement | null)?.innerText || ''
}

/**
 * The foot of every page: "Listen to this page" (the planning note, October
 * 2026, Goal 10: "make the site audible"), read with the voice, speed and
 * volume chosen in Settings, and a note for today (Goal 11, the Positivity
 * Quota; lib/positive.ts), on some days for one of the person's norms. Both
 * can be turned off in Settings → Accessibility. Nothing speaks until
 * someone presses Listen, and it stops when they leave the page.
 */
export default function PageFooter() {
  const pathname = usePathname() || '/'
  const { user } = useAuth()
  const [prefs, setPrefs] = useState({ readAloud: true, dailyNotes: true })
  const [canSpeak, setCanSpeak] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [norms, setNorms] = useState<string[]>([])
  const [note, setNote] = useState('')

  useEffect(() => {
    const read = () => {
      const a = loadPreferences().accessibility
      setPrefs({ readAloud: a.readAloud !== false, dailyNotes: a.dailyNotes !== false })
    }
    read()
    setCanSpeak(speechSupported())
    window.addEventListener('autinerary:prefs', read)
    return () => window.removeEventListener('autinerary:prefs', read)
  }, [])

  useEffect(() => {
    if (!user) return setNorms([])
    try {
      const kept = sessionStorage.getItem(NORMS_KEY)
      if (kept) return setNorms(JSON.parse(kept))
    } catch {}
    fetch('/api/me/norms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { norms: [] }))
      .then((d) => {
        const ids = normIds(d.norms || [])
        setNorms(ids)
        try {
          sessionStorage.setItem(NORMS_KEY, JSON.stringify(ids))
        } catch {}
      })
      .catch(() => {})
  }, [user])

  useEffect(() => setNote(noteFor(today(), pathname, norms)), [pathname, norms])

  // A new page stops the old one being read.
  useEffect(() => {
    stopSpeaking()
    setSpeaking(false)
  }, [pathname])
  useEffect(() => () => stopSpeaking(), [])

  const listen = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const chunks = speechChunks(textToRead())
    if (!chunks.length) return
    setSpeaking(true)
    speakAll(chunks, () => setSpeaking(false))
  }

  const showListen = prefs.readAloud && canSpeak
  const showNote = prefs.dailyNotes && Boolean(note)
  if (!showListen && !showNote) return null
  return (
    <aside aria-label="Listen, and a note for today" className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        {showNote ? (
          <p className="flex items-center gap-2 text-sm text-slate-800">
            <Leaf className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            {note}
            <button
              type="button"
              onClick={() => saveAccessibility({ dailyNotes: false })}
              className="ml-1 text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
            >
              Hide these notes
            </button>
          </p>
        ) : (
          <span />
        )}
        {showListen && (
          <button
            type="button"
            onClick={listen}
            aria-pressed={speaking}
            data-info="Reads this page aloud, or just the words you select, with the voice chosen in Settings, Accessibility."
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            {speaking ? 'Stop' : 'Listen to this page'}
          </button>
        )}
      </div>
    </aside>
  )
}
