'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, PlayCircle, X } from 'lucide-react'
import { pageGuideFor } from '@/lib/pageGuides'
import { track } from '@/lib/funnel'

/**
 * "How it works" on the page you are on (lib/pageGuides.ts).
 *
 * Riipen Labs, Group 23 found the tour "blocks active use of the page content
 * instead of displaying explanations alongside it", and asked for the tour
 * button to open "guidance specific to the page the user is currently
 * viewing", explaining "the core purpose of each screen". So the top bar's
 * "How it works" opens this: a panel beside the page, never over it, that
 * says what the page is for and how to use it. The page stays usable; Escape
 * or Close puts it away. The full tour is one button away, and starts at the
 * part about this page.
 *
 * Opened by the "autinerary:page-guide" event (components/Navigation.tsx).
 */
export default function PageGuide() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const show = () => {
      opener.current = document.activeElement as HTMLElement | null
      setOpen(true)
      track('feature_use', 'page_guide')
    }
    window.addEventListener('autinerary:page-guide', show)
    return () => window.removeEventListener('autinerary:page-guide', show)
  }, [])

  // Focus moves to the panel, and back to the button that opened it.
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    setOpen(false)
    opener.current?.focus?.()
  }

  if (!open) return null
  const guide = pageGuideFor(pathname)
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby="page-guide-heading"
      className="fixed bottom-3 right-3 z-[90] max-h-[min(34rem,calc(100vh-1.5rem))] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-5 text-left shadow-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">How it works</p>
          <h2 id="page-guide-heading" className="mt-0.5 text-lg font-bold text-slate-900">{guide ? guide.name : 'This page'}</h2>
        </div>
        <button type="button" onClick={close} aria-label="Close the guide" className="rounded-md p-1 text-slate-600 hover:text-slate-900">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {guide ? (
        <>
          <p className="mt-2 text-sm text-slate-800">{guide.purpose}</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">How to use it</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {guide.connects && <p className="mt-3 text-sm text-slate-700">{guide.connects}</p>}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-800">
          There is no guide for this page yet. The tour shows the main parts of the app, and the glossary explains every name.
        </p>
      )}

      <p className="mt-3 text-xs text-slate-600">The page stays usable while this is open.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            window.dispatchEvent(new CustomEvent('autinerary:start-demo', { detail: { part: guide?.tourPart ?? null } }))
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> {guide?.tourPart ? 'Take the tour from here' : 'Take the tour'}
        </button>
        <Link href="/help" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-500">
          <BookOpen className="h-4 w-4" aria-hidden="true" /> What things are called
        </Link>
      </div>
    </aside>
  )
}
