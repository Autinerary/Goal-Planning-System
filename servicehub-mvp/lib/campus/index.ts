/**
 * Ontario's public colleges and universities and their campuses (lib/campus/
 * campuses.json, built by scripts/places/build-campuses.mjs from OpenStreetMap),
 * for the campus pages: what is near each campus (the team's planning note,
 * October 2026: "services near universities and colleges, as a partnership
 * package").
 */
import data from './campuses.json'

export interface Campus {
  name: string
  /** From its address, when the map has it. */
  city: string | null
  /** Otherwise the nearest town on the map. */
  near?: string | null
  lat: number
  lng: number
}

/** "Toronto", "near Brampton", or nothing. */
export const campusTown = (c: Campus) => c.city || (c.near ? `near ${c.near}` : '')

export interface Institution {
  slug: string
  name: string
  kind: 'university' | 'college'
  campuses: Campus[]
}

export const INSTITUTIONS: Institution[] = ((data as unknown as { institutions: Institution[] }).institutions || []).filter(
  (i) => i.campuses.length > 0
)

export function institution(slug: string): Institution | undefined {
  return INSTITUTIONS.find((i) => i.slug === slug)
}

/** The kinds of place a student looks for near campus, as searches (lib/search/understand.ts reads them). */
export const NEAR_CAMPUS: { label: string; q: string }[] = [
  { label: 'Study spots and libraries', q: 'study spots' },
  { label: 'Cafés', q: 'cafe' },
  { label: 'Counselling and therapists', q: 'therapist' },
  { label: 'Doctors and clinics', q: 'doctor' },
  { label: 'Swimming', q: 'swimming' },
  { label: 'Jobs and job training', q: 'jobs' },
  { label: 'Support groups', q: 'support group' },
  { label: 'Restaurants', q: 'restaurant' },
]

/** A search near a campus. */
export function nearCampusHref(campus: Campus, q: string): string {
  const params = new URLSearchParams({ ai: '1', q, near: `${campus.lat},${campus.lng}`, nearName: campus.name })
  return `/search?${params.toString()}`
}
