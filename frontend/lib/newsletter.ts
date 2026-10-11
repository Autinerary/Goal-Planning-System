// The weekly email and emailed Start here lists, for people without an
// account (Riipen Labs, Group 11: "Every week: 3 neurodivergent-friendly
// resources ... plus one practical tip. No spam." and "Want these saved and
// emailed to you? Never a hard email wall."). Server-only.
//
// Double opt-in: an address typed in gets one email asking to confirm, and
// nothing else until it is confirmed (public.newsletter_subscribers, STEP 52).
// The weekly email is sent only when NEWSLETTER_POSTAL_ADDRESS is set, because
// Canada's anti-spam law (CASL) requires a mailing address in it.

import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { starterItems, HUB_URL } from '@/lib/starterItems'
import { isStartGoal, isStartRole, pathwayTitle, START_GOALS } from '@/lib/startHere'
import type { NewsletterLink } from '@/lib/email'

export const SIGNUPS_PER_HOUR = 5

export function newToken(): string {
  return randomBytes(24).toString('hex')
}

/** A salted hash of where a sign-up came from, only for limiting floods. */
export function ipHash(ip: string | null): string | null {
  if (!ip) return null
  const salt = process.env.NEWSLETTER_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim()
  return email.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(email) ? email : null
}

export function postalAddress(): string | null {
  return (process.env.NEWSLETTER_POSTAL_ADDRESS || '').trim() || null
}

/** What someone asked for, said back to them and kept as the consent record. */
export function askedFor(weekly: boolean, list: boolean, role: string | null, need: string | null): string {
  const parts: string[] = []
  if (list && isStartGoal(need)) parts.push(`the Start here list "${pathwayTitle(isStartRole(role) ? role : 'unsure', need)}", once`)
  if (weekly) parts.push('a weekly email with three places and ideas to start with and one practical tip')
  return parts.join(', and ')
}

// Practical, non-clinical tips in Autinerary's voice (docs/voice.md). One a
// week, in turn.
export const TIPS = [
  'Write tomorrow’s one most important task on a sticky note tonight, and put it where you will see it first.',
  'On a low-energy day, pick the smallest step that still counts. A five-minute version is still progress.',
  'Before a phone call or appointment, write down the two things you most want to say or ask.',
  'Set a timer for 10 minutes and stop when it rings. Starting is often the hardest part.',
  'Put things you use every day in the same spot every time, like a bowl by the door for keys.',
  'If noise wears you down, plan quieter routes or times for errands, like early morning shopping.',
  'Break a big task into steps you can see. Tick each one off so the progress is visible.',
  'Keep a short list of what helps on hard days, written on a good day, so you don’t have to think of it then.',
  'Ask for instructions in writing when you can. It is a reasonable request at school, work or appointments.',
  'Plan rest the way you plan tasks. A break you scheduled is one you are more likely to take.',
  'When a goal feels too big, ask: what is one thing I could do in the next 15 minutes?',
  'Celebrate small wins. Noticing what went well makes the next step easier to start.',
]

/** The ISO-ish week number, for taking turns. */
export function weekIndex(now: Date): number {
  return Math.floor((now.getTime() / 86400000 + 3) / 7)
}

export function tipFor(now: Date): string {
  return TIPS[weekIndex(now) % TIPS.length]
}

/**
 * Organisations that serve everyone, not one town (no map position), with a
 * real description: a placeholder of a word or two tells the reader nothing.
 * Filtered in the database: there are thousands of places with a position
 * (9,561 approved resources, 19 without one, on 10 October 2026).
 */
async function organisations(): Promise<{ id: string; name: string; description: string | null; province: string | null }[]> {
  const { data } = await createAdminClient()
    .from('resources')
    .select('id, name, description, location')
    .eq('status', 'approved')
    .or('location.is.null,location->>lat.is.null')
    .order('name')
    .limit(500)
  return (data || [])
    .filter((r: any) => !(r.location && (r.location.lat || r.location.lng)))
    .filter((r: any) => (r.description || '').trim().length >= 20)
    .map((r: any) => ({ id: r.id, name: r.name, description: r.description, province: r.location?.province || null }))
}

const shorten = (text: string | null, max = 140) => {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t
}

/** This week's three: an organisation, then two starter searches for their need. */
export async function weeklyLinks(role: string | null, need: string | null, now: Date, appUrl: string): Promise<NewsletterLink[]> {
  const week = weekIndex(now)
  const links: NewsletterLink[] = []
  const orgs = await organisations()
  if (orgs.length) {
    const org = orgs[week % orgs.length]
    links.push({ label: org.name, detail: shorten(org.description) || 'An organisation to know about.', href: `${HUB_URL}/resources/${org.id}` })
  }
  const goal = isStartGoal(need) ? need : START_GOALS.find((g) => g.id === 'unsure')!.id
  const { items } = await starterItems(isStartRole(role) ? role : 'unsure', goal)
  const searches = items.filter((i) => typeof i.count === 'number')
  for (let k = 0; k < Math.min(2, searches.length); k++) {
    const item = searches[(week * 2 + k) % searches.length]
    if (links.some((l) => l.label === item.label)) continue
    links.push({ label: item.label, detail: `${item.count!.toLocaleString('en-CA')} places in ResourceHub. ${item.detail}`, href: `${HUB_URL}${item.path}` })
  }
  if (links.length < 3) links.push({ label: 'Questions and answers in Tidbits', detail: 'Advice from people with similar experiences (free account).', href: `${appUrl.replace(/\/$/, '')}/start` })
  return links.slice(0, 3)
}

/** The Start here list, as links anyone can open. */
export async function listLinks(role: string | null, need: string): Promise<NewsletterLink[]> {
  const { items } = await starterItems(role, need)
  return items.map((i) => ({
    label: i.label,
    detail: `${typeof i.count === 'number' ? `${i.count.toLocaleString('en-CA')} places. ` : ''}${i.detail}${i.needsAccount ? ' (free account)' : ''}`,
    href: `${HUB_URL}${i.path}`,
  }))
}
