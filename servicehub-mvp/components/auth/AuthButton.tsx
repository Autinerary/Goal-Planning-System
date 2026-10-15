'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import { APP_SIGNUP } from '@/lib/appSignIn'

interface AuthButtonProps {
  className?: string
  showUserMenu?: boolean
}

export default function AuthButton({ className = '', showUserMenu = true }: AuthButtonProps) {
  const { user, signOut, loading } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    setIsMenuOpen(false)
  }

  if (loading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="animate-pulse bg-gray-200 h-10 w-24 rounded-md"></div>
      </div>
    )
  }

  if (!user) {
    // Sign up the way the sign-in page does, with one Autinerary account
    // (Riipen Labs, Groups 22 and 24: no second sign-up or sign-in wall). The
    // two disagreed: this went to ResourceHub's own form (found going back
    // over Group 8). ResourceHub's own sign-up and setup stay at /signup.
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={APP_SIGNUP}
          className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Sign up
        </a>
        <Link
          href="/login"
          className="px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (!showUserMenu) {
    return (
      <button
        onClick={handleSignOut}
        className={`text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${className}`}
        aria-label="Sign out"
      >
        Sign out
      </button>
    )
  }

  // Get user display name or email
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        {/* Named by what it shows, the person's name, then what it opens: it
            was "User menu", a name with none of the words on it (WCAG 2.5.3,
            label in name; axe on the signed-in pages, 15 October 2026). */}
        <div aria-hidden="true" className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:block">{displayName}</span>
        <span className="sr-only">Account menu</span>
        <svg
          className={`w-4 h-4 transition-transform ${isMenuOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-10"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          />
          
          {/* Dropdown menu */}
          <div
            className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="user-menu-button"
          >
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                <p className="font-medium">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              
              <Link
                href="/profile"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
              >
                Profile
              </Link>
              
              <Link
                href="/my-resources"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
              >
                Resource Manager
              </Link>
              
              {/* Only the phone menu (MobileNav) linked here, so on a desktop
                  the Tidbits public-profile switch could not be found
                  (Riipen Labs, Group 34: a clear public/private toggle). */}
              <Link
                href="/community/settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
              >
                Tidbits settings
              </Link>

              <Link
                href="/settings/accessibility"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
                onClick={() => setIsMenuOpen(false)}
              >
                Accessibility
              </Link>
              
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
