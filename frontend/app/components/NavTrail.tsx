'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordPage } from '@/lib/navTrail'
import { placeName, type LastPlace } from '@/lib/lastPlace'
import { useAuth } from '../context/AuthContext'

export const LAST_PLACE_KEY = 'autinerary_last_place'
export const VISIT_STARTED_KEY = 'autinerary_visit_started'

/** The last place kept in this browser, if any (lib/lastPlace.ts). */
export function readLastPlace(): LastPlace | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_PLACE_KEY) || 'null')
    return value && typeof value.path === 'string' && typeof value.at === 'number' && typeof value.user === 'string' ? value : null
  } catch {
    return null
  }
}

/** When this visit (this tab) began. */
export function visitStartedAt(): number {
  try {
    const kept = Number(sessionStorage.getItem(VISIT_STARTED_KEY))
    if (kept) return kept
    const now = Date.now()
    sessionStorage.setItem(VISIT_STARTED_KEY, String(now))
    return now
  } catch {
    return Date.now()
  }
}

/**
 * Records each page visited in this tab, for Back buttons (lib/navTrail.ts),
 * and the last place in the app worth going back to, for the Path's "Pick up
 * where you left off" (lib/lastPlace.ts). It reads the visit's start before
 * writing, so the Path compares against an earlier visit.
 */
export default function NavTrail() {
  const pathname = usePathname()
  const { supabaseUser } = useAuth()
  const userId = supabaseUser?.id
  useEffect(() => {
    if (!pathname) return
    recordPage(pathname)
    visitStartedAt()
    if (!userId || !placeName(pathname)) return
    try {
      localStorage.setItem(LAST_PLACE_KEY, JSON.stringify({ path: pathname, at: Date.now(), user: userId }))
    } catch {}
  }, [pathname, userId])
  return null
}
