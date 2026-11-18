'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Check, Trash2, ArrowLeft } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import NotificationItem from './NotificationItem'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types/database'
import { showToast } from '@/lib/toast'

interface NotificationsPageClientProps {
  userId: string
}

export default function NotificationsPageClient({ userId }: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    loadNotifications()
    // Removed again when the page closes, so channels don't pile up.
    return subscribeToNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      // Get all notifications
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      setNotifications(data || [])

      // Get unread count
      const unread = (data || []).filter((n) => !n.read).length
      setUnreadCount(unread)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToNotifications = () => {
    const channel = supabase
      // A name of its own each time: the client hands back a channel that is
      // still closing under the same name, which never joins again.
      .channel(`notifications:${userId}:page:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Reload notifications when changes occur
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) throw error

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  // As in the bell: gone at once, through the server, and put back with a
  // short message if the delete doesn't happen.
  const handleDelete = async (id: string) => {
    const index = notifications.findIndex((n) => n.id === id)
    if (index < 0) return
    const removed = notifications[index]
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (!removed.read) setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
    } catch (error) {
      console.error('Error deleting notification:', error)
      setNotifications((prev) => {
        if (prev.some((n) => n.id === id)) return prev
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, removed)
        return next
      })
      if (!removed.read) setUnreadCount((prev) => prev + 1)
      showToast.error('We couldn’t remove that notification just now. Please try again later.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to home
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-8 h-8 text-blue-600" aria-hidden="true" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {unreadCount} unread
                    </span>
                  )}
                </h1>
                <p className="text-gray-600 mt-2">
                  Stay updated on activity related to your content
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Check className="w-4 h-4" aria-hidden="true" />
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
              <p className="text-gray-900 font-medium mb-2">No notifications</p>
              <p className="text-sm text-gray-600">
                You&apos;ll see notifications here when someone interacts with your content
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  showDelete={true}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}