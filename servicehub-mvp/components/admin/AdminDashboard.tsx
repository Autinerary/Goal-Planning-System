'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Users, 
  FileText, 
  Star, 
  Shield, 
  TrendingUp, 
  Activity,
  Settings,
  BarChart3,
  AlertCircle,
  Database
} from 'lucide-react'
import StatCard from './StatCard'
import ActivityFeed from './ActivityFeed'
import type { ActivityItem } from './ActivityFeed'

interface AdminDashboardProps {
  userId: string
}

interface DashboardStats {
  totalResources: number
  totalRatings: number
  totalUsers: number
  pendingModeration: number
  resourceGrowth: number
  ratingGrowth: number
  userGrowth: number
}

export default function AdminDashboard({ userId }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalResources: 0,
    totalRatings: 0,
    totalUsers: 0,
    pendingModeration: 0,
    resourceGrowth: 0,
    ratingGrowth: 0,
    userGrowth: 0,
  })
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/stats')
      if (!response.ok) throw new Error('Failed to load stats')
      const data = await response.json()
      setStats(data.stats)
      setActivities(data.activities || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Activity className="w-8 h-8 text-blue-600 animate-pulse" aria-hidden="true" />
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
                <Link
                  href="/admin"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Overview
                </Link>
                <Link
                  href="/admin/moderation"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Moderation
                  {stats.pendingModeration > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      {stats.pendingModeration}
                    </span>
                  )}
                </Link>
                <Link
                  href="/admin/resources"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Resources
                </Link>
                <Link
                  href="/admin/users"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Users
                </Link>
                <Link
                  href="/admin/insights"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Insights
                </Link>
                <Link
                  href="/admin/community"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Tidbits
                </Link>
              </div>
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
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
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Overview of platform activity and metrics</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Resources"
              value={stats.totalResources.toLocaleString()}
              change={stats.resourceGrowth}
              changeLabel="this week"
              icon={<FileText className="w-5 h-5" aria-hidden="true" />}
              color="blue"
            />
            <StatCard
              title="Total Ratings"
              value={stats.totalRatings.toLocaleString()}
              change={stats.ratingGrowth}
              changeLabel="this week"
              icon={<Star className="w-5 h-5" aria-hidden="true" />}
              color="yellow"
              onClick={() => (window.location.href = '/admin/resources')}
            />
            <StatCard
              title="Total Users"
              value={stats.totalUsers.toLocaleString()}
              change={stats.userGrowth}
              changeLabel="this week"
              icon={<Users className="w-5 h-5" aria-hidden="true" />}
              color="green"
              onClick={() => (window.location.href = '/admin/users')}
            />
            <StatCard
              title="Pending Moderation"
              value={stats.pendingModeration}
              icon={<Shield className="w-5 h-5" aria-hidden="true" />}
              color="red"
              onClick={() => (window.location.href = '/admin/moderation')}
            />
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" aria-hidden="true" />
                    Recent Activity
                  </h2>
                  <Link
                    href="/admin/insights"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View all
                  </Link>
                </div>
                <ActivityFeed activities={activities} limit={10} />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link
                    href="/admin/moderation"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Shield className="w-4 h-4" aria-hidden="true" />
                    Review Moderation Queue
                    {stats.pendingModeration > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {stats.pendingModeration}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/admin/resources?status=pending"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    Pending Resources
                  </Link>
                  <Link
                    href="/admin/users?sort=newest"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Users className="w-4 h-4" aria-hidden="true" />
                    New Users
                  </Link>
                  <Link
                    href="/admin/insights"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" aria-hidden="true" />
                    View Analytics
                  </Link>
                  <Link
                    href="/admin/data-management"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors border border-yellow-200"
                  >
                    <Database className="w-4 h-4" aria-hidden="true" />
                    Data Management
                  </Link>
                </div>
              </div>

              {/* Top Resources This Week */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" aria-hidden="true" />
                  Top Resources This Week
                </h2>
                <div className="space-y-3">
                  {/* Placeholder - would fetch actual data */}
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Loading top resources...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}