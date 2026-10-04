'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { computeAge, MIN_SIGNUP_AGE } from '@/lib/age'
import { track } from '@/lib/funnel'

/**
 * One question before setup for accounts without a date of birth: new Google
 * accounts (Google does not share it) and accounts made before the 18+ rule.
 * Setup cannot finish without it, so AuthContext sends those accounts here.
 */
export default function DateOfBirthPage() {
  const { user, supabaseUser, isLoading, logout } = useAuth()
  const [dob, setDob] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'under_age' | 'error'>('idle')
  const [error, setError] = useState('')

  const dobAge = dob ? computeAge(dob) : null
  const underAge = status === 'under_age' || (dobAge !== null && dobAge < MIN_SIGNUP_AGE)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (computeAge(dob) === null) {
      setStatus('error')
      setError('Please enter your date of birth.')
      return
    }
    setStatus('saving')
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateOfBirth: dob }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 403 && body.error === 'under_age') {
        setStatus('under_age')
        return
      }
      if (!res.ok && res.status !== 409) {
        setStatus('error')
        setError(body.error || 'Could not save. Please try again.')
        return
      }
      // For the funnel, a new Google account is created at this point.
      // (Older email accounts adding a date of birth were counted already.)
      if (res.ok && supabaseUser?.app_metadata?.provider && supabaseUser.app_metadata.provider !== 'email') track('signup_complete')
      // Pick up the saved date of birth in this browser's session, then
      // start setup with a fresh load.
      await createClient().auth.refreshSession().catch(() => {})
      window.location.assign('/onboarding')
    } catch {
      setStatus('error')
      setError('Could not reach the server. Please try again.')
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-3xl font-bold text-slate-900">Autinerary</p>
        <form onSubmit={onSubmit} className="surface rounded-2xl p-8">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">One question before setup</h1>
          <p className="mb-6 text-sm text-slate-700">
            {user.name ? `Welcome, ${user.name}. ` : 'Welcome. '}
            Autinerary is for adults (18+) for now, so we need your date of birth. It is only used for that (see{' '}
            <Link href="/privacy" className="font-medium text-indigo-800 underline underline-offset-2">Privacy</Link>).
          </p>

          <label htmlFor="dob" className="mb-2 block text-sm font-medium text-slate-800">
            Date of birth
          </label>
          <input
            id="dob"
            type="date"
            value={dob}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => {
              setDob(e.target.value)
              if (status !== 'saving') setStatus('idle')
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />

          {underAge && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
              <p className="mb-0.5 font-semibold">Under 18?</p>
              <p>
                You can’t create your own account yet. A parent or guardian with an account can add you and set things up
                for you from their <strong>Family</strong> page.
              </p>
            </div>
          )}
          {status === 'error' && error && (
            <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={status === 'saving' || underAge || !dob}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
          >
            {status === 'saving' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Continue to setup'
            )}
          </button>
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
