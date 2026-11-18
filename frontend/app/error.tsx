'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

/**
 * When a page breaks (bug audit, 17 November 2026: Milestone pages crashed on iPhones before iOS 16.4, and there
 * was no page for it, only the framework's bare error). The app's menus stay; this says what happened in plain
 * words, that nothing saved is lost, and offers to try again or go to the Path. Errors in the root layout itself
 * are app/global-error.tsx.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    console.error(error)
    // Said by screen readers, and where the keyboard starts.
    heading.current?.focus()
  }, [error])

  // A file of the app that didn't load (often after an update) needs the page loaded again, not just redrawn.
  const chunk = error?.name === 'ChunkLoadError' || /Loading (CSS )?chunk/i.test(error?.message || '')
  const retry = () => (chunk ? window.location.reload() : reset())

  return (
    <div className="min-h-[60vh] bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-900 focus:outline-none">
          Something went wrong
        </h1>
        <p className="mt-3 text-slate-800">This page didn’t load properly. Nothing you saved is lost.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link href="/path" className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
            Go to your Path
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-700">
          If it keeps happening, email <a href="mailto:aayush@autinerary.ca" className="font-medium text-indigo-800 underline underline-offset-2">aayush@autinerary.ca</a>.
        </p>
      </div>
    </div>
  )
}
