'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { LogOut, User, ExternalLink } from 'lucide-react'

async function goToServiceHub() {
  const base = 'http://localhost:3001'
  const params = new URLSearchParams()

  const profile = localStorage.getItem('autinerary_profile')
  if (profile) params.set('profile', profile)

  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      params.set('access_token', session.access_token)
      params.set('refresh_token', session.refresh_token ?? '')
    }
  } catch {
    // no session
  }

  const qs = params.toString()
  window.location.href = qs ? `${base}?${qs}` : base
}

const hideNavRoutes = ['/', '/login', '/signup', '/onboarding']

export default function Navigation() {
  const { user, logout, isLoading } = useAuth()
  const pathname = usePathname()

  if (isLoading || hideNavRoutes.includes(pathname)) {
    return null
  }

  if (!user || !user.hasCompletedOnboarding) {
    return null
  }

  return (
    <nav className="bg-white/30 backdrop-blur-md text-slate-800 sticky top-0 z-50 shadow-sm border-b border-white/40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/path" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-lg flex items-center justify-center">
              <span className="font-bold text-sm text-white">A</span>
            </div>
            <span className="font-bold text-lg hidden sm:block text-slate-700">Autinerary</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4" />
              <span>{user.name || user.email.split('@')[0]}</span>
            </div>

            <button
              onClick={goToServiceHub}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:opacity-90 rounded-lg transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Find Resources</span>
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
