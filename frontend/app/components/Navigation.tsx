'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { LogOut, User, ExternalLink, Settings, PlayCircle } from 'lucide-react'
import InfoModeButton from './InfoModeButton'
import VoiceNavigation from './VoiceNavigation'
import NotificationBell from './NotificationBell'
import FeedbackButton from './FeedbackButton'
import { goHubHref } from '@/lib/serviceHub'
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
// Riipen Labs, Group 19: "the interface also uses small icons and navigation
// tools"; on a phone the icons are 20 pixels and the names 12 (they were 16
// and 11). The room comes from the space around them, so the controls fit
// on one row on phones 375 pixels wide and wider, each still at least 44
// pixels; narrower phones take two rows.
const ITEM = 'flex min-w-[2.75rem] flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-lg px-1 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm leading-tight transition-all'
const ICON = 'w-5 h-5 sm:w-4 sm:h-4'

const hideNavRoutes = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/age', '/onboarding', '/checkin']

export default function Navigation() {
  const { user, logout, isLoading } = useAuth()
  const { t } = useTranslation()
  const pathname = usePathname()
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex flex-wrap justify-between items-center min-h-16 py-2 gap-2">
          <Link href="/path" className="flex min-h-[2.75rem] min-w-[2.75rem] items-center gap-2">
            <div aria-hidden="true" className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg flex items-center justify-center">
              <span className="font-bold text-sm text-white">A</span>
            </div>
            <span className="font-bold text-lg hidden sm:block text-slate-700">Autinerary</span>
            <span className="sr-only sm:hidden">Autinerary</span>
          </Link>

          <div className="flex flex-wrap items-center sm:gap-3">
            {/* The name opens Your profile (Riipen Labs, Group 34); it was plain text. */}
            <Link
              href="/profile"
              aria-label={`Your profile: ${user.name || user.email.split('@')[0]}`}
              data-info="Opens your profile: your name, what friends see, and your password."
              className={`${ITEM} text-slate-700 hover:bg-slate-100 hover:text-slate-900`}
            >
              <User className={ICON} aria-hidden="true" />
              <span className="sm:hidden">Profile</span>
              <span className="hidden sm:inline">{user.name || user.email.split('@')[0]}</span>
            </Link>

            <button
              onClick={goToServiceHub}
              aria-label="Find resources in ResourceHub"
              data-info="Opens ResourceHub to find services and tools for your goals."
              className={`${ITEM} font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800`}
            >
              <ExternalLink className={ICON} aria-hidden="true" />
              <span className="sm:hidden">Resources</span>
              <span className="hidden sm:inline">{t('nav.findResources')}</span>
            </button>

            {/* How this page works (components/PageGuide.tsx; Riipen Labs,
                Group 23: "opens guidance specific to the page the user is
                currently viewing"). The full tour is one button inside it. */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('autinerary:page-guide'))}
              className={`${ITEM} text-slate-600 hover:text-slate-900 hover:bg-white/40`}
              title="How this page works"
            >
              <PlayCircle className={ICON} aria-hidden="true" />
              <span className="sm:hidden">Guide</span>
              <span className="hidden sm:inline">{t('nav.howItWorks')}</span>
            </button>

            <NotificationBell />

            {/* Family and Reels were here too, as icons only below 1024 pixels,
                and pushed the bar to three rows on a phone (Riipen Labs, Group
                32: "the navigation bar is condensed with various options";
                Group 33: the same layout on a phone and a computer, and less
                clutter on small screens). Both are places, so they are in All
                places on the Path, and Family is a Quick Link for parents. */}
            <InfoModeButton />
            <VoiceNavigation />

            {/* Goal 8: feedback to the team. From tablets up; on a phone the bar
                keeps one row, and Settings has it at the top. */}
            <FeedbackButton
              className={`${ITEM} hidden sm:flex text-slate-600 hover:text-slate-900 hover:bg-white/40`}
              label={t('nav.feedback')}
              iconClassName={ICON}
            />

            <Link
              href="/profile/settings"
              className={`${ITEM} text-slate-600 hover:text-slate-900 hover:bg-white/40`}
              title="Settings"
              data-info="Opens Settings, where you can change the language, how much of the app you see, colours, and where things sit on the screen."
            >
              <Settings className={ICON} aria-hidden="true" />
              <span>{t('nav.settings')}</span>
            </Link>

            <button
              onClick={logout}
              aria-label={t('nav.logout')}
              data-info="Signs you out of this account without deleting your saved progress."
              className={`${ITEM} text-slate-600 hover:text-slate-900 hover:bg-white/40`}
            >
              <LogOut className={ICON} aria-hidden="true" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
