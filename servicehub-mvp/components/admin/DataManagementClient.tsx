'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { Database, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { showToast } from '@/lib/toast'

export default function DataManagementClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleSeed = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed database')
      }

      showToast.success(
        `Database seeded successfully! Created ${data.users} users, ${data.resources} resources, and ${data.ratings} ratings.`
      )
    } catch (error) {
      console.error('Error seeding database:', error)
      showToast.error(error instanceof Error ? error.message : 'Failed to seed database')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear test data')
      }

      showToast.success('Test data cleared successfully!')
      setShowClearConfirm(false)
    } catch (error) {
      console.error('Error clearing database:', error)
      showToast.error(error instanceof Error ? error.message : 'Failed to clear test data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1" role="main">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Admin', href: '/admin' },
              { label: 'Data Management', href: '#' },
            ]}
          />

          <div className="mt-8">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
            </div>

            <p className="text-gray-600 mb-8">
              Manage test data for development and testing. These tools are only available in
              development mode.
            </p>

            {/* Warning Banner */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900 mb-1">Development Only</h3>
                  <p className="text-sm text-yellow-800">
                    These operations will modify your database. Only use in development
                    environments. All test data uses the <code className="bg-yellow-100 px-1 rounded">@test.com</code> email
                    domain.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-6">
              {/* Seed Database */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Seed Database</h2>
                    <p className="text-gray-600 text-sm">
                      Populate the database with test data including:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                      <li>5-10 test user profiles with different barrier combinations</li>
                      <li>50-100 test resources across all categories</li>
                      <li>200-300 test ratings with varied scores</li>
                      <li>Resources distributed across Toronto, Vancouver, and Montreal</li>
                    </ul>
                  </div>
                </div>
                <button
                  onClick={handleSeed}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      Seeding...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" aria-hidden="true" />
                      Seed Database
                    </>
                  )}
                </button>
              </div>

              {/* Clear Test Data */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Clear Test Data</h2>
                    <p className="text-gray-600 text-sm">
                      Remove all test data from the database. This will delete:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                      <li>All test user accounts (emails ending in @test.com)</li>
                      <li>All test resources</li>
                      <li>All test ratings</li>
                      <li>All saved resources and notes</li>
                    </ul>
                    <p className="text-red-600 text-sm font-medium mt-2">
                      ⚠️ This action cannot be undone!
                    </p>
                  </div>
                </div>

                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Clear Test Data
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800 font-medium mb-2">
                        Are you sure you want to delete all test data?
                      </p>
                      <p className="text-sm text-red-700">
                        This will permanently delete all test users, resources, and ratings. This
                        action cannot be undone.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClear}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            Clearing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Yes, Delete All Test Data
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Test Data Details</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>
                  • <strong>Test Users:</strong> 8 users with various barrier combinations (autism,
                  ADHD, mobility, sensory, etc.)
                </li>
                <li>
                  • <strong>Test Resources:</strong> ~100 resources across all categories (therapist,
                  school, doctor, park, store, etc.)
                </li>
                <li>
                  • <strong>Test Ratings:</strong> ~250 ratings with varied scores (1-5 stars) and
                  barrier-specific ratings
                </li>
                <li>
                  • <strong>Locations:</strong> Resources distributed across Toronto, Vancouver, and
                  Montreal
                </li>
                <li>
                  • <strong>Distribution:</strong> Mix of high and low rated resources, some with no
                  ratings yet
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}