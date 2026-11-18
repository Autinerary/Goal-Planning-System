import { createAdminClient } from '@/lib/supabase/admin'
import { sharedCache } from '@/lib/cache/shared'

/**
 * ResourceHub's moderation queue (moderation_queue), written as the service.
 *
 * People can't write the queue (it has an admin-only read policy and no
 * insert policy), and the routes used to write it with the person's own
 * session and ignore the error, so nothing ever reached it (bug audit,
 * 17 November 2026, item 25). Writes now go through here, with the admin
 * client, and every error is logged.
 *
 * STEP 105 adds submitted_by, agent_decision, agent_confidence,
 * agent_reasons, review_notes and admin_override. Before it, a row is written
 * with the original columns only, with the agent's reasons in `reason`.
 */

export type QueueItemType = 'resource' | 'rating' | 'product_review'

export interface QueueEntry {
  item_type: QueueItemType
  item_id: string
  submitted_by?: string | null
  agent_decision?: string | null
  agent_confidence?: number | null
  agent_reasons?: string[] | null
  /** A short note for moderators (before STEP 105 it carries the agent's reasons). */
  reason?: string | null
}

type DbError = { code?: string; message?: string } | null | undefined

/** A column the code knows about isn't in the table yet (before STEP 105). */
export function queueColumnMissing(error: DbError): boolean {
  if (!error) return false
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /submitted_by|agent_decision|agent_confidence|agent_reasons|review_notes|admin_override/.test(error.message || '')
  )
}

function summary(entry: QueueEntry): string | null {
  if (entry.reason) return entry.reason.slice(0, 500)
  const reasons = (entry.agent_reasons || []).filter(Boolean)
  if (!entry.agent_decision && reasons.length === 0) return null
  return [entry.agent_decision ? `Agent: ${entry.agent_decision}` : '', reasons.join('; ')].filter(Boolean).join(' — ').slice(0, 500)
}

/**
 * Put an item in the queue as pending, or refresh the pending entry it
 * already has (so editing a held rating doesn't pile up rows). Returns the
 * queue row's id, or null when it could not be written (logged).
 */
export async function enqueueModeration(entry: QueueEntry): Promise<string | null> {
  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error('[moderation] service client not configured; queue entry not written', err)
    return null
  }

  const full = {
    item_type: entry.item_type,
    item_id: entry.item_id,
    status: 'pending',
    reason: entry.reason ?? null,
    submitted_by: entry.submitted_by ?? null,
    agent_decision: entry.agent_decision ?? null,
    agent_confidence: entry.agent_confidence ?? null,
    agent_reasons: entry.agent_reasons ?? null,
  }
  const base = { item_type: entry.item_type, item_id: entry.item_id, status: 'pending', reason: summary(entry) }

  const { data: existing, error: findError } = await admin
    .from('moderation_queue')
    .select('id')
    .eq('item_type', entry.item_type)
    .eq('item_id', entry.item_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
  if (findError) console.error('[moderation] queue lookup failed:', findError.message)

  const pendingId = (existing as { id: string }[] | null)?.[0]?.id
  if (pendingId) {
    const changes = {
      reason: full.reason,
      submitted_by: full.submitted_by,
      agent_decision: full.agent_decision,
      agent_confidence: full.agent_confidence,
      agent_reasons: full.agent_reasons,
    }
    let { error } = await admin.from('moderation_queue').update(changes).eq('id', pendingId)
    if (error && queueColumnMissing(error)) ({ error } = await admin.from('moderation_queue').update({ reason: base.reason }).eq('id', pendingId))
    if (error) console.error('[moderation] queue update failed:', error.message)
    return pendingId
  }

  let { data, error } = await admin.from('moderation_queue').insert(full).select('id').single()
  if (error && queueColumnMissing(error)) ({ data, error } = await admin.from('moderation_queue').insert(base).select('id').single())
  if (error || !data) {
    console.error('[moderation] queue insert failed:', error?.message || 'no row')
    return null
  }
  return (data as { id: string }).id
}

/** Take an entry back out (best effort), when the item it points to was never saved. */
export async function dropModerationEntry(queueId: string | null): Promise<void> {
  if (!queueId) return
  try {
    const { error } = await createAdminClient().from('moderation_queue').delete().eq('id', queueId)
    if (error) console.error('[moderation] queue entry not removed:', error.message)
  } catch (err) {
    console.error('[moderation] queue entry not removed:', err)
  }
}

// Which items are waiting for a moderator, refreshed every 30 seconds per
// server instance: read on every page that shows ratings, so kept cheap.
const heldCache = sharedCache<Set<string>>({ ttlMs: 30_000, maxEntries: 4 })

/**
 * Ids of items of this type waiting in the queue: a flagged rating or
 * product review stays hidden from everyone but its author until a
 * moderator approves it. With `ids`, only those are asked about, fresh.
 * A failure hides nothing (logged), so a queue problem never empties pages.
 */
export async function heldForReview(itemType: QueueItemType, ids?: string[]): Promise<Set<string>> {
  const read = async (only?: string[]): Promise<Set<string>> => {
    const out = new Set<string>()
    let admin
    try {
      admin = createAdminClient()
    } catch {
      return out
    }
    const batches: (string[] | undefined)[] = []
    if (only) for (let i = 0; i < only.length; i += 200) batches.push(only.slice(i, i + 200))
    else batches.push(undefined)
    for (const batch of batches) {
      let q = admin.from('moderation_queue').select('item_id').eq('item_type', itemType).eq('status', 'pending').limit(5000)
      if (batch) q = q.in('item_id', batch)
      const { data, error } = await q
      if (error) {
        console.error('[moderation] held items not read:', error.message)
        return new Set()
      }
      for (const r of (data || []) as { item_id: string }[]) out.add(String(r.item_id))
    }
    return out
  }
  if (ids) {
    const wanted = Array.from(new Set(ids.filter(Boolean)))
    return wanted.length ? read(wanted) : new Set()
  }
  return heldCache(itemType, () => read())
}
