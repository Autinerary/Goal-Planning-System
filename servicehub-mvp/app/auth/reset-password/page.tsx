'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Where the password reset email lands (lib/auth/AuthContext.tsx sends people
 * to /auth/reset-password). The link carries a one-time ?code= (PKCE), which
 * the browser client swaps for a session as this page loads. Moving on at once
 * dropped the code, or cut the swap short, so the reset form had no session
 * and said the link was invalid (bug audit, 17 November 2026, item 33). So
 * this waits for the swap, then goes on to the form.
 */
export default function ResetPasswordRedirectPage() {
  useEffect(() => {
    let cancelled = false
    const go = async () => {
      const url = new URL(window.location.href)
      const hash = window.location.hash
      // An expired or used link comes back with an error in the address.
      if (/(^|[?&#])error(_code|_description)?=/.test(`${url.search}${hash}`)) {
        window.location.replace('/reset-password?error=invalid_token')
        return
      }
      // getSession waits until the client has finished with the address, the code swap included.
      const { data } = await createClient().auth.getSession()
      if (cancelled) return
      if (data.session) {
        window.location.replace('/reset-password')
        return
      }
      if (url.searchParams.get('code')) {
        window.location.replace('/reset-password?error=invalid_token')
        return
      }
      // An older link, with what it needs after the #: passed on as before.
      window.location.replace(`/reset-password${hash}`)
    }
    void go()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" aria-hidden="true"></div>
        <p className="mt-4 text-gray-600">Redirecting to password reset...</p>
      </div>
    </div>
  )
}
