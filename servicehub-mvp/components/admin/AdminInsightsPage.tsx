'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart3, TrendingUp, Users, FileText } from 'lucide-react'
import DiscoveryCard from '@/components/agents/DiscoveryCard'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'

interface AdminInsightsPageProps {
  userId: string
}

interface InsightData {
  patterns: DiscoveredPattern[]
  topCategories: Array<{ category: string; count: number }>
  topBarriers: Array<{ barrier: string; count: number }>
  userGrowth: Array<{ date: string; count: number }>
}

export default function AdminInsightsPage({ userId }: AdminInsightsPageProps) {
  const [insights, setInsights] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInsights()
  }, [])

  const loadInsights = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/insights')
      if (!response.ok) throw new Error('Failed to load insights')
      const data = await response.json()
      setInsights(data)
    } catch (error) {
      console.error('Error loading insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <BarChart3 className="w-8 h-8 text-blue-600 animate-pulse" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Admin Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="text-xl font-bold text-gray-900">
                Admin Dashboard
              </Link>
              <div className="flex items-center gap-4">
                <Link href="/admin" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
                  Overview
                </Link>
                <Link href="/admin/moderation" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
                  Moderation
                </Link>
                <Link href="/admin/resources" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
                  Resources
                </Link>
                <Link href="/admin/users" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
                  Users
                </Link>
                <Link href="/admin/insights" className="text-sm font-medium text-blue-600 px-3 py-2 rounded-md border-b-2 border-blue-600">
                  Insights
                </Link>
              </div>
            </div>
            <Link href="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
            </div>
            <p className="text-gray-600">View platform analytics, patterns, and trends</p>
          </div>

          {/* Top Categories */}
          {insights?.topCategories && insights.topCategories.length > 0 && (
            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" aria-hidden="true" />
                Top Categories
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {insights.topCategories.map((item, index) => (
                  <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{item.count}</div>
                    <div className="text-sm text-gray-600 capitalize">{item.category}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discovered Patterns */}
          {insights?.patterns && insights.patterns.length > 0 && (
            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" aria-hidden="true" />
                Recently Discovered Patterns
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.patterns.map((pattern, index) => (
                  <DiscoveryCard
                    key={pattern.id || index}
                    pattern={pattern}
                    highlight={index === 0}
                    showDetails={true}
                  />
                ))}
              </div>
            </div>
          )}

          {(!insights || (!insights.patterns || insights.patterns.length === 0)) && (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
              <p className="text-gray-600">No insights available yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Insights will appear as the platform grows and agents discover patterns
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}