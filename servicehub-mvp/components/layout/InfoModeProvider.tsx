'use client'

/**
 * ResourceHub's Info Mode (the app's frontend/app/components/InfoModeProvider.tsx):
 * while it is on, a click on a control first says what it is; clicking it
 * again uses it. In Info + Action Mode a control is explained once and then
 * works with one click. The ? button and this popover are never blocked.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { HelpCircle, Volume2, X } from 'lucide-react'
import { INFO_MODE_META, controlKey, describeElement, isKnown, markKnown, useInfoMode } from '@/lib/infoMode'

const APP = (process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000').replace(/\/$/, '')

interface Explanation {
  title: string
  body: string | null
  x: number
  y: number
}

/** Read aloud with the browser's voice, at the speed chosen in the app (data-speech-rate). */
function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  const speed = document.documentElement.dataset.speechRate
  u.rate = speed === 'slow' ? 0.8 : speed === 'fast' ? 1.2 : 1
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export default function InfoModeProvider() {
  const { mode, isOn } = useInfoMode()
  const [shown, setShown] = useState<Explanation | null>(null)
  const primed = useRef<Element | null>(null)

  const onCapture = useCallback(
    (e: MouseEvent) => {
      if (!isOn) return
      const target = e.target as Element | null
      if (!target || target.closest('[data-info-exempt="true"]')) return
      const actionable = target.closest('button, a, [role="button"], input, select, textarea, [data-info]')
      if (!actionable) return
      if (primed.current === actionable) {
        primed.current = null
        setShown(null)
        return
      }
      const key = controlKey(actionable, window.location.pathname)
      if (mode === 'infoAction' && isKnown(key)) return
      e.preventDefault()
      e.stopPropagation()
      if (mode === 'infoAction') markKnown(key)
      const { title, body } = describeElement(actionable)
      const rect = actionable.getBoundingClientRect()
      setShown({ title, body, x: rect.left + rect.width / 2, y: rect.bottom })
      primed.current = actionable
    },
    [isOn, mode]
  )

  useEffect(() => {
    primed.current = null
    setShown(null)
    if (!isOn) return
    document.addEventListener('click', onCapture, true)
    return () => document.removeEventListener('click', onCapture, true)
  }, [isOn, onCapture])

  useEffect(() => {
    if (!shown) return
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        primed.current = null
        setShown(null)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [shown])

  if (!isOn) return null
  return (
    <>
      <div data-info-exempt="true" className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 shadow-lg">
        <HelpCircle className="h-4 w-4 text-cyan-700" aria-hidden="true" />
        <span className="text-xs font-semibold text-cyan-900">
          {INFO_MODE_META[mode].label}: {INFO_MODE_META[mode].description}
        </span>
      </div>
      {shown && (
        <div
          data-info-exempt="true"
          role="dialog"
          aria-label={shown.title}
          aria-live="polite"
          className="fixed z-[80] w-72 max-w-[90vw] -translate-x-1/2 rounded-xl border border-cyan-300 bg-white p-3 shadow-xl"
          style={{ left: Math.min(Math.max(shown.x, 150), window.innerWidth - 150), top: Math.min(shown.y + 8, window.innerHeight - 170) }}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">{shown.title}</p>
            <button type="button" data-info-exempt="true" onClick={() => { primed.current = null; setShown(null) }} aria-label="Close explanation" className="rounded p-1 text-gray-600 hover:text-gray-900">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-700">{shown.body ?? 'No description has been written for this one yet.'}</p>
          <p className="mt-2 text-xs font-medium text-cyan-800">
            {mode === 'infoAction' ? 'Tap it again to use it. Next time it works with one tap.' : 'Tap it again to use it.'}
          </p>
          <button type="button" data-info-exempt="true" onClick={() => speak(`${shown.title}. ${shown.body || 'No description has been written for this one yet.'}`)} className="mr-3 mt-1 inline-flex items-center gap-1 py-1 text-xs font-medium text-indigo-800 underline underline-offset-2">
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Hear it
          </button>
          <a href={`${APP}/help`} data-info-exempt="true" className="mt-1 inline-block py-1 text-xs font-medium text-indigo-800 underline underline-offset-2">
            What things are called
          </a>
        </div>
      )}
    </>
  )
}
