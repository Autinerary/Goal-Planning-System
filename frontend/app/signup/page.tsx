'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, UserPlus, Loader2, Check } from 'lucide-react'
import { computeAge, isAdult, MIN_SIGNUP_AGE } from '@/lib/age'
import { track } from '@/lib/funnel'
import { wakeBackend } from '@/lib/wakeBackend'
import GoogleSignIn from '../components/GoogleSignIn'

export default function SignupPage() {
  const router = useRouter()
  const { signup, isLoading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    track('signup_view')
    // Setup makes the path on the backend, which sleeps when idle.
    wakeBackend()
  }, [])

  // Under-18 flagged live once a full DOB is entered.
  const dobAge = dob ? computeAge(dob) : null
  const underAge = dobAge !== null && dobAge < MIN_SIGNUP_AGE

  const passwordRequirements = [
    { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p: string) => /[A-Z]/.test(p), label: 'One uppercase letter' },
    { test: (p: string) => /[0-9]/.test(p), label: 'One number' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password requirements
    const failedReqs = passwordRequirements.filter(r => !r.test(password))
    if (failedReqs.length > 0) {
      setError('Password does not meet requirements')
      return
    }

    // 18+ gate (also enforced server-side).
    if (!dob) {
      setError('Please enter your date of birth.')
      return
    }
    if (!isAdult(dob)) {
      setError('You must be 18 or older to create your own account.')
      return
    }

    setIsSubmitting(true)
    const result = await signup(email.trim().toLowerCase(), password, name, dob)
    
    if (result.success) {
      track('signup_complete')
      router.replace('/onboarding')
    } else {
      setError(result.error || 'An account with this email already exists.')
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

  // Compact, so the button is on the first screen of a laptop or a phone
  // (Riipen Labs, Group 25: three testers "encountered scrolling/completion
  // issues during signup" on a phone and a laptop). Centred with margins, not
  // flex centring, which cuts off the top of a form taller than the window
  // so it cannot be scrolled to. The decorative blurs behind it are gone.
  // What it costs, how information is handled and what comes next are said
  // before the first field (Group 28: before signing up, people should know
  // "any costs or subscriptions", "how their personal information is
  // protected" and "what their next step should be"). The browser can fill
  // every field in (Group 26: "autofill, autocomplete").
  const field = 'w-full bg-white/60 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all'
  const required = (
    <>
      <span className="font-bold text-red-700" aria-hidden="true">*</span>
      <span className="sr-only"> (required)</span>
    </>
  )
  return (
    <div className="flex min-h-screen px-4 py-4">
      <div className="m-auto w-full max-w-md">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Link href="/" className="text-lg font-bold text-slate-900">Autinerary</Link>
          <p className="text-sm text-slate-700">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-800 underline underline-offset-2">Sign in</Link>
          </p>
        </div>

        <div className="rounded-2xl p-5 surface">
          <div className="mb-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-purple-600" aria-hidden="true" />
              Create your free account
            </h1>
            <ul className="mt-2 space-y-0.5 text-sm text-slate-800">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />Free during the beta. No credit card.</li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>
                  We never sell your information.{' '}
                  <Link href="/privacy" className="font-medium text-indigo-800 underline underline-offset-2">Privacy</Link>
                </span>
              </li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />Next: two quick questions, then your plan.</li>
            </ul>
          </div>

          <GoogleSignIn label="Sign up with Google" />

          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-xs text-slate-700">{required} Required: all four.</p>
            {/* Name and date of birth, side by side on a wider screen */}
            <div className="grid items-end gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="signup-name" className="mb-1 block text-sm font-medium text-slate-800">
                Your name {required}
              </label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
                placeholder="What should we call you?"
                required
              />
            </div>

            {/* Date of birth (18+ gate) */}
            <div>
              <label htmlFor="signup-dob" className="mb-1 block text-sm font-medium text-slate-800">
                Date of birth {required}{' '}
                <span id="signup-dob-help" className="font-normal text-slate-700">(18 or older, for now)</span>
              </label>
              <input
                id="signup-dob"
                type="date"
                autoComplete="bday"
                value={dob}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDob(e.target.value)}
                aria-describedby="signup-dob-help"
                className={field}
                required
              />
            </div>
            </div>

            {/* Under-18 explainer */}
            {underAge && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold mb-0.5">Under 18?</p>
                <p>
                  You can’t create your own account yet. But a parent or guardian with an account can add you and
                  set things up for you. Ask them to sign up, then add you from their <strong>Family</strong> page.
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slate-800">
                Email {required}
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@example.com"
                required
              />
            </div>

            {/* Password, and the same again, side by side */}
            <div className="grid grid-cols-2 items-end gap-3">
              <div>
                <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-800">
                  Password {required}
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${field} pr-11`}
                    placeholder="Create a password"
                    aria-describedby="signup-password-rules"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="signup-confirm" className="mb-1 block text-sm font-medium text-slate-800">
                  Type it again {required}
                </label>
                <input
                  id="signup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${field} ${confirmPassword && confirmPassword !== password ? 'border-red-500/50' : ''}`}
                  placeholder="Same password"
                  required
                />
              </div>
            </div>

            {/* The password rules: one line, ticked as they are met */}
            <p id="signup-password-rules" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {passwordRequirements.map((req, idx) => {
                const met = Boolean(password) && req.test(password)
                return (
                  <span key={idx} className={`flex items-center gap-1 ${met ? 'text-green-700' : 'text-slate-700'}`}>
                    <Check className={`w-3 h-3 ${met ? 'opacity-100' : 'opacity-30'}`} aria-hidden="true" />
                    {req.label}{met && <span className="sr-only"> (done)</span>}
                  </span>
                )
              })}
            </p>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-red-600 text-xs" role="status">The two passwords don&apos;t match yet.</p>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-600 text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || password !== confirmPassword}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create your free account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
