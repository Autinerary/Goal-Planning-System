'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { LogOut, User, ExternalLink, Settings, PlayCircle, Film, Users } from 'lucide-react'
import InfoModeButton from './InfoModeButton'
import VoiceNavigation from './VoiceNavigation'
import NotificationBell from './NotificationBell'
import { goHubHref } from '@/lib/serviceHub'
import { useDisclosure } from '@/lib/disclosure'
import { useCssHeightVar } from '@/lib/useCssHeightVar'

function goToServiceHub() {
  // Route through /go/servicehub, which forwards the session so the user lands
  // on ServiceHub signed in (see lib/serviceHub.ts).
  window.location.href = goHubHref('/')
}

// One look for the bar's controls: an icon with its name under it on a phone,
// beside it on a wider screen. On a phone the bar was icons only (Riipen Labs,
// Groups 31 and 32: "dual-labeling text", and a clear difference between the
// app's menu and your plan's pages, which have their own bar).
const ITEM = 'flex min-w-[2.75rem] flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-lg px-1.5 sm:px-3 py-1 sm:py-2 text-[0.6875rem] sm:text-sm leading-tight transition-all'

const hideNavRoutes = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/age', '/onboarding', '/checkin']

export default function Navigation() {
  const { user, supabaseUser, logout, isLoading } = useAuth()
  const { t } = useTranslation()
  const pathname = usePathname()
  const { isSimple } = useDisclosure()
  const navRef = useRef<HTMLElement>(null)
  // Setup finished, or skipped for now (Riipen Labs, Group 33): the bar was
  // hidden until setup was done, so the app was a dead end without a plan.
  const inApp = !!user && (user.hasCompletedOnboarding || !!user.skippedSetup)
  const shown = !isLoading && !hideNavRoutes.includes(pathname) && inApp
  // Page headers that stick to the top sit below this bar (lib/useCssHeightVar.ts).
  useCssHeightVar(navRef, '--nav-h', shown)

  if (isLoading || hideNavRoutes.includes(pathname)) {
    return null
  }

  if (!user || !inApp) {
    return null
  }

  return (
    <nav ref={navRef} className="text-slate-800 sticky top-0 z-50 shadow-sm border-b border-white/40 surface-chrome">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap justify-between items-center min-h-16 py-2 gap-2">
          <Link href="/path" className="flex min-h-[2.75rem] min-w-[2.75rem] items-center gap-2">
            <div aria-hidden="true" className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg flex items-center justify-center">
              <span className="font-bold text-sm text-white">A</span>
            </div>
            <span className="font-bold text-lg hidden sm:block text-slate-700">Autinerary</span>
            <span className="sr-only sm:hidden">Autinerary</span>
          </Link>

          <div className="flex flex-wrap items-center gap-0.5 sm:gap-3">
            {/* The name opens Your profile (Riipen Labs, Group 34); it was plain text. */}
            <Link
              href="/profile"
              aria-label={`Your profile: ${user.name || user.email.split('@')[0]}`}
              data-info="Opens your profile: your name, what friends see, and your password."
              className={`${ITEM} text-slate-700 hover:bg-slate-100 hover:text-slate-900`}
            >
              <User className="w-4 h-4" aria-hidden="true" />
              <span className="sm:hidden">Profile</span>
              <span className="hidden sm:inline">{user.name || user.email.split('@')[0]}</span>
            </Link>

            <button
              onClick={goToServiceHub}
              aria-label="Find resources"
              data-info="Opens ResourceHub to find services and tools for your goals."
              className={`${ITEM} font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800`}
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span className="sm:hidden">Resources</span>
              <span className="hidden sm:inline">{t('nav.findResources')}</span>
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent('autinerary:start-demo'))}
              className={`${ITEM} text-slate-600 hover:text-slate-900 hover:bg-white/40`}
              title="How it works"
            >
              <PlayCircle className="w-4 h-4" aria-hidden="true" />
              <span className="sm:hidden">Guide</span>
              <span className="hidden sm:inline">{t('nav.howItWorks')}</span>
            </button>

            <NotificationBell />

            {/* Family — supervise children (hidden for managed child accounts) */}
            {!isSimple && !supabaseUser?.user_metadata?.managed_by_guardian && !supabaseUser?.app_metadata?.managed_by_guardian && (
              <Link
                href="/family"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
                title="Family: add & supervise children"
              >
                <Users className="w-4 h-4" />
                <span className="hidden lg:inline">Family</span>
              </Link>
            )}

            {!isSimple && <Link
              href="/reels"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-white/40 rounded-lg transition-all"
              title="Progress Reels"
            >
              <Film className="w-4 h-4 anim-reel" />
              <span className="hidden lg:inline">Reels</span>
            </Link>}

            <InfoModeButton />
            <VoiceNavigation />

            <Link
              href="/profile/settings"
              className={`${ITEM} text-slate-600 hover:text-slate-900 hover:bg-white/40`}
              title="Settings"
              data-info="Opens Settings, where you can change the language, how much of the app you see, colours, and where things sit on the screen."
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              <span>{t('nav.settings')}</span>
            </Link>

            <button
              onClick={logout}
              aria-label={t('nav.logout')}
              data-info="Signs you out of this account without deleting your saved progress."
              className={`${ITEM} text-slate-600 hover:text-slate-900 hover:bg-white/40`}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
