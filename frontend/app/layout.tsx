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
import InteractiveDemo from './components/InteractiveDemo'
import AppWideTranslator from './components/AppWideTranslator'
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar'
import InstallPrompt from './components/InstallPrompt'
import InfoModeProvider from './components/InfoModeProvider'

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

export const metadata: Metadata = {
  title: 'Autinerary - Goal Planning System',
  description: 'Personalized life planning for individuals facing systematic barriers',
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
    <html lang="en" className={bodyFont.variable}>
      <body className="min-h-screen">
        <AuthProvider>
          <AgentPathProvider>
            <LanguageProvider>
            <AccessibilityProvider />
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
            <InfoModeProvider />
            </LanguageProvider>
          </AgentPathProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
