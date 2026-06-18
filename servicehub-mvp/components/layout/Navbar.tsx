'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthContext'
import AuthButton from '@/components/auth/AuthButton'
import MobileNav from './MobileNav'
import { Search, Home, User, Shield, Menu, ArrowLeft } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Navbar() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Memoize the close handler to prevent unnecessary re-renders
  const handleCloseMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setIsAdmin(false)
        return
      }
      try {
        const response = await fetch('/api/admin/check')
        if (response.ok) {
          const data = await response.json()
          setIsAdmin(data.isAdmin || false)
        }
      } catch (error) {
        setIsAdmin(false)
      }
    }
    checkAdmin()
  }, [user])

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center space-x-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
              aria-label="ResourceHub Home"
            >
              <span className="sr-only">ResourceHub</span>
              <Home className="w-6 h-6" aria-hidden="true" />
              <span>ResourceHub</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/search"
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
              aria-label="Search resources"
            >
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
              Search
            </Link>
            {user && (
              <Link
                href="/my-resources"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                My Resources
              </Link>
            )}
            {user && (
              <Link
                href="/resources/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Recommend
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center"
                aria-label="Admin Dashboard"
              >
                <Shield className="w-4 h-4 mr-2" aria-hidden="true" />
                Admin
              </Link>
            )}
          </div>

          {/* Back to Goal Planning */}
          <div className="hidden md:flex items-center">
            <a
              href={`${process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000'}/path`}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              My Journey
            </a>
          </div>

          {/* Notifications & Auth */}
          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden md:block">
                <NotificationBell userId={user.id} />
              </div>
            )}
            <AuthButton />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden ml-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMobileMenuOpen(prev => !prev)
              }}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
              aria-label={mobileMenuOpen ? "Close main menu" : "Open main menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={handleCloseMenu}
        isAdmin={isAdmin}
      />
    </nav>
  )
}
