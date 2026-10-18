/**
 * The service-adding loop (the team's planning note, October 2026, Goal 1:
 * "Establish continuous Service-adding loop with Spot Guides (for now, use
 * agents)"). Each day it takes one slice of Ontario from OpenStreetMap, one
 * kind of place in one piece of the map at a time, up to six slices a run and
 * a run every six hours (about a month to go round), and adds the places
 * ResourceHub does not have yet, with the same plain facts and tags as the Ontario import
 * (scripts/import-ontario-services.mjs; keep the two in step).
 *
 * What the agent checks before adding: a name, a point inside Ontario, not
 * closed or private, not already listed (the same OpenStreetMap place, or the
 * same name within about 100 m). What it adds waits for a Spot Guide in
 * ResourceHub (/spot-guides), unless SERVICE_LOOP_AUTO_APPROVE is "on", when
 * the agent's checks are the approval. Every run is its own batch
 * (import_batch loop-YYYY-MM-DD), so a day can be found and hidden again.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import outline from './ontarioOutline.json'

const UA = 'Autinerary-ResourceHub/1.0 (+https://autinerary.ca; accessibility service directory)'
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

interface Group {
  id: string
  category: string
  select: string[]
}

/** The kinds of place, as in the Ontario import. */
export const LOOP_GROUPS: Group[] = [
  { id: 'therapist', category: 'Therapist', select: ['nwr["healthcare"~"^(psychotherapist|counselling|speech_therapist|occupational_therapist|psychologist)$"]'] },
  { id: 'doctor', category: 'Doctor', select: ['nwr["amenity"~"^(doctors|clinic)$"]', 'nwr["healthcare"~"^(doctor|clinic|centre)$"]'] },
  { id: 'swimming', category: 'Swimming', select: ['nwr["leisure"="swimming_pool"]["name"]', 'nwr["leisure"="sports_centre"]["sport"~"swimming"]'] },
  { id: 'riding', category: 'Horseback Riding', select: ['nwr["leisure"="horse_riding"]', 'nwr["sport"~"equestrian"]["leisure"]'] },
  { id: 'jobs', category: 'Employment', select: ['nwr["office"="employment_agency"]', 'nwr["amenity"="employment_agency"]'] },
  { id: 'childcare', category: 'Child Care', select: ['nwr["amenity"~"^(childcare|kindergarten)$"]'] },
  { id: 'library', category: 'Community Center', select: ['nwr["amenity"="library"]'] },
  { id: 'cafe', category: 'Café', select: ['nwr["amenity"="cafe"]'] },
  { id: 'museum', category: 'Museum', select: ['nwr["tourism"="museum"]'] },
  { id: 'zoo', category: 'Zoo & Aquarium', select: ['nwr["tourism"~"^(zoo|aquarium)$"]'] },
  { id: 'amusement', category: 'Amusement Park', select: ['nwr["tourism"="theme_park"]', 'nwr["leisure"="water_park"]'] },
  { id: 'bank', category: 'Bank', select: ['nwr["amenity"="bank"]'] },
  { id: 'hotel', category: 'Hotel', select: ['nwr["tourism"~"^(hotel|motel)$"]'] },
  { id: 'restaurant', category: 'Restaurant', select: ['nwr["amenity"="restaurant"]'] },
]

/** Ontario in pieces: the populated south in one-degree squares, the north in two. south, west, north, east. */
export function loopTiles(): number[][] {
  const out: number[][] = []
  for (let lat = 41.6; lat < 47; lat += 1) for (let lng = -84; lng < -74.3; lng += 1.5) out.push([lat, lng, Math.min(lat + 1, 47), Math.min(lng + 1.5, -74.3)])
  out.push([42, -95.2, 47, -84], [47, -95.2, 57, -74.3])
  return out
}

export const SLICES_PER_RUN = 6
const RUN_MS = 6 * 3_600_000

/** Which slice a run takes (k = 0..5 within the run): every kind of place in every piece, in turn. */
export function sliceFor(day: Date, k = 0): { group: Group; tile: number[]; index: number; of: number } {
  const tiles = loopTiles()
  const of = LOOP_GROUPS.length * tiles.length
  const run = Math.floor(day.getTime() / RUN_MS)
  const index = (((run * SLICES_PER_RUN + k) % of) + of) % of
  return { group: LOOP_GROUPS[index % LOOP_GROUPS.length], tile: tiles[Math.floor(index / LOOP_GROUPS.length)], index, of }
}

function insideRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function inOntario(lat: number, lng: number): boolean {
  return (outline as { polygons: number[][][][] }).polygons.some(
    (rings) => insideRing(rings[0], lng, lat) && !rings.slice(1).some((hole) => insideRing(hole, lng, lat))
  )
}

const GONE = /^(disused|abandoned|was|demolished|razed|removed|closed):/
const USUALLY_FREE = new Set(['Doctor', 'Employment', 'Community Center'])

type El = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function website(raw?: string): string | null {
  const v = String(raw || '').trim().split(';')[0].trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`
  return null
}

/** One OpenStreetMap place as a ResourceHub row, or null. Plain facts only. */
export function loopRow(el: El, group: Group, now: string, batch: string, status: 'pending' | 'approved') {
  const t = el.tags || {}
  const name = (t.name || '').trim()
  if (!name || Object.keys(t).some((k) => GONE.test(k)) || t.opening_hours === 'closed' || t.access === 'private' || t.access === 'no') return null
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (typeof lat !== 'number' || typeof lng !== 'number' || !inOntario(lat, lng)) return null
  const facts: string[] = []
  if (t.wheelchair === 'yes') facts.push('Mapped as step-free by an OpenStreetMap contributor.')
  else if (t.wheelchair === 'limited') facts.push('Mapped as partially step-free by an OpenStreetMap contributor.')
  else if (t.wheelchair === 'no') facts.push('Mapped as not step-free by an OpenStreetMap contributor.')
  if (t['toilets:wheelchair'] === 'yes') facts.push('Accessible toilet mapped.')
  if (t.opening_hours) facts.push(`Hours listed as: ${t.opening_hours}.`)
  if ((group.id === 'restaurant' || group.id === 'cafe') && t.cuisine) facts.push(`Food listed as: ${t.cuisine.replace(/_/g, ' ').replace(/;/g, ', ')}.`)
  facts.push('Imported from OpenStreetMap. Nobody has reviewed what it is like inside yet.')
  const tags: string[] = []
  if (['swimming', 'riding', 'zoo', 'amusement', 'museum'].includes(group.id)) tags.push('recreation')
  if (group.id === 'jobs') tags.push('job_opportunities')
  if (group.id === 'childcare') tags.push(t.amenity === 'kindergarten' ? 'edu_kindergarten' : 'edu_daycare')
  const cost =
    t.fee === 'no' ? { cost_type: 'free', cost_source: 'listed' } :
    t.fee === 'yes' || t.charge ? { cost_type: 'paid', cost_source: 'listed' } :
    { cost_type: USUALLY_FREE.has(group.category) ? 'free' : 'paid', cost_source: 'usual' }
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
  return {
    name: name.slice(0, 200),
    description: facts.join(' ').slice(0, 900),
    category: group.category,
    location: { address: street || null, city: t['addr:city'] || null, province: t['addr:province'] || 'ON', postal_code: t['addr:postcode'] || null, lat, lng },
    contact_info: { phone: t.phone || t['contact:phone'] || null, website: website(t.website || t['contact:website']), email: t.email || t['contact:email'] || null },
    status,
    ...cost,
    currency: 'CAD',
    delivery: 'in_person',
    tags,
    source_type: 'openstreetmap',
    source_ref: `osm:${el.type}/${el.id}`,
    source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    source_attribution: '© OpenStreetMap contributors (ODbL)',
    last_verified_at: now,
    is_first_party: false,
    image_url: null,
    image_is_generic: false,
    image_attribution: null,
    import_batch: batch,
  }
}

async function overpass(group: Group, tile: number[], deadline: number): Promise<El[]> {
  const q = `[out:json][timeout:40];\n(\n${group.select.map((s) => `  ${s}(${tile.join(',')});`).join('\n')}\n);\nout tags center;`
  for (const server of SERVERS) {
    const left = deadline - Date.now()
    if (left < 8000) break
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: q }),
        signal: AbortSignal.timeout(Math.min(left - 5000, 45000)),
      })
      if (!res.ok) continue
      const json = await res.json()
      // A query that ran out of time answers 200 with a remark: not trusted.
      if (json.remark && /error|timed out|out of memory/i.test(json.remark)) continue
      return json.elements || []
    } catch {
      /* the next server */
    }
  }
  throw new Error('OpenStreetMap did not answer in time')
}

export interface LoopResult {
  slice: string
  found: number
  added: number
  skipped: number
  batch: string
  status: 'pending' | 'approved'
  error?: string
}

/** One run: up to six slices while time is left; for each, fetch, check, add (with dryRun, everything but adding). */
export async function runServiceLoop(admin: SupabaseClient, day = new Date(), budgetMs = 240_000, dryRun = false): Promise<LoopResult[]> {
  const deadline = Date.now() + budgetMs
  const out: LoopResult[] = []
  for (let k = 0; k < SLICES_PER_RUN && deadline - Date.now() > 60_000; k++) {
    try {
      out.push(await runSlice(admin, day, k, deadline, dryRun))
    } catch (e: any) {
      out.push({ slice: `${sliceFor(day, k).group.id} ${sliceFor(day, k).index + 1}/${sliceFor(day, k).of}`, found: 0, added: 0, skipped: 0, batch: '', status: 'pending', error: e?.message || String(e) })
    }
  }
  return out
}

async function runSlice(admin: SupabaseClient, day: Date, k: number, deadline: number, dryRun: boolean): Promise<LoopResult> {
  const { group, tile, index, of } = sliceFor(day, k)
  const now = day.toISOString()
  const batch = `loop-${now.slice(0, 10)}`
  const status = process.env.SERVICE_LOOP_AUTO_APPROVE === 'on' ? 'approved' : 'pending'
  const elements = await overpass(group, tile, deadline)
  const rows = elements.map((el) => loopRow(el, group, now, batch, status)).filter(Boolean) as NonNullable<ReturnType<typeof loopRow>>[]

  // Already listed: the same place, or the same name within about 100 m.
  const near = new Set<string>()
  const key = (name: string, lat: number, lng: number) => `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin
      .from('resources')
      .select('name, geo_lat, geo_lng')
      .gte('geo_lat', tile[0]).lte('geo_lat', tile[2]).gte('geo_lng', tile[1]).lte('geo_lng', tile[3])
      .neq('status', 'rejected')
      .order('id')
      .range(from, from + 999)
    if (error || !data?.length) break
    for (const r of data as { name: string; geo_lat: number; geo_lng: number }[]) near.add(key(r.name, r.geo_lat, r.geo_lng))
    if (data.length < 1000) break
  }
  const fresh = rows.filter((r) => !near.has(key(r.name, r.location.lat, r.location.lng)))

  let added = 0
  if (dryRun) return { slice: `${group.id} ${index + 1}/${of}`, found: elements.length, added: fresh.length, skipped: rows.length - fresh.length, batch, status }
  for (let i = 0; i < fresh.length; i += 500) {
    const { data, error } = await admin
      .from('resources')
      .upsert(fresh.slice(i, i + 500), { onConflict: 'source_ref', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(error.message)
    added += (data || []).length
  }
  return { slice: `${group.id} ${index + 1}/${of}`, found: elements.length, added, skipped: rows.length - added, batch, status }
}
