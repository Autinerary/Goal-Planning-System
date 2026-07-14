import './globals.css'
import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'Autinerary - Goal Planning System',
  description: 'Personalized life planning for individuals facing systematic barriers',
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
