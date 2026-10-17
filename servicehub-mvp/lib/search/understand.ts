/**
 * What someone means by a search typed the way they would say it (the team's
 * planning note, October 2026: "Everything in 3 clicks MAXIMUM - especially
 * with AI searchbar"; click 1 is "What I Want → Enter → list of matching
 * services").
 *
 * "A quiet pool for my autistic son near Kitchener" used to be six words that
 * all had to appear in a listing, so it found nothing, then anything with
 * "son" in it. Read instead as:
 *
 *   the kind of place  swimming (swim, pool or aquatic in the listing)
 *   where              Kitchener, nearest first
 *   who for            a child          (shown; a filter only if chosen)
 *   norms              autism           (shown; a filter only if chosen)
 *   other words        quiet            (puts matching listings first)
 *
 * First by the words themselves (this file, always), then, when the search is
 * a sentence and the person pressed Enter, by OpenAI with the same lists to
 * choose from (lib/llm.ts), so it cannot invent a kind of place, a norm or a
 * town. Nothing typed is kept.
 */

import { completeJSON, isLLMEnabled, userText, USER_TEXT_RULE } from '@/lib/llm'
import { cleanTerm } from './words'
import placesData from './places.json'

export interface Intent {
  id: string
  label: string
  /** Any of these in a listing's name, description or category. */
  terms: string[]
}

export interface UnderstoodPlace {
  name: string
  province: string
  lat: number
  lng: number
}

export interface Understood {
  text: string
  intents: Intent[]
  /** Other words: they put matching listings first; required only when no kind of place was found. */
  words: string[]
  place: UnderstoodPlace | null
  norms: { id: string; label: string }[]
  ages: { id: string; label: string; ranges: string[] }[]
  /** 'words': read from the words; 'ai': read with AI from what was typed. */
  by: 'words' | 'ai'
}

// The kinds of place, with the words people use for them (triggers) and the
// words listings use (terms). Categories in ResourceHub, and the Ontario
// import's (scripts/import-ontario-services.mjs).
export const INTENTS: (Intent & { triggers: string[] })[] = [
  { id: 'swimming', label: 'Swimming', triggers: ['swim', 'swimming', 'swims', 'pool', 'pools', 'aquatic', 'aquatics', 'swim lessons'], terms: ['swim', 'pool', 'aquatic'] },
  { id: 'riding', label: 'Horseback riding and animal programs', triggers: ['horse', 'horses', 'horseback', 'riding', 'equestrian', 'equine', 'hippotherapy', 'animal therapy', 'pet therapy', 'animal assisted', 'farm animals'], terms: ['horse', 'equestrian', 'riding', 'equine', 'animal therapy', 'animal-assisted'] },
  { id: 'diagnosis', label: 'Diagnosis and assessment', triggers: ['diagnosis', 'diagnose', 'diagnosed', 'diagnostic', 'assessment', 'assessments', 'assess', 'evaluation', 'evaluate', 'testing for', 'screening'], terms: ['diagnos', 'assessment', 'psycholog', 'developmental'] },
  { id: 'therapy', label: 'Therapists and counselling', triggers: ['therapist', 'therapists', 'therapy', 'counsellor', 'counselor', 'counselling', 'counseling', 'psychotherapist', 'psychotherapy', 'psychologist', 'aba', 'occupational therapy', 'speech therapy', 'speech therapist', 'occupational therapist', 'ot', 'slp'], terms: ['therap', 'counsel', 'psycholog'] },
  { id: 'doctor', label: 'Doctors and clinics', triggers: ['doctor', 'doctors', 'physician', 'gp', 'family doctor', 'clinic', 'clinics', 'paediatrician', 'pediatrician', 'psychiatrist', 'nurse practitioner', 'walk-in', 'walk in', 'medical'], terms: ['doctor', 'clinic', 'medical', 'physician', 'health centre', 'health center', 'hospital'] },
  { id: 'jobs', label: 'Jobs and job training', triggers: ['job', 'jobs', 'work', 'employment', 'employer', 'employers', 'career', 'careers', 'hiring', 'hire', 'job training', 'internship', 'apprenticeship', 'resume', 'résumé'], terms: ['employ', 'job', 'career', 'workforce'] },
  { id: 'study', label: 'Study spots', triggers: ['study', 'studying', 'study spot', 'study spots', 'quiet place to work', 'place to study', 'work from'], terms: ['library', 'caf', 'coffee'] },
  { id: 'library', label: 'Libraries', triggers: ['library', 'libraries'], terms: ['library'] },
  { id: 'cafe', label: 'Cafés', triggers: ['cafe', 'café', 'cafes', 'cafés', 'coffee', 'coffee shop', 'coffee shops', 'tea'], terms: ['caf', 'coffee'] },
  { id: 'restaurant', label: 'Restaurants', triggers: ['restaurant', 'restaurants', 'eat', 'eating out', 'dinner', 'lunch', 'brunch', 'breakfast', 'diner'], terms: ['restaurant', 'diner', 'bistro', 'grill', 'eatery'] },
  { id: 'hotel', label: 'Hotels', triggers: ['hotel', 'hotels', 'motel', 'motels', 'stay', 'stay overnight', 'accommodation', 'lodging', 'inn'], terms: ['hotel', 'motel', 'inn', 'lodge'] },
  { id: 'bank', label: 'Banks', triggers: ['bank', 'banks', 'banking', 'atm', 'credit union'], terms: ['bank', 'credit union'] },
  { id: 'zoo', label: 'Zoos and aquariums', triggers: ['zoo', 'zoos', 'aquarium', 'aquariums', 'petting zoo', 'wildlife'], terms: ['zoo', 'aquarium', 'wildlife', 'safari'] },
  { id: 'amusement', label: 'Amusement parks', triggers: ['amusement park', 'amusement parks', 'theme park', 'theme parks', 'water park', 'waterpark', 'rides', 'fun park', 'fair'], terms: ['amusement', 'theme park', 'water park', 'waterpark', 'fun park'] },
  { id: 'museum', label: 'Museums', triggers: ['museum', 'museums', 'gallery', 'galleries', 'science centre', 'science center'], terms: ['museum', 'gallery', 'science centre', 'science center'] },
  { id: 'park', label: 'Parks and playgrounds', triggers: ['park', 'parks', 'playground', 'playgrounds', 'trail', 'trails', 'outdoors'], terms: ['park', 'playground', 'trail'] },
  { id: 'school', label: 'Schools', triggers: ['school', 'schools', 'tutor', 'tutoring', 'tutors'], terms: ['school', 'tutor', 'academy'] },
  { id: 'campus', label: 'Colleges and universities', triggers: ['college', 'colleges', 'university', 'universities', 'campus', 'campuses'], terms: ['college', 'universit', 'campus'] },
  { id: 'support', label: 'Support groups', triggers: ['support group', 'support groups', 'peer support', 'parent group', 'parents group', 'meetup', 'social group', 'social skills'], terms: ['support', 'peer', 'social skills'] },
  { id: 'recreation', label: 'Recreation and sports', triggers: ['recreation', 'sports', 'sport', 'gym', 'gyms', 'community centre', 'community center', 'activities', 'camp', 'camps', 'martial arts', 'dance', 'climbing'], terms: ['recreation', 'sport', 'community cent', 'arena', 'gym', 'camp'] },
  { id: 'child_care', label: 'Child care', triggers: ['daycare', 'day care', 'child care', 'childcare', 'preschool', 'nursery'], terms: ['child care', 'childcare', 'daycare', 'day care', 'preschool', 'nursery'] },
  { id: 'housing', label: 'Housing and shelter', triggers: ['housing', 'shelter', 'group home', 'supported housing', 'respite'], terms: ['housing', 'shelter', 'residential', 'respite'] },
  { id: 'food', label: 'Food support', triggers: ['food bank', 'food banks', 'meal', 'meals', 'groceries', 'food support'], terms: ['food bank', 'food support', 'meal'] },
]

// Norms, as the conditions filter names them (lib/search/conditions.ts).
// stem: what a listing would say, for searching its text ("autis" finds
// autism and autistic).
const NORMS: { id: string; label: string; stem: string; triggers: string[] }[] = [
  { id: 'autism', label: 'Autism', stem: 'autis', triggers: ['autism', 'autistic', 'asd', 'asperger', 'aspergers', "asperger's", 'on the spectrum', 'spectrum'] },
  { id: 'adhd', label: 'ADHD', stem: 'adhd', triggers: ['adhd', 'add', 'attention deficit'] },
  { id: 'audhd', label: 'AuDHD (Autism + ADHD)', stem: 'audhd', triggers: ['audhd'] },
  { id: 'ocd', label: 'OCD', stem: 'ocd', triggers: ['ocd', 'obsessive compulsive'] },
  { id: 'anxiety', label: 'Anxiety', stem: 'anxi', triggers: ['anxiety', 'anxious', 'panic'] },
  { id: 'dyslexia', label: 'Dyslexia', stem: 'dyslex', triggers: ['dyslexia', 'dyslexic'] },
  { id: 'tourette', label: 'Tourette', stem: 'tourette', triggers: ['tourette', 'tourettes', "tourette's", 'tics'] },
  { id: 'specific_learning_disabilities', label: 'Specific Learning Disabilities', stem: 'learning disab', triggers: ['learning disability', 'learning disabilities', 'learning disorder'] },
]

// Who it is for, as age bands (lib/filters/taxonomy.ts).
const AGES: { id: string; label: string; stem: string; ranges: string[]; triggers: string[] }[] = [
  { id: 'baby', label: 'A baby or toddler', stem: 'toddler', ranges: ['babies_0_4'], triggers: ['baby', 'babies', 'toddler', 'toddlers', 'infant', 'infants', 'preschooler'] },
  { id: 'child', label: 'A child', stem: 'child', ranges: ['children_5_8', 'preteens_9_12'], triggers: ['child', 'children', 'kid', 'kids', 'son', 'daughter', 'boy', 'girl', 'grandchild', 'grandson', 'granddaughter'] },
  { id: 'teen', label: 'A teenager', stem: 'teen', ranges: ['teens_13_17'], triggers: ['teen', 'teens', 'teenager', 'teenagers', 'adolescent', 'adolescents', 'youth', 'high school'] },
  { id: 'young_adult', label: 'A young adult', stem: 'young adult', ranges: ['young_adults_18_30'], triggers: ['young adult', 'young adults', 'student', 'students', 'university student', 'college student'] },
  { id: 'adult', label: 'An adult', stem: 'adult', ranges: ['young_adults_18_30', 'adults_30_45', 'adults_45_65'], triggers: ['adult', 'adults', 'grown up', 'myself'] },
  { id: 'senior', label: 'An older adult', stem: 'senior', ranges: ['seniors_65_plus'], triggers: ['senior', 'seniors', 'elderly', 'older adult', 'older adults', 'retired', 'grandparent'] },
]

// Words that say how someone is asking, not what for.
const FILLER = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'with', 'near', 'nearby', 'around', 'close', 'closest', 'nearest',
  'me', 'my', 'i', 'im', "i'm", 'we', 'our', 'us', 'is', 'are', 'be', 'that', 'which', 'who', 'can', 'could', 'would', 'will', 'please',
  'find', 'finding', 'looking', 'look', 'search', 'searching', 'need', 'needs', 'want', 'wants', 'get', 'some', 'any', 'good', 'best', 'great',
  'place', 'places', 'somewhere', 'something', 'someone', 'service', 'services', 'help', 'helps', 'there', 'here', 'this', 'it', 'they', 'them',
  'has', 'have', 'who', 'what', 'where', 'how', 'do', 'does', 'from', 'about', 'like', 'into', 'than', 'very', 'really', 'also', 'just', 'one', 'ones',
])
// Not filler, though they look it: names use them ("Autism Ontario",
// "Autism Canada"), so they stay words to search for.

// "St. Catharines", "Saint Catharines" and "st catharines" alike.
function placeKey(s: string): string {
  return cleanTerm(s)
    .replace(/\bsainte\b/g, 'ste')
    .replace(/\bsaint\b/g, 'st')
    .replace(/\s+/g, ' ')
    .trim()
}

// [name, province, lat, lng, population, 'town' | 'area'] (scripts/places/build-gazetteer.mjs)
type PlaceRow = [string, string, number, number, number, string]
const PLACES: (UnderstoodPlace & { key: string; pop: number; town: boolean })[] = (
  (placesData as unknown as { places: PlaceRow[] }).places || []
).map(([name, province, lat, lng, pop, kind]) => ({ name, province, lat, lng, pop, town: kind === 'town', key: placeKey(name) }))
const PLACE_WORDS = 4
const CUES = ['near', 'in', 'around', 'by', 'close', 'at', 'from', 'outside', 'of']

/** A place named in the text: the longest name, after "near", "in" or "around", or a city on its own. */
function findPlace(text: string): { place: UnderstoodPlace; phrase: string } | null {
  const words = placeKey(text).split(' ').filter(Boolean)
  let best: { place: (typeof PLACES)[number]; start: number; len: number; cue: boolean } | null = null
  for (let start = 0; start < words.length; start++) {
    for (let len = Math.min(PLACE_WORDS, words.length - start); len >= 1; len--) {
      const phrase = words.slice(start, start + len).join(' ')
      // Several places share a name (Kingston, Richmond): Ontario first, then the biggest.
      const matches = PLACES.filter((p) => p.key === phrase)
      if (matches.length === 0) continue
      const place = matches.find((p) => p.province === 'ON') || matches[0]
      // "near Kitchener", "in the Annex".
      const before = words[start - 1] === 'the' ? words[start - 2] : words[start - 1]
      const cue = CUES.includes(before || '')
      // On its own (no "near" before it), only a city or town, so a word
      // that is also a village's or a district's name stays a word.
      if (!cue && !place.town) continue
      if (!best || len > best.len || (len === best.len && cue && !best.cue)) best = { place, start, len, cue }
      break
    }
  }
  if (!best) return null
  const { name, province, lat, lng } = best.place
  return { place: { name, province, lat, lng }, phrase: words.slice(best.start, best.start + best.len).join(' ') }
}

const has = (text: string, phrase: string) => new RegExp(`(^| )${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(text)

/** Read from the words alone. */
export function understandByWords(raw: string): Understood {
  const text = raw.trim().slice(0, 300)
  // The place first, in the words it was found in ("niagara-on-the-lake"),
  // then hyphens become spaces for the rest.
  const found = findPlace(text)
  let rest = ` ${placeKey(text)} `
  if (found) rest = rest.replace(` ${found.phrase} `, ' ')
  rest = rest.replace(/[-_]/g, ' ')

  const take = <T extends { triggers: string[] }>(list: T[]): T[] => {
    const out: T[] = []
    for (const item of list) {
      // Longer phrases first, so "speech therapist" is taken before "therapist".
      const hit = [...item.triggers].sort((a, b) => b.length - a.length).find((t) => has(rest.trim(), cleanTerm(t)))
      if (!hit) continue
      out.push(item)
      for (const t of item.triggers) rest = rest.replace(new RegExp(` ${cleanTerm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `, 'g'), ' ')
    }
    return out
  }
  const norms = take(NORMS)
  const intents = take(INTENTS)
  const ages = take(AGES)

  const words = rest
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !FILLER.has(w))

  return {
    text,
    intents: intents.map(({ id, label, terms }) => ({ id, label, terms })),
    words: Array.from(new Set(words)).slice(0, 8),
    place: found?.place || null,
    norms: norms.map(({ id, label }) => ({ id, label })),
    ages: ages.map(({ id, label, ranges }) => ({ id, label, ranges })),
    by: 'words',
  }
}

/** Worth asking AI: a sentence, not a name or one or two words. */
export function isSentence(text: string): boolean {
  return cleanTerm(text).split(' ').filter(Boolean).length >= 4
}

// The same search asked twice in ten minutes is read once.
const aiCache = new Map<string, { at: number; value: Understood }>()
const AI_TTL = 10 * 60_000

/**
 * Read with AI, choosing only from the lists above. Falls back to the words
 * when AI is off, slow (over 4 seconds) or answers with nothing usable.
 */
export async function understandWithAI(raw: string): Promise<Understood> {
  const byWords = understandByWords(raw)
  if (!isLLMEnabled() || process.env.AI_SEARCH === 'off' || !isSentence(raw)) return byWords
  const key = cleanTerm(raw)
  const hit = aiCache.get(key)
  if (hit && Date.now() - hit.at < AI_TTL) return hit.value

  const system =
    'You read one search someone typed into a directory of services and places in Canada, mostly Ontario, used by ' +
    'neurodivergent people and their families. Choose only from the lists given. ' + USER_TEXT_RULE
  const prompt = [
    `Search: ${userText(raw, 300)}`,
    `Kinds of place (ids): ${INTENTS.map((i) => `${i.id} (${i.label})`).join('; ')}`,
    `Norms (ids): ${NORMS.map((n) => `${n.id} (${n.label})`).join('; ')}`,
    `Who it is for (ids): ${AGES.map((a) => `${a.id} (${a.label})`).join('; ')}`,
    'Return JSON: {"kinds": [ids, at most 2, only ones the search asks for], "place": "the town or city named, or null", ' +
      '"norms": [ids], "for": [ids], "other_words": [at most 4 single words that matter and are none of the above, e.g. quiet]}',
  ].join('\n')

  const answer = await Promise.race([
    completeJSON<{ kinds?: unknown; place?: unknown; norms?: unknown; for?: unknown; other_words?: unknown }>(system, prompt, { temperature: 0, maxTokens: 200 }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ])
  if (!answer) return byWords

  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const intents = ids(answer.kinds).map((id) => INTENTS.find((i) => i.id === id)).filter(Boolean).slice(0, 2) as typeof INTENTS
  const norms = ids(answer.norms).map((id) => NORMS.find((n) => n.id === id)).filter(Boolean) as typeof NORMS
  const ages = ids(answer.for).map((id) => AGES.find((a) => a.id === id)).filter(Boolean) as typeof AGES
  const placeName = typeof answer.place === 'string' ? answer.place.split(',')[0] : ''
  const place = (placeName && findPlace(`near ${placeName}`)?.place) || byWords.place
  // Not a word it already used for a kind, a norm or who it is for ("pool", "son").
  const used = new Set([...INTENTS, ...NORMS, ...AGES].flatMap((x) => x.triggers.flatMap((t) => cleanTerm(t).split(' '))))
  const words = ids(answer.other_words).map(cleanTerm).filter((w) => w && !FILLER.has(w) && !used.has(w)).slice(0, 4)

  // Nothing it chose: keep the reading from the words.
  if (intents.length === 0 && !place && norms.length === 0) return byWords

  const value: Understood = {
    text: byWords.text,
    intents: intents.length ? intents.map(({ id, label, terms }) => ({ id, label, terms })) : byWords.intents,
    words: words.length ? words : byWords.words,
    place,
    norms: norms.length ? norms.map(({ id, label }) => ({ id, label })) : byWords.norms,
    ages: ages.length ? ages.map(({ id, label, ranges }) => ({ id, label, ranges })) : byWords.ages,
    by: 'ai',
  }
  aiCache.set(key, { at: Date.now(), value })
  if (aiCache.size > 500) aiCache.delete(aiCache.keys().next().value as string)
  return value
}

/** Leave out the parts someone took away ("place", "intent:swimming", "word:quiet"). */
export function withoutParts(u: Understood, drop: string[]): Understood {
  const d = new Set(drop)
  return {
    ...u,
    place: d.has('place') ? null : u.place,
    intents: u.intents.filter((i) => !d.has(`intent:${i.id}`)),
    words: u.words.filter((w) => !d.has(`word:${w}`)),
    norms: u.norms.filter((n) => !d.has(`norm:${n.id}`)),
    ages: u.ages.filter((a) => !d.has(`age:${a.id}`)),
  }
}

/**
 * The search an understanding asks for. With a kind of place: each kind
 * required (any of its words), and the other words and the norms only put
 * matching listings first. Without one, the words are the search, as before,
 * with each norm's stem (searching "autism" still finds what mentions autism,
 * and "autistic" now finds it too), or who it is for when nothing else is
 * left; the place still sets where "near" is.
 */
export function searchFor(u: Understood): { groups: string[][]; softWords: string[]; query: string } {
  const normStems = u.norms.map((n) => NORMS.find((x) => x.id === n.id)?.stem || n.id)
  if (u.intents.length > 0) {
    return { groups: u.intents.map((i) => i.terms), softWords: [...u.words, ...normStems], query: '' }
  }
  const ageStems = u.words.length || normStems.length ? [] : u.ages.map((a) => AGES.find((x) => x.id === a.id)?.stem || a.id)
  return { groups: [], softWords: [], query: [...u.words, ...normStems, ...ageStems].join(' ') }
}
