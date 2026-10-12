import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Atkinson_Hyperlegible } from 'next/font/google'
import { AuthProvider } from './context/AuthContext'
import { AgentPathProvider } from './context/AgentPathContext'
import { LanguageProvider } from './context/LanguageContext'
import Navigation from './components/Navigation'
import ViewTabs from './components/ViewTabs'
import FeedbackGate from './components/FeedbackGate'
import Toaster from './components/Toaster'
import MovementTracker from './components/MovementTracker'
import AccessibilityProvider from './components/AccessibilityProvider'
import NavTrail from './components/NavTrail'
import InteractiveDemo from './components/InteractiveDemo'
import PageGuide from './components/PageGuide'
import AppWideTranslator from './components/AppWideTranslator'
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar'
import InstallPrompt from './components/InstallPrompt'
import InfoModeProvider from './components/InfoModeProvider'
import AnalyticsConsent from './components/AnalyticsConsent'

/**
 * Typeface.
 *
 * The app had no typographic choice at all: globals.css said
 * `font-family: 'Arial', sans-serif`, which is the browser's default
 * fallback wearing a name. That reads as "nobody looked at this" just as
 * loudly as defaulting to Inter does.
 *
 * Atkinson Hyperlegible is the considered pick rather than a fashionable
 * one. The Braille Institute commissioned it specifically so that letters
 * which normally collapse into each other stay distinct: the lowercase l,
 * capital I and digit 1 are drawn differently, as are O and 0, and the
 * apertures are opened up. For an app whose users include people with
 * dyslexia, visual processing differences and low vision, that is a
 * functional decision, not decoration.
 *
 * Loaded through next/font so it is self-hosted at build time. No request
 * to Google at runtime, no layout shift while it loads.
 */
const bodyFont = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-body',
  // Matched so the fallback occupies near-identical space and text does
  // not reflow when the real face arrives.
  fallback: ['Verdana', 'Geneva', 'system-ui', 'sans-serif'],
})

// What a search result shows (Riipen Labs, Group 25: people found Autinerary
// "through a Google search to find an outdated title link"; the website's
// "(2025)" is for the website's team, in docs/groups-25-30.md). Says what it
// is and who it is for, with no year to go stale.
export const metadata: Metadata = {
  title: 'Autinerary: a life plan built around how you work',
  description: 'Free during the beta. Turn your goals into small, clear steps, planned around your energy, with services rated by people with similar norms. For neurodivergent adults and the people who support them.',
  manifest: '/manifest.json',
  // Apple ignores the web manifest when installing to the home screen, so
  // the icon and standalone behaviour have to be declared separately or an
  // iPhone install gets a screenshot of the page as its icon.
  appleWebApp: {
    capable: true,
    title: 'Autinerary',
    statusBarStyle: 'default',
  },
  icons: {
    // The tab icon was missing because the only sizes declared were 192px
    // and 512px, with no favicon.ico at all. Browsers request /favicon.ico
    // unprompted and that 404'd, and a 192px PNG downscaled to a 16px tab
    // is mush. The .ico carries real 16 and 32 renders.
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [{ url: '/favicon.ico' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  // Zoom is left ENABLED on purpose. Locking it is a common PWA default and
  // an accessibility failure — plenty of people here rely on pinch-zoom.
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Settings saved on this device (Settings → Accessibility) are applied
    // before the first paint, so dark mode doesn't flash white, text doesn't
    // jump size, and calm motion is calm from the first frame (Riipen Labs,
    // Group 22: "sensory control before the animations load").
    // AccessibilityProvider keeps them up to date after.
    <html lang="en" className={bodyFont.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=(JSON.parse(localStorage.getItem('autinerary_preferences')||'{}').accessibility)||{},r=document.documentElement;if(a.darkMode)r.dataset.darkMode='on';if(a.highContrast)r.dataset.highContrast='on';if(a.fontScale)r.dataset.fontScale=a.fontScale;if(a.reduceMotion)r.dataset.reduceMotion='on'}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <AuthProvider>
          <AgentPathProvider>
            <LanguageProvider>
            <AccessibilityProvider />
            <NavTrail />
            <ServiceWorkerRegistrar />
            <InstallPrompt />
            <AppWideTranslator />
            <Navigation />
            <ViewTabs />
            <MovementTracker />
            <main>
              {children}
            </main>
            <FeedbackGate />
            <Toaster />
            <InteractiveDemo />
            <PageGuide />
            <InfoModeProvider />
            <AnalyticsConsent />
            </LanguageProvider>
          </AgentPathProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
