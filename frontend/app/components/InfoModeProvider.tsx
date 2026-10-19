'use client'

/**
 * Intercepts clicks while Info Mode is on and shows what the control does.
 *
 * Capture phase, so the explanation happens before the app's own handler and
 * we can stop the action from running. Clicking the same element again lets
 * the action through. In Info Mode that happens every time; in Info + Action
 * Mode a control is explained once and then works with one click.
 *
 * The ? button itself is exempt — being unable to turn the mode back off
 * without understanding the mode would be a trap.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { HelpCircle, Volume2, X } from 'lucide-react'
import { INFO_MODE_META, controlKey, describeElement, isKnown, markKnown, useInfoMode } from '@/lib/infoMode'
import { speakAll } from '@/lib/speech'

interface Explanation {
  title: string
  body: string | null
  x: number
  y: number
}

export default function InfoModeProvider() {
  const { mode, isOn } = useInfoMode()
  const [shown, setShown] = useState<Explanation | null>(null)
  const primed = useRef<Element | null>(null)

  const onCapture = useCallback(
    (e: MouseEvent) => {
      if (!isOn) return
      const target = e.target as Element | null
      if (!target) return

      // Never block the control that turns this off, or the popover itself.
      if (target.closest('[data-info-exempt="true"]')) return

      const actionable = target.closest('button, a, [role="button"], input, select, textarea, [data-info]')
      if (!actionable) return

      if (primed.current === actionable) {
        primed.current = null
        setShown(null)
        return // let it through
      }

      // Info + Action: explained once, then it just works.
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
    [isOn, mode],
  )

  useEffect(() => {
    primed.current = null
    setShown(null)
    if (!isOn) {
      setShown(null)
      primed.current = null
      return
    }
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
      {/* Persistent reminder — otherwise a user can forget why buttons stopped
          working, which is worse than never having the mode. */}
      <div
        data-info-exempt="true"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 shadow-lg"
      >
        <HelpCircle className="h-4 w-4 text-cyan-700" aria-hidden="true" />
        <span className="text-xs font-semibold text-cyan-900">
          {INFO_MODE_META[mode].label}: {INFO_MODE_META[mode].description}
        </span>
      </div>

      {shown && (
        <>
          <div
            data-info-exempt="true"
            role="dialog"
            aria-label={shown.title}
            aria-live="polite"
            className="fixed z-[80] w-72 max-w-[90vw] -translate-x-1/2 rounded-xl border border-cyan-300 bg-white p-3 shadow-xl"
            style={{
              left: Math.min(Math.max(shown.x, 150), window.innerWidth - 150),
              top: Math.min(shown.y + 8, window.innerHeight - 160),
            }}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">{shown.title}</p>
              <button
                data-info-exempt="true"
                onClick={() => { primed.current = null; setShown(null) }}
                aria-label="Close explanation"
                className="rounded p-1 text-slate-600 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {shown.body ?? 'No description has been written for this one yet.'}
            </p>
            <p className="mt-2 text-xs font-medium text-cyan-800">
              {mode === 'infoAction' ? 'Tap it again to use it. Next time it works with one tap.' : 'Tap it again to use it.'}
            </p>
            {/* Heard as well as read (Odosa: "make the site audible"). */}
            <button
              type="button"
              data-info-exempt="true"
              onClick={() => speakAll([shown.title, shown.body || 'No description has been written for this one yet.'])}
              className="mt-1 mr-3 inline-flex items-center gap-1 py-1 text-xs font-medium text-indigo-800 underline underline-offset-2"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Hear it
            </button>
            {/* Autinerary's own words, explained in one place (Riipen Labs,
                Groups 34 and 36: "Races", "Norms", "Pit Stop" are unfamiliar). */}
            <a href="/help" data-info-exempt="true" className="mt-1 inline-block py-1 text-xs font-medium text-indigo-800 underline underline-offset-2">
              What things are called
            </a>
          </div>
        </>
      )}
    </>
  )
}
