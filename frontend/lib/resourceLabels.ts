/**
 * A ResourceHub listing's labels, shown on each tool of a milestone (the
 * team's notes on the Milestone view, October 2026: "For each resource, add
 * its labels from ResourceHub (Norms, Resource Type, Type within Resource
 * Type such as Product Type or Service type, etc.)").
 *
 * All from ResourceHub's own data: the kind and type of listing, its tags
 * (named as lib/filters/tags.ts names them, the same words ResourceHub uses), free or paid, the
 * ages it serves, and its norms, which ResourceHub takes from ratings
 * (people rate a service for their norms; a listing says nothing about
 * norms itself, servicehub-mvp/lib/supabase/queries.ts ratingIndex).
 */

export interface ResourceRow {
  category: string | null
  tags: string[] | null
  cost_type: string | null
  price?: number | string | null
  age_ranges?: string[] | null
}

export interface ResourceLabels {
  /** Service, Product or Commentary. */
  kind: string
  /** The type within it: the listing's category ("Education Support"). */
  type: string | null
  tags: string[]
  /** Norms people rated it for, most often first. */
  norms: string[]
  cost: string | null
  ages: string[]
}

const AGES: Record<string, string> = {
  babies_0_4: 'Babies (0-4)',
  children_5_8: 'Children (5-8)',
  preteens_9_12: 'Pre-teens (9-12)',
  teens_13_17: 'Teens under 18 (13-17)',
  young_adults_18_30: 'Young adults (18-30)',
  adults_30_45: 'Adults (30-45)',
  adults_45_65: 'Adults (45-65)',
  seniors_65_plus: 'Seniors (65+)',
}

// Norm keys as ratings store them (ResourceHub's ids, and older words).
const NORMS: Record<string, string> = {
  autism: 'Autism', adhd: 'ADHD', ocd: 'OCD', bipolar: 'Bipolar Disorder', depression: 'Depression',
  sensory_deaf: 'Deaf or Hard of Hearing', sensory_blind: 'Blind or Low Vision', physical_wheelchair: 'Wheelchair User',
  physical_mobility: 'Mobility Challenges', intellectual: 'Intellectual Disabilities', race_visible_minority: 'Race/Visible Minority',
  lgbtq: 'LGBTQ+', socioeconomic: 'Socioeconomic Considerations', chronic_health: 'Chronic Health Conditions',
  mental_health: 'Mental Health Considerations', substance_use: 'Substance Use / Recovery',
}

const sentence = (key: string) => {
  const s = key.replace(/[_-]+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

export const normLabel = (key: string): string => NORMS[key] || sentence(key)

/** Service, Product or Commentary, as the plan's tools are grouped (lib/moreTools.ts typeFor). */
export function kindFor(category: string | null | undefined): string {
  const c = String(category || '').toLowerCase()
  if (c === 'app' || c === 'store') return 'Product'
  if (c === 'book' || c === 'workshop') return 'Commentary'
  return 'Service'
}

/**
 * The labels for one listing. `tagName` names a tag the way ResourceHub does
 * (lib/filters/tags.ts tagLabel, passed in by the caller).
 */
export function labelsFor(
  row: ResourceRow,
  normCounts: Record<string, number> = {},
  tagName: (id: string) => string = (id) => id,
): ResourceLabels {
  const price = Number(row.price)
  const cost =
    row.cost_type === 'free' || (row.price !== null && row.price !== undefined && row.price !== '' && price === 0)
      ? 'Free'
      : row.cost_type === 'paid' || (Number.isFinite(price) && price > 0)
        ? 'Paid'
        : null
  return {
    kind: kindFor(row.category),
    type: row.category ? sentence(row.category) : null,
    tags: Array.from(new Set((row.tags || []).map(tagName))).slice(0, 6),
    norms: Object.entries(normCounts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([k]) => normLabel(k))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5),
    cost,
    ages: (row.age_ranges || []).map((a) => AGES[a] || sentence(a)).slice(0, 4),
  }
}
