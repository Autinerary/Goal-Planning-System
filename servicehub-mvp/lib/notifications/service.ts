import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
 * Send a notification to a user.
 *
 * Written as the service: people can't add notifications for anyone, even
 * themselves (STEP 105 drops the open INSERT policy that let anyone with the
 * public key put a "Resource approved" with any link in anyone's bell; bug
 * audit, 17 November 2026, item 1). The text and the link are always made
 * here, from the type, never taken from a request. Call this only after the
 * route has checked that the event really happened.
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData
): Promise<Notification | null> {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('Error sending notification: service client not configured', err)
    return null
  }

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
 * The same notification to several people at once (for example everyone who
 * saved a resource that just got a new rating), as the service, in one write.
 * Returns how many were written. Capped, so one event can't flood the table.
 */
export async function sendNotificationToMany(
  userIds: string[],
  type: NotificationType,
  data: NotificationData,
  max = 500
): Promise<number> {
  const ids = Array.from(new Set(userIds.filter(Boolean))).slice(0, max)
  if (ids.length === 0) return 0
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('Error sending notifications: service client not configured', err)
    return 0
  }
  const { title, message, link } = generateNotificationContent(type, data)
  const rows: NotificationInsert[] = ids.map((user_id) => ({ user_id, type, title, message, link, read: false }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) {
    console.error('Error sending notifications:', error)
    return 0
  }
  return rows.length
}

/** A link inside ResourceHub only, to the resource's page. */
function resourceLink(resourceId?: string): string | null {
  return resourceId ? `/resources/${encodeURIComponent(resourceId)}` : null
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
        link: resourceLink(data.resourceId),
      }

    case 'resource_rejected':
      return {
        title: 'Resource Not Approved',
        message: `Your resource "${data.resourceName || 'Resource'}" could not be approved at this time. Please review the guidelines and try again.`,
        link: resourceLink(data.resourceId),
      }

    case 'rating_helpful':
      return {
        title: 'Your Rating was Helpful! ⭐',
        message: `${data.helpfulCount || 1} person${(data.helpfulCount || 1) > 1 ? 's have' : ' has'} found your rating helpful.`,
        link: resourceLink(data.resourceId),
      }

    case 'new_rating':
      return {
        title: 'New Rating Added',
        message: `Someone added a new rating to a resource you follow.`,
        link: resourceLink(data.resourceId),
      }

    case 'resource_saved_new_rating':
      return {
        title: 'New Rating on Saved Resource',
        message: `"${data.resourceName || 'A resource'}" you saved has received a new rating.`,
        link: resourceLink(data.resourceId),
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
 * Delete one of the signed-in person's own notifications. Until STEP 105
 * there was no delete policy, so with the person's session this deleted
 * nothing and still said it had (bug audit, 17 November 2026, item 33). The
 * person is read from their session; the delete is limited to their own row
 * and made as the service, so it works before and after STEP 105. False when
 * nothing was deleted.
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    admin = supabase
  }
  const { data, error } = await admin
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .select('id')

  return !error && (data?.length ?? 0) > 0
}