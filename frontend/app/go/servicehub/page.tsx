'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SH = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/**
 * Single funnel for every Goal Planning → ServiceHub navigation.
 *
 * All GP links point here (same-origin, so plain <a> works). We read the
 * signed-in user's Supabase session and forward the tokens ON THE DESTINATION
 * URL. ServiceHub's ProfileSync (root layout, already deployed) reads them and
 * establishes the session, then strips them from the URL — so the user lands on
 * the real ServiceHub page signed in.
 *
 * We deliberately redirect to the REAL destination (not a dedicated handoff
 * route) so navigation never depends on a not-yet-deployed route: the page
 * always exists, and worst case the user simply lands signed-out.
 */
function Redirector() {
  const params = useSearchParams()
  const [manualHref, setManualHref] = useState(SH)

  useEffect(() => {
    const raw = params.get('next') || '/'
    const next = raw.startsWith('/') ? raw : `/${raw}`
    const plain = `${SH}${next}`
    let navigated = false

    const go = (url: string) => {
      if (navigated) return
      navigated = true
      setManualHref(url)
      window.location.replace(url)
    }

    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.access_token) {
          const url = new URL(plain)
          url.searchParams.set('access_token', session.access_token)
          url.searchParams.set('refresh_token', session.refresh_token ?? '')
          go(url.toString())
          return
        }
      } catch {
        // fall through to anonymous
      }
      go(plain)
    })()

    // Safety net: never get stuck on this page if the session read stalls.
    const t = setTimeout(() => go(plain), 2500)
    return () => clearTimeout(t)
  }, [params])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
      <p>Opening ResourceHub…</p>
      <a href={manualHref} className="text-cyan-600 hover:underline text-sm">
        Click here if you’re not redirected
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
