/**
 * "Start here": who you are here for, what you need today, and a first
 * pathway of real starter resources, before any account.
 *
 * Riipen Labs, Group 3 asked for a starter page by role. Group 4 asked for a
 * guided, role- and goal-based "Start Here" that ends in a first pathway:
 * "Show 3-5 resources, one plain-language explanation, and one recommended
 * next action", with a "not sure" choice "to avoid blocking progress", few
 * role choices, neurodivergent-friendly wording, and recommendations that do
 * not "imply clinical advice".
 *
 * Every pathway item is something ResourceHub really has, checked against its
 * data in October 2026: searches anyone can open (shown with how many places
 * they find), shop items (opened with a free account) and Tidbits. Its
 * "Support Group" category used to be 712 care homes, shelters and food banks
 * from OpenStreetMap; since 5 October 2026 those have their own categories
 * (backend/scripts/resort_support_groups.py) and it holds real support
 * organisations, including autism and ADHD ones added that day
 * (backend/scripts/add_support_organisations.py). The "Employment" category
 * is left out: the work search below finds its places and more.
 *
 * Used by the home page and /start (app/components/StartHere.tsx), the
 * starter API (app/api/starter-resources), setup (which starts with the same
 * answers) and the funnel events (app/api/events).
 */

export interface StartRole {
  id: string
  label: string
  /** Completes "Starter resources for ...". */
  forWhom: string
  /** What a free account adds, for this person. */
  account: string
}

const PLAN_YOURS = 'With a free account you can save this path, and turn one goal into small, clear steps planned around your energy.'
const PLAN_HELPING = 'With a free account you can save this path, and plan a goal you are helping with in small, clear steps.'

export const START_ROLES: StartRole[] = [
  { id: 'self', label: 'Myself', forWhom: 'you', account: PLAN_YOURS },
  {
    id: 'child',
    label: 'My child',
    forWhom: 'parents',
    account: 'With a free account you can save this path, and plan a goal you are working on together in small, clear steps. If your child is under 18, you can add them from the Family page.',
  },
  { id: 'family', label: 'Another family member or a friend', forWhom: 'family and friends', account: PLAN_HELPING },
  { id: 'work', label: 'Someone I teach, support or work with', forWhom: 'teachers, employers and support workers', account: PLAN_HELPING },
  { id: 'ally', label: "I'm an ally, or just learning", forWhom: 'allies', account: 'With a free account you can save this path, ask questions in Tidbits, and start a plan of your own.' },
  { id: 'unsure', label: 'Not sure yet', forWhom: 'you', account: PLAN_YOURS },
]

export interface StartGoal {
  id: string
  label: string
  hint: string
  /** Completes "Starter resources for parents: ..."; none for "Not sure yet". */
  topic: string | null
  /** The matching answer to setup's "What are you looking for today?". */
  lookingFor: string | null
}

export const START_GOALS: StartGoal[] = [
  { id: 'learn', label: 'Starter information', hint: 'Where to begin, in plain words', topic: 'starter information', lookingFor: 'learning' },
  { id: 'services', label: 'Services', hint: 'Therapists, doctors and other places that can help', topic: 'services', lookingFor: 'services' },
  { id: 'community', label: 'People with similar experiences', hint: 'Questions, groups and activities', topic: 'people with similar experiences', lookingFor: 'community' },
  { id: 'school_work', label: 'School or work support', hint: 'Jobs, careers, school and activities', topic: 'school and work', lookingFor: 'services' },
  { id: 'sensory', label: 'Sensory tools', hint: 'For noise, light and touch', topic: 'sensory tools', lookingFor: 'tools' },
  { id: 'unsure', label: 'Not sure yet', hint: 'A few good places to start', topic: null, lookingFor: null },
]

/** One line of a pathway. `id` names it in the funnel events (start_open). */
export type PathwayItem =
  /** A ResourceHub search anyone can open; shown with how many places it finds. */
  | { id: string; kind: 'search'; label: string; detail: string; params: Record<string, string> }
  /** Shop items in these categories whose names contain `names`, in that
   *  order (any item when `names` is empty). They open with a free account. */
  | { id: string; kind: 'shop'; categories: string[]; names: string[]; limit: number; detail: string }
  /** Tidbits, ResourceHub's questions and answers (a free account). */
  | { id: string; kind: 'tidbits'; label: string; detail: string }

export interface Pathway {
  /** The one plain-language explanation. */
  explanation: string
  items: PathwayItem[]
  /** The secondary link: everything of this kind in ResourceHub. */
  more: { label: string; params: Record<string, string> }
}

// The id stays 'autism' so the funnel's counts carry on (start_open).
const AUTISM: PathwayItem = {
  id: 'autism', kind: 'search', label: 'Autism, ADHD and support organisations',
  detail: 'Organisations for autistic people, people with ADHD and their families, and other support groups.',
  params: { categories: 'Support Group' },
}
const THERAPISTS: PathwayItem = {
  id: 'therapists', kind: 'search', label: 'Therapists and counsellors',
  detail: 'Psychologists, counsellors and other therapists.', params: { categories: 'Therapist' },
}
const DOCTORS: PathwayItem = {
  id: 'doctors', kind: 'search', label: 'Doctors and health centres',
  detail: 'Clinics, family doctors and community health centres.', params: { categories: 'Doctor' },
}
const CENTRES: PathwayItem = {
  id: 'centres', kind: 'search', label: 'Community centres and libraries',
  detail: 'Places with programs, clubs and events.', params: { categories: 'Community Center' },
}
const ACTIVITIES: PathwayItem = {
  id: 'activities', kind: 'search', label: 'Sports and activities',
  detail: 'Dance, swimming, sports and other activities.', params: { categories: 'Recreation' },
}
const WORK: PathwayItem = {
  id: 'work', kind: 'search', label: 'Help with work',
  detail: 'Career centres, job programs and employment services.', params: { lifeAreas: 'workplace' },
}
const AFTER_SCHOOL: PathwayItem = {
  id: 'afterschool', kind: 'search', label: 'After-school activities',
  detail: 'Sports, dance, swimming and other activities for after school.', params: { lifeAreas: 'afterschool' },
}
const SCHOOLS: PathwayItem = {
  id: 'schools', kind: 'search', label: 'Schools and daycares',
  detail: 'Schools and daycares listed in ResourceHub.', params: { categories: 'School' },
}
// Tidbits is new (a handful of questions so far), so it is offered as a
// place to ask, not as a library of answers.
const TIDBITS: PathwayItem = {
  id: 'tidbits', kind: 'tidbits', label: 'Ask a question in Tidbits',
  detail: 'Autinerary’s questions and answers. It is new, so yours may be one of the first questions.',
}
const TIDBITS_SCHOOL_WORK: PathwayItem = {
  id: 'tidbits', kind: 'tidbits', label: 'Ask how others handled school or work',
  detail: 'In Tidbits, Autinerary’s questions and answers. It is new, so yours may be one of the first questions.',
}
const books = (limit: number): PathwayItem => ({
  id: 'book', kind: 'shop', categories: ['books'], names: ['unmasking', 'autistic'], limit, detail: 'A book, in the ResourceHub shop.',
})
const sensory = (names: string[]): PathwayItem => ({
  id: 'sensory', kind: 'shop', categories: ['self-care', 'toys', 'supplies', 'clothing'], names, limit: 5, detail: 'In the ResourceHub shop.',
})

const PATHWAYS: Record<string, Pathway> = {
  learn: {
    explanation: 'You do not have to learn everything at once. Start with one thing below. Organisations like these explain the basics and know what help is available; a book or a question in Tidbits can help with the rest.',
    items: [AUTISM, books(2), TIDBITS],
    more: { label: 'Explore ResourceHub', params: {} },
  },
  services: {
    explanation: 'Pick one kind of service to start with. You can open any place to see what it offers and how to contact it.',
    items: [AUTISM, THERAPISTS, DOCTORS, CENTRES],
    more: { label: 'Explore services', params: {} },
  },
  community: {
    explanation: 'Talking with people who have been through the same things can help. Ask a question, or find a group or an activity to try.',
    items: [TIDBITS, AUTISM, CENTRES, ACTIVITIES],
    more: { label: 'Explore groups and activities', params: { categories: 'Community Center,Recreation' } },
  },
  school_work: {
    explanation: 'Start with the part that matters most right now. These places help with jobs and careers, and people in Tidbits can share what worked for them.',
    items: [WORK, AUTISM, TIDBITS_SCHOOL_WORK],
    more: { label: 'Explore school and work support', params: { lifeAreas: 'workplace,afterschool' } },
  },
  sensory: {
    explanation: 'Small changes can make noise, light and touch easier. These are tools other people found helpful. Try one at a time and keep what works for you.',
    items: [sensory(['earplug', 'noise', 'weighted', 'blackout', 'fidget'])],
    more: { label: 'Explore sensory tools', params: { categories: 'self-care,toys,supplies,clothing' } },
  },
  unsure: {
    explanation: 'That is fine. Here are a few good places to start. You can change your answers any time.',
    items: [AUTISM, THERAPISTS, TIDBITS, books(1)],
    more: { label: 'Explore ResourceHub', params: {} },
  },
}

// Where who it is for changes what comes first (Group 4: "resource tagging or
// mapping by role/goal").
const FOR_ROLE: Record<string, Partial<Record<string, Partial<Pathway>>>> = {
  child: {
    school_work: {
      explanation: 'Start with the part that matters most right now. Autism and ADHD organisations can often point you to support at school, and after-school activities are a gentle way to try new things.',
      items: [AUTISM, AFTER_SCHOOL, SCHOOLS, TIDBITS_SCHOOL_WORK],
    },
    sensory: { items: [sensory(['noise', 'fidget', 'weighted', 'timer', 'chew'])] },
  },
}

export function pathwayFor(role: string, goal: string): Pathway {
  return { ...PATHWAYS[goal], ...(FOR_ROLE[role]?.[goal] || {}) }
}

export function pathwayTitle(role: string, goal: string): string {
  const forWhom = START_ROLES.find((r) => r.id === role)?.forWhom || 'you'
  const topic = START_GOALS.find((g) => g.id === goal)?.topic
  return `Starter resources for ${forWhom}${topic ? `: ${topic}` : ''}`
}

/** A ResourceHub search path, e.g. /search?categories=Therapist. */
export function searchPath(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return qs ? `/search?${qs}` : '/search'
}

// Setup's answers, read as Start here answers, so everyone gets starter
// resources straight after setup (Riipen Labs, Group 5: "a personalized
// 'Start Here' resource on Screen 3 before asking for detailed info").
const ROLE_FOR_AUDIENCE: Record<string, string> = {
  self: 'self', child: 'child', family: 'family', friend: 'family', work: 'work', ally: 'ally', unsure: 'unsure',
}
// "What are you looking for today?" first, then the goal's category.
const NEED_FOR_LOOKING_FOR: Record<string, string> = { services: 'services', community: 'community', learning: 'learn' }
const NEED_FOR_GOAL_CATEGORY: Record<string, string> = {
  education: 'school_work', career: 'school_work', health: 'services', relationships: 'community', barrier: 'learn',
}

export function suggestedStart(audience: string, lookingFor: string[], goalCategory?: string): { for: string; need: string } {
  const need = lookingFor.map((k) => NEED_FOR_LOOKING_FOR[k]).find(Boolean) || NEED_FOR_GOAL_CATEGORY[goalCategory || ''] || 'unsure'
  return { for: ROLE_FOR_AUDIENCE[audience] || 'unsure', need }
}

export const START_FOR_KEY = 'autinerary_start_for'
export const START_NEED_KEY = 'autinerary_start_need'

export const isStartRole = (id: unknown): id is string => START_ROLES.some((r) => r.id === id)
export const isStartGoal = (id: unknown): id is string => START_GOALS.some((g) => g.id === id)

/** Item ids used in pathways, for validating start_open events. */
export const PATHWAY_ITEM_IDS = Array.from(new Set(
  [...Object.values(PATHWAYS), ...Object.values(FOR_ROLE).flatMap((p) => Object.values(p || {}))]
    .flatMap((p) => p?.items || [])
    .map((i) => i.id),
))
