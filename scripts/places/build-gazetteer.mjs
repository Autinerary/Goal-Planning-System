#!/usr/bin/env node
// The places ResourceHub's search understands by name ("a pool near
// Kitchener"): Ontario's cities, towns and larger villages and suburbs, and
// the bigger cities of the other provinces, each with its map point and
// population, from OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Writes servicehub-mvp/lib/search/places.json, which
// servicehub-mvp/lib/search/understand.ts reads.
//
//   node scripts/places/build-gazetteer.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const UA = 'Autinerary-ResourceHub/1.0 (+https://autinerary.ca; accessibility service directory)'
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']

// Names that are also everyday words in a search, left out (a "Spanish-
// speaking therapist" is not in Spanish, Ontario).
const LEFT_OUT = new Set(['spanish', 'marathon', 'cobalt', 'emo', 'tiny', 'king', 'hope', 'mono', 'echo bay', 'iron bridge', 'red lake', 'english', 'french', 'centre', 'downtown', 'island', 'beach', 'lakeshore', 'harbour'])

// Public servers are often busy: wait, and try the next one.
async function query(ql, attempt = 1) {
  const server = OVERPASS[(attempt - 1) % OVERPASS.length]
  let res
  try {
    res = await fetch(server, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: ql }) })
  } catch {
    res = { ok: false, status: 599 }
  }
  if (!res.ok) {
    if (res.status >= 429 && attempt < 9) { await sleep(attempt * 20000); return query(ql, attempt + 1) }
    throw new Error(`Overpass ${res.status}`)
  }
  // Out of time or memory still answers 200, with a remark: ask again.
  const json = await res.json().catch(() => ({ remark: 'error: not JSON' }))
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) {
    if (attempt < 9) { await sleep(attempt * 20000); return query(ql, attempt + 1) }
    throw new Error(`Overpass: ${json.remark}`)
  }
  return json.elements || []
}

// Each province's answer is kept while the script runs, so a failed run
// picks up where it stopped.
const CACHE = join(tmpdir(), 'autinerary-gazetteer-v2')
mkdirSync(CACHE, { recursive: true })
const places = new Map()
for (const code of PROVINCES) {
  const ontario = code === 'ON'
  const sel = ontario
    ? `node["place"~"^(city|town)$"](area.p); node["place"="village"]["population"](if: t["population"] >= 1000)(area.p); node["place"~"^(suburb|borough|city_district)$"]["wikidata"](area.p);`
    : `node["place"="city"](area.p); node["place"="town"]["population"](if: t["population"] >= 20000)(area.p);`
  // "out" with no modifier: tags and the map point.
  const ql = `[out:json][timeout:120]; area["ISO3166-2"="CA-${code}"]["admin_level"="4"]->.p; (${sel}); out;`
  const cached = join(CACHE, `${code}.json`)
  const fresh = !existsSync(cached)
  const elements = fresh ? await query(ql) : JSON.parse(readFileSync(cached, 'utf8'))
  if (fresh) writeFileSync(cached, JSON.stringify(elements))
  for (const el of elements) {
    const name = (el.tags?.['name:en'] || el.tags?.name || '').trim()
    if (!name || LEFT_OUT.has(name.toLowerCase())) continue
    const pop = Number(String(el.tags?.population || '').replace(/[^0-9]/g, '')) || 0
    const key = `${name.toLowerCase()}|${code}`
    const prev = places.get(key)
    if (prev && prev.pop >= pop) continue
    if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue
    // A city or town counts on its own in a search; a village or a district
    // only after "near", "in" or "around" (lib/search/understand.ts).
    const kind = ['city', 'town'].includes(el.tags?.place) ? 'town' : 'area'
    places.set(key, { name, province: code, lat: Math.round(el.lat * 1e4) / 1e4, lng: Math.round(el.lon * 1e4) / 1e4, pop, kind })
  }
  console.log(code, elements.length, fresh ? '' : '(kept from the last run)')
  if (fresh) await sleep(3000)
}

// French names of Ontario places are left as OpenStreetMap has them; the
// search also matches "st" and "saint" and "ste" and "sainte" alike.
const list = [...places.values()].sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name))
const out = {
  attribution: '© OpenStreetMap contributors (ODbL), built by scripts/places/build-gazetteer.mjs',
  built: new Date().toISOString().slice(0, 10),
  places: list.map((p) => [p.name, p.province, p.lat, p.lng, p.pop, p.kind]),
}
writeFileSync(join(ROOT, 'servicehub-mvp/lib/search/places.json'), JSON.stringify(out) + '\n')
console.log('wrote', list.length, 'places; Ontario', list.filter((p) => p.province === 'ON').length)
