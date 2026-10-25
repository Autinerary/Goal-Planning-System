'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import SavedTab from '@/components/myResources/SavedTab'
import CurrentTab from '@/components/myResources/CurrentTab'
import PastTab from '@/components/myResources/PastTab'
import RatedTab from '@/components/myResources/RatedTab'
import SubmittedTab from '@/components/myResources/SubmittedTab'
import BuildTeamTab from '@/components/myResources/BuildTeamTab'
import SignedUpTab from '@/components/myResources/SignedUpTab'
import { SIGNUP_ON } from '@/lib/signup'
import MoreLikeThesePrompt from '@/components/prompts/MoreLikeThesePrompt'
import KeptItems from '@/components/myResources/KeptItems'
import { Bookmark, Star, FileText, Calendar, History, Plus, UserPlus, Users, Building2, ChefHat, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

type TabType = 'build-team' | 'signed-up' | 'saved' | 'current' | 'past' | 'rated' | 'submitted'
// Layer 1 (the team's notes, October 2026: "Categories in My Resources should
// be 2 layered; Layer 1 as Service, Post or Store Item, Layer 2 as layers in
// each"): services, Tidbits and shop items, each with its own categories.
type Kind = 'service' | 'post' | 'product'
const KIND_TABS: { id: Kind; label: string; icon: React.ReactNode }[] = [
  { id: 'service', label: 'Services', icon: <Building2 className="h-4 w-4" aria-hidden="true" /> },
  { id: 'post', label: 'Posts', icon: <ChefHat className="h-4 w-4" aria-hidden="true" /> },
  { id: 'product', label: 'Store Items', icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" /> },
]
const STATUS_OF: Partial<Record<TabType, 'wishlist' | 'current' | 'past'>> = { saved: 'wishlist', current: 'current', past: 'past' }

export default function MyResourcesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('build-team')
  const [kind, setKind] = useState<Kind>('service')
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      setLoading(false)
    }

    checkAuth()
  }, [router])

  // How many Posts and Store Items each tab holds, for Layer 1.
  useEffect(() => {
    if (!userId) return
    fetch('/api/my-resources/items?counts=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCounts(d?.counts || {}))
      .catch(() => {})
  }, [userId, activeTab, kind])

  if (loading || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-600">Loading...</div>
        </main>
        <Footer />
      </div>
    )
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'build-team', label: 'Build a Team', icon: <Users className="w-5 h-5" aria-hidden="true" /> },
    // One-click sign-up (lib/signup.ts): what Sign me up signed the person up for.
    ...(SIGNUP_ON ? [{ id: 'signed-up' as TabType, label: 'Signed up', icon: <UserPlus className="w-5 h-5" aria-hidden="true" /> }] : []),
    { id: 'saved', label: 'Wishlist', icon: <Bookmark className="w-5 h-5" aria-hidden="true" /> },
    { id: 'current', label: 'My Resources', icon: <Calendar className="w-5 h-5" aria-hidden="true" /> },
    { id: 'past', label: 'Completed', icon: <History className="w-5 h-5" aria-hidden="true" /> },
    { id: 'rated', label: 'Rated', icon: <Star className="w-5 h-5" aria-hidden="true" /> },
    { id: 'submitted', label: 'Submitted', icon: <FileText className="w-5 h-5" aria-hidden="true" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'My Resources', href: '/my-resources' },
            ]}
          />

          <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Resources</h1>
              <p className="text-gray-600">
                Your <span className="font-medium text-gray-900">Wishlist</span> (want to use),{' '}
                <span className="font-medium text-gray-900">My Resources</span> (currently using), and{' '}
                <span className="font-medium text-gray-900">Completed</span> (rate with proof).
              </p>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add a resource
            </Link>
          </div>

          {/* "Want more like these?" after a few saves of one kind (Group 8) */}
          <MoreLikeThesePrompt />

          {/* Tabs */}
          <div className="mt-8 border-b border-gray-200">
            {/* Named on a phone too, wrapping onto a second line if needed:
                they were icons alone there (Riipen Labs, Group 33). */}
            <nav className="-mb-px flex flex-wrap gap-x-4 sm:gap-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-t min-w-[44px] min-h-[44px]`}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Layer 1: Services, Posts or Store Items. */}
          {STATUS_OF[activeTab] && (
            <div role="group" aria-label="Kind" className="mt-6 flex flex-wrap gap-2">
              {KIND_TABS.map((k) => {
                const n = k.id === 'service' ? 0 : counts[k.id]?.[STATUS_OF[activeTab]!] || 0
                return (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={kind === k.id}
                    onClick={() => setKind(k.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                      kind === k.id ? 'bg-blue-700 text-white' : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {k.icon}
                    {k.label}
                    {n > 0 && <span className={`rounded-full px-1.5 text-xs ${kind === k.id ? 'bg-white/20' : 'bg-gray-100'}`}>{n}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Tab Content */}
          <div className="mt-8">
            {activeTab === 'build-team' && <BuildTeamTab userId={userId} />}
            {activeTab === 'signed-up' && <SignedUpTab />}
            {STATUS_OF[activeTab] && kind !== 'service' && <KeptItems kind={kind} status={STATUS_OF[activeTab]!} />}
            {activeTab === 'saved' && kind === 'service' && <SavedTab userId={userId} />}
            {activeTab === 'current' && kind === 'service' && <CurrentTab userId={userId} />}
            {activeTab === 'past' && kind === 'service' && <PastTab userId={userId} />}
            {activeTab === 'rated' && <RatedTab userId={userId} />}
            {activeTab === 'submitted' && <SubmittedTab userId={userId} />}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}