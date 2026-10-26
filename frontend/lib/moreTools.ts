import type { PlanTool } from './milestoneTools'

/**
 * "Recommend more" on a milestone (the team's notes on the Milestone view,
 * October 2026): the next best ResourceHub listings for it, from the same
 * pool and the same signals as the plan's own (backend/core/agents/
 * tool_recommendation_agent.py): the services checked on their own sites and
 * everything people have rated; words the milestone and the listing share;
 * the listing's real ratings; ratings from people with the same norms. Free
 * first, then the cheapest. Nothing is suggested on no evidence at all.
 */

export interface PoolRow {
  id: string
  name: string
  description: string | null
  category: string | null
  tags: string[] | null
  cost_type: string | null
  price: number | string | null
  website?: string | null
  is_first_party?: boolean | null
}

const SELF_NAME = /^\s*(autinerary|resource\s*hub|service\s*hub)\b/i

/** Autinerary's or ResourceHub's own listing: never suggested (as in the agent). */
export const isSelfListing = (row: Pick<PoolRow, 'name' | 'is_first_party'>): boolean =>
  Boolean(row.is_first_party) || SELF_NAME.test(String(row.name || ''))

/** A listing's ratings: their total and number, and how often each norm was scored. */
export interface RatingAgg {
  sum: number
  count: number
  norms: Record<string, number>
}

export interface MilestoneText {
  name: string
  description?: string | null
  goal?: string | null
}

// Words that say nothing about what a step or a listing is about.
const STOP = new Set([
  'about', 'after', 'again', 'their', 'there', 'these', 'those', 'which', 'would', 'could', 'should', 'other',
  'where', 'while', 'within', 'without', 'yours', 'every', 'things', 'thing', 'using', 'being', 'first',
  'support', 'supports', 'services', 'service', 'resource', 'resources', 'people', 'helps', 'help', 'build',
  'start', 'plan', 'plans', 'steps', 'personalised', 'personalized', 'tailored', 'milestone',
])

const stem = (w: string) => (w.length > 5 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)

/** The meaningful words of a text: longer than four letters, not filler, lightly stemmed. */
export function words(text: string | null | undefined): Set<string> {
  const out = new Set<string>()
  for (const w of String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length > 4 && !STOP.has(w)) out.add(stem(w))
  }
  return out
}

/** Norms as the words ratings store them under ("Sensory Impairment" → sensory, impairment). */
export function normWords(norms: readonly string[]): Set<string> {
  const out = new Set<string>()
  for (const n of norms) for (const w of String(n || '').toLowerCase().split(/[^a-z0-9]+/)) if (w.length > 2) out.add(w)
  return out
}

/** The agent's four groups (tool_recommendation_agent._tool_type_for). */
export function typeFor(category: string | null | undefined): string {
  const c = String(category || '').toLowerCase()
  if (c === 'app' || c === 'store') return 'product'
  if (c === 'book' || c === 'workshop') return 'commentary'
  if (['therapist', 'school', 'doctor', 'support_group', 'organization', 'park', 'recreation'].includes(c)) return 'service'
  return 'other'
}

/** Free, then by price, then paid with no price, then unknown (cost_order in the agent). */
function costRank(row: PoolRow): [number, number] {
  const price = Number(row.price)
  if (row.cost_type === 'free' || (row.price !== null && row.price !== '' && price === 0)) return [0, 0]
  if (Number.isFinite(price) && price > 0) return [1, price]
  if (row.cost_type === 'paid') return [2, 0]
  return [3, 0]
}

export function toPlanTool(row: PoolRow, hubUrl: string, agg?: RatingAgg): PlanTool {
  return {
    id: `sh_${row.id}`,
    resourceId: row.id,
    name: row.name || 'Resource',
    description: row.description || '',
    type: typeFor(row.category),
    category: row.category,
    url: row.website || `${hubUrl.replace(/\/$/, '')}/resources/${row.id}`,
    price: row.price,
    costType: row.cost_type,
    rating: agg && agg.count ? Math.round((agg.sum / agg.count) * 100) / 100 : null,
    reviews: agg ? agg.count : 0,
  }
}

/** How well one listing fits the milestone, 0 to 1; 0 when nothing links them. */
export function fit(row: PoolRow, milestone: Set<string>, norms: Set<string>, agg?: RatingAgg): number {
  const listing = words([row.name, row.description, row.category, ...(row.tags || []).map((t) => t.replace(/_/g, ' '))].join(' '))
  let shared = 0
  for (const w of milestone) if (listing.has(w)) shared++
  const overlap = milestone.size ? shared / milestone.size : 0
  const normHits = agg ? Object.keys(agg.norms).filter((k) => k.split(/[^a-z0-9]+/).some((w) => norms.has(w))).length : 0
  if (!shared && !normHits) return 0
  const rated = agg && agg.count ? (agg.sum / agg.count / 5) * Math.min(agg.count / 10, 1) : 0
  return Math.min(1, 0.6 * Math.min(overlap * 2, 1) + 0.25 * rated + 0.15 * Math.min(normHits, 1))
}

/**
 * The next `limit` listings for a milestone: the ten that fit best, free
 * first among them (as the agent orders its picks), leaving out `exclude`
 * (ResourceHub ids already shown, removed or suggested).
 */
export function rankMore(
  pool: readonly PoolRow[],
  milestone: MilestoneText,
  opts: { exclude: Set<string>; norms: readonly string[]; ratings: Map<string, RatingAgg>; limit: number; hubUrl: string },
): PlanTool[] {
  const m = words([milestone.name, milestone.description, milestone.goal].filter(Boolean).join(' '))
  const n = normWords(opts.norms)
  const scored = pool
    .filter((row) => row.id && !opts.exclude.has(row.id) && !isSelfListing(row))
    .map((row, i) => ({ row, i, score: fit(row, m, n, opts.ratings.get(row.id)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 10)
  scored.sort((a, b) => {
    const [ga, pa] = costRank(a.row)
    const [gb, pb] = costRank(b.row)
    return ga - gb || pa - pb || b.score - a.score || a.i - b.i
  })
  return scored.slice(0, Math.max(0, opts.limit)).map((x) => toPlanTool(x.row, opts.hubUrl, opts.ratings.get(x.row.id)))
}

// ── Services near the person, for one step (Send my request) ─────────────

/**
 * Services near the person for one step of their plan (the account holder's
 * choice, 26 October 2026), so Send my request has somewhere to go on every
 * plan, old or new: the same pool and scoring as "Recommend more", but
 *   - only where the person lives: their province, or national ones (no
 *     province and no city; one with only a city counts only in that city);
 *     with no province on their profile, only national ones;
 *   - only a clear match: at least two words the step and the service share
 *     (one, for a step of one or two words), so a single common word
 *     ("learn") doesn't bring in a tax clinic;
 *   - never a student-only service (a university's, a college's) unless their
 *     plan says they study;
 *   - for whom: planning for themselves (an adult), never one only for
 *     children or teens; for their child, never one only for adults;
 *   - only services the caller can reach (`reachable`: lib/requests.ts, an
 *     email or a website, never a place);
 *   - nearer first, when both have a map position or share a city.
 */
export interface LocalRow extends PoolRow {
  location?: { city?: string | null; province?: string | null } | null
  geo_lat?: number | null
  geo_lng?: number | null
  contact_info?: unknown
  status?: string | null
  source_url?: string | null
  source_type?: string | null
}

export interface PersonPlace {
  city?: string | null
  province?: string | null
  lat?: number | null
  lng?: number | null
}

const PROVINCES: Record<string, string> = {
  on: 'ON', ontario: 'ON',
  bc: 'BC', 'british columbia': 'BC',
  ab: 'AB', alberta: 'AB',
  sk: 'SK', saskatchewan: 'SK',
  mb: 'MB', manitoba: 'MB',
  qc: 'QC', quebec: 'QC', 'québec': 'QC',
  nb: 'NB', 'new brunswick': 'NB',
  ns: 'NS', 'nova scotia': 'NS',
  pe: 'PE', pei: 'PE', 'prince edward island': 'PE',
  nl: 'NL', 'newfoundland and labrador': 'NL', newfoundland: 'NL',
  yt: 'YT', yukon: 'YT',
  nt: 'NT', 'northwest territories': 'NT',
  nu: 'NU', nunavut: 'NU',
}

/** A province as its two letters ("Ontario", "ON" → "ON"); '' for none; null for something that isn't one. */
export function provinceCode(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (!s) return ''
  return PROVINCES[s] ?? null
}

/** A university's or a college's own service: for its students. */
export const studentOnly = (row: Pick<PoolRow, 'name' | 'description'>): boolean =>
  /\b(university|college|campus|c[ée]gep|polytechnic)\b/i.test(row.name || '') || /\b(for|registered|enrolled|current) students\b/i.test(row.description || '')

const CHILD_WORDS = /\b(adolescents?|teens?|teenagers?|youth|child|children|kids?|boys|girls|toddlers?|infants?|preschool(ers)?|school-age|aged? \d{1,2}\s*(to|-|–|and)\s*1[0-7]|under 1[0-8])\b/i
const ADULT_WORDS = /\b(adults?|all ages|18\+|18 and (over|older)|grown-ups?|seniors?)\b/i

/** Only for children or teens ("PEERS® for Adolescents"); one for "children and adults" isn't. */
export const youthOnly = (row: Pick<PoolRow, 'name' | 'description'>): boolean => {
  const t = `${row.name || ''} ${row.description || ''}`
  return CHILD_WORDS.test(t) && !ADULT_WORDS.test(t)
}

/** Only for adults (and not their families either). */
export const adultOnly = (row: Pick<PoolRow, 'name' | 'description'>): boolean => {
  const t = `${row.name || ''} ${row.description || ''}`
  return ADULT_WORDS.test(t) && !CHILD_WORDS.test(t) && !/\b(famil(y|ies)|parents?|caregivers?)\b/i.test(t)
}

/** Whether their plan says they study (its profile's own words). */
export const studies = (profileText: string): boolean => /\b(student|studying|college|university|campus|enrolled)\b/i.test(profileText)

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(x)))
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function localServices(
  pool: readonly LocalRow[],
  milestone: MilestoneText,
  opts: { place: PersonPlace | null; student: boolean; forWhom?: 'adult' | 'child' | null; exclude: Set<string>; norms: readonly string[]; ratings: Map<string, RatingAgg>; limit: number; reachable: (row: LocalRow) => boolean },
): LocalRow[] {
  const m = words([milestone.name, milestone.description, milestone.goal].filter(Boolean).join(' '))
  const n = normWords(opts.norms)
  const home = provinceCode(opts.place?.province) || ''
  const lat = num(opts.place?.lat)
  const lng = num(opts.place?.lng)
  const city = String(opts.place?.city || '').trim().toLowerCase()
  const scored: { row: LocalRow; score: number; i: number }[] = []
  pool.forEach((row, i) => {
    if (!row.id || opts.exclude.has(row.id) || isSelfListing(row) || !opts.reachable(row)) return
    const p = provinceCode(row.location?.province)
    const rowCity = String(row.location?.city || '').trim().toLowerCase()
    // Their province; or national (no province, no city); a city alone only if it's theirs; a province that isn't one: no.
    if (p === null || (p && p !== home) || (!p && rowCity && rowCity !== city)) return
    if (!opts.student && studentOnly(row)) return
    if ((opts.forWhom === 'adult' && youthOnly(row)) || (opts.forWhom === 'child' && adultOnly(row))) return
    const listing = words([row.name, row.description, row.category, ...(row.tags || []).map((t) => t.replace(/_/g, ' '))].join(' '))
    let shared = 0
    for (const w of m) if (listing.has(w)) shared++
    if (shared < Math.min(2, m.size)) return
    let score = fit(row, m, n, opts.ratings.get(row.id))
    if (score <= 0) return
    const rLat = num(row.geo_lat)
    const rLng = num(row.geo_lng)
    if (lat !== null && lng !== null && rLat !== null && rLng !== null) {
      const d = km({ lat, lng }, { lat: rLat, lng: rLng })
      score += d <= 40 ? 0.15 : d <= 100 ? 0.05 : 0
    } else if (p && city && String(row.location?.city || '').trim().toLowerCase() === city) {
      score += 0.15
    }
    scored.push({ row, score, i })
  })
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, Math.max(0, opts.limit)).map((x) => x.row)
}
