'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null; session?: Session }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session?.user) {
          setSession(session)
          setUser(session.user)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        setLoading(false)
        if (_event === 'SIGNED_IN') createProfileIfNeeded(session.user)
      } else if (_event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function createProfileIfNeeded(user: User) {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existing) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
        })
      }
    } catch (error) {
      console.error('Error creating profile:', error)
    }
  }

  /**
   * Sign up using server-side admin API (auto-confirms email),
   * then sign in to get a real session.
   */
  async function signUp(
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ error: AuthError | null; session?: Session }> {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      })
      const body = await res.json()
      if (!res.ok) {
        return { error: { message: body.error || 'Signup failed' } as AuthError }
      }

      // User created and confirmed — now sign in for a real session
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) return { error: signInErr }

      router.push('/')
      router.refresh()
      return { error: null, session: data.session ?? undefined }
    } catch (err: any) {
      return { error: { message: err.message || 'Network error during signup' } as AuthError }
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error }

      router.push('/')
      router.refresh()
      return { error: null }
    } catch (err: any) {
      return { error: { message: err.message || 'Network error during login' } as AuthError }
    }
  }

  async function signOut(): Promise<void> {
    try {
      await supabase.auth.signOut()
    } catch {}
    setUser(null)
    setSession(null)
    router.push('/login')
    router.refresh()
  }

  async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
