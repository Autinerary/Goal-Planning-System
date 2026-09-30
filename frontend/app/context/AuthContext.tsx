'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name?: string
  hasCompletedOnboarding: boolean
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

const publicRoutes = ['/', '/login', '/signup']

function profileFromSupabase(su: SupabaseUser): User {
  return {
    id: su.id,
    email: su.email || '',
    name: su.user_metadata?.full_name || su.user_metadata?.name || undefined,
    hasCompletedOnboarding: su.user_metadata?.has_completed_onboarding === true,
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

  // Redirect logic
  useEffect(() => {
    if (isLoading) return
    const isPublic = publicRoutes.includes(pathname)
    const isOnboarding = pathname === '/onboarding'

    if (!user && !isPublic && !isOnboarding) {
      router.push('/login')
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
      if (signInErr) return { success: false, error: signInErr.message }

      return { success: true }
    } catch (err: any) {
      console.error('Signup error:', err)
      return { success: false, error: 'Network error during signup' }
    }
  }, [supabase])

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const normalizedEmail = email.trim().toLowerCase()

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })

      const body = await res.json()

      if (!res.ok) {
        return { success: false, error: body.message || body.detail || body.error || 'Login failed' }
      }

      // Store JWT token if returned
      const token = body.access_token || body.token || body.session?.access_token
      if (token) {
        localStorage.setItem('access_token', token)
      }

      // Build user profile object
      const userData = body.user || body
      const userProfile: User = {
        id: userData.id || 'user_id',
        email: userData.email || normalizedEmail,
        name: userData.name || userData.full_name,
        hasCompletedOnboarding: Boolean(userData.hasCompletedOnboarding ?? true),
      }

      // Persist user profile to state and localStorage to preserve session across reloads
      localStorage.setItem('app_user', JSON.stringify(userProfile))
      setUser(userProfile)

      return { success: true }
    } catch (err: any) {
      console.error('Login error:', err)
      return { success: false, error: 'Network error during login' }
    }
  }, [])

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
