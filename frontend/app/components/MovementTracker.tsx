'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { recordVisit, syncMovement } from '@/lib/movement'

function MovementTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const qs = searchParams?.toString()
    recordVisit(qs ? `${pathname}?${qs}` : pathname)
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
