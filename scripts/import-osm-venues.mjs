#!/usr/bin/env node
/**
 * Seed ResourceHub with real venues from OpenStreetMap.
 *
 * Why OSM and not a scrape of a service directory:
 *
 *   - It is licensed for exactly this. ODbL permits redistribution
 *     provided the source is credited, which is a clear yes rather
 *     than the grey area you get scraping a site whose terms forbid it.
 *   - Overpass is a query API built to be queried, so using it is the
 *     intended behaviour rather than something tolerated.
 *   - It carries coordinates, which the sensory scanner needs.
 *
 * Sources that were considered and rejected: Ontario's open data portal
 * disallows /api/ in robots.txt, and Autism Ontario serves
 * Content-Signal: ai-train=no. Neither is worth arguing about when a
 * cleanly licensed alternative exists.
 *
 * What this imports: name, address, coordinates, phone, website,
 * category. What it refuses to import: any claim about accessibility.
 * A survey of 286 central Toronto venues found wheelchair tags on 16%
 * and hearing loops, quiet rooms or autism tags on exactly none. That
 * data does not exist, so deriving it from an amenity type would be
 * invention. Imported venues arrive as a place with an address, and
 * everything about what it is like inside comes from real ratings and
 * sensory scans afterwards.
 *
 * Rows land as `pending`. Nothing reaches the public directory without
 * a human approving it.
 *
 * Usage:
 *   node scripts/import-osm-venues.mjs --city toronto --dry-run
 *   node scripts/import-osm-venues.mjs --city toronto --limit 200
 */

// supabase-js is imported lazily further down, only when actually
// writing. A dry run should need no dependencies at all, and the
// package lives in the app's node_modules rather than the repo root.
import fs from 'node:fs'
import path from 'node:path'

const UA = 'Autinerary-ResourceHub/1.0 (+https://autinerary.ca; accessibility service directory)'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const STATUS = 'https://overpass-api.de/api/status'
const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'

/** Bounding boxes: south, west, north, east. */
const CITIES = {
  toronto:   [43.58, -79.64, 43.86, -79.12],
  mississauga: [43.47, -79.82, 43.68, -79.52],
  hamilton:  [43.18, -80.00, 43.34, -79.71],
  ottawa:    [45.25, -75.93, 45.54, -75.49],
  vancouver: [49.20, -123.27, 49.32, -123.02],
}

/**
 * OSM tag to the category vocabulary this directory already uses.
 * Anything not listed here is skipped rather than being forced into a
 * category that does not fit.
 */
const CATEGORY_MAP = {
  'amenity=library': 'Community Center',
  'amenity=community_centre': 'Community Center',
  'amenity=social_facility': 'Support Group',
  'amenity=clinic': 'Doctor',
  'amenity=doctors': 'Doctor',
  'amenity=hospital': 'Doctor',
  'amenity=school': 'School',
  'amenity=college': 'School',
  'amenity=university': 'School',
  'amenity=kindergarten': 'School',
  'healthcare=psychotherapist': 'Therapist',
  'healthcare=occupational_therapist': 'Therapist',
  'healthcare=speech_therapist': 'Therapist',
  'healthcare=counselling': 'Therapist',
  'leisure=park': 'Park',
  'leisure=playground': 'Park',
  'leisure=sports_centre': 'Recreation',
  'leisure=swimming_pool': 'Recreation',
  'amenity=employment_agency': 'Employment',
}

const args = process.argv.slice(2)
const flag = (name, dflt = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? (args[i + 1] ?? true) : dflt
}
const DRY_RUN = args.includes('--dry-run')
const CITY = String(flag('city', 'toronto')).toLowerCase()
const LIMIT = Number(flag('limit', 500))

if (!CITIES[CITY]) {
  console.error(`Unknown city "${CITY}". Known: ${Object.keys(CITIES).join(', ')}`)
  process.exit(1)
}

/** Load credentials the same way the rest of the repo does. */
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
loadEnv()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Overpass publishes how many query slots you may use. Honour it rather
 * than retrying into a rate limit: this is a free service run for
 * everyone and hammering it is how access gets withdrawn.
 */
async function waitForSlot() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(STATUS, { headers: { 'User-Agent': UA } })
    const text = await res.text()
    if (/\d+ slots available now/.test(text)) {
      const n = Number(text.match(/(\d+) slots available now/)[1])
      if (n > 0) return
    }
    const waits = [...text.matchAll(/in (\d+) seconds/g)].map((m) => Number(m[1]))
    const wait = waits.length ? Math.min(...waits) + 1 : 15
    console.log(`  no slot free, waiting ${wait}s`)
    await sleep(wait * 1000)
  }
  throw new Error('Overpass stayed busy; try again later.')
}

function buildQuery([s, w, n, e]) {
  const amenities = 'library|community_centre|social_facility|clinic|doctors|hospital|school|college|university|kindergarten|employment_agency'
  const healthcare = 'psychotherapist|occupational_therapist|speech_therapist|counselling'
  const leisure = 'park|playground|sports_centre|swimming_pool'
  const bbox = `${s},${w},${n},${e}`
  return `[out:json][timeout:180];
(
  node["amenity"~"^(${amenities})$"](${bbox});
  way["amenity"~"^(${amenities})$"](${bbox});
  node["healthcare"~"^(${healthcare})$"](${bbox});
  way["healthcare"~"^(${healthcare})$"](${bbox});
  node["leisure"~"^(${leisure})$"](${bbox});
  way["leisure"~"^(${leisure})$"](${bbox});
);
out tags center;`
}

function categoryFor(tags) {
  for (const key of ['healthcare', 'amenity', 'leisure']) {
    const v = tags[key]
    if (v && CATEGORY_MAP[`${key}=${v}`]) return CATEGORY_MAP[`${key}=${v}`]
  }
  return null
}

/**
 * Turn one OSM element into a resource row.
 *
 * Note what is absent: no barrier_scores, no accessibility rating, no
 * description implying suitability. Where a wheelchair tag exists it is
 * restated as the plain fact it is, attributed to the mapper, and where
 * it does not exist nothing is said.
 */
function toResource(el) {
  const tags = el.tags || {}
  const name = (tags.name || '').trim()
  if (!name) return null
  const category = categoryFor(tags)
  if (!category) return null

  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')

  const facts = []
  if (tags.wheelchair === 'yes') facts.push('Mapped as step-free by an OpenStreetMap contributor.')
  else if (tags.wheelchair === 'limited') facts.push('Mapped as partially step-free by an OpenStreetMap contributor.')
  else if (tags.wheelchair === 'no') facts.push('Mapped as not step-free by an OpenStreetMap contributor.')
  if (tags['toilets:wheelchair'] === 'yes') facts.push('Accessible toilet mapped.')
  if (tags.opening_hours) facts.push(`Hours listed as: ${tags.opening_hours}.`)
  facts.push('Imported from OpenStreetMap. Nobody has reviewed what it is like inside yet.')

  return {
    name: name.slice(0, 200),
    description: facts.join(' ').slice(0, 900),
    category,
    location: {
      address: street || null,
      city: tags['addr:city'] || null,
      province: tags['addr:state'] || tags['addr:province'] || null,
      postal_code: tags['addr:postcode'] || null,
      lat, lng,
    },
    contact_info: {
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      email: tags.email || tags['contact:email'] || null,
    },
    // Human review before anything reaches the public directory.
    status: 'pending',
    source_type: 'openstreetmap',
    source_ref: `osm:${el.type}/${el.id}`,
    source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    source_attribution: ATTRIBUTION,
    last_verified_at: new Date().toISOString(),
    is_first_party: false,
  }
}

async function main() {
  console.log(`OpenStreetMap import: ${CITY}${DRY_RUN ? ' (dry run)' : ''}`)
  console.log(`Attribution: ${ATTRIBUTION}\n`)

  await waitForSlot()
  const query = buildQuery(CITIES[CITY])
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  })
  if (!res.ok) throw new Error(`Overpass returned ${res.status}`)
  const { elements = [] } = await res.json()
  console.log(`Overpass returned ${elements.length} elements`)

  const rows = []
  const seen = new Set()
  let skippedNoName = 0, skippedNoCategory = 0
  for (const el of elements) {
    const r = toResource(el)
    if (!r) {
      if (!(el.tags?.name || '').trim()) skippedNoName++
      else skippedNoCategory++
      continue
    }
    if (seen.has(r.source_ref)) continue
    seen.add(r.source_ref)
    rows.push(r)
    if (rows.length >= LIMIT) break
  }

  const byCat = rows.reduce((a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a), {})
  console.log(`\nusable: ${rows.length}`)
  console.log(`skipped: ${skippedNoName} unnamed, ${skippedNoCategory} no category match`)
  console.log('by category:', byCat)
  console.log('\nsample:')
  for (const r of rows.slice(0, 3)) {
    console.log(`  ${r.name} [${r.category}] ${r.location.address || 'no address'} -> ${r.source_url}`)
  }

  if (DRY_RUN) { console.log('\nDry run, nothing written.'); return }

  const { createClient } = await import(
    path.resolve(process.cwd(), 'servicehub-mvp/node_modules/@supabase/supabase-js/dist/main/index.js')
  ).catch(() => import('@supabase/supabase-js'))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // Upsert on source_ref, so re-running refreshes rather than duplicates
  // and last_verified_at moves forward each time.
  let written = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('resources').upsert(chunk, { onConflict: 'source_ref' })
    if (error) { console.error('  batch failed:', error.message); continue }
    written += chunk.length
    process.stdout.write(`\r  written ${written}/${rows.length}`)
  }
  console.log(`\n\nDone. ${written} venues staged as pending for review.`)
}

main().catch((e) => { console.error('\nImport failed:', e.message); process.exit(1) })
