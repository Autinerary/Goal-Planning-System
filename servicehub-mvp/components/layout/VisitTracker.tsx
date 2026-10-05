'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { firstTime, track } from '@/lib/track'

/**
 * The first time this browser opens ResourceHub ("landing"), and the first
 * place it opens, for Group 8's "time from landing to first resource viewed".
 * A place opened from the end of setup counts as 'setup'; anywhere else,
 * 'browse'.
 */
export default function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (firstTime('rh_visit_at')) track('rh_visit')
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
