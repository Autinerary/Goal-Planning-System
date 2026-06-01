import { createClient } from '@/lib/supabase/server'
import type { Notification } from '@/types/database'

type NotificationInsert = {
  user_id: string
  type: string
  title: string
  message: string
  link?: string | null
  read?: boolean
}

export type NotificationType =
  | 'resource_approved'
  | 'resource_rejected'
  | 'rating_helpful'
  | 'new_rating'
  | 'resource_saved_new_rating'

interface NotificationData {
  resourceId?: string
  resourceName?: string
  ratingId?: string
  userId?: string
  userName?: string
  helpfulCount?: number
  [key: string]: any
}

/**
 * Send a notification to a user
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData
): Promise<Notification | null> {
  const supabase = createClient()

  // Generate title and message based on type
  const { title, message, link } = generateNotificationContent(type, data)

  const notification: NotificationInsert = {
    user_id: userId,
    type,
    title,
    message,
    link,
    read: false,
  }

  const { data: notificationData, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single()

  if (error) {
    console.error('Error sending notification:', error)
    return null
  }

  return notificationData
}

/**
 * Generate notification content based on type
 */
function generateNotificationContent(
  type: NotificationType,
  data: NotificationData
): { title: string; message: string; link: string | null } {
  switch (type) {
    case 'resource_approved':
      return {
        title: 'Resource Approved! 🎉',
        message: `Your resource "${data.resourceName || 'Resource'}" has been approved and is now live on the platform.`,
        link: data.resourceId ? `/resources/${data.resourceId}` : null,
      }

    case 'resource_rejected':
      return {
        title: 'Resource Not Approved',
        message: `Your resource "${data.resourceName || 'Resource'}" could not be approved at this time. Please review the guidelines and try again.`,
        link: data.resourceId ? `/resources/${data.resourceId}` : null,
      }

    case 'rating_helpful':
      return {
        title: 'Your Rating was Helpful! ⭐',
        message: `${data.helpfulCount || 1} person${(data.helpfulCount || 1) > 1 ? 's have' : ' has'} found your rating helpful.`,
        link: data.resourceId ? `/resources/${data.resourceId}` : null,
      }

    case 'new_rating':
      return {
        title: 'New Rating Added',
        message: `Someone added a new rating to a resource you follow.`,
        link: data.resourceId ? `/resources/${data.resourceId}` : null,
      }

    case 'resource_saved_new_rating':
      return {
        title: 'New Rating on Saved Resource',
        message: `"${data.resourceName || 'A resource'}" you saved has received a new rating.`,
        link: data.resourceId ? `/resources/${data.resourceId}` : null,
      }

    default:
      return {
        title: 'Notification',
        message: 'You have a new notification.',
        link: null,
      }
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  return !error
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  return !error
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('Error getting unread count:', error)
    return 0
  }

  return count || 0
}

/**
 * Get user notifications with optional limit
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 20,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  const supabase = createClient()

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting notifications:', error)
    return []
  }

  return data || []
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id)

  return !error
}