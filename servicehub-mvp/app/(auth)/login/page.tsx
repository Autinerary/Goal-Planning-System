'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import { appSignInHref, APP_SIGNUP } from '@/lib/appSignIn'
import type { AuthError } from '@supabase/supabase-js'

/**
 * ResourceHub's sign-in. One account with Autinerary (Riipen Labs, Group 22:
 * "a second sign in at Resource Hub"; Group 24: "Secondary login wall"), so
 * the first choice is the Autinerary sign-in, which comes back here signed in
 * (lib/appSignIn.ts); the same email and password also work below. It used to
 * read "ResourceHub · Sign in to your account", with "create a new account"
 * and a demo account (which does not exist), as if it were a separate service,
 * and it always went to the home page afterwards: now it goes back to `next`.
 */

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [next, setNext] = useState('/')
  const { signIn } = useAuth()
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('next') || '/'
    setNext(raw.startsWith('/') && !raw.startsWith('//') ? raw : '/')
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email.trim().toLowerCase(), password, next)

    if (error) {
      setError(getErrorMessage(error))
      setLoading(false)
    } else {
      // Navigation happens in signIn function
    }
  }

  function getErrorMessage(error: AuthError): string {
    if (error.message.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please try again.'
    }
    if (error.message.includes('Email not confirmed')) {
      return 'Please check your email and confirm your account before signing in.'
    }
    return error.message || 'An error occurred during sign in.'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <p className="text-center text-sm font-semibold text-gray-700">ResourceHub, part of Autinerary</p>
          <h1 className="mt-2 text-center text-2xl font-bold text-gray-900">
            Sign in with your Autinerary account
          </h1>
          <p className="mt-2 text-center text-sm text-gray-700">
            It is one account for Autinerary and ResourceHub. If you are signed in to Autinerary, you&apos;ll come straight back here.
          </p>
          <a
            href={appSignInHref(next)}
            className="mt-6 flex w-full justify-center rounded-md bg-indigo-700 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Continue with Autinerary
          </a>
          <p className="mt-3 text-center text-sm text-gray-700">
            New here?{' '}
            <a href={APP_SIGNUP} className="font-medium text-indigo-800 underline underline-offset-2">Create your free account</a>
          </p>
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-gray-50 px-2 text-gray-700">or sign in here with the same email and password</span></div>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {error && (
            <div
              className="rounded-md bg-red-50 p-4"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                aria-label="Email address"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'email-error' : undefined}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                aria-label="Password"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'password-error' : undefined}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-busy={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
