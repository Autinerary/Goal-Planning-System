'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * "Forgot password?" (Riipen Labs, Group 34). The app's sign-in page had no
 * way back in; only ResourceHub could send a reset email. The link lands on
 * /auth/reset, which signs the person in for this one purpose and opens
 * /reset-password. It has to be opened in the same browser: the sign-in
 * code checks a key this page leaves in it.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<null | 'sending' | 'sent' | string>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = email.trim().toLowerCase()
    if (!address) return
    setState('sending')
    const { error } = await createClient().auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    if (error) {
      const tooSoon = error.status === 429 || /rate limit|security purposes|seconds/i.test(error.message || '')
      setState(tooSoon
        ? 'A link was sent a moment ago. Please wait a minute, check your email, then try again if it hasn’t arrived.'
        : 'The email could not be sent. Please try again in a minute.')
      return
    }
    // The same answer whether or not there is an account, so this page can't
    // be used to find out who has one.
    setState('sent')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-4xl font-bold text-slate-900 mb-2">Autinerary</p>
        </div>

        <div className="rounded-2xl p-8 surface">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-500/20 rounded-full mb-4">
              <KeyRound className="w-8 h-8 text-blue-700" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Forgot your password?</h1>
            <p className="text-slate-700 text-sm mt-1">
              Type the email address you sign in with. We’ll email you a link to choose a new password.
            </p>
          </div>

          {state === 'sent' ? (
            <div role="status" className="space-y-3 text-slate-800">
              <p className="font-semibold">Check your email.</p>
              <p className="text-sm">
                If there is an Autinerary account for <strong>{email.trim().toLowerCase()}</strong>, a link is on its way.
                Open it in this browser, on this device. It works once, for a short time.
              </p>
              <p className="text-sm">Nothing yet after a few minutes? Check your spam folder, or send another.</p>
              <button type="button" onClick={() => setState(null)} className="text-sm font-medium text-blue-700 underline underline-offset-2">
                Send another link
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-6">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state && state !== 'sending') setState(null) }}
                  className="w-full bg-white/60 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>
              {state && state !== 'sending' && (
                <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">{state}</p>
              )}
              <button
                type="submit"
                disabled={state === 'sending'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {state === 'sending' ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Sending…</> : 'Email me a link'}
              </button>
            </form>
          )}

          <p className="text-center text-slate-700 mt-6 text-sm">
            Remembered it?{' '}
            <Link href="/login" className="text-blue-700 hover:text-blue-800 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
