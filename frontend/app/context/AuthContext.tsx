'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { trackArea, trackDailyOpen } from '@/lib/funnel'
import { markSeenToday } from '@/lib/checkin'

interface User {
  id: string
  email: string
  name?: string
  hasCompletedOnboarding: boolean
  /** No date of birth yet (a new Google account, or one made before the 18+
   *  rule) and setup not finished: asked at /auth/age first. */
  needsDateOfBirth?: boolean
}

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, name: string, dateOfBirth?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  completeOnboarding: (pathId: string) => Promise<void>
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response> // 👈 Add this line
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// '/start' is the guided "Start here", open to everyone (campaign links land there).
// The newsletter links, and the weekly email's stop link, work from an email,
// signed in or not (app/newsletter, app/emails).
const publicRoutes = ['/', '/start', '/login', '/signup', '/forgot-password', '/reset-password', '/checkin', '/privacy', '/help', '/newsletter/confirm', '/newsletter/unsubscribe', '/emails/weekly-stop']
const AGE_ROUTE = '/auth/age'

/** Supabase's sign-in errors, in plain words. */
function signInErrorMessage(error: { message?: string; status?: number } | null): string {
  const message = error?.message || ''
  if (error?.status === 429 || /rate limit|too many/i.test(message)) {
    return 'Too many sign-in attempts in a short time. Please wait a few minutes, then try again.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password don’t match. Check them and try again, or use “Forgot password?”.'
  }
  return message || 'Sign-in didn’t work. Please try again.'
}

function profileFromSupabase(su: SupabaseUser): User {
  const hasCompletedOnboarding = su.user_metadata?.has_completed_onboarding === true
  return {
    id: su.id,
    email: su.email || '',
    name: su.user_metadata?.full_name || su.user_metadata?.name || undefined,
    hasCompletedOnboarding,
    needsDateOfBirth:
      !hasCompletedOnboarding &&
      !su.app_metadata?.date_of_birth &&
      !su.user_metadata?.date_of_birth &&
      !su.app_metadata?.managed_by_guardian,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const isInitRef = useRef(true)

  const supabase = useMemo(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  }, [])

  // Helper function to make authenticated requests to backend/Next API routes
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    const headers = new Headers(options.headers || {})
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }, [])

  useEffect(() => {
    // The placeholder backend login stored "mock_token" here. It is not a
    // session, but while it was set, signing out elsewhere (or a session
    // running out) left this browser looking signed in.
    try { if (localStorage.getItem('access_token') === 'mock_token') localStorage.removeItem('access_token') } catch {}
    // 1. Check if we have a locally stored custom session first
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('app_user') : null
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        localStorage.removeItem('app_user')
      }
    }

    if (!supabase) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    const timeout = setTimeout(() => {
      if (isInitRef.current) {
        setIsLoading(false)
        isInitRef.current = false
      }
    }, 5000)

    async function init() {
      try {
        const { data: { session } } = await supabase!.auth.getSession()
        if (cancelled) return
        if (session?.user) {
          setSupabaseUser(session.user)
          setUser(profileFromSupabase(session.user))
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') console.error('Auth init error:', err)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          isInitRef.current = false
          clearTimeout(timeout)
        }
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (isInitRef.current) return
      
      // Only clear user on SIGNED_OUT if we don't have a custom bearer token stored
      if (session?.user) {
        setSupabaseUser(session.user)
        setUser(profileFromSupabase(session.user))
      } else if (event === 'SIGNED_OUT' && !localStorage.getItem('access_token')) {
        setSupabaseUser(null)
        setUser(null)
        localStorage.removeItem('app_user')
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [supabase])

  // Funnel: one "app_open" per day per signed-in browser, for the
  // returned-within-7-days measure; and the last-seen day the check-in email
  // uses to tell who has been away.
  useEffect(() => {
    if (!user) return
    trackDailyOpen()
    markSeenToday()
  }, [user])

  // Which parts of the app people use, once they have a path (lib/funnel.ts;
  // Riipen Labs, Group 5).
  useEffect(() => {
    if (!user?.hasCompletedOnboarding) return
    trackArea(pathname, window.location.search)
  }, [user, pathname])

  // Redirect logic
  useEffect(() => {
    if (isLoading) return
    const isPublic = publicRoutes.includes(pathname)
    const isOnboarding = pathname === '/onboarding'

    if (!user && !isPublic && !isOnboarding) {
      router.push('/login')
    } else if (user && user.needsDateOfBirth && !isPublic) {
      if (pathname !== AGE_ROUTE) router.push(AGE_ROUTE)
    } else if (user && !user.hasCompletedOnboarding && !isOnboarding && !isPublic) {
      router.push('/onboarding')
    } else if (user && user.hasCompletedOnboarding && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
      router.push('/path')
    }
  }, [user, isLoading, pathname, router])

  const signup = useCallback(async (email: string, password: string, name: string, dateOfBirth?: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) return { success: false, error: 'Auth not available' }

    try {
      const normalizedEmail = email.trim().toLowerCase()

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, name, dateOfBirth }),
      })
      const body = await res.json()
      if (!res.ok) return { success: false, error: body.message || body.error || 'Signup failed' }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (signInErr) return { success: false, error: signInErrorMessage(signInErr) }

      return { success: true }
    } catch (err: any) {
      console.error('Signup error:', err)
      return { success: false, error: 'Network error during signup' }
    }
  }, [supabase])

  // Signs in straight from the browser. It used to post to /api/auth/login,
  // which asked the backend first (a placeholder that accepted any password
  // and returned "mock_token", stored below as if it were real) and, when the
  // backend was asleep, signed in again from the server. Every server-side
  // sign-in came from the same few hosting addresses, so a group signing in
  // together shared one Supabase limit and saw "Too many requests" (Riipen
  // Labs, Group 34); waiting on a sleeping backend also made signing in slow.
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) return { success: false, error: 'Sign-in is not available right now. Please try again in a minute.' }
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error || !data.user) return { success: false, error: signInErrorMessage(error) }

      localStorage.removeItem('access_token')
      const userProfile = profileFromSupabase(data.user)
      localStorage.setItem('app_user', JSON.stringify(userProfile))
      setSupabaseUser(data.user)
      setUser(userProfile)
      return { success: true }
    } catch (err: any) {
      console.error('Login error:', err)
      return { success: false, error: 'Network error during login' }
    }
  }, [supabase])

  const logout = useCallback(async () => {
    try {
      if (supabase) await supabase.auth.signOut()
    } catch {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('app_user')
    setUser(null)
    setSupabaseUser(null)
    router.push('/')
  }, [supabase, router])

  const completeOnboarding = useCallback(async (pathId: string) => {
    if (!user) return

    const updatedUser = { ...user, hasCompletedOnboarding: true }
    setUser(updatedUser)
    localStorage.setItem('app_user', JSON.stringify(updatedUser))

    if (supabase) {
      try {
        const { data } = await supabase.auth.updateUser({
          data: { has_completed_onboarding: true, path_id: pathId },
        })
        if (data?.user) {
          setSupabaseUser(data.user)
          void fetch('/api/me/welcome', { method: 'POST' }).catch(() => {})
        }
      } catch (err) {
        console.error('Error saving onboarding status:', err)
      }
    }
  }, [user, supabase])

  return (
    <AuthContext.Provider value={{ user, supabaseUser, isLoading, login, signup, logout, completeOnboarding, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
