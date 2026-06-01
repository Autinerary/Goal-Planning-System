'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Search } from 'lucide-react'
import UserTable from './UserTable'
import { calculateUserTrust } from '@/lib/agents/validation-agent/trust-scorer'
import type { Profile } from '@/types/database'

interface AdminUsersPageProps {
  userId: string
  initialRole?: string
  initialSort?: string
  initialPage?: number
}

export default function AdminUsersPage({
  userId,
  initialRole,
  initialSort,
  initialPage = 1,
}: AdminUsersPageProps) {
  const [users, setUsers] = useState<(Profile & { ratingsCount?: number; resourcesCount?: number; trustScore?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState(initialRole || 'all')
  const [sort, setSort] = useState(initialSort || 'newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(initialPage)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadUsers()
  }, [roleFilter, sort, searchQuery, page])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        role: roleFilter !== 'all' ? roleFilter : '',
        sort: sort,
        q: searchQuery,
      })

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) throw new Error('Failed to load users')
      const data = await response.json()
      setUsers(data.users || [])
      setTotalCount(data.total || 0)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) throw new Error('Failed to update role')
      loadUsers()
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update user role')
    }
  }

  const handleBan = async (userId: string) => {
    if (!confirm('Are you sure you want to ban this user?')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'banned' }),
      })

      if (!response.ok) throw new Error('Failed to ban user')
      loadUsers()
    } catch (error) {
      console.error('Error banning user:', error)
      alert('Failed to ban user')
    }
  }

  const handleUnban = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user' }),
      })

      if (!response.ok) throw new Error('Failed to unban user')
      loadUsers()
    } catch (error) {
      console.error('Error unbanning user:', error)
      alert('Failed to unban user')
    }
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
                <Link href="/admin/users" className="text-sm font-medium text-blue-600 px-3 py-2 rounded-md border-b-2 border-blue-600">
                  Users
                </Link>
                <Link href="/admin/insights" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
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
              <Users className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            </div>
            <p className="text-gray-600">View and manage users, assign roles, and monitor activity</p>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setPage(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Roles</option>
                  <option value="user">Users</option>
                  <option value="moderator">Moderators</option>
                  <option value="admin">Admins</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="most_active">Most Active</option>
                  <option value="least_active">Least Active</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <UserTable
            users={users}
            onRoleChange={handleRoleChange}
            onBan={handleBan}
            onUnban={handleUnban}
            loading={loading}
          />

          {/* Pagination */}
          {totalCount > 20 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalCount)} of {totalCount} users
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 20 >= totalCount}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}