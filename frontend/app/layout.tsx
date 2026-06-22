import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from './context/AuthContext'
import { AgentPathProvider } from './context/AgentPathContext'
import Navigation from './components/Navigation'
import FeedbackGate from './components/FeedbackGate'

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
            <Navigation />
            <main>
              {children}
            </main>
            <FeedbackGate />
          </AgentPathProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
