import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { Toaster } from 'react-hot-toast'
import { Suspense } from 'react'
import ProfileSync from '@/components/layout/ProfileSync'

export const metadata: Metadata = {
  title: "ResourceHub",
  description: "Resource rating platform for the autism community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
      </body>
    </html>
  );
}
