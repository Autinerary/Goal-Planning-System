'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import AuthButton from '@/components/auth/AuthButton'
import MobileNav from './MobileNav'
import { Search, Home, User, Shield, Menu, ArrowLeft, Sparkles, ShoppingBag, Handshake, FolderKanban, PlusCircle, Star, Palette } from 'lucide-react'
import NotificationBell from '@/components/notifications/NotificationBell'
import InfoModeButton from './InfoModeButton'

function NavbarInner() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Where did the user come from? Determines the back-link target/label.
  const goalPlanningBase = process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000'
  const from = searchParams?.get('from') ?? null
  const backHref = from === 'hare-world'
    ? `${goalPlanningBase}/pit-stop?tab=haveworld`
    : `${goalPlanningBase}/path`
  const backLabel = from === 'hare-world' ? 'Back to Hare World' : 'My Journey'
  
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
              {/* The house alone on the narrowest phones, so the header fits a
                  320 px screen without sideways scrolling (WCAG 1.4.10). */}
              <span className="hidden min-[360px]:inline">ResourceHub</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Odosa: a Search tab covering ALL resource types, with the
                type-specific tabs kept alongside it. "Search" used to mean
                services only, which is why it was renamed to Services. */}
            <Link
              href="/search-all"
              data-info="Search everything at once: services, products and Tidbits."
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
              aria-label="Search everything"
            >
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
              Search
            </Link>
            <Link
              href="/search"
              data-info="Find services near you, with filters for norms, cost, waits and more."
              className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
              aria-label="Services"
            >
              <Handshake className="w-4 h-4 mr-2" aria-hidden="true" />
              Services
            </Link>
            <Link
              href="/shop"
              data-info="Products people recommend, with the qualities that matter, like tagless, quiet or fragrance-free."
              className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center"
              aria-label="Shop"
            >
              <ShoppingBag className="w-4 h-4 mr-2" aria-hidden="true" />
              Shop
            </Link>
            <Link
              href="/community"
              data-info="Tidbits: short pieces and questions from people who have been there."
              className="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 flex items-center"
              aria-label="Tidbits community"
            >
              <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
              Tidbits
            </Link>
            {/* Visuals (the team's notes, October 2026): real art by the
                people who made it; never AI-generated. */}
            <Link
              href="/visuals"
              data-info="Visuals: real art by people in the community. No AI-generated art."
              className="text-gray-700 hover:text-rose-700 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 flex items-center"
            >
              <Palette className="w-4 h-4 mr-2" aria-hidden="true" />
              Visuals
            </Link>
            {user && (
              <Link
                href="/my-resources"
                data-info="Your saved services, and the team you are building."
                className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
                aria-label="Resource Manager"
              >
                <FolderKanban className="w-4 h-4 mr-2" aria-hidden="true" />
                Resource Manager
              </Link>
            )}
            {user && (
              <Link
                href="/resources/new"
                data-info="Recommend a service ResourceHub should list."
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
              >
                <PlusCircle className="w-4 h-4 mr-2" aria-hidden="true" />
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
            {/* The planning note's Goal 11: last in the bar. */}
            <Link
              href="/help-us-rate"
              data-info="Rate services you have used, so others can choose well."
              className="text-gray-700 hover:text-amber-800 px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 flex items-center"
            >
              <Star className="w-4 h-4 mr-2" aria-hidden="true" />
              Help us rate our resources!
            </Link>
          </div>

          {/* Back to Goal Planning */}
          <div className="hidden md:flex items-center">
            <a
              href={backHref}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-blue-700 via-purple-700 to-pink-700 hover:from-blue-800 hover:via-purple-800 hover:to-pink-800 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {backLabel}
            </a>
          </div>

          {/* Notifications & Auth, with the ? for Info Mode (All Apps). */}
          <div className="flex items-center gap-2">
            <InfoModeButton />
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
        backHref={backHref}
        backLabel={backLabel}
      />
    </nav>
  )
}

export default function Navbar() {
  // useSearchParams inside NavbarInner forces this whole tree to opt out of
  // static prerendering. The Suspense boundary is required by Next.js 14 so
  // the rest of the page can still prerender.
  return (
    <Suspense fallback={<nav className="bg-white shadow-sm border-b border-gray-200 h-16" aria-hidden="true" />}>
      <NavbarInner />
    </Suspense>
  )
}
