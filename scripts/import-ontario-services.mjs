#!/usr/bin/env node
/**
 * Ontario services from OpenStreetMap, up to 50,000, for ResourceHub.
 *
 * The team's planning note (October 2026), Goal 0: "Mass Uploading of
 * Domain-Specific & General Purpose Services", starting in Ontario, "UP TO
 * 50K ADDITIONAL SERVICES", shown on every ResourceHub on this database.
 * Focus: diagnosis, therapists, doctors, riding and other animal programs,
 * swimming, job training and hiring; and general places: study spots, cafés,
 * zoos, amusement parks, restaurants, hotels, banks; and colleges and
 * universities (the campus package).
 *
 * The rules are scripts/import-osm-venues.mjs's (read its header): OSM is
 * licensed for this (ODbL, credited on every row); only the plain facts a
 * mapper recorded (name, address, map point, phone, website, hours, step-free
 * tags) and never a claim about what a place is like for autistic or
 * neurodivergent people. That comes from ratings and sensory scans later.
 *
 * What is different here:
 *   - All of Ontario (its boundary, not city boxes), one kind of place at a
 *     time, domain-specific first; with more than --max, the general kinds
 *     at the end of the list are cut first (restaurants last of all).
 *   - Insert only: a place already in ResourceHub (same source_ref) is left
 *     exactly as it is. The September import's re-run would have sent
 *     approved rows back to pending and undone later fixes.
 *   - Every row carries import_batch (STEP 77; before it, the run's own
 *     last_verified_at, and the statement it prints tags them), lands as
 *     'pending', and is published by one statement after a look at a sample:
 *       UPDATE public.resources SET status = 'approved'
 *        WHERE import_batch = 'ontario-2026-10' AND status = 'pending';
 *     and hidden again, if needed, by setting 'rejected'. Nothing is deleted.
 *   - No photo lookups (50,000 Wikidata calls); the category icon stands in.
 *
 * Usage (from the repo root):
 *   node scripts/import-ontario-services.mjs                 # dry run: fetch, count, sample
 *   node scripts/import-ontario-services.mjs --apply         # write (STEP 77 first)
 *   node scripts/import-ontario-services.mjs --only cafe,bank --max 50000 --refresh
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UA = 'Autinerary-ResourceHub/1.0 (+https://autinerary.ca; accessibility service directory)'
// The main public server first, then another public instance when it is
// overloaded (the same software; its data can be a few months older).
// overpass.kumi.systems answered every request with an error on 17 October
// 2026, so it is left out.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'
export const BATCH = 'ontario-2026-10'

// Kinds of place, in priority order: the focus list's domain-specific ones,
// then the general ones. Categories follow ResourceHub's (and the September
// import's: libraries are Community Center, campuses School); the new ones
// match the submission form's (CategorySelect: swimming, horseback_riding).
export const GROUPS = [
  { id: 'therapist', category: 'Therapist', select: ['nwr["healthcare"~"^(psychotherapist|counselling|speech_therapist|occupational_therapist|psychologist)$"]'] },
  { id: 'doctor', category: 'Doctor', select: ['nwr["amenity"~"^(doctors|clinic)$"]', 'nwr["healthcare"~"^(doctor|clinic|centre)$"]'] },
  { id: 'swimming', category: 'Swimming', select: ['nwr["leisure"="swimming_pool"]["name"]', 'nwr["leisure"="sports_centre"]["sport"~"swimming"]'] },
  { id: 'riding', category: 'Horseback Riding', select: ['nwr["leisure"="horse_riding"]', 'nwr["sport"~"equestrian"]["leisure"]'] },
  { id: 'jobs', category: 'Employment', select: ['nwr["office"="employment_agency"]', 'nwr["amenity"="employment_agency"]'] },
  { id: 'campus', category: 'School', select: ['nwr["amenity"~"^(university|college)$"]'] },
  { id: 'library', category: 'Community Center', select: ['nwr["amenity"="library"]'] },
  { id: 'cafe', category: 'Café', select: ['nwr["amenity"="cafe"]'] },
  { id: 'museum', category: 'Museum', select: ['nwr["tourism"="museum"]'] },
  { id: 'zoo', category: 'Zoo & Aquarium', select: ['nwr["tourism"~"^(zoo|aquarium)$"]'] },
  { id: 'amusement', category: 'Amusement Park', select: ['nwr["tourism"="theme_park"]', 'nwr["leisure"="water_park"]'] },
  { id: 'bank', category: 'Bank', select: ['nwr["amenity"="bank"]'] },
  { id: 'hotel', category: 'Hotel', select: ['nwr["tourism"~"^(hotel|motel)$"]'] },
  { id: 'restaurant', category: 'Restaurant', select: ['nwr["amenity"="restaurant"]'] },
]

const args = process.argv.slice(2)
const flag = (name, dflt = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? (args[i + 1] ?? true) : dflt
}
const APPLY = args.includes('--apply')
const REFRESH = args.includes('--refresh')
const MAX = Number(flag('max', 50000))
const ONLY = flag('only', null) ? String(flag('only')).split(',') : null
const CACHE = path.join(os.tmpdir(), 'autinerary-ontario-import')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadEnv() {
  for (const f of ['backend/.env', 'servicehub-mvp/.env.local', '.env']) {
    const p = path.resolve(process.cwd(), f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

async function overpass(query, attempt = 1, attempts = 9) {
  const server = OVERPASS[(attempt - 1) % OVERPASS.length]
  let res
  try {
    res = await fetch(server, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    })
  } catch (e) {
    res = { ok: false, status: 599 }
  }
  if (!res.ok) {
    // Public servers are often busy: wait, try the next one, politely.
    if (res.status >= 429 && attempt < attempts) {
      process.stdout.write(`(${res.status} from ${new URL(server).host}, waiting ${attempt * 20}s) `)
      await sleep(attempt * 20000)
      return overpass(query, attempt + 1, attempts)
    }
    throw new Error(`Overpass ${res.status}`)
  }
  // A query that ran out of time or memory still answers 200, with what it
  // had so far and a remark: a partial answer, so ask again.
  const json = await res.json().catch(() => ({ remark: 'error: not JSON' }))
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) {
    if (attempt < attempts) {
      process.stdout.write(`(partial answer from ${new URL(server).host}, waiting ${attempt * 20}s) `)
      await sleep(attempt * 20000)
      return overpass(query, attempt + 1, attempts)
    }
    throw new Error(`Overpass: ${json.remark}`)
  }
  return json.elements || []
}

// Ontario in pieces, for a kind of place too big to ask for at once when the
// public servers are busy: the populated south in one-degree squares, the
// north in large ones. south, west, north, east.
function tiles() {
  const out = []
  for (let lat = 41.6; lat < 47; lat += 1) for (let lng = -84; lng < -74.3; lng += 1.5) out.push([lat, lng, Math.min(lat + 1, 47), Math.min(lng + 1.5, -74.3)])
  out.push([42, -95.2, 47, -84], [47, -95.2, 57, -74.3])
  return out
}

// All of Ontario inside its boundary; or one piece of the map as a plain box,
// which every public server can answer quickly (some have no boundaries
// built), kept to Ontario afterwards with its outline.
const query = (group, box) => box
  ? `[out:json][timeout:300];
(
${group.select.map((s) => `  ${s}(${box.join(',')});`).join('\n')}
);
out tags center;`
  : `[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-2"="CA-ON"]["admin_level"="4"]->.on;
(
${group.select.map((s) => `  ${s}(area.on);`).join('\n')}
);
out tags center;`

// Ontario's outline (OpenStreetMap, through Nominatim, simplified to about
// 100 m), kept on disk; and whether a point is inside it.
let OUTLINE = null
async function outline() {
  if (OUTLINE) return OUTLINE
  const file = path.join(CACHE, 'ontario-nominatim.json')
  if (!fs.existsSync(file)) {
    const res = await fetch('https://nominatim.openstreetmap.org/search?q=Ontario%2C%20Canada&format=json&polygon_geojson=1&polygon_threshold=0.001&limit=1', { headers: { 'User-Agent': UA } })
    fs.writeFileSync(file, await res.text())
  }
  const g = JSON.parse(fs.readFileSync(file, 'utf8'))[0].geojson
  OUTLINE = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return OUTLINE
}
function insideRing(ring, lng, lat) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inOntario = (polys, el) => {
  const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon
  if (typeof lat !== 'number') return false
  return polys.some((rings) => insideRing(rings[0], lng, lat) && !rings.slice(1).some((hole) => insideRing(hole, lng, lat)))
}

/** One kind of place across Ontario, kept on disk while the import runs. */
async function fetchGroup(group) {
  fs.mkdirSync(CACHE, { recursive: true })
  const file = path.join(CACHE, `${group.id}.json`)
  if (!REFRESH && fs.existsSync(file)) return { elements: JSON.parse(fs.readFileSync(file, 'utf8')), cached: true }
  let elements
  try {
    elements = await overpass(query(group, null), 1, 2)
  } catch {
    // Too big for now: in pieces, each kept as it arrives, then only what
    // is inside Ontario.
    process.stdout.write('in pieces: ')
    const polys = await outline()
    const seen = new Map()
    for (const [i, box] of tiles().entries()) {
      const part = path.join(CACHE, `${group.id}.tile${i}.json`)
      const els = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : await overpass(query(group, box), 2)
      if (!fs.existsSync(part)) fs.writeFileSync(part, JSON.stringify(els))
      for (const el of els) if (inOntario(polys, el)) seen.set(`${el.type}/${el.id}`, el)
      process.stdout.write('.')
      await sleep(1000)
    }
    elements = [...seen.values()]
  }
  fs.writeFileSync(file, JSON.stringify(elements))
  return { elements, cached: false }
}

const GONE = /^(disused|abandoned|was|demolished|razed|removed|closed):/
function stillThere(tags) {
  if (Object.keys(tags).some((k) => GONE.test(k))) return false
  if (tags.opening_hours === 'closed' || tags.access === 'private' || tags.access === 'no') return false
  return true
}

function website(raw) {
  const v = String(raw || '').trim().split(';')[0].trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`
  return null
}

const titleCase = (s) => s.replace(/_/g, ' ').replace(/;/g, ', ')

// Free or paid (STEP 78): what a mapper recorded (fee=no / fee=yes), else
// what the kind of place usually is, as the migration fills in for the rest.
const USUALLY_FREE = new Set(['Doctor', 'Employment', 'Community Center', 'School'])
function costOf(tags, group) {
  if (tags.fee === 'no') return { cost_type: 'free', cost_source: 'listed' }
  if (tags.fee === 'yes' || tags.charge) return { cost_type: 'paid', cost_source: 'listed' }
  // Colleges and universities charge tuition; public schools are free.
  return { cost_type: USUALLY_FREE.has(group.category) && group.id !== 'campus' ? 'free' : 'paid', cost_source: 'usual' }
}

// Tags the kind of place and its name make plain (servicehub-mvp/lib/filters/tags.ts).
function tagsOf(tags, group, name) {
  const out = []
  if (['swimming', 'riding', 'zoo', 'amusement', 'museum'].includes(group.id)) out.push('recreation')
  if (group.id === 'jobs') out.push('job_opportunities')
  if (group.id === 'campus') {
    if (/universit/i.test(name) || tags.amenity === 'university') out.push('edu_university', 'edu_undergraduate')
    else out.push('edu_college', 'edu_undergraduate')
  }
  return out
}

/** One OSM element to a ResourceHub row, or null. Plain facts only. */
export function toRow(el, group, now) {
  const tags = el.tags || {}
  const name = (tags.name || '').trim()
  if (!name || !stillThere(tags)) return null
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const facts = []
  if (tags.wheelchair === 'yes') facts.push('Mapped as step-free by an OpenStreetMap contributor.')
  else if (tags.wheelchair === 'limited') facts.push('Mapped as partially step-free by an OpenStreetMap contributor.')
  else if (tags.wheelchair === 'no') facts.push('Mapped as not step-free by an OpenStreetMap contributor.')
  if (tags['toilets:wheelchair'] === 'yes') facts.push('Accessible toilet mapped.')
  if (tags.opening_hours) facts.push(`Hours listed as: ${tags.opening_hours}.`)
  if ((group.id === 'restaurant' || group.id === 'cafe') && tags.cuisine) facts.push(`Food listed as: ${titleCase(tags.cuisine)}.`)
  if (group.id === 'swimming' && tags.indoor === 'yes') facts.push('Mapped as an indoor pool.')
  facts.push('Imported from OpenStreetMap. Nobody has reviewed what it is like inside yet.')

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  return {
    name: name.slice(0, 200),
    description: facts.join(' ').slice(0, 900),
    category: group.category,
    location: {
      address: street || null,
      city: tags['addr:city'] || null,
      // Found inside Ontario's boundary.
      province: tags['addr:province'] || tags['addr:state'] || 'ON',
      postal_code: tags['addr:postcode'] || null,
      lat,
      lng,
    },
    contact_info: {
      phone: tags.phone || tags['contact:phone'] || null,
      website: website(tags.website || tags['contact:website']),
      email: tags.email || tags['contact:email'] || null,
    },
    status: 'pending',
    ...costOf(tags, group),
    currency: 'CAD',
    delivery: 'in_person',
    tags: tagsOf(tags, group, name),
    source_type: 'openstreetmap',
    source_ref: `osm:${el.type}/${el.id}`,
    source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    source_attribution: ATTRIBUTION,
    last_verified_at: now,
    is_first_party: false,
    image_url: null,
    image_is_generic: false,
    image_attribution: null,
    import_batch: BATCH,
  }
}

async function supabaseClient() {
  const pkgRoot = path.resolve(process.cwd(), 'servicehub-mvp/node_modules/@supabase/supabase-js/dist')
  let createClient
  for (const entry of ['index.mjs', 'index.cjs', 'main/index.js']) {
    try {
      ;({ createClient } = await import(path.join(pkgRoot, entry)))
      break
    } catch {
      /* the next entry point */
    }
  }
  if (!createClient) throw new Error(`Could not load @supabase/supabase-js from ${pkgRoot}`)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function main() {
  loadEnv()
  const now = new Date().toISOString()
  const groups = ONLY ? GROUPS.filter((g) => ONLY.includes(g.id)) : GROUPS
  console.log(`Ontario services from OpenStreetMap${APPLY ? '' : ' (dry run)'}: ${groups.map((g) => g.id).join(', ')}; at most ${MAX}`)
  console.log(`Attribution: ${ATTRIBUTION}. Batch: ${BATCH}\n`)

  const seen = new Set()
  const nearby = new Set()
  const byGroup = []
  for (const group of groups) {
    process.stdout.write(`${group.id}: `)
    let fetched
    try {
      fetched = await fetchGroup(group)
    } catch (e) {
      console.log(`FAILED (${e.message})`)
      continue
    }
    const rows = []
    let skipped = 0
    for (const el of fetched.elements) {
      const row = toRow(el, group, now)
      if (!row) { skipped++; continue }
      if (seen.has(row.source_ref)) continue
      // The same place mapped twice (a point and an outline): same name, within about 100 m.
      const near = `${row.name.toLowerCase()}|${row.location.lat.toFixed(3)}|${row.location.lng.toFixed(3)}`
      if (nearby.has(near)) continue
      seen.add(row.source_ref)
      nearby.add(near)
      rows.push(row)
    }
    byGroup.push({ group, rows })
    console.log(`${fetched.elements.length} mapped -> ${rows.length} usable (${skipped} unnamed or closed)${fetched.cached ? ' [kept from the last run]' : ''}`)
    if (!fetched.cached) await sleep(5000)
  }

  // At most MAX: the last kinds are cut first.
  let room = MAX
  const kept = []
  for (const { group, rows } of byGroup) {
    const take = rows.slice(0, Math.max(0, room))
    room -= take.length
    kept.push({ group, rows: take, cut: rows.length - take.length })
  }
  const all = kept.flatMap((k) => k.rows)
  console.log('\nTo add (before any already in ResourceHub are left out):')
  for (const k of kept) console.log(`  ${k.group.category.padEnd(18)} ${String(k.rows.length).padStart(6)}${k.cut ? `  (${k.cut} over the limit, left out)` : ''}`)
  console.log(`  ${'Total'.padEnd(18)} ${String(all.length).padStart(6)}`)
  const withSite = all.filter((r) => r.contact_info.website).length
  const withPhone = all.filter((r) => r.contact_info.phone).length
  const withCity = all.filter((r) => r.location.city).length
  const stepFree = all.filter((r) => r.description.includes('Mapped as step-free')).length
  console.log(`  with a website ${withSite}, a phone ${withPhone}, a town ${withCity}, mapped step-free ${stepFree}`)

  // A sample to look at before publishing, outside the repo.
  const sampleFile = path.join(CACHE, 'sample.json')
  const sample = kept.flatMap((k) => k.rows.filter((_, i) => i % Math.max(1, Math.floor(k.rows.length / 15)) === 0).slice(0, 15))
  fs.writeFileSync(sampleFile, JSON.stringify(sample, null, 2))
  console.log(`  a sample of ${sample.length} rows: ${sampleFile}`)

  if (!APPLY) {
    console.log('\nDry run: nothing written. Run with --apply to write them as pending.')
    return
  }

  const supabase = await supabaseClient()
  // import_batch comes with STEP 77. Without it the rows are written without
  // it, all with this run's last_verified_at, which finds them again: the
  // statement printed at the end tags them with the batch and publishes them.
  const probe = await supabase.from('resources').select('import_batch').limit(1)
  const tagged = !probe.error
  if (!tagged) {
    console.log(`\nSTEP 77 is not applied yet (${probe.error.message}): writing without import_batch; this run is last_verified_at = ${now}.`)
    for (const row of all) delete row.import_batch
  }
  // Tags, cost, currency and delivery come with STEP 78; without it the rows
  // are written without them, and the migration fills cost and currency in.
  const probe78 = await supabase.from('resources').select('tags').limit(1)
  if (probe78.error) {
    console.log(`STEP 78 is not applied yet (${probe78.error.message}): writing without tags, cost, currency and delivery.`)
    for (const row of all) { delete row.tags; delete row.cost_type; delete row.cost_source; delete row.currency; delete row.delivery }
  }
  let added = 0
  let failed = 0
  for (let i = 0; i < all.length; i += 500) {
    const chunk = all.slice(i, i + 500)
    const { data, error } = await supabase
      .from('resources')
      .upsert(chunk, { onConflict: 'source_ref', ignoreDuplicates: true })
      .select('id')
    if (error) {
      failed += chunk.length
      console.error(`  rows ${i + 1}-${i + chunk.length} failed: ${error.message}`)
      continue
    }
    added += (data || []).length
    process.stdout.write(`\r  written ${Math.min(i + 500, all.length)} of ${all.length} (${added} new)`)
    await sleep(250)
  }
  console.log(`\n\nAdded ${added} places as pending (batch ${BATCH}); ${all.length - added - failed} were already in ResourceHub and left as they are${failed ? `; ${failed} failed` : ''}.`)
  if (!tagged) {
    console.log(`After STEP 77, tag them with the batch:\n  UPDATE public.resources SET import_batch = '${BATCH}' WHERE import_batch IS NULL AND status = 'pending' AND source_type = 'openstreetmap' AND last_verified_at = '${now}';`)
  }
  console.log(`Publish them with:\n  UPDATE public.resources SET status = 'approved' WHERE import_batch = '${BATCH}' AND status = 'pending';`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
