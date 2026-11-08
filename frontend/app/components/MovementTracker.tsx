'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { countingAllowed } from '@/lib/consent'
import { recordVisit, syncMovement } from '@/lib/movement'

function MovementTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Only with a yes to counting (the cookie banner, lib/consent.ts), and only the page's path: a query string can
    // carry search words or a private link's key.
    if (!pathname || !countingAllowed()) return
    recordVisit(pathname)
    // Best-effort, debounced upload for cross-device analytics.
    syncMovement()
  }, [pathname, searchParams])

  return null
}

/**
 * Invisible global tracker that records the order the user moves through the
 * app. Mounted once in the root layout. Wrapped in Suspense because
 * useSearchParams opts the subtree out of static rendering.
 */
export default function MovementTracker() {
  return (
    <Suspense fallback={null}>
      <MovementTrackerInner />
    </Suspense>
  )
}
