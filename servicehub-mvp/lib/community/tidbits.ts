/**
 * Tidbits (the Tidbits round's planning note, October 2026): short articles
 * beside the community's questions. A Tidbit is at most 500 words; a Tadbit,
 * at most 1000 ("For Tadbits, make the length 2x longer"). STEP 83 keeps the
 * same limits in the database (community_posts_before_write).
 */

export type LengthType = 'tidbit' | 'tadbit'
export type PostKind = 'question' | 'tidbit'
export type PostSource = 'internal' | 'external'

export const LENGTHS: Record<LengthType, { label: string; words: number; hint: string }> = {
  tidbit: { label: 'Tidbit', words: 500, hint: 'Up to 500 words: one idea, short and sweet.' },
  tadbit: { label: 'Tadbit', words: 1000, hint: 'Up to 1000 words, for a little more.' },
}

export const isLengthType = (v: unknown): v is LengthType => v === 'tidbit' || v === 'tadbit'

/** The team's own long pages as Tidbits (STEP 86: "taken right from our own
 *  Learning info ... each page a separate Tidbit"): up to 3000 words, and
 *  only with the Autinerary byline, which only the server sets. Not offered
 *  in the composer. */
export const GUIDE = { label: 'Guide', words: 3000 } as const

/** A post's length name and word limit, guides included. */
export function lengthOf(lengthType: string | null | undefined): { label: string; words: number } {
  if (lengthType === 'guide') return GUIDE
  return LENGTHS[lengthType === 'tadbit' ? 'tadbit' : 'tidbit']
}

/** Words as the database counts them: runs of characters between spaces. */
export function wordCount(text: string): number {
  const t = (text || '').trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * The community rules, shown once (Goal 2: "When users enter Commentaries for
 * the first time, give them a 2 page pop-up ... also when users write a Rating
 * for the first time"). Change the words, and raise the version so everyone
 * sees them again.
 */
// Words a search can skip: they say nothing about what a Tidbit is about.
const SEARCH_SKIP = new Set([
  'the', 'and', 'for', 'with', 'your', 'you', 'from', 'into', 'that', 'this', 'about', 'how', 'what', 'when', 'who',
  'set', 'get', 'got', 'make', 'find', 'build', 'start', 'try', 'take', 'use', 'plan', 'learn', 'help', 'step', 'steps',
  'up', 'out', 'new', 'one', 'own', 'more', 'some', 'can', 'are', 'was', 'have', 'has', 'will',
])

/**
 * The words a Tidbits search looks for (each must appear, in any order, in
 * the title or the text). A search used to match its whole text as one
 * phrase, so "Set up a structured study schedule" (a milestone, from the
 * Race view's "help someone" prompt) matched nothing unless a Tidbit said
 * exactly that. At most four words; one word or a short phrase as typed.
 */
export function searchWords(q: string | null | undefined): string[] {
  const words = String(q || '')
    .toLowerCase()
    .replace(/[%,()_*\\]/g, ' ')
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !SEARCH_SKIP.has(w))
  return Array.from(new Set(words)).slice(0, 4)
}

export const RULES_VERSION = 1

export const RULES_INTRO = {
  title: 'Welcome to Tidbits',
  paragraphs: [
    'Tidbits are short, useful pieces from people who have been there: what you tried, what worked, and what you would tell someone just starting out.',
    'Our philosophy is short and sweet, and solution-oriented. A Tidbit is at most 500 words; a Tadbit, at most 1000. Hard things are welcome here, with what helped.',
    'Ratings work the same way: say what it was like, so the next person can decide.',
  ],
}

export const RULES = {
  title: 'Community rules',
  items: [
    'Be kind. Disagree with ideas, never with people.',
    'No slurs. A post with a slur is not published.',
    'No swearing. Swear words are bleeped.',
    'Keep it mostly positive and practical. Writing about something hard? Add a content note.',
    'Share your own experience, not medical advice.',
    'Leave out personal details, yours or anyone else’s.',
    'See something that breaks these? Report it. Moderators, people on the Autinerary team, review every report.',
  ],
}

/** The database errors that mean STEP 83 isn't in yet (a missing column or table). */
export function step83Missing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === '42703' ||
    error.code === '42P01' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    /(kind|length_type|status|is_anonymous|group_id|byline|well_done|bite_count|community_groups|community_post_|community_rules)/.test(error.message || '')
  )
}

/** Where an outside article lives, for "See more from (platform) here". */
export function platformOf(url: string | null | undefined): { name: string; home: string } | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').replace(/^old\./, '')
    const known: Record<string, string> = {
      'reddit.com': 'Reddit', 'medium.com': 'Medium', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'substack.com': 'Substack',
      'instagram.com': 'Instagram', 'tiktok.com': 'TikTok', 'facebook.com': 'Facebook', 'x.com': 'X', 'twitter.com': 'X',
      'autism.org.uk': 'National Autistic Society', 'autismcanada.org': 'Autism Canada', 'autismontario.com': 'Autism Ontario',
      'cbc.ca': 'CBC', 'theglobeandmail.com': 'The Globe and Mail', 'thestar.com': 'Toronto Star',
    }
    const base = Object.keys(known).find((k) => host === k || host.endsWith(`.${k}`))
    return { name: base ? known[base] : host, home: `${u.protocol}//${u.hostname}/` }
  } catch {
    return null
  }
}

export interface DisplayAuthor {
  user_id: string
  pseudonym: string
  avatar_url: string | null
  karma: number
  is_public: boolean
  top_badges: unknown[]
  /** Written by the Autinerary team. */
  team?: boolean
  /** Published anonymously: no pseudonym, no profile link. */
  anonymous?: boolean
}

/**
 * Who a post shows as. The team's posts show "Autinerary"; an anonymous
 * Tidbit shows "Anonymous" to everyone but its author and moderators, and
 * never carries the author's id or profile.
 */
export function shownAuthor(
  post: { author_id: string; byline?: string | null; is_anonymous?: boolean | null },
  author: DisplayAuthor | undefined,
  viewer: { user_id: string; is_admin?: boolean } | null
): DisplayAuthor {
  if (post.byline === 'autinerary') {
    return { user_id: '', pseudonym: 'Autinerary', avatar_url: null, karma: 0, is_public: false, top_badges: [], team: true }
  }
  const mine = !!viewer && viewer.user_id === post.author_id
  if (post.is_anonymous && !mine && !viewer?.is_admin) {
    return { user_id: '', pseudonym: 'Anonymous', avatar_url: null, karma: 0, is_public: false, top_badges: [], anonymous: true }
  }
  const a = author ?? { user_id: post.author_id, pseudonym: 'former_member', avatar_url: null, karma: 0, is_public: false, top_badges: [] }
  return post.is_anonymous ? { ...a, anonymous: true } : a
}
