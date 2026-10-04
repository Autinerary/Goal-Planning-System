'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * "Continue with Google" (Riipen Labs, Group 2: "create a connection with
 * other softwares like google for account creation").
 *
 * Hidden until NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is "true", which should be set
 * only after the Google provider is turned on in Supabase (Authentication >
 * Providers > Google) and this site's /auth/callback is in its redirect URLs.
 * Google does not share a date of birth, so new Google accounts answer that
 * one question at /auth/age before setup (the 18+ rule still applies).
 */

export const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

export default function GoogleSignIn({ label = 'Continue with Google' }: { label?: string }) {
  const [status, setStatus] = useState<'idle' | 'redirecting' | 'error'>('idle')

  if (!GOOGLE_AUTH_ENABLED) return null

  async function start() {
    setStatus('redirecting')
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={start}
        disabled={status === 'redirecting'}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#747775] bg-white px-4 py-3 font-medium text-[#1f1f1f] transition-colors hover:bg-slate-50 disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {status === 'redirecting' ? 'Opening Google…' : label}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-700" role="alert">Could not reach Google. Please try again, or use your email below.</p>
      )}
      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-slate-700">or with your email</span>
        </div>
      </div>
    </div>
  )
}
