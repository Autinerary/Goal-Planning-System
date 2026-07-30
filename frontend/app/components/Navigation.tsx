'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { LogOut, User, ExternalLink, Settings, PlayCircle, Film, Users } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { goHubHref } from '@/lib/serviceHub'

function goToServiceHub() {
  // Route through /go/servicehub, which forwards the session so the user lands
  // on ServiceHub signed in (see lib/serviceHub.ts).
  window.location.href = goHubHref('/')
}

const hideNavRoutes = ['/', '/login', '/signup', '/onboarding']

export default function Navigation() {
  const { user, supabaseUser, logout, isLoading } = useAuth()
  const { t } = useTranslation()
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
              <span className="hidden sm:inline">{t('nav.findResources')}</span>
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
              title="How it works"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.howItWorks')}</span>
            </button>

            <NotificationBell />

            {/* Family — supervise children (hidden for managed child accounts) */}
            {!supabaseUser?.user_metadata?.managed_by_guardian && (
              <Link
                href="/family"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
                title="Family — add & supervise children"
              >
                <Users className="w-4 h-4" />
                <span className="hidden lg:inline">Family</span>
              </Link>
            )}

            <Link
              href="/under-construction?feature=Progress%20Reels"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
              title="Progress Reels — coming soon"
            >
              <Film className="w-4 h-4" />
              <span className="hidden lg:inline">Reels</span>
            </Link>

            <Link
              href="/profile/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.settings')}</span>
            </Link>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
