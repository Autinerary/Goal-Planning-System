import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { isHalloween, type AchievementUnlock } from '@/lib/achievements'

const FRIEND_MILESTONES = [
  { achievementId: 'friends_1', threshold: 1 },
  { achievementId: 'friends_5', threshold: 5 },
  { achievementId: 'friends_10', threshold: 10 },
] as const

export async function evaluateFriendAchievements(userId: string): Promise<number> {
  const admin = createAdminClient()
  const [outgoing, incoming] = await Promise.all([
    admin
      .from('social_connections')
      .select('target_user_id')
      .eq('owner_id', userId)
      .eq('category', 'friends')
      .eq('status', 'connected')
      .not('target_user_id', 'is', null),
    admin
      .from('social_connections')
      .select('owner_id')
      .eq('target_user_id', userId)
      .eq('category', 'friends')
      .eq('status', 'connected'),
  ])

  if (outgoing.error) throw outgoing.error
  if (incoming.error) throw incoming.error

  const friendIds = new Set<string>()
  for (const connection of outgoing.data || []) {
    if (connection.target_user_id && connection.target_user_id !== userId) {
      friendIds.add(connection.target_user_id)
    }
  }
  for (const connection of incoming.data || []) {
    if (connection.owner_id && connection.owner_id !== userId) {
      friendIds.add(connection.owner_id)
    }
  }

  const eligible = FRIEND_MILESTONES
    .filter(milestone => friendIds.size >= milestone.threshold)
    .map(milestone => ({ user_id: userId, achievement_id: milestone.achievementId }))

  if (eligible.length) {
    const { error } = await admin
      .from('achievement_unlocks')
      .upsert(eligible, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
    if (error) throw error
  }

  return friendIds.size
}

export async function listAchievementUnlocks(userId: string): Promise<AchievementUnlock[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('achievement_unlocks')
    .select('achievement_id, unlocked_at')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: true })

  if (error) throw error
  return data || []
}

/** On 31 October in the person's own time zone (lib/achievements.ts, isHalloween), records Spooky Season. */
export async function recordHalloweenLogin(userId: string, timeZone?: unknown, now = new Date()): Promise<boolean> {
  if (!isHalloween(timeZone, now)) return false

  const admin = createAdminClient()
  const { error } = await admin
    .from('achievement_unlocks')
    .upsert(
      { user_id: userId, achievement_id: 'halloween_login' },
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true }
    )

  if (error) throw error
  return true
}
