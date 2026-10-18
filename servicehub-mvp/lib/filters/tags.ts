/**
 * Tags on services (resources.tags, STEP 78), one vocabulary for the
 * sidebar, the search API, the importers and the research that adds services
 * (the team's planning note, October 2026, "Goal 1: Service Directory").
 *
 * Tags say what a service is or offers, never what it is like for someone
 * with a given norm: that comes from ratings. A tag no listing has yet still
 * shows, so it can be chosen as more services are added.
 */

export interface Tag {
  id: string
  label: string
  /** A tag shown indented under another in the same list. */
  parent?: string
  /** Shown beside the tag where it is explained. */
  note?: string
}

export interface TagGroup {
  id: string
  label: string
  tags: Tag[]
}

/** Kinds of service. */
export const SERVICE_TAGS: Tag[] = [
  { id: 'funding', label: 'Funding resources', note: 'Help applying for financial assistance, or the assistance itself.' },
  { id: 'free_first_visit', label: 'Free first visit', note: 'The first visit or meeting costs nothing.' },
  { id: 'new_to_country', label: 'New to the country' },
  { id: 'new_to_city', label: 'New to the city' },
  { id: 'large_resource_centre', label: 'Large-scale resource centre' },
  { id: 'community_choice', label: "Community's Choice", note: 'Chosen by the community: nominated through the month, voted for in the newsletter.' },
  { id: 'job_opportunities', label: 'Job opportunities' },
  { id: 'community_group', label: 'Community groups' },
  { id: 'charity', label: 'Charity' },
  { id: 'advocacy', label: 'Advocacy' },
  { id: 'provides_diagnosis', label: 'Provides medical diagnosis', note: 'Can diagnose a condition.' },
  {
    id: 'requires_diagnosis',
    label: 'Requires a diagnosis',
    note: 'For services that require a diagnosis, make sure you have one: Autinerary does not diagnose directly (yet).',
  },
  { id: 'respite_care', label: 'Respite care' },
  { id: 'recreation', label: 'Recreational activities' },
  { id: 'siblings', label: 'For siblings' },
]

/** How a community group meets (shown under "Community groups"). */
export const COMMUNITY_GROUP_TAGS: Tag[] = [
  { id: 'community_local', label: 'Local', note: 'In your city, from your profile.' },
  { id: 'community_in_person', label: 'In person' },
  { id: 'community_online', label: 'Online' },
]

/** Levels of education in Canada. */
export const EDUCATION_LEVELS_CA: Tag[] = [
  { id: 'edu_daycare', label: 'Daycare' },
  { id: 'edu_kindergarten', label: 'Kindergarten' },
  { id: 'edu_kindergarten_junior', label: 'Junior kindergarten', parent: 'edu_kindergarten' },
  { id: 'edu_kindergarten_senior', label: 'Senior kindergarten', parent: 'edu_kindergarten' },
  { id: 'edu_elementary', label: 'Elementary school' },
  { id: 'edu_middle', label: 'Middle school' },
  { id: 'edu_secondary', label: 'High school / secondary school' },
  { id: 'edu_testing', label: 'Standardized testing' },
  { id: 'edu_trade', label: 'Trade school' },
  { id: 'edu_apprenticeship', label: 'Apprenticeship' },
  { id: 'edu_undergraduate', label: 'Undergraduate' },
  { id: 'edu_college', label: 'College', parent: 'edu_undergraduate' },
  { id: 'edu_university', label: 'University', parent: 'edu_undergraduate' },
  { id: 'edu_certificate', label: 'Certificates', parent: 'edu_undergraduate' },
  { id: 'edu_bachelor', label: 'Bachelor', parent: 'edu_undergraduate' },
  { id: 'edu_graduate', label: 'Graduate' },
  { id: 'edu_masters', label: 'Masters', parent: 'edu_graduate' },
  { id: 'edu_further', label: 'Further' },
  { id: 'edu_phd', label: 'PhD', parent: 'edu_further' },
  { id: 'edu_continuing', label: 'Continuing education' },
  { id: 'edu_mature', label: 'Mature student options' },
]

/** The same in the United States: preschool and pre-K, junior high, community college. */
export const EDUCATION_LEVELS_US: Tag[] = [
  { id: 'edu_preschool', label: 'Preschool' },
  { id: 'edu_prek', label: 'Pre-K' },
  { id: 'edu_kindergarten', label: 'Kindergarten' },
  { id: 'edu_elementary', label: 'Elementary school' },
  { id: 'edu_junior_high', label: 'Junior high / middle school' },
  { id: 'edu_secondary', label: 'High school' },
  { id: 'edu_testing', label: 'Standardized testing (SAT, ACT)' },
  { id: 'edu_trade', label: 'Trade school' },
  { id: 'edu_community_college', label: 'Community college' },
  { id: 'edu_undergraduate', label: 'Undergraduate' },
  { id: 'edu_university', label: 'University', parent: 'edu_undergraduate' },
  { id: 'edu_certificate', label: 'Certificates', parent: 'edu_undergraduate' },
  { id: 'edu_bachelor', label: "Bachelor's", parent: 'edu_undergraduate' },
  { id: 'edu_graduate', label: 'Graduate' },
  { id: 'edu_masters', label: "Master's", parent: 'edu_graduate' },
  { id: 'edu_further', label: 'Further' },
  { id: 'edu_phd', label: 'PhD', parent: 'edu_further' },
  { id: 'edu_continuing', label: 'Continuing education' },
  { id: 'edu_mature', label: 'Adult learner options' },
]

/** The school system for a country: Canada's unless it is the United States. */
export function educationLevelsFor(country?: string | null): Tag[] {
  const c = (country || '').trim().toLowerCase()
  return c === 'united states' || c === 'usa' || c === 'us' || c === 'united states of america' ? EDUCATION_LEVELS_US : EDUCATION_LEVELS_CA
}

/** Domains of post-secondary education: law, medicine, engineering and 40 more (the planning note's "up to 40"). */
export const EDUCATION_DOMAINS: Tag[] = [
  ['law', 'Law'], ['medicine', 'Medicine'], ['engineering', 'Engineering'], ['nursing', 'Nursing'],
  ['dentistry', 'Dentistry'], ['pharmacy', 'Pharmacy'], ['veterinary', 'Veterinary medicine'], ['health_sciences', 'Health sciences'],
  ['rehabilitation', 'Occupational and physical therapy'], ['speech_language', 'Speech-language pathology'],
  ['psychology', 'Psychology'], ['social_work', 'Social work'], ['education_teaching', 'Education and teaching'],
  ['early_childhood', 'Early childhood education'], ['business', 'Business'], ['accounting', 'Accounting'], ['economics', 'Economics'],
  ['computer_science', 'Computer science'], ['information_technology', 'Information technology'],
  ['mathematics', 'Mathematics'], ['physics', 'Physics'], ['chemistry', 'Chemistry'],
  ['biology', 'Biology'], ['environmental_science', 'Environmental science'], ['agriculture', 'Agriculture and food'],
  ['architecture', 'Architecture'], ['political_science', 'Political science'],
  ['sociology', 'Sociology'], ['history', 'History'], ['philosophy', 'Philosophy'], ['languages', 'Languages and linguistics'],
  ['literature', 'Literature and writing'], ['journalism', 'Journalism and communications'], ['media_arts', 'Media, film and animation'],
  ['music', 'Music'], ['fine_arts', 'Fine arts'], ['design', 'Design'], ['kinesiology', 'Kinesiology and sport'], ['skilled_trades', 'Skilled trades'], ['culinary', 'Culinary arts and hospitality'],
  ['aviation', 'Aviation'], ['criminology', 'Criminology and justice'], ['indigenous_studies', 'Indigenous studies'],
].map(([id, label]) => ({ id: `domain_${id}`, label }))

/** Programs and options in education. */
export const EDUCATION_PROGRAMS: Tag[] = [
  { id: 'prog_after_school', label: 'After-school programs' },
  { id: 'prog_special_education', label: 'Special education' },
  { id: 'prog_accessibility', label: 'Accessibility and accommodation services' },
  { id: 'edu_mature', label: 'Mature student options' },
  { id: 'prog_mentorship', label: 'Mentorship' },
  { id: 'prog_tutoring', label: 'Tutoring' },
  { id: 'prog_events', label: 'Events' },
  { id: 'prog_social_clubs', label: 'Social clubs' },
  { id: 'prog_awareness_clubs', label: 'Awareness clubs' },
]

/** Career: workplace life, and the career level. */
export const CAREER_TAGS: Tag[] = [
  { id: 'career_workplace_life', label: 'Workplace life' },
  { id: 'career_training', label: 'Training' },
  { id: 'career_internships', label: 'Internships' },
  { id: 'career_jobs', label: 'Jobs' },
]

/** Adulting. */
export const ADULTING_TAGS: Tag[] = [
  { id: 'adult_taxes', label: 'Taxes' },
  { id: 'adult_finances', label: 'Finances' },
  { id: 'adult_cooking', label: 'Cooking' },
  { id: 'adult_living_alone', label: 'Living by yourself' },
  { id: 'adult_friends', label: 'Finding friends and community' },
]

/** Parenting, by the child's age. */
export const PARENTING_TAGS: Tag[] = [
  { id: 'parent_babies', label: 'Babies and toddlers (0-4)' },
  { id: 'parent_children', label: 'Children (5-8)' },
  { id: 'parent_preteens', label: 'Pre-teens (9-12)' },
  { id: 'parent_teens', label: 'Teens (13-17)' },
  { id: 'parent_adult_children', label: 'Adult children (18+)' },
]

/** Every tag, once. */
export const ALL_TAGS: Tag[] = (() => {
  const seen = new Map<string, Tag>()
  for (const t of [
    ...SERVICE_TAGS, ...COMMUNITY_GROUP_TAGS, ...EDUCATION_LEVELS_CA, ...EDUCATION_LEVELS_US, ...EDUCATION_DOMAINS,
    ...EDUCATION_PROGRAMS, ...CAREER_TAGS, ...ADULTING_TAGS, ...PARENTING_TAGS,
  ]) if (!seen.has(t.id)) seen.set(t.id, t)
  return Array.from(seen.values())
})()

const TAG_IDS = new Set(ALL_TAGS.map((t) => t.id))
export const isTag = (v: string) => TAG_IDS.has(v)
export const tagLabel = (id: string) => ALL_TAGS.find((t) => t.id === id)?.label || id

/** A tag and the tags under it: choosing "Kindergarten" finds junior and senior kindergarten too. */
export function withChildren(ids: string[]): string[] {
  const out = new Set(ids)
  for (const t of ALL_TAGS) if (t.parent && ids.includes(t.parent)) out.add(t.id)
  return Array.from(out)
}

/** How long ago a service started (or was added): "Age of service". */
export const SERVICE_AGES = [
  { id: 'today', label: 'Just launched today!', days: 1 },
  { id: 'week', label: '1 week old', days: 7 },
  { id: 'month', label: '1 month old', days: 31 },
  { id: 'year', label: '1 year old', days: 366 },
  { id: 'five_years', label: '5 years old', days: 5 * 366 },
] as const

export type ServiceAgeId = (typeof SERVICE_AGES)[number]['id']
export const isServiceAge = (v: string): v is ServiceAgeId => SERVICE_AGES.some((a) => a.id === v)

/** Free or paid. */
export const COST_TYPES = [
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
] as const
export type CostType = (typeof COST_TYPES)[number]['id']

/** How a service is offered. */
export const DELIVERY = [
  { id: 'in_person', label: 'In person' },
  { id: 'online', label: 'Online' },
  { id: 'both', label: 'In person and online' },
] as const

// Which list each tag belongs to, for grouping a selection.
const FAMILIES: [string, Tag[]][] = [
  ['service', SERVICE_TAGS],
  ['community', COMMUNITY_GROUP_TAGS],
  ['edu', [...EDUCATION_LEVELS_CA, ...EDUCATION_LEVELS_US]],
  ['domain', EDUCATION_DOMAINS],
  ['program', EDUCATION_PROGRAMS],
  ['career', CAREER_TAGS],
  ['adulting', ADULTING_TAGS],
  ['parenting', PARENTING_TAGS],
]

/**
 * A selection of tags as search groups: any tag within a list, every list
 * chosen ("Daycare or Kindergarten", and "Charity"). A tag brings the tags
 * under it. "Local" community groups are a place, not a tag: the search
 * keeps them near the person instead (community_local is left out here).
 */
export function tagGroupsFor(selected: string[]): string[][] {
  const ids = selected.filter((id) => isTag(id) && id !== 'community_local')
  const groups = new Map<string, string[]>()
  for (const id of withChildren(ids)) {
    const family = FAMILIES.find(([, tags]) => tags.some((t) => t.id === id))?.[0] || 'service'
    groups.set(family, [...(groups.get(family) || []), id])
  }
  return Array.from(groups.values())
}

/** Whether "Local" community groups were asked for. */
export const wantsLocalGroups = (selected: string[]) => selected.includes('community_local')
