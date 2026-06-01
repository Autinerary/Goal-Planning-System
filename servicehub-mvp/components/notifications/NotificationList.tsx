'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Trash2 } from 'lucide-react'
import NotificationItem from './NotificationItem'
import type { Notification } from '@/types/database'

interface NotificationListProps {
  notifications: Notification[]
  onMarkAsRead?: (id: string) => void
  onMarkAllAsRead?: () => void
  onDelete?: (id: string) => void
  loading?: boolean
}

export default function NotificationList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  loading = false,
}: NotificationListProps) {
  const unreadCount = notifications.filter((n) => !n.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
        <p>No notifications yet</p>
        <p className="text-sm mt-2">You'll see notifications here when someone interacts with your content</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" aria-hidden="true" />
          Notifications
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {unreadCount} new
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && onMarkAllAsRead && (
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Mark all as read
            </button>
          )}
          <Link
            href="/notifications"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            showDelete={true}
          />
        ))}
      </div>
    </div>
  )
}