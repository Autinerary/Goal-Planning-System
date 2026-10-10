import type { SupabaseClient } from '@supabase/supabase-js'
import { publicProfilesByIds, step64Missing, type PublicProfile } from '@/lib/publicProfiles'

/**
 * Hare World's people features (Riipen Labs, Group 34): messages and notes of
 * support, memes, calls, tasks from mentors, goals worked on together, and
 * updates from your people. The routes in app/api/social read and write as
 * the signed-in person; the rules are in the database (STEP 66,
 * backend/database/migrations/2026_social_features.sql), which also refuses
 * anything between people who aren't connected or where one blocked the other.
 */

/** True when STEP 66 isn't applied yet (no table, column or function). */
export const socialMissing = step64Missing

/**
 * Whether STEP 66 is applied. memes and video_calls are older than STEP 66
 * (database/schema.sql), so reading them works before it; messages.kind is
 * new in STEP 66.
 */
export async function socialReady(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.from('messages').select('kind').limit(1)
  return !error || !socialMissing(error)
}

const HINTS: Record<string, string> = {
  not_connected: 'You can only do this with people you’re connected to.',
  unavailable: 'This person isn’t available.',
  empty: 'Write something first.',
  too_long: 'That’s too long. Please make it shorter.',
  slow_down: 'You’ve sent a lot just now. Please wait a little and try again.',
  not_mentor: 'Tasks are only for people who chose you as their mentor.',
  not_found: 'That couldn’t be found. It may have been removed.',
  type: 'Emoji or words only.',
}

/** A message for the person, from a database error. */
export function socialError(error: { code?: string; hint?: string | null; message?: string } | null | undefined, fallback: string): { status: number; error: string } {
  if (!error) return { status: 500, error: fallback }
  if (socialMissing(error)) return { status: 503, error: 'This isn’t switched on yet.' }
  const hint = error.hint || ''
  if (HINTS[hint]) return { status: hint === 'not_found' ? 404 : hint === 'slow_down' ? 429 : 400, error: HINTS[hint] }
  if (error.code === '23505') return { status: 409, error: 'That’s already there.' }
  if (error.code === '23514' || error.code === '22023') return { status: 400, error: 'Please check what you typed.' }
  if (error.code === '42501') return { status: 403, error: 'You can’t do that.' }
  return { status: 500, error: fallback }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface Person {
  id: string
  name: string
  icon: string
  avatar_url: string | null
  /** How they're linked to you. */
  relation: 'friend' | 'your_mentor' | 'your_role_model' | 'chose_you_as_mentor' | 'chose_you_as_role_model' | 'friend_request_accepted'
  /** They chose you as their mentor, so you can suggest tasks (whatever else links you). */
  chose_you_as_mentor?: boolean
}

/** Everyone a connection links you to, with their public name and picture. */
export async function connectedPeople(supabase: SupabaseClient, me: string): Promise<Person[]> {
  const [mine, theirs] = await Promise.all([
    supabase.from('social_connections').select('target_user_id, category, name').eq('owner_id', me).eq('status', 'connected').not('target_user_id', 'is', null),
    supabase.from('social_connections').select('owner_id, category, name').eq('target_user_id', me).eq('status', 'connected'),
  ])
  const relation = new Map<string, Person['relation']>()
  const mentees = new Set<string>()
  for (const r of (mine.data || []) as { target_user_id: string; category: string }[]) {
    relation.set(r.target_user_id, r.category === 'mentors' ? 'your_mentor' : r.category === 'rolemodels' ? 'your_role_model' : 'friend')
  }
  for (const r of (theirs.data || []) as { owner_id: string; category: string }[]) {
    if (r.category === 'mentors') mentees.add(r.owner_id)
    if (relation.has(r.owner_id)) continue
    relation.set(r.owner_id, r.category === 'mentors' ? 'chose_you_as_mentor' : r.category === 'rolemodels' ? 'chose_you_as_role_model' : 'friend_request_accepted')
  }
  const ids = Array.from(relation.keys())
  const profiles = await publicProfilesByIds(supabase, ids)
  return ids
    .map((id) => ({ ...personFrom(id, profiles[id], relation.get(id)!), chose_you_as_mentor: mentees.has(id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function personFrom(id: string, p: PublicProfile | undefined, relation: Person['relation'] = 'friend'): Person {
  return { id, name: p?.display_name || 'Someone on Autinerary', icon: p?.avatar_emoji || '👤', avatar_url: p?.avatar_url || null, relation }
}

/** Names and pictures for a set of ids (public fields only). */
export async function peopleByIds(supabase: SupabaseClient, ids: string[]): Promise<Record<string, Person>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const profiles = await publicProfilesByIds(supabase, unique)
  return Object.fromEntries(unique.map((id) => [id, personFrom(id, profiles[id])]))
}

/** A video room nobody can guess, on Jitsi Meet, for a booked call. */
export function newRoomUrl(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const code = Array.from(bytes, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')
  return `https://meet.jit.si/Autinerary-${code}`
}

/** A link someone pasted for a call: https, no spaces, not too long. */
export function cleanRoomUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const url = value.trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || url.length > 300 || /[\s<>"]/.test(url)) return null
    return parsed.toString()
  } catch {
    return null
  }
}
