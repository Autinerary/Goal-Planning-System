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
import { Bookmark, Star, FileText, Calendar, History, Plus, Users } from 'lucide-react'
import Link from 'next/link'

type TabType = 'build-team' | 'saved' | 'current' | 'past' | 'rated' | 'submitted'

export default function MyResourcesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('build-team')
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

          {/* Tabs */}
          <div className="mt-8 border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
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
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-8">
            {activeTab === 'build-team' && <BuildTeamTab userId={userId} />}
            {activeTab === 'saved' && <SavedTab userId={userId} />}
            {activeTab === 'current' && <CurrentTab userId={userId} />}
            {activeTab === 'past' && <PastTab userId={userId} />}
            {activeTab === 'rated' && <RatedTab userId={userId} />}
            {activeTab === 'submitted' && <SubmittedTab userId={userId} />}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}