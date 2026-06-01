'use client'

import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Notification } from '@/types/database'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead?: (id: string) => void
  onDelete?: (id: string) => void
  showDelete?: boolean
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  showDelete = false,
}: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete) {
      onDelete(notification.id)
    }
  }

  const content = (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        notification.read
          ? 'bg-gray-50 border-gray-200'
          : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          notification.read ? 'bg-gray-200' : 'bg-blue-500'
        }`}>
          <Bell className={`w-5 h-5 ${notification.read ? 'text-gray-600' : 'text-white'}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`text-sm font-semibold ${
              notification.read ? 'text-gray-700' : 'text-gray-900'
            }`}>
              {notification.title}
            </h3>
            {showDelete && onDelete && (
              <button
                onClick={handleDelete}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                aria-label="Delete notification"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className={`text-sm mb-2 ${
            notification.read ? 'text-gray-600' : 'text-gray-700'
          }`}>
            {notification.message}
          </p>
          <div className="flex items-center justify-between">
            <time className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </time>
            {!notification.read && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                New
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (notification.link) {
    return (
      <Link href={notification.link} className="block hover:no-underline">
        {content}
      </Link>
    )
  }

  return content
}