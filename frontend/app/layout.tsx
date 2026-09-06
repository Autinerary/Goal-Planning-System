import './globals.css'
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from './context/AuthContext'
import { AgentPathProvider } from './context/AgentPathContext'
import { LanguageProvider } from './context/LanguageContext'
import Navigation from './components/Navigation'
import ViewTabs from './components/ViewTabs'
import FeedbackGate from './components/FeedbackGate'
import MovementTracker from './components/MovementTracker'
import AccessibilityProvider from './components/AccessibilityProvider'
import InteractiveDemo from './components/InteractiveDemo'
import AppWideTranslator from './components/AppWideTranslator'
import ServiceWorkerRegistrar from './components/ServiceWorkerRegistrar'
import InstallPrompt from './components/InstallPrompt'

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
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
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
    <html lang="en">
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
            <InteractiveDemo />
            </LanguageProvider>
          </AgentPathProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
