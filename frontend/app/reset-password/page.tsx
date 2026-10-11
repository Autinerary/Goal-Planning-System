'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { newPasswordError } from '@/lib/passwordRules'
import NewPasswordFields from '../components/NewPasswordFields'

/** Choose a new password, after the "Forgot password?" email (app/auth/reset). */
function ResetPassword() {
  const params = useSearchParams()
  const { user, isLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState<null | 'saving' | 'saved' | string>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = newPasswordError(password, confirm)
    if (problem) { setState(problem); return }
    setState('saving')
    const { error } = await createClient().auth.updateUser({ password })
    if (error) {
      setState(/different from the old/i.test(error.message || '')
        ? 'That is your current password, so you can sign in with it. Or choose a new one.'
        : 'Your password could not be changed. Please try again, or ask for a new link.')
      return
    }
    setState('saved')
  }

  const badLink = params.get('link') === 'invalid' || (!isLoading && !user)

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
            <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
          </div>

          {isLoading && params.get('link') !== 'invalid' ? (
            <p className="flex items-center justify-center gap-2 text-slate-700"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking your link…</p>
          ) : state === 'saved' ? (
            <div role="status" className="space-y-4 text-center text-slate-800">
              <p className="font-semibold">Your password is changed.</p>
              <p className="text-sm">Use it next time you sign in, here and in ResourceHub. You are signed in now.</p>
              <Link href={user?.hasCompletedOnboarding ? '/path' : '/onboarding'} className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">
                {user?.hasCompletedOnboarding ? 'Go to my Path' : 'Continue'}
              </Link>
            </div>
          ) : badLink ? (
            <div role="alert" className="space-y-4 text-center text-slate-800">
              <p>This link has expired, was used already, or was opened in a different browser from the one that asked for it.</p>
              <Link href="/forgot-password" className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">
                Send a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-5">
              <p className="text-sm text-slate-700">For <strong>{user?.email}</strong>. This changes it in ResourceHub too: it is the same account.</p>
              <NewPasswordFields idPrefix="reset-password" password={password} confirm={confirm} onPassword={(v) => { setPassword(v); setState(null) }} onConfirm={(v) => { setConfirm(v); setState(null) }} />
              {state && state !== 'saving' && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">{state}</p>}
              <button type="submit" disabled={state === 'saving'} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {state === 'saving' ? 'Saving…' : 'Save my new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  )
}
