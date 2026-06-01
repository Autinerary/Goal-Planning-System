'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Reads URL params passed by Goal Planning's "Find Resources" button:
 *  - ?profile=   → stores barrier profile for personalised recommendations
 *  - ?access_token= + ?refresh_token= → sets a real Supabase session
 */
export default function ProfileSync() {
  const searchParams = useSearchParams()

  useEffect(() => {
    async function sync() {
      const profileParam = searchParams.get('profile')
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')

      if (profileParam) {
        try {
          const parsed = JSON.parse(decodeURIComponent(profileParam))
          localStorage.setItem('autinerary_profile', JSON.stringify(parsed))
        } catch {
          // ignore malformed
        }
      }

      if (accessToken) {
        try {
          const supabase = createClient()
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? '',
          })
        } catch {
          // token invalid or expired — user can sign in manually
        }
      }

      if (profileParam || accessToken) {
        const url = new URL(window.location.href)
        url.searchParams.delete('profile')
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
