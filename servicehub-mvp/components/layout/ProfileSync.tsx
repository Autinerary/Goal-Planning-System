'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { A11Y_COOKIE, applyA11y, cleanA11y } from '@/lib/a11y'

/**
 * Reads URL params passed by Goal Planning's "Find Resources" button:
 *  - ?profile=   → stores the norms profile for personalised recommendations
 *  - ?a11y=      → the app's accessibility settings
 * Signing in comes through app/auth/handoff, with a one-time code; session
 * tokens in a link are only removed from the address bar.
 */
function ProfileSyncInner() {
  const searchParams = useSearchParams()

  useEffect(() => {
    async function sync() {
      const profileParam = searchParams.get('profile')
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      const a11y = searchParams.get('a11y')

      // The app's accessibility settings, if the middleware didn't keep them.
      if (a11y !== null) {
        const value = cleanA11y(a11y)
        document.cookie = `${A11Y_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
        applyA11y(value)
      }

      if (profileParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(profileParam))
          localStorage.setItem('autinerary_profile', JSON.stringify(parsed))
        } catch {
          // ignore malformed
        }
      }

      // Session tokens in a link are no longer used to sign in (the app's
      // one-time code goes to app/auth/handoff instead; Riipen Labs, Groups 22
      // and 24). An old link's tokens are only taken out of the address bar.

      if (profileParam || accessToken || refreshToken || a11y !== null) {
        const url = new URL(window.location.href)
        url.searchParams.delete('profile')
        url.searchParams.delete('a11y')
        url.searchParams.delete('access_token')
        url.searchParams.delete('refresh_token')
        window.history.replaceState({}, '', url.toString())
      }
    }

    sync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function ProfileSync() {
  // useSearchParams() must be wrapped in a Suspense boundary for Next.js 14
  // static prerendering to succeed.
  return (
    <Suspense fallback={null}>
      <ProfileSyncInner />
    </Suspense>
  )
}
