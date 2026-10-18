import type { SupabaseClient } from '@supabase/supabase-js'
import { isLastWeek, monthName, torontoDate } from './choiceTime'

/**
 * Community's Choice, the app's side (the team's planning note, October 2026,
 * Goal 5): the month's ballot for the newsletter's last edition and the vote
 * page, and the tally (STEP 79: choice_build_ballot(), choice_tally()).
 * Nominations happen in ResourceHub.
 */

export type ChoiceKind = 'service' | 'product' | 'article'

export const CHOICE_KINDS: { id: ChoiceKind; label: string; plural: string }[] = [
  { id: 'service', label: 'Service', plural: 'Services' },
  { id: 'product', label: 'Shop item', plural: 'Shop items' },
  { id: 'article', label: 'Article', plural: 'Articles' },
]

export const CHOICE_DISCLAIMER =
  "Community's Choice services are chosen through monthly nomination rounds, where all users can nominate a service."

export interface BallotItem {
  kind: ChoiceKind
  item_id: string
  rank: number
  nominations: number
  name: string
  /** Its page in ResourceHub. */
  url: string
}

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

/** The month's ballot, made once (the most nominated of each kind). 0 when there is nothing to vote on yet, or before STEP 79. */
export async function makeBallot(admin: SupabaseClient, month: string): Promise<number> {
  const { data, error } = await admin.rpc('choice_build_ballot', { p_month: month })
  return error ? 0 : Number(data) || 0
}

/** The month's ballot with names and links, in each kind's order. */
export async function loadBallot(db: SupabaseClient, month: string): Promise<BallotItem[]> {
  const { data, error } = await db.from('choice_ballots').select('kind, item_id, rank, nominations').eq('month', month).order('kind').order('rank')
  if (error || !data?.length) return []
  const ids = data.map((b) => b.item_id)
  const [{ data: places }, { data: products }] = await Promise.all([
    db.from('resources').select('id, name').in('id', ids),
    db.from('products').select('id, name').in('id', ids),
  ])
  const names = new Map<string, string>([...(places || []), ...(products || [])].map((x: any) => [x.id, x.name]))
  return data
    .filter((b) => names.has(b.item_id))
    .map((b) => ({
      kind: b.kind as ChoiceKind,
      item_id: b.item_id,
      rank: b.rank,
      nominations: b.nominations,
      name: names.get(b.item_id) as string,
      url: b.kind === 'product' ? `${HUB}/shop/${b.item_id}` : `${HUB}/resources/${b.item_id}`,
    }))
}

/** A month's winners with names and links (choice_winners). */
export async function loadWinners(db: SupabaseClient, month: string): Promise<BallotItem[]> {
  const { data, error } = await db.from('choice_winners').select('kind, item_id, votes, nominations').eq('month', month)
  if (error || !data?.length) return []
  const ids = data.map((w) => w.item_id)
  const [{ data: places }, { data: products }] = await Promise.all([
    db.from('resources').select('id, name').in('id', ids),
    db.from('products').select('id, name').in('id', ids),
  ])
  const names = new Map<string, string>([...(places || []), ...(products || [])].map((x: any) => [x.id, x.name]))
  return data.map((w) => ({
    kind: w.kind as ChoiceKind,
    item_id: w.item_id,
    rank: 1,
    nominations: w.nominations,
    name: names.get(w.item_id) || 'Removed',
    url: w.kind === 'product' ? `${HUB}/shop/${w.item_id}` : `${HUB}/resources/${w.item_id}`,
  }))
}

/** What the month's last newsletter needs for its vote section, or null in the other weeks (or with nothing nominated). */
export interface ChoiceRun {
  month: string
  /** "October". */
  name: string
  nominees: { kind: string; name: string }[]
}

export async function choiceForNewsletter(admin: SupabaseClient, now: Date): Promise<ChoiceRun | null> {
  const today = torontoDate(now)
  if (!isLastWeek(today)) return null
  const month = today.slice(0, 7)
  await makeBallot(admin, month)
  const ballot = await loadBallot(admin, month)
  if (!ballot.length) return null
  return {
    month,
    name: monthName(month),
    nominees: ballot.map((b) => ({ kind: (CHOICE_KINDS.find((k) => k.id === b.kind)?.label || b.kind).toLowerCase(), name: b.name })),
  }
}
