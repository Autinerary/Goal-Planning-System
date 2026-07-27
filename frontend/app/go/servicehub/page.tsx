'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SH = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/**
 * Single funnel for every Goal Planning → ServiceHub navigation.
 *
 * All GP links point here (same-origin, so plain <a> works). We read the
 * signed-in user's Supabase session and forward the tokens to ServiceHub's
 * server-side `/auth/handoff`, which establishes the session before the page
 * renders — so the user lands on ServiceHub already signed in. If GP has no
 * session, we just open ServiceHub anonymously.
 */
function Redirector() {
  const params = useSearchParams()

  useEffect(() => {
    const raw = params.get('next') || '/'
    const next = raw.startsWith('/') ? raw : `/${raw}`

    ;(async () => {
      let target = `${SH}${next}`
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.access_token) {
          const hp = new URLSearchParams({
            access_token: session.access_token,
            refresh_token: session.refresh_token ?? '',
            next,
          })
          target = `${SH}/auth/handoff?${hp.toString()}`
        }
      } catch {
        // fall through to the plain ServiceHub URL (anonymous)
      }
      window.location.replace(target)
    })()
  }, [params])

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Opening ResourceHub…
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
