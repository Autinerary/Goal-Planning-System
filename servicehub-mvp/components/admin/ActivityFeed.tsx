'use client'

import { Clock, User, FileText, Star, Shield, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export interface ActivityItem {
  id: string
  type: 'resource' | 'rating' | 'user' | 'moderation' | 'pattern'
  action: string
  userId?: string
  userName?: string
  resourceId?: string
  resourceName?: string
  timestamp: string
  metadata?: any
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  limit?: number
}

const activityIcons = {
  resource: FileText,
  rating: Star,
  user: User,
  moderation: Shield,
  pattern: AlertCircle,
}

const activityColors = {
  resource: 'text-blue-600 bg-blue-100',
  rating: 'text-yellow-600 bg-yellow-100',
  user: 'text-green-600 bg-green-100',
  moderation: 'text-purple-600 bg-purple-100',
  pattern: 'text-purple-600 bg-purple-100',
}

export default function ActivityFeed({ activities, limit = 10 }: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, limit)

  if (displayedActivities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
        <p>No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {displayedActivities.map((activity) => {
        const Icon = activityIcons[activity.type] || Clock
        const colorClass = activityColors[activity.type] || 'text-gray-600 bg-gray-100'

        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.userName || 'User'}</span>{' '}
                  {activity.action}
                  {activity.resourceName && (
                    <Link
                      href={`/resources/${activity.resourceId}`}
                      className="font-medium text-blue-600 hover:text-blue-700 ml-1"
                    >
                      {activity.resourceName}
                    </Link>
                  )}
                </p>
                <time className="text-xs text-gray-500 whitespace-nowrap">
                  {formatTimestamp(activity.timestamp)}
                </time>
              </div>
              {activity.metadata && (
                <div className="text-xs text-gray-600 mt-1">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}