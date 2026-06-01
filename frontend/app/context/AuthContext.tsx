'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser, Session, AuthError } from '@supabase/supabase-js'

interface User {
  id: string
  email: string
  name?: string
  hasCompletedOnboarding: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
  completeOnboarding: (pathId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/signup']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  
  // Create Supabase client with error handling (memoized to prevent re-creation)
  const supabase = useMemo(() => {
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return createClient()
      } else {
        console.warn('Supabase credentials not found, using localStorage-only mode')
        return null
      }
    } catch (error) {
      console.error('Error creating Supabase client:', error)
      return null
    }
  }, [])

  // Load user profile from Supabase or localStorage
  const loadUserProfile = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      // Check onboarding status from Supabase first
      let hasCompletedOnboarding = false
      
      // Check Supabase user metadata (primary source of truth)
      if (supabaseUser.user_metadata?.has_completed_onboarding === true) {
        hasCompletedOnboarding = true
        console.log('Onboarding status found in Supabase user metadata for:', supabaseUser.email)
      } else {
        // Fallback to localStorage (for users who completed onboarding before Supabase integration)
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser)
            // Only trust localStorage if it matches the current user
            if (parsed.id === supabaseUser.id || parsed.email === supabaseUser.email) {
              hasCompletedOnboarding = parsed.hasCompletedOnboarding || false
              if (hasCompletedOnboarding) {
                console.log('Onboarding status found in localStorage for:', supabaseUser.email)
                // Sync to Supabase if not already there
                if (supabase && !supabaseUser.user_metadata?.has_completed_onboarding) {
                  try {
                    await supabase.auth.updateUser({
                      data: {
                        has_completed_onboarding: true,
                      }
                    })
                    console.log('Synced onboarding status to Supabase')
                  } catch (syncError) {
                    console.error('Error syncing onboarding status to Supabase:', syncError)
                  }
                }
              }
            }
          } catch (e) {
            // Invalid stored user, ignore
          }
        }
      }

      const userProfile: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || undefined,
        hasCompletedOnboarding
      }

      setUser(userProfile)
      localStorage.setItem('user', JSON.stringify(userProfile))
    } catch (error) {
      console.error('Error loading user profile:', error)
      // Fallback to localStorage only
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          // Invalid stored user, ignore
        }
      }
    }
  }, [supabase])

  // Check for existing Supabase session on mount
  const isInitializingRef = useRef(true)
  
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout | null = null
    
    // Safety timeout to ensure loading always completes
    safetyTimeout = setTimeout(() => {
      if (isInitializingRef.current) {
        console.warn('Auth initialization taking too long, forcing completion')
        setIsLoading(false)
        isInitializingRef.current = false
      }
    }, 5000) // 5 second timeout
    
    const initializeAuth = async () => {
      // If Supabase is not available, use localStorage only
      if (!supabase) {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser))
          } catch {
            localStorage.removeItem('user')
          }
        }
        setIsLoading(false)
        isInitializingRef.current = false
        return
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          // Fallback to localStorage
          const storedUser = localStorage.getItem('user')
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser))
            } catch {
              localStorage.removeItem('user')
            }
          }
          setIsLoading(false)
          isInitializingRef.current = false
          return
        }

        if (session?.user) {
          setSupabaseUser(session.user)
          await loadUserProfile(session.user)
        } else {
          // Fallback to localStorage for backward compatibility
          const storedUser = localStorage.getItem('user')
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser))
            } catch {
              localStorage.removeItem('user')
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        // Fallback to localStorage
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser))
          } catch {
            localStorage.removeItem('user')
          }
        }
      } finally {
        setIsLoading(false)
        isInitializingRef.current = false
        if (safetyTimeout) {
          clearTimeout(safetyTimeout)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes (only if Supabase is available)
    // Skip the initial session event since we already handle it in initializeAuth
    if (!supabase) {
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the initial session event - we handle it in initializeAuth
      if (isInitializingRef.current) {
        // Don't do anything during initialization - initializeAuth will handle it
        return
      }
      
      // Only handle auth changes after initialization is complete
      if (session?.user) {
        setSupabaseUser(session.user)
        await loadUserProfile(session.user)
      } else {
        setSupabaseUser(null)
        setUser(null)
        localStorage.removeItem('user')
      }
      setIsLoading(false)
    })

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Redirect logic
  useEffect(() => {
    if (isLoading) return

    const isPublicRoute = publicRoutes.includes(pathname)
    const isOnboarding = pathname === '/onboarding'

    if (!user && !isPublicRoute && !isOnboarding) {
      // Not logged in and trying to access protected route
      router.push('/login')
    } else if (user && !user.hasCompletedOnboarding && !isOnboarding && !publicRoutes.includes(pathname)) {
      // Logged in but hasn't completed onboarding
      router.push('/onboarding')
    } else if (user && user.hasCompletedOnboarding && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
      // Logged in and completed onboarding, redirect from auth pages to path
      router.push('/path')
    }
  }, [user, isLoading, pathname, router])

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      // Try Supabase Auth first (if available)
      if (!supabase) {
        // Fallback to localStorage
        const storedUsers = JSON.parse(localStorage.getItem('users') || '{}')
        const userData = storedUsers[email]
        
        if (userData && userData.password === password) {
          const user: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            hasCompletedOnboarding: userData.hasCompletedOnboarding || false
          }
          setUser(user)
          localStorage.setItem('user', JSON.stringify(user))
          setIsLoading(false)
          return true
        }
        setIsLoading(false)
        return false
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Fallback to localStorage for backward compatibility
        const storedUsers = JSON.parse(localStorage.getItem('users') || '{}')
        const userData = storedUsers[email]
        
        if (userData && userData.password === password) {
          const user: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            hasCompletedOnboarding: userData.hasCompletedOnboarding || false
          }
          setUser(user)
          localStorage.setItem('user', JSON.stringify(user))
          return true
        }
        return false
      }

      // Supabase login successful - user will be set via onAuthStateChange
      if (supabase) {
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      // Try Supabase Auth first (if available)
      if (!supabase) {
        // Fallback to localStorage
        const storedUsers = JSON.parse(localStorage.getItem('users') || '{}')
        
        if (storedUsers[email]) {
          setIsLoading(false)
          return false // User already exists
        }
        
        const newUser = {
          id: `user_${Date.now()}`,
          email,
          password,
          name,
          hasCompletedOnboarding: false
        }
        
        storedUsers[email] = newUser
        localStorage.setItem('users', JSON.stringify(storedUsers))
        
        const user: User = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          hasCompletedOnboarding: false
        }
        setUser(user)
        localStorage.setItem('user', JSON.stringify(user))
        setIsLoading(false)
        return true
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        // If Supabase signup fails (e.g., user already exists), fallback to localStorage
        const storedUsers = JSON.parse(localStorage.getItem('users') || '{}')
        
        if (storedUsers[email]) {
          return false // User already exists
        }
        
        const newUser = {
          id: `user_${Date.now()}`,
          email,
          password,
          name,
          hasCompletedOnboarding: false
        }
        
        storedUsers[email] = newUser
        localStorage.setItem('users', JSON.stringify(storedUsers))
        
        const user: User = {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          hasCompletedOnboarding: false
        }
        setUser(user)
        localStorage.setItem('user', JSON.stringify(user))
        return true
      }

      // Supabase signup successful - user will be set via onAuthStateChange after email confirmation
      // For now, set user immediately (email confirmation can be handled separately)
      if (data.user) {
        const userProfile: User = {
          id: data.user.id,
          email: data.user.email || email,
          name: name,
          hasCompletedOnboarding: false
        }
        setUser(userProfile)
        localStorage.setItem('user', JSON.stringify(userProfile))
      }

      return true
    } catch (error) {
      console.error('Signup error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      // Sign out from Supabase (if available)
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local state
      setUser(null)
      setSupabaseUser(null)
      localStorage.removeItem('user')
      router.push('/')
    }
  }

  const completeOnboarding = async (pathId: string) => {
    if (user) {
      const updatedUser = { ...user, hasCompletedOnboarding: true }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      localStorage.setItem('pathId', pathId)
      
      // Update the mock database too
      const storedUsers = JSON.parse(localStorage.getItem('users') || '{}')
      if (storedUsers[user.email]) {
        storedUsers[user.email].hasCompletedOnboarding = true
        localStorage.setItem('users', JSON.stringify(storedUsers))
      }
      
      // Save onboarding status to Supabase if user is authenticated
      if (supabaseUser && supabase) {
        try {
          // Update user metadata in Supabase to mark onboarding as complete
          const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({
            data: {
              has_completed_onboarding: true,
              path_id: pathId,
            }
          })
          
          if (updateError) {
            console.error('Error updating onboarding status in Supabase:', updateError)
          } else {
            console.log('Onboarding status saved to Supabase')
            // Refresh the user profile with updated metadata
            if (updatedUser?.user) {
              setSupabaseUser(updatedUser.user)
              await loadUserProfile(updatedUser.user)
            }
          }
        } catch (error) {
          console.error('Error saving onboarding status to Supabase:', error)
          // Continue anyway - localStorage is updated
        }
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, completeOnboarding }}>
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
