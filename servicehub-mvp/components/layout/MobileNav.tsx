'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, Home, Search, Star, Plus, User, Shield, Bell, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import NotificationBell from '@/components/notifications/NotificationBell'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
}

export default function MobileNav({ isOpen, onClose, isAdmin }: MobileNavProps) {
  const { user } = useAuth()
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const justOpenedRef = useRef(false)
  const [backdropDisabled, setBackdropDisabled] = useState(false)

  // Track when menu just opened to prevent immediate closing
  useEffect(() => {
    if (isOpen) {
      justOpenedRef.current = true
      setBackdropDisabled(true)
      // Longer delay to prevent immediate closing - 1 second
      const timer = setTimeout(() => {
        justOpenedRef.current = false
        setBackdropDisabled(false)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      justOpenedRef.current = false
      setBackdropDisabled(false)
    }
  }, [isOpen])

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'unset'
      return
    }

    // Prevent body scroll when menu is open
    document.body.style.overflow = 'hidden'

    let clickHandler: ((event: MouseEvent) => void) | null = null

      // Much longer delay before setting up click-outside handler - 1 second
      const timeoutId = setTimeout(() => {
        clickHandler = (event: MouseEvent) => {
          // Don't close if we just opened
          if (justOpenedRef.current) {
            return
          }

          const target = event.target as HTMLElement
          
          // Don't close if clicking on the hamburger menu button
          const menuButton = target.closest('button[aria-label="Open main menu"]') || 
                            target.closest('button[aria-label="Close main menu"]')
          if (menuButton) {
            return
          }
          
          // Don't close if clicking inside the menu
          if (navRef.current && navRef.current.contains(target)) {
            return
          }
          
          // Close if clicking outside
          onClose()
        }

        // Use capture phase to catch events earlier, but still with delay
        document.addEventListener('mousedown', clickHandler, true)
      }, 1000) // Increased delay to 1 second

    return () => {
      clearTimeout(timeoutId)
      if (clickHandler) {
        document.removeEventListener('mousedown', clickHandler, true)
      }
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Close menu on route change (but not on initial mount)
  const prevPathnameRef = useRef(pathname)
  useEffect(() => {
    // Only close if pathname actually changed (not on initial mount)
    if (isOpen && prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      onClose()
    } else {
      prevPathnameRef.current = pathname
    }
  }, [pathname, isOpen, onClose])

  // Focus trap for accessibility
  useEffect(() => {
    if (isOpen && navRef.current) {
      const focusableElements = navRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }

      document.addEventListener('keydown', handleTabKey)
      firstElement?.focus()

      return () => {
        document.removeEventListener('keydown', handleTabKey)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onMouseDown={(e) => {
          // Prevent immediate closing when menu just opened
          if (backdropDisabled || justOpenedRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return false
          }
        }}
        onClick={(e) => {
          // Prevent immediate closing when menu just opened
          if (backdropDisabled || justOpenedRef.current) {
            e.preventDefault()
            e.stopPropagation()
            return false
          }
          onClose()
        }}
        style={{ pointerEvents: backdropDisabled ? 'none' : 'auto' }}
        aria-hidden="true"
      />

      {/* Mobile Menu */}
      <nav
        ref={navRef}
        className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out overflow-hidden"
        role="navigation"
        aria-label="Main navigation"
        aria-modal="true"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto py-4" style={{ minHeight: 0 }}>
            <div className="space-y-1 px-4">
              <Link
                href="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  pathname === '/'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={onClose}
              >
                <Home className="w-5 h-5" aria-hidden="true" />
                Home
              </Link>

              <Link
                href="/search"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  pathname === '/search'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={onClose}
              >
                <Search className="w-5 h-5" aria-hidden="true" />
                Search
              </Link>

              {user && (
                <>
                  <Link
                    href="/my-resources"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      pathname === '/my-resources'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={onClose}
                  >
                    <Star className="w-5 h-5" aria-hidden="true" />
                    My Resources
                  </Link>

                  <Link
                    href="/resources/new"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      pathname === '/resources/new'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={onClose}
                  >
                    <Plus className="w-5 h-5" aria-hidden="true" />
                    Recommend Resource
                  </Link>

                  <div className="px-4 py-3">
                    <NotificationBell userId={user.id} />
                  </div>
                </>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    pathname?.startsWith('/admin')
                      ? 'bg-purple-50 text-purple-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={onClose}
                >
                  <Shield className="w-5 h-5" aria-hidden="true" />
                  Admin Dashboard
                </Link>
              )}

              <Link
                href="/settings/accessibility"
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  pathname === '/settings/accessibility'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={onClose}
              >
                <User className="w-5 h-5" aria-hidden="true" />
                Accessibility Settings
              </Link>
            </div>
          </div>

          {/* Back to Goal Planning - always visible */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <a
              href="http://localhost:3000/path"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-base font-medium text-white bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 transition-all shadow-sm"
              onClick={onClose}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              Back to My Journey
            </a>
          </div>

          {/* Footer */}
          {user && (
            <div className="flex-shrink-0 border-t border-gray-200 p-4">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  )
}