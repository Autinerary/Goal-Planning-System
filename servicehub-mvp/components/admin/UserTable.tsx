'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Shield, Ban, Unlock, MoreVertical } from 'lucide-react'
import TrustScoreBadge from '@/components/agents/TrustScoreBadge'
import type { Profile } from '@/types/database'

interface UserTableProps {
  users: (Profile & { ratingsCount?: number; resourcesCount?: number; trustScore?: number })[]
  onRoleChange?: (userId: string, role: string) => void
  onBan?: (userId: string) => void
  onUnban?: (userId: string) => void
  loading?: boolean
}

export default function UserTable({
  users,
  onRoleChange,
  onBan,
  onUnban,
  loading = false,
}: UserTableProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
        <p>No users found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trust Score
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.full_name || user.email?.split('@')[0] || 'User'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => onRoleChange?.(user.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!onRoleChange}
                  >
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.trustScore !== undefined ? (
                    <TrustScoreBadge trustScore={user.trustScore} size="sm" />
                  ) : (
                    <span className="text-sm text-gray-500">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    {user.ratingsCount !== undefined && (
                      <div>{user.ratingsCount} ratings</div>
                    )}
                    {user.resourcesCount !== undefined && (
                      <div>{user.resourcesCount} resources</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Details"
                    >
                      <User className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    {user.role !== 'banned' && onBan && (
                      <button
                        onClick={() => onBan(user.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Ban User"
                      >
                        <Ban className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                    {user.role === 'banned' && onUnban && (
                      <button
                        onClick={() => onUnban(user.id)}
                        className="text-green-600 hover:text-green-900"
                        title="Unban User"
                      >
                        <Unlock className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}