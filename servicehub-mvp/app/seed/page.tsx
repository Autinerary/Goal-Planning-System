/**
 * Development-only seeding page
 * 
 * This page allows easy database seeding during development.
 * 
 * Usage: Navigate to http://localhost:3000/seed in development mode
 */

'use client'

import { useState } from 'react'
import { Database, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { showToast } from '@/lib/toast'

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    message?: string
    users?: number
    resources?: number
    ratings?: number
    error?: string
  } | null>(null)

  const handleSeed = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed database')
      }

      setResult({
        success: true,
        message: data.message || 'Database seeded successfully!',
        users: data.users,
        resources: data.resources,
        ratings: data.ratings,
      })

      showToast.success('Database seeded successfully!')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed database'
      setResult({
        success: false,
        error: errorMessage,
      })
      showToast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Check if in production (client-side check)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Not Available</h1>
          <p className="text-gray-600">
            This page is only available in development mode (localhost).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center mb-6">
          <Database className="w-12 h-12 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Database Seeding
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Seed the database with test data for development and testing.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Seeding Database...
              </>
            ) : (
              <>
                <Database className="w-5 h-5" />
                Seed Database
              </>
            )}
          </button>

          {result && (
            <div
              className={`p-4 rounded-lg ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      result.success ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {result.success ? 'Success!' : 'Error'}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      result.success ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {result.success ? result.message : result.error}
                  </p>
                  {result.success && (
                    <div className="mt-3 space-y-1 text-sm text-green-700">
                      {result.users !== undefined && (
                        <p>✓ Created {result.users} test users</p>
                      )}
                      {result.resources !== undefined && (
                        <p>✓ Created {result.resources} test resources</p>
                      )}
                      {result.ratings !== undefined && (
                        <p>✓ Created {result.ratings} test ratings</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">What gets created?</h3>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>5-10 test user profiles with barrier combinations</li>
              <li>50-100 test resources across all categories</li>
              <li>200-300 test ratings with varied scores</li>
              <li>Resources distributed across Toronto, Vancouver, Montreal</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Requires <code className="bg-yellow-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in your <code className="bg-yellow-100 px-1 rounded">.env.local</code> file.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
