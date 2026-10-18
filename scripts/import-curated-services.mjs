#!/usr/bin/env node
/**
 * Services found and checked by hand (or by research agents, checked on each
 * service's own website), for ResourceHub: the team's planning note, October
 * 2026, Goal 1 — funding resources, services for people new to the country or
 * city, therapy for kindergarten-age children, resources for siblings,
 * mentorship, tutoring and events at universities and colleges and for
 * neurodivergent people, and the services the team named.
 *
 * Reads scripts/data/services/<topic>.json:
 *   {"topic", "checked", "entries": [{slug, name, website, description,
 *    category, tags, cost, cost_note, delivery, country, province, city,
 *    address, phone, email, currency?, price?, usual_cost?, age_ranges,
 *    evidence, notes}]}
 *
 * cost is what the page says (free, paid or unknown), and price the amount it
 * lists. When it says nothing, usual_cost (checked by hand) or the category
 * gives what that kind of service usually costs, and the listing says so.
 *
 * Each website is fetched again before saving, and one that does not load is
 * left out (one that answers with a robot check, or Facebook's sign-in, loads
 * for people and is kept). Tags and age ranges outside ResourceHub's vocabularies are
 * dropped. A street address is placed on the map with OpenStreetMap's
 * Nominatim (one request a second); without one there is no map point, and
 * search lists the service after places near the person. Rows are approved
 * (checked operator listings, like backend/scripts/add_support_organisations.py),
 * source_type 'operator', and each topic is its own batch (import_batch
 * curated-<topic>-2026-10), so Spot Guides can see and, if needed, hide it.
 * Safe to re-run: rows are matched on source_ref, and a service ResourceHub
 * already has from elsewhere with the same website is left out.
 *
 *   node scripts/import-curated-services.mjs [topic ...]           # check only
 *   node scripts/import-curated-services.mjs --apply [topic ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'scripts/data/services')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const NOMINATIM_UA = 'Autinerary-ResourceHub/1.0 (+https://autinerary.ca; accessibility service directory)'
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const ONLY = args.filter((a) => !a.startsWith('--'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ResourceHub's vocabularies, read from its source so the two cannot drift.
const tagsSrc = fs.readFileSync(path.join(ROOT, 'servicehub-mvp/lib/filters/tags.ts'), 'utf8')
const TAGS = new Set([
  ...[...tagsSrc.matchAll(/id: '([a-z0-9_]+)'/g)].map((m) => m[1]),
  ...[...tagsSrc.matchAll(/\['([a-z0-9_]+)', '[^']+'\]/g)].map((m) => `domain_${m[1]}`),
])
const AGES = new Set(['babies_0_4', 'children_5_8', 'preteens_9_12', 'teens_13_17', 'young_adults_18_30', 'adults_30_45', 'adults_45_65', 'seniors_65_plus'])
// What each kind of service usually costs when the page does not say.
const USUALLY_FREE = new Set(['Funding & Benefits', 'Newcomer Services', 'Education Support', 'Support Group', 'Legal & Future Planning', 'Social Services', 'Employment'])
const CURRENCY = { canada: 'CAD', jamaica: 'JMD', 'united states': 'USD', usa: 'USD' }

function loadEnv() {
  for (const f of ['backend/.env', 'servicehub-mvp/.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

// 'yes', or why a site that answers turns a script away but loads for people
// (a robot check, Facebook without signing in), or null when it is gone.
async function loads(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) })
      if (res.status < 400) return 'yes'
      if (res.headers.get('cf-mitigated') === 'challenge') return 'checks for robots'
      if (res.status === 400 && /(^|\.)facebook\.com$/.test(new URL(res.url).hostname)) return 'needs a sign-in'
      if (method === 'GET') return null
    } catch (e) {
      // A browser fetches a missing middle certificate itself; Node does not,
      // and curl, with the system's certificates, does.
      if (/CERT|SIGNATURE|ISSUER/.test(e?.cause?.code || '')) return viaCurl(url)
      if (method === 'GET') return null
    }
  }
  return null
}

function viaCurl(url) {
  try {
    const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-L', '--max-time', '25', '-A', UA, url]).toString()
    return Number(code) > 0 && Number(code) < 400 ? 'yes' : null
  } catch {
    return null
  }
}

async function geocode(address, city, province, country) {
  const q = new URLSearchParams({ q: [address, city, province, country].filter(Boolean).join(', '), format: 'json', limit: '1' })
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { 'User-Agent': NOMINATIM_UA } })
    const hits = await res.json()
    await sleep(1100)
    return hits?.[0] ? { lat: Number(hits[0].lat), lng: Number(hits[0].lon) } : null
  } catch {
    return null
  }
}

async function supabaseClient() {
  const pkgRoot = path.join(ROOT, 'servicehub-mvp/node_modules/@supabase/supabase-js/dist')
  let createClient
  for (const entry of ['index.mjs', 'index.cjs', 'main/index.js']) {
    try {
      ;({ createClient } = await import(path.join(pkgRoot, entry)))
      break
    } catch {}
  }
  if (!createClient) throw new Error('Could not load @supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function main() {
  loadEnv()
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && (!ONLY.length || ONLY.includes(f.replace(/\.json$/, ''))))
  const rows = []
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
    const topic = data.topic || file.replace(/\.json$/, '')
    let kept = 0, dropped = 0
    for (const e of data.entries || []) {
      if (!e?.name || !/^https?:\/\//.test(e?.website || '') || !e?.slug) { dropped++; continue }
      const site = await loads(e.website)
      if (!site) { console.log(`  ${topic}: site did not load, left out: ${e.name}`); dropped++; continue }
      if (site !== 'yes') console.log(`  ${topic}: kept, the site ${site} (it loaded for the check on ${data.checked}): ${e.name}`)
      const country = e.country || 'Canada'
      const point = e.address ? await geocode(e.address, e.city, e.province, country) : null
      const known = e.cost === 'free' || e.cost === 'paid'
      const usual = e.usual_cost === 'free' || e.usual_cost === 'paid' ? e.usual_cost : USUALLY_FREE.has(e.category) ? 'free' : 'paid'
      rows.push({
        name: String(e.name).slice(0, 200),
        description: String(e.description || '').slice(0, 900),
        category: e.category || 'Social Services',
        location: { address: e.address || null, city: e.city || null, province: e.province || null, postal_code: null, country, lat: point?.lat ?? null, lng: point?.lng ?? null },
        contact_info: { phone: e.phone || null, email: e.email || null, website: e.website },
        tags: [...new Set((e.tags || []).filter((t) => TAGS.has(t)))],
        age_ranges: [...new Set((e.age_ranges || []).filter((a) => AGES.has(a)))],
        cost_type: known ? e.cost : usual,
        cost_source: known ? 'listed' : 'usual',
        price: known && e.cost === 'paid' && typeof e.price === 'number' && e.price > 0 ? e.price : null,
        currency: e.currency || CURRENCY[String(country).toLowerCase()] || 'CAD',
        delivery: ['in_person', 'online', 'both'].includes(e.delivery) ? e.delivery : null,
        status: 'approved',
        source_type: 'operator',
        source_ref: `operator:${topic}-${e.slug}`.slice(0, 200),
        source_url: e.website,
        source_attribution: `From ${e.institution || e.name}'s website`,
        last_verified_at: new Date(data.checked || Date.now()).toISOString(),
        is_first_party: false,
        import_batch: `curated-${topic.replace(/_/g, '-')}-2026-10`,
      })
      kept++
    }
    console.log(`${topic}: ${kept} ready${dropped ? `, ${dropped} left out` : ''}`)
  }
  if (!APPLY) {
    console.log(`\n${rows.length} ready. Check only; run with --apply to save.`)
    return
  }
  const supabase = await supabaseClient()
  // A service already in ResourceHub from somewhere else (another list, or
  // OpenStreetMap) with the same website is left out, so nobody sees it twice.
  const norm = (u) => {
    try {
      const x = new URL(u)
      return `${x.hostname.toLowerCase().replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '').toLowerCase()}`
    } catch {
      return String(u || '').toLowerCase()
    }
  }
  const hosts = [...new Set(rows.map((r) => { try { return new URL(r.source_url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' } }).filter(Boolean))]
  const taken = new Map()
  for (const host of hosts) {
    const { data } = await supabase.from('resources').select('source_ref, contact_info').ilike('contact_info->>website', `%${host.replace(/[\\%_]/g, (c) => `\\${c}`)}%`).limit(100)
    for (const r of data || []) if (r.contact_info?.website) taken.set(norm(r.contact_info.website), r.source_ref || 'another listing')
  }
  const fresh = rows.filter((r) => {
    const other = taken.get(norm(r.source_url))
    if (other && other !== r.source_ref) {
      console.log(`  left out, already in ResourceHub (${other}): ${r.name}`)
      return false
    }
    return true
  })
  rows.length = 0
  rows.push(...fresh)
  let saved = 0
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabase.from('resources').upsert(rows.slice(i, i + 200), { onConflict: 'source_ref' }).select('id')
    if (error) { console.error('  failed:', error.message); continue }
    saved += (data || []).length
  }
  console.log(`\nSaved ${saved} services.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
