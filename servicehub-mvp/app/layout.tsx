import type { Metadata } from "next";
import "./globals.css";
import "./themes.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { Toaster } from 'react-hot-toast'
import { Suspense } from 'react'
import ProfileSync from '@/components/layout/ProfileSync'
import VisitTracker from '@/components/layout/VisitTracker'
import { A11Y_SCRIPT } from '@/lib/a11y'
import UserWay from '@/components/layout/UserWay'

export const metadata: Metadata = {
  title: "ResourceHub",
  description: "Resource rating platform for the autism community",
  // No icon was declared at all, so the tab fell back to the browser's
  // blank-page glyph and /favicon.ico 404'd on every load.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the script below sets <html>'s accessibility
    // attributes before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The app's accessibility settings (lib/a11y.ts), before the first
            paint, so dark mode doesn't flash white or text jump in size. */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_SCRIPT }} />
      </head>
      <body>
        {/* Skip to main content link for keyboard navigation */}
        <a
          href="#main-content"
          className="skip-link focus:top-0"
          aria-label="Skip to main content"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <Suspense fallback={null}><ProfileSync /></Suspense>
          <VisitTracker />
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#1f2937',
              padding: '16px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              minHeight: '44px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <UserWay />
      </body>
    </html>
  );
}
