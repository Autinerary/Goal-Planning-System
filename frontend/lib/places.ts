/**
 * The places on the Path's Quick Links, in the order that suits who the
 * person is planning for (setup's "Who are you here for?").
 *
 * Riipen Labs, Group 32: role-based progressive disclosure, "an initial
 * role-selection prompt (parent, sibling, caregiver, healthcare professional,
 * or neurodivergent user) to filter options and present tailored content
 * pathways". Setup already asks; until now only one card on the Path used
 * the answer. The places are the same for everyone (nothing is hidden), but
 * a parent sees services for their child and Family first, a teacher or
 * support worker services to share and questions to answer, an ally Tidbits
 * and the glossary. The simple view shows the first four.
 *
 * Plain data, no imports: the Path wraps `hub` places in the ResourceHub
 * hand-off. Run the test from frontend/:
 *   node --experimental-strip-types lib/places.test.mjs
 */

export interface Place {
  key: PlaceKey
  href: string
  /** A ResourceHub path, opened through the session hand-off. */
  hub?: boolean
  name: string
  /** One line saying what it is, for this person. */
  what: string
  /** For Help (data-info). */
  info: string
}

export type PlaceKey = 'races' | 'pitstop' | 'hareworld' | 'journal' | 'tidbits' | 'resourcehub' | 'pathmarket' | 'starter' | 'family' | 'help' | 'kits'

const BASE: Record<PlaceKey, Omit<Place, 'key'>> = {
  races: { href: '/races', name: 'Races', what: 'Your goals, step by step', info: 'Races: each goal is a race, made of small steps called milestones.' },
  pitstop: { href: '/pit-stop', name: 'Pit Stop', what: 'Tools for your steps', info: 'Pit Stop: tools and supports for the steps in your plan.' },
  hareworld: { href: '/hare-world', name: 'Hare World', what: 'Friends, mentors, role models', info: 'Hare World: the people side of Autinerary. Connect with friends, mentors and role models.' },
  journal: { href: '/reflection?contextType=path', name: 'Journal', what: 'Write how it is going', info: 'Journal: write how things went, and look back on what is working.' },
  tidbits: { href: '/community?from=hare-world&context=path', hub: true, name: 'Tidbits', what: 'Questions and answers', info: 'Tidbits: questions and answers from people with similar experiences, in ResourceHub.' },
  resourcehub: { href: '/search', hub: true, name: 'ResourceHub', what: 'Services near you', info: 'ResourceHub: services and places, rated by people with similar norms. It shares your account.' },
  pathmarket: { href: '/path-market', name: 'Path Market', what: 'Plans other people followed', info: 'Path Market: plans other people made for goals like yours, to follow or borrow from.' },
  starter: { href: '/start', name: 'Starter resources', what: 'Places to start', info: 'Starter resources: a few places to start, for what you need today.' },
  family: { href: '/family', name: 'Family', what: 'Add and support your child', info: 'Family: add a child under 18 and support their account.' },
  help: { href: '/help', name: 'What things are called', what: 'The app’s words, explained', info: 'What things are called: every name in Autinerary, in plain words.' },
  // Riipen Labs, Group 24: "Surface 2 pre-curated 'Caregiver Starter Kits' on
  // the main dashboard" (lib/starterKits.ts).
  kits: { href: '/kits', name: 'Starter kits', what: 'Assessment and school, step by step', info: 'Starter kits: step-by-step guides for parents in Ontario, on getting an autism assessment and on support at school.' },
}

type Entry = PlaceKey | [PlaceKey, string]

// First the places that matter most to each person, then the rest. Eight
// each; "All places" under them lists everything.
const ORDER: Record<string, Entry[]> = {
  self: ['races', 'pitstop', 'hareworld', 'journal', 'tidbits', 'resourcehub', 'pathmarket', 'starter'],
  child: [['resourcehub', 'Services for your child'], 'family', 'kits', ['tidbits', 'Ask other parents'], ['starter', 'Starter resources for parents'], ['races', 'The goal you are working on together'], 'journal', 'pathmarket'],
  family: [['hareworld', 'Support them as a friend or mentor'], ['tidbits', 'Ask people who have been there'], ['resourcehub', 'Services that could help them'], ['starter', 'For family and friends'], 'kits', ['races', 'The goal you are helping with'], 'journal', 'pathmarket'],
  work: [['resourcehub', 'Services to share'], ['tidbits', 'Answer and ask questions'], ['hareworld', 'Mentor someone'], ['starter', 'For teachers, employers and support workers'], ['kits', 'Guides to share with parents'], ['races', 'The goal you are helping with'], 'pitstop', 'pathmarket'],
  ally: [['tidbits', 'Learn from people with lived experience'], 'help', ['starter', 'For allies'], 'resourcehub', 'hareworld', ['races', 'Your own plan'], 'journal', 'pathmarket'],
}
ORDER.friend = ORDER.family
ORDER.unsure = ORDER.self

/** The Quick Links for someone planning for `audience` (setup's answer). */
export function placesFor(audience: string | null | undefined, opts: { startPath?: boolean } = {}): Place[] {
  const entries = ORDER[audience || 'self'] || ORDER.self
  return entries.map((entry) => {
    const [key, what] = Array.isArray(entry) ? entry : [entry, undefined]
    const place: Place = { key, ...BASE[key] }
    if (what) place.what = what
    if (key === 'starter' && opts.startPath) place.what = 'The path you saved'
    return place
  })
}
