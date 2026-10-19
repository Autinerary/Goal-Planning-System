#!/usr/bin/env node
/**
 * Support for parents (the 5Qs report, October 2026: "SHUB - PARENT SUPPORT
 * SYSTEMS tag"; lib/filters/tags.ts's parent_support: support groups,
 * coaching, respite or advice for parents and caregivers). Adds the tag to
 * the listings already in ResourceHub that scripts/data/services/*.json now
 * marks with it, and changes nothing else: no other field, no new listing.
 * Rows are found by source_ref, as import-curated-services.mjs saved them.
 *
 *   node scripts/tag-parent-support.mjs            # check only: what would change
 *   node scripts/tag-parent-support.mjs --apply
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'scripts/data/services')
const APPLY = process.argv.includes('--apply')

function loadEnv() {
  for (const f of ['servicehub-mvp/.env.local', 'frontend/.env.local', 'backend/.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

loadEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (servicehub-mvp/.env.local)')
const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

const refs = []
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  const topic = d.topic || f.replace(/\.json$/, '')
  for (const e of d.entries) if ((e.tags || []).includes('parent_support')) refs.push({ ref: `operator:${topic}-${e.slug}`.slice(0, 200), name: e.name })
}

let missing = 0
let changed = 0
let already = 0
for (let i = 0; i < refs.length; i += 40) {
  const batch = refs.slice(i, i + 40)
  const list = batch.map((r) => `"${r.ref.replace(/"/g, '\\"')}"`).join(',')
  const res = await fetch(`${url}/rest/v1/resources?select=id,source_ref,tags&source_ref=in.(${encodeURIComponent(list)})`, { headers: H })
  if (!res.ok) throw new Error(`read: ${res.status} ${await res.text()}`)
  const rows = await res.json()
  const byRef = new Map(rows.map((r) => [r.source_ref, r]))
  for (const r of batch) {
    const row = byRef.get(r.ref)
    if (!row) {
      missing++
      continue
    }
    const tags = Array.isArray(row.tags) ? row.tags : []
    if (tags.includes('parent_support')) {
      already++
      continue
    }
    changed++
    console.log(`  ${APPLY ? 'tagging' : 'would tag'}: ${r.name}`)
    if (APPLY) {
      const p = await fetch(`${url}/rest/v1/resources?id=eq.${row.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ tags: [...tags, 'parent_support'] }) })
      if (!p.ok) throw new Error(`${r.name}: ${p.status} ${await p.text()}`)
    }
  }
}
console.log(`${refs.length} marked in the data files: ${already} already tagged, ${changed} ${APPLY ? 'tagged now' : 'to tag'}, ${missing} not in ResourceHub yet (the import adds them with the tag).`)
