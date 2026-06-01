'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

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
  completeOnboarding: (pathId: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/signup']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

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
      // Simulate API call - in production, call your backend
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Check if user exists in localStorage (mock database)
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
    } catch {
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Store user in localStorage (mock database)
      const storedUsers = JSON.parse(localStorage.getItem('users') || '{}')
      
      if (storedUsers[email]) {
        // User already exists
        return false
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
    } catch {
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    router.push('/')
  }

  const completeOnboarding = (pathId: string) => {
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
