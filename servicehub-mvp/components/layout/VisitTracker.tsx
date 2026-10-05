'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { firstTime, track } from '@/lib/track'

const DAY_KEY = 'rh_visit_day'

/** Today in this browser's time zone, as YYYY-MM-DD. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The first time this browser opens ResourceHub ("landing"), each later day
 * it comes back, and the first place it opens: for Group 8's "time from
 * landing to first resource viewed", and whether a first session brings
 * people "back in their first 7-14 days". A place opened from the end of
 * setup counts as 'setup'; anywhere else, 'browse'.
 */
export default function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const day = today()
    let last: string | null = null
    try {
      last = localStorage.getItem(DAY_KEY)
      localStorage.setItem(DAY_KEY, day)
    } catch {}
    if (firstTime('rh_visit_at')) track('rh_visit', 'first')
    else if (last !== day) track('rh_visit', 'return')
  }, [])

  useEffect(() => {
    if (!/^\/resources\/[^/]+$/.test(pathname || '') || pathname === '/resources/new') return
    if (!firstTime('rh_first_resource_at')) return
    let from = 'browse'
    try {
      if (sessionStorage.getItem('rh_from_setup')) from = 'setup'
    } catch {}
    track('rh_first_resource', from)
  }, [pathname])

  return null
}
