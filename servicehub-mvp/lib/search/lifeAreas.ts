/**
 * "Life area" search filter — the life domains that used to live on the Goal
 * Planning "Resource Roadmap" page (Odosa). Folding them in here lets people
 * filter resources by domain instead of visiting a separate roadmap page.
 *
 * Resources are not yet explicitly tagged with a life area, so matching is
 * best-effort keyword matching against a resource's name / description /
 * category / tags. That means some areas (especially the more "planned" ones
 * like legacy planning) may return few or no results until resources are
 * tagged — which is expected.
 */

export interface LifeArea {
  /** Stable token used in the URL param and API. */
  id: string
  /** Human label shown in the filter UI. */
  label: string
  /** Lower-cased keywords; a resource matches if its text contains any. */
  keywords: string[]
}

export const LIFE_AREAS: LifeArea[] = [
  {
    id: 'workplace',
    label: 'Workplace — fitting in',
    keywords: [
      'workplace',
      'work',
      'employment',
      'employer',
      'job',
      'career',
      'vocational',
      'vocation',
      'internship',
      'apprenticeship',
    ],
  },
  {
    id: 'society',
    label: 'Functioning in society',
    keywords: [
      'society',
      'social skills',
      'community',
      'daily living',
      'independent living',
      'life skills',
      'benefits',
      'housing',
      'transport',
      'transportation',
    ],
  },
  {
    id: 'afterschool',
    label: 'After-school & activities',
    keywords: [
      'after-school',
      'after school',
      'afterschool',
      'extracurricular',
      'activities',
      'recreation',
      'recreational',
      'sports',
      'hobby',
      'hobbies',
      'youth',
      'camp',
    ],
  },
  {
    id: 'legacy',
    label: 'After-death planning',
    keywords: [
      'legacy',
      'estate',
      'will',
      'trust',
      'guardianship',
      'conservatorship',
      'end of life',
      'end-of-life',
      'after-death',
      'inheritance',
      'special needs trust',
    ],
  },
]

export const LIFE_AREA_IDS = LIFE_AREAS.map((a) => a.id)

/** Flatten selected life-area ids into the union of their keywords. */
export function lifeAreaKeywords(ids: string[]): string[] {
  const set = new Set<string>()
  for (const area of LIFE_AREAS) {
    if (ids.includes(area.id)) {
      for (const k of area.keywords) set.add(k.toLowerCase())
    }
  }
  return Array.from(set)
}
