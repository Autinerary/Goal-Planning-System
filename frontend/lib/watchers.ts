import { createAdminClient } from '@/lib/supabase/admin'
import { pushEnabled, pushToUser } from '@/lib/push'

/**
 * "Rival Notifs / Watch Tasks" (Hare World, STEP 87): when someone finishes
 * a milestone, the people who chose to watch them get a notification, unless
 * the person who finished shares nothing with them. Needs push (VAPID keys)
 * and STEP 87; quietly does nothing without them. Returns how many devices
 * were told.
 */
export async function notifyWatchers(userId: string): Promise<number> {
  if (!pushEnabled()) return 0
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('social_connections')
    .select('owner_id, target_user_id, owner_shares, target_shares, owner_watches, target_watches')
    .in('status', ['connected', 'matched'])
    .or(`and(owner_id.eq.${userId},target_watches.eq.true),and(target_user_id.eq.${userId},owner_watches.eq.true)`)
  if (error || !data?.length) return 0
  const watchers = new Set<string>()
  for (const row of data as any[]) {
    const mine = row.owner_id === userId
    const myShares = mine ? row.owner_shares : row.target_shares
    const watcher = mine ? row.target_user_id : row.owner_id
    if (watcher && myShares !== 'none') watchers.add(watcher)
  }
  if (!watchers.size) return 0
  const { data: me } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  const name = (me?.display_name || 'Someone you watch').slice(0, 60)
  let told = 0
  for (const watcher of watchers) {
    told += await pushToUser(admin, watcher, {
      title: `${name} finished a milestone`,
      body: 'Send them a note of support?',
      url: `/friend/${userId}`,
      tag: `watch-${userId}`,
    }).catch(() => 0)
  }
  return told
}
