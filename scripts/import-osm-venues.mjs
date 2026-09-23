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
// Major Canadian metro areas, roughly ordered by population. This is the
// list "mass import" actually pulls from -- run without --city to cover
// all of them in one pass. Bounding boxes are deliberately generous (they
// overshoot into surrounding suburbs) since Overpass dedupes nothing and
// the app's own source_ref unique index is what prevents double-counting
// a venue that a box's edge clips twice.
const CITIES = {
  toronto:      [43.58, -79.64, 43.86, -79.12],
  mississauga:  [43.47, -79.82, 43.68, -79.52],
  brampton:     [43.65, -79.87, 43.79, -79.68],
  hamilton:     [43.18, -80.00, 43.34, -79.71],
  london_on:    [42.92, -81.35, 43.05, -81.14],
  kitchener:    [43.38, -80.58, 43.48, -80.40],
  windsor:      [42.26, -83.11, 42.36, -82.90],
  ottawa:       [45.25, -75.93, 45.54, -75.49],
  montreal:     [45.40, -73.98, 45.70, -73.47],
  quebec_city:  [46.72, -71.42, 46.87, -71.14],
  vancouver:    [49.20, -123.27, 49.32, -123.02],
  surrey:       [49.05, -122.90, 49.22, -122.68],
  victoria:     [48.40, -123.45, 48.52, -123.30],
  calgary:      [50.85, -114.27, 51.18, -113.85],
  edmonton:     [53.40, -113.70, 53.68, -113.30],
  winnipeg:     [49.75, -97.30, 49.98, -97.00],
  halifax:      [44.55, -63.75, 44.75, -63.45],
  saskatoon:    [52.05, -106.78, 52.20, -106.55],
  regina:       [50.38, -104.72, 50.52, -104.52],
  st_johns:     [47.50, -52.80, 47.62, -52.60],
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

const RUN_ALL = !flag('city', null)
if (!RUN_ALL && !CITIES[CITY]) {
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
  // wikidata is not read here -- it drives a separate photo-resolution
  // pass over the whole batch, added below, because it needs its own
  // batched API calls rather than one lookup per element.
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
    // These three are set explicitly on every row, not left absent for
    // resolvePhotos() to add later. Supabase's upsert() builds one INSERT
    // per batch from the UNION of keys across every object in it; a key
    // present on some rows and absent on others gets an explicit NULL for
    // the rows missing it rather than falling back to the column DEFAULT.
    // image_is_generic is NOT NULL, so the first real run of this script
    // failed every batch that contained at least one row with a resolved
    // photo (the null went to the OTHER rows in that same batch) and only
    // succeeded, by accident, on batches where no row resolved a photo at
    // all. Explicit defaults here make every batch's keys identical
    // regardless of what resolvePhotos() below does to individual rows.
    image_url: null,
    image_is_generic: false,
    image_attribution: null,
    // Carried through only so resolvePhotos() below can use it, then
    // stripped before the row is written -- it is not a resources column.
    _wikidata: tags.wikidata || null,
  }
}

/**
 * Resolve real photos for a batch of rows via Wikidata.
 *
 * OSM's own image tags are essentially unused (0.1% coverage, measured
 * against 1,440 venues in these same categories). But 9.4% of venues
 * carry a wikidata id, and 75.6% of THOSE resolve to a real photo via
 * Wikidata's P18 (image) property -- about 7% of venues overall, at
 * zero cost, always correctly licensed because Commons requires it of
 * every file it hosts.
 *
 * Rows with no wikidata id, or whose Wikidata item has no P18, are left
 * with image_url unset. That is not a gap to paper over: the app's own
 * imageOrPlaceholder() already renders a clean, honest generated tile
 * for exactly this case, and inventing a stand-in photo here would be
 * the same mistake this whole import exists to avoid.
 */
async function resolvePhotos(rows) {
  const withWikidata = rows.filter((r) => r._wikidata)
  if (withWikidata.length === 0) return { resolved: 0 }

  const ids = [...new Set(withWikidata.map((r) => r._wikidata))]
  const p18ByEntity = {}

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
      action: 'wbgetentities', ids: chunk.join('|'), props: 'claims', format: 'json',
    })
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      const data = await res.json()
      for (const [eid, ent] of Object.entries(data.entities || {})) {
        const claim = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value
        if (claim) p18ByEntity[eid] = claim // Commons filename, e.g. "Hart House Library.jpg"
      }
    } catch { /* this batch of photos is skipped, not the import */ }
    await sleep(300) // Wikidata's own courtesy: stay well under any burst limit.
  }

  let resolved = 0
  for (const row of withWikidata) {
    const filename = p18ByEntity[row._wikidata]
    if (!filename) continue

    // Commons' own imageinfo API returns both a direct, stable file URL
    // and the extmetadata a licence needs credited -- one request gets
    // the actual pixels' location and the attribution text together,
    // rather than guessing a Special:FilePath URL and a generic credit.
    const infoUrl = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', titles: `File:${filename}`, prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '800', format: 'json',
    })
    try {
      const res = await fetch(infoUrl, { headers: { 'User-Agent': UA } })
      const data = await res.json()
      const page = Object.values(data.query?.pages || {})[0]
      const info = page?.imageinfo?.[0]
      if (!info) continue

      const meta = info.extmetadata || {}
      const artist = (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim()
      const license = meta.LicenseShortName?.value || 'Wikimedia Commons'
      row.image_url = info.thumburl || info.url
      row.image_attribution = artist
        ? `${artist} via Wikimedia Commons (${license})`
        : `Wikimedia Commons (${license})`
      row.image_is_generic = false
      resolved++
    } catch { /* skip this one photo */ }
    await sleep(300)
  }
  return { resolved }
}

/**
 * Query Overpass for one city and reduce the result to usable rows.
 *
 * 504s here are the shared public instance being overloaded, not a
 * problem with the query -- a first full run showed roughly 45% of
 * cities failing this way, and they succeeded on a second attempt once
 * the instance had a moment. Worth two retries with backoff before
 * giving up on a city; not worth retrying a 4xx, which means the query
 * itself was rejected and will fail identically every time.
 */
async function fetchCity(cityKey, attempt = 1) {
  await waitForSlot()
  const query = buildQuery(CITIES[cityKey])
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  })
  if (!res.ok) {
    if (res.status >= 500 && attempt < 3) {
      const backoff = attempt * 20_000
      process.stdout.write(`(${res.status}, retrying in ${backoff / 1000}s) `)
      await sleep(backoff)
      return fetchCity(cityKey, attempt + 1)
    }
    throw new Error(`Overpass returned ${res.status} for ${cityKey}`)
  }
  const { elements = [] } = await res.json()

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
  return { elementCount: elements.length, rows, skippedNoName, skippedNoCategory }
}

/**
 * Upsert one batch of rows. Chunked so one bad row can't sink the batch.
 *
 * _wikidata is scratch space for resolvePhotos() above, not a resources
 * column -- it is stripped here rather than at the point rows are built,
 * so the same in-memory rows can still be inspected for how many photos
 * resolved before this function ever runs (see the dry-run report below).
 */
async function writeRows(supabase, rows) {
  let written = 0
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100).map(({ _wikidata, ...row }) => row)
    const { error } = await supabase.from('resources').upsert(chunk, { onConflict: 'source_ref' })
    if (error) { console.error('  batch failed:', error.message); continue }
    written += chunk.length
  }
  return written
}

async function main() {
  const targets = RUN_ALL ? Object.keys(CITIES) : [CITY]
  console.log(`OpenStreetMap import: ${RUN_ALL ? `all ${targets.length} cities` : CITY}${DRY_RUN ? ' (dry run)' : ''}`)
  console.log(`Attribution: ${ATTRIBUTION}\n`)

  let supabase = null
  if (!DRY_RUN) {
    // This script lives beside servicehub-mvp/, not inside it, so a bare
    // `import('@supabase/supabase-js')` never finds it -- Node only walks
    // node_modules directories above the IMPORTING file's own path. Import
    // by the resolved absolute path to servicehub-mvp's copy instead. The
    // .cjs vs .mjs entry point moved between package versions, so try both
    // rather than hardcoding one.
    const pkgRoot = path.resolve(process.cwd(), 'servicehub-mvp/node_modules/@supabase/supabase-js/dist')
    let createClient
    for (const entry of ['index.mjs', 'index.cjs', 'main/index.js']) {
      try {
        ({ createClient } = await import(path.join(pkgRoot, entry)))
        break
      } catch { /* try the next known entry point */ }
    }
    if (!createClient) {
      throw new Error(
        `Could not load @supabase/supabase-js from ${pkgRoot}. Run "npm install" in servicehub-mvp/ first.`
      )
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing Supabase credentials')
    supabase = createClient(url, key, { auth: { persistSession: false } })
  }

  const totals = { elements: 0, usable: 0, written: 0, withPhoto: 0, byCategory: {} }

  for (const [idx, cityKey] of targets.entries()) {
    process.stdout.write(`[${idx + 1}/${targets.length}] ${cityKey}: querying... `)
    let result
    try {
      result = await fetchCity(cityKey)
    } catch (e) {
      console.log(`FAILED (${e.message})`)
      continue
    }
    const { elementCount, rows, skippedNoName, skippedNoCategory } = result
    totals.elements += elementCount
    totals.usable += rows.length
    for (const r of rows) totals.byCategory[r.category] = (totals.byCategory[r.category] || 0) + 1

    // Run even on a dry run, so --dry-run reports an honest photo count
    // instead of always showing zero.
    const { resolved } = await resolvePhotos(rows)
    totals.withPhoto += resolved

    let written = 0
    if (!DRY_RUN && rows.length > 0) written = await writeRows(supabase, rows)
    totals.written += written

    console.log(
      `${elementCount} elements -> ${rows.length} usable ` +
      `(${skippedNoName} unnamed, ${skippedNoCategory} uncategorised, ${resolved} with a real photo)` +
      (DRY_RUN ? '' : ` -> ${written} written`)
    )

    // A short pause between cities. Overpass's slot check already throttles
    // individual requests; this just keeps a multi-city run from reading as
    // a burst against a service run for everyone, not just this app.
    if (idx < targets.length - 1) await sleep(2000)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Total: ${totals.elements} elements -> ${totals.usable} usable venues`)
  console.log(`Real photos resolved via Wikidata -> Commons: ${totals.withPhoto} ` +
    `(${totals.usable ? (100 * totals.withPhoto / totals.usable).toFixed(1) : 0}%)`)
  console.log('By category:', totals.byCategory)
  if (DRY_RUN) {
    console.log('\nDry run, nothing written.')
  } else {
    console.log(`\n${totals.written} venues staged as pending for review.`)
  }
}

main().catch((e) => { console.error('\nImport failed:', e.message); process.exit(1) })
