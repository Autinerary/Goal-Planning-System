'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Filter, Search } from 'lucide-react'
import ResourceTable from './ResourceTable'
import type { Resource } from '@/types/database'

interface AdminResourcesPageProps {
  userId: string
  initialStatus?: string
  initialCategory?: string
  initialPage?: number
}

export default function AdminResourcesPage({
  userId,
  initialStatus,
  initialCategory,
  initialPage = 1,
}: AdminResourcesPageProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all')
  const [categoryFilter, setCategoryFilter] = useState(initialCategory || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(initialPage)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadResources()
  }, [statusFilter, categoryFilter, searchQuery, page])

  const loadResources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        status: statusFilter !== 'all' ? statusFilter : '',
        category: categoryFilter !== 'all' ? categoryFilter : '',
        q: searchQuery,
      })

      const response = await fetch(`/api/admin/resources?${params}`)
      if (!response.ok) throw new Error('Failed to load resources')
      const data = await response.json()
      setResources(data.resources || [])
      setTotalCount(data.total || 0)
    } catch (error) {
      console.error('Error loading resources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/admin/resources/${resourceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })

      if (!response.ok) throw new Error('Failed to approve resource')
      loadResources()
    } catch (error) {
      console.error('Error approving resource:', error)
      alert('Failed to approve resource')
    }
  }

  const handleReject = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/admin/resources/${resourceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })

      if (!response.ok) throw new Error('Failed to reject resource')
      loadResources()
    } catch (error) {
      console.error('Error rejecting resource:', error)
      alert('Failed to reject resource')
    }
  }

  const handleDelete = async (resourceId: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return

    try {
      const response = await fetch(`/api/admin/resources/${resourceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete resource')
      loadResources()
    } catch (error) {
      console.error('Error deleting resource:', error)
      alert('Failed to delete resource')
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
                <Link href="/admin/resources" className="text-sm font-medium text-blue-600 px-3 py-2 rounded-md border-b-2 border-blue-600">
                  Resources
                </Link>
                <Link href="/admin/users" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
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
              <FileText className="w-8 h-8 text-blue-600" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900">Resource Management</h1>
            </div>
            <p className="text-gray-600">Manage all resources, approve submissions, and edit details</p>
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
                    placeholder="Search resources..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setPage(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  <option value="therapist">Therapists</option>
                  <option value="school">Schools</option>
                  <option value="doctor">Doctors</option>
                  <option value="park">Parks</option>
                  <option value="store">Stores</option>
                  <option value="app">Apps</option>
                  <option value="book">Books</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resources Table */}
          <ResourceTable
            resources={resources}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
            loading={loading}
          />

          {/* Pagination */}
          {totalCount > 20 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalCount)} of {totalCount} resources
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