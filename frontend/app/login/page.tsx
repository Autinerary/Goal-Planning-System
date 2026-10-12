'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'
import GoogleSignIn from '../components/GoogleSignIn'
import { wakeBackend } from '@/lib/wakeBackend'
import { hubReturnHref } from '@/lib/serviceHub'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  // After Your profile → Delete your account.
  const [deleted, setDeleted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Check for return URL from ServiceHub (only store once to prevent redirect loops)
  useEffect(() => {
    // The Path loads from the backend, which sleeps when idle.
    wakeBackend()
    const params = new URLSearchParams(window.location.search)
    if (params.get('deleted') === '1') setDeleted(true)
    const returnTo = params.get('returnTo')
    if (returnTo && !sessionStorage.getItem('returnTo_used')) {
      sessionStorage.setItem('returnTo', returnTo)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await login(email.trim().toLowerCase(), password)
    
    if (result.success) {
      const returnTo = sessionStorage.getItem('returnTo')
      const alreadyUsed = sessionStorage.getItem('returnTo_used')
      if (returnTo && !alreadyUsed) {
        sessionStorage.removeItem('returnTo')
        sessionStorage.setItem('returnTo_used', 'true')
        // Back to ResourceHub through the hand-off, so it arrives signed in.
        // Anything else must be a page of this app: returnTo used to send
        // people to any address at all.
        const inApp = returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith('/\\')
        window.location.href = hubReturnHref(returnTo) || (inApp ? returnTo : '/path')
      } else {
        sessionStorage.removeItem('returnTo')
        sessionStorage.removeItem('returnTo_used')
        // Back from the Path shouldn't reopen the sign-in page.
        router.replace('/path')
      }
    } else {
      setError(result.error || 'Login failed. Please check your credentials.')
    }
    setIsSubmitting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    // The same layout as sign-up (Riipen Labs, Group 25): centred with
    // margins, which never cut off the top of a tall form the way flex
    // centring can, and one heading for the page (Group 27: consistent
    // headings).
    <div className="flex min-h-screen px-4 py-4 sm:py-8">
      <div className="m-auto w-full max-w-md">
        <p className="mb-3 text-center text-sm text-slate-700">
          <Link href="/" className="text-lg font-bold text-slate-900">Autinerary</Link>
          <span aria-hidden="true"> · </span>
          Your personalized path
        </p>

        {/* Login Card */}
        <div className="rounded-2xl p-5 sm:p-7 surface">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <LogIn className="h-6 w-6 text-blue-600" aria-hidden="true" />
              Welcome back
            </h1>
            <p className="text-slate-700 text-sm mt-1">Sign in to continue your journey.</p>
          </div>

          {deleted && (
            <p role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Your account and everything in it have been deleted. Thank you for using Autinerary.
            </p>
          )}

          <GoogleSignIn label="Sign in with Google" />

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/60 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/60 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* There was no way back in without ResourceHub (Riipen Labs, Group 34). */}
              <p className="mt-2 text-right text-sm">
                <Link href="/forgot-password" className="font-medium text-blue-700 underline-offset-2 underline">
                  Forgot password?
                </Link>
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-slate-600 mt-6">
            Don't have an account?{' '}
            <Link 
              href="/signup" 
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>

        {/*
          This line sits outside the white card, directly on the cloud
          photo background, so its contrast depends on which patch of sky
          happens to be behind it -- text-slate-500 washed out against the
          lighter parts. A tester flagged it as too light. Everything else
          on this page sits on solid white inside the card and was fine;
          this was the one line exposed to the raw background.

          Fixed the same way other hints over this background already are
          (see the .surface-veil pattern from the design pass): a small
          opaque chip guarantees contrast no matter what the photo behind
          it looks like, and text-slate-700 on it clears AA with room to
          spare rather than sitting right at the edge.
        */}
        <div className="mt-6 flex justify-center">
          <p className="surface-veil rounded-full px-4 py-2 text-sm text-slate-700">
            💡 <strong>First time?</strong> Click &quot;Create one&quot; to sign up.
          </p>
        </div>
      </div>
    </div>
  )
}
