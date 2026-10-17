'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadPreferences } from '@/lib/preferences'
import { a11yParam } from '@/lib/a11yHandoff'

const SH = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/**
 * Single funnel for every Goal Planning → ResourceHub navigation.
 *
 * All links point here (same-origin, so plain <a> works). Signed in, it asks
 * the server for a one-time sign-in code (app/api/hub-handoff) and opens
 * ResourceHub's /auth/handoff with it, which signs the person in there and
 * goes on to the page they asked for: one account, no second sign-in (Riipen
 * Labs, Groups 22 and 24). Signed out, it opens the page itself. Either way
 * the accessibility settings go along.
 *
 * It used to put the session's access and refresh tokens in the link; a code
 * that works once replaced them, so nothing reusable is ever in a URL.
 */
function Redirector() {
  const params = useSearchParams()
  const [manualHref, setManualHref] = useState(SH)

  useEffect(() => {
    const raw = params.get('next') || '/'
    const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : `/${raw.replace(/^\/+/, '')}`
    const prefs = loadPreferences()
    const a11y = a11yParam(prefs.accessibility, prefs.layout)
    // Text size, contrast, dark mode, the colours and the rest go along,
    // signed in or not.
    const withSettings = new URL(`${SH}${next}`)
    withSettings.searchParams.set('a11y', a11y)
    const plain = withSettings.toString()
    let navigated = false

    const go = (url: string) => {
      if (navigated) return
      navigated = true
      setManualHref(url)
      window.location.replace(url)
    }

    ;(async () => {
      try {
        const res = await fetch('/api/hub-handoff', { method: 'POST', credentials: 'include', cache: 'no-store' })
        const json = res.ok ? await res.json() : null
        if (json?.tokenHash) {
          const url = new URL(`${SH}/auth/handoff`)
          url.searchParams.set('token_hash', json.tokenHash)
          url.searchParams.set('next', next)
          url.searchParams.set('a11y', a11y)
          go(url.toString())
          return
        }
      } catch {
        // fall through to anonymous
      }
      go(plain)
    })()

    // Safety net: never get stuck on this page if the server is slow.
    const t = setTimeout(() => go(plain), 6000)
    return () => clearTimeout(t)
  }, [params])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-700">
      <p>Opening ResourceHub…</p>
      {/* Says where it goes, not "Click here" (the Government of Canada's
          guidance for autistic users, Riipen Labs, Group 31). */}
      <a href={manualHref} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
        Not opening? Open ResourceHub
      </a>
    </div>
  )
}

export default function GoServiceHubPage() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  )
}
