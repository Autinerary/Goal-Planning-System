'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { LogOut, User } from 'lucide-react'

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
    <nav className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/path" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="font-bold text-sm">A</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">Autinerary</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <User className="w-4 h-4" />
              <span>{user.name || user.email.split('@')[0]}</span>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
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
