import { createHmac } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sponsored listings (Resource Accounts, STEP 81; in Tidbits and the app's
 * Paths too, paid by the click, since STEP 83: the Tidbits round's planning
 * note, Goal 7). Server only. A copy of ResourceHub's
 * servicehub-mvp/lib/sponsored.ts (keep the two the same): here it picks the
 * one sponsored service among a step's suggestions in Paths. Off until the
 * team turns them on with NEXT_PUBLIC_SPONSORED=on, here and in ResourceHub;
 * the privacy page describes them once it's on.
 *
 * "Personalized" the way the privacy page can promise: a promotion is chosen
 * by what the person is looking at right now (what they searched, the Tidbit
 * they're reading, the step of their plan) and a province, never by a
 * profile of them. The business sees counts only. People who pay, or who
 * have free access through an organization, never see one.
 */
export const SPONSORED_ON = process.env.NEXT_PUBLIC_SPONSORED === 'on'

export const PLACEMENTS = ['search', 'tidbits', 'paths'] as const
export type Placement = (typeof PLACEMENTS)[number]
export const isPlacement = (p: unknown): p is Placement => PLACEMENTS.includes(p as Placement)

export interface SponsoredItem {
  id: string
  headline: string
  body: string | null
  image_url: string | null
  resource: { id: string; name: string; category: string; city: string }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const words = (text: string) => new Set(text.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 2))

// What a click is weighed at when the team arranged a promotion without a bid.
const DEFAULT_BID = 25

/**
 * At most one promotion for what someone is looking at: its words or its
 * kind of place match, it is showing today, in this place, in this province
 * (or anywhere), with budget left. Several match: each has a chance in
 * proportion to what it pays a click.
 */
export async function pickPromotion(
  db: SupabaseClient,
  { placement, text, categories = [], province = '' }: { placement: Placement; text: string; categories?: string[]; province?: string }
): Promise<SponsoredItem | null> {
  const w = words(text.slice(0, 400))
  const cats = new Set(categories.map((c) => c.toLowerCase()).filter(Boolean))
  if (!w.size && !cats.size) return null
  const base = 'id, item_id, headline, body, image_url, categories, keywords, provinces, starts_on, ends_on'
  const live = () => db.from('promotions').select(base + ', placements, bid_cents, budget_cents, spent_cents').eq('status', 'active').eq('item_kind', 'resource').limit(200)
  let { data, error } = await live()
  if (error) {
    // Before STEP 83 there are no places or bids: beside searches only.
    if (placement !== 'search') return null
    ;({ data, error } = (await db.from('promotions').select(base).eq('status', 'active').eq('item_kind', 'resource').limit(200)) as any)
    if (error) return null
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const prov = province.toUpperCase()
  const matches = ((data || []) as any[]).filter(
    (p) =>
      (!p.placements || p.placements.includes(placement)) &&
      (p.budget_cents == null || (p.spent_cents ?? 0) < p.budget_cents) &&
      (!p.starts_on || p.starts_on <= today) &&
      (!p.ends_on || p.ends_on >= today) &&
      (!p.provinces?.length || !prov || p.provinces.includes(prov)) &&
      ((p.keywords || []).some((k: string) => k.split(/\s+/).every((x) => w.has(x))) || (p.categories || []).some((c: string) => cats.has(c.toLowerCase())))
  )
  if (!matches.length) return null
  const weight = (p: any) => Math.max(5, p.bid_cents ?? DEFAULT_BID)
  let roll = Math.random() * matches.reduce((sum, p) => sum + weight(p), 0)
  const pick = matches.find((p) => (roll -= weight(p)) < 0) || matches[matches.length - 1]
  const { data: place } = await db.from('resources').select('id, name, category, location, status').eq('id', pick.item_id).maybeSingle()
  if (!place || place.status !== 'approved') return null
  return {
    id: pick.id,
    headline: pick.headline,
    body: pick.body,
    image_url: pick.image_url,
    resource: { id: place.id, name: place.name, category: place.category, city: (place.location as any)?.city || '' },
  }
}

/**
 * Paying for Autinerary, or free access through an organization, means no
 * sponsored listings (the planning note: "Premium banner to remove ads").
 */
export async function adFree(db: SupabaseClient, userId: string | null): Promise<boolean> {
  if (!userId) return false
  const [{ data: sub }, { data: grants }] = await Promise.all([
    db.from('subscriptions').select('status').eq('user_id', userId).maybeSingle(),
    db.from('access_grants').select('ends_at').eq('user_id', userId).eq('status', 'active').limit(5),
  ])
  if (['active', 'trialing', 'past_due'].includes(String(sub?.status))) return true
  return ((grants || []) as { ends_at: string | null }[]).some((g) => !g.ends_at || new Date(g.ends_at) > new Date())
}

/**
 * Who saw or clicked, as a key that changes every day and can't be turned
 * back into a person or an address: views and clicks count once a day per
 * person, and nothing links one day to the next.
 */
export function viewerKey(userId: string | null, headers: Headers): string {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const who = userId ? `u:${userId}` : `a:${(headers.get('x-forwarded-for') || '').split(',')[0].trim()}|${headers.get('user-agent') || ''}`
  const secret = process.env.PROMOTION_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'autinerary'
  return createHmac('sha256', secret).update(`${day}|${who}`).digest('hex')
}
