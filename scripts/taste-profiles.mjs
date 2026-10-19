#!/usr/bin/env node
/**
 * Taste profiles (the products round's planning note, v1.5: "UNSUPERVISED
 * LEARNING groups of profiles for tastes & textures! Mix of Goal 3 & 4 + the
 * intersecting norms, using unsupervised learning to identify profiles").
 *
 * Reads what people said they like and avoid (STEP 82's sensory_preferences)
 * and their norms (user_barriers), and groups them with k-means: each person
 * is a vector (+1 for a quality they like, -1 for one they avoid, 0.5 for each
 * of their norms). Only groups of 10 or more are kept, and each is described
 * by what most of its people like and avoid; nobody is ever named. Each run
 * makes new groups (ids run*100+n), so a profile is always from the latest
 * run; older groups stay as history.
 *
 *   node scripts/taste-profiles.mjs            # check only: prints the groups
 *   node scripts/taste-profiles.mjs --apply    # saves them
 *
 * Needs at least 20 people who answered. The qualities are
 * servicehub-mvp/lib/shop/taste.ts's TASTE_QUALITIES.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const APPLY = process.argv.includes('--apply')
const MIN_PEOPLE = 20
const MIN_GROUP = 10

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

const taste = fs.readFileSync(path.join(ROOT, 'servicehub-mvp/lib/shop/taste.ts'), 'utf8')
const QUALITIES = [...taste.slice(taste.indexOf('TASTE_QUALITIES'), taste.indexOf('] as const')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'servicehub-mvp/lib/shop/taxonomy.json'), 'utf8'))
const LABEL = Object.fromEntries(taxonomy.qualities.map((q) => [q.id, q.label.toLowerCase()]))

// A small seeded random, so a run can be repeated.
let seed = 42
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

const dist = (a, b) => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0)

function kmeans(points, k, iterations = 60) {
  // k-means++ start.
  const centres = [points[Math.floor(rand() * points.length)]]
  while (centres.length < k) {
    const d = points.map((p) => Math.min(...centres.map((c) => dist(p, c))))
    const total = d.reduce((s, x) => s + x, 0)
    let r = rand() * total
    let i = 0
    while (r > d[i] && i < d.length - 1) r -= d[i++]
    centres.push(points[i])
  }
  let assign = new Array(points.length).fill(0)
  for (let it = 0; it < iterations; it++) {
    const next = points.map((p) => centres.reduce((best, c, j) => (dist(p, c) < dist(p, centres[best]) ? j : best), 0))
    const moved = next.some((x, i) => x !== assign[i])
    assign = next
    for (let j = 0; j < k; j++) {
      const members = points.filter((_, i) => assign[i] === j)
      if (members.length) centres[j] = members[0].map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length)
    }
    if (!moved) break
  }
  const inertia = points.reduce((s, p, i) => s + dist(p, centres[assign[i]]), 0)
  return { centres, assign, inertia }
}

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const get = async (q) => {
    const r = await fetch(`${url}/rest/v1/${q}`, { headers: H })
    if (!r.ok) throw new Error(`${q}: ${r.status} ${await r.text()}`)
    return r.json()
  }
  const prefs = (await get('sensory_preferences?select=user_id,likes,avoids&limit=10000')).filter((p) => (p.likes?.length || 0) + (p.avoids?.length || 0) >= 2)
  console.log(`${prefs.length} people have said what they like and avoid (at least two answers).`)
  if (prefs.length < MIN_PEOPLE) {
    console.log(`Not enough yet: taste profiles need at least ${MIN_PEOPLE} people, in groups of ${MIN_GROUP} or more. Nothing changed.`)
    return
  }
  const barriers = await get(`user_barriers?select=user_id,barrier_type&limit=50000`)
  const normsOf = new Map()
  for (const b of barriers) normsOf.set(b.user_id, [...(normsOf.get(b.user_id) || []), String(b.barrier_type || '').toLowerCase()])
  const normCounts = new Map()
  for (const p of prefs) for (const n of new Set(normsOf.get(p.user_id) || [])) normCounts.set(n, (normCounts.get(n) || 0) + 1)
  const NORMS = [...normCounts.entries()].filter(([, c]) => c >= 3).map(([n]) => n)
  const vectors = prefs.map((p) => [
    ...QUALITIES.map((q) => ((p.likes || []).includes(q) ? 1 : (p.avoids || []).includes(q) ? -1 : 0)),
    ...NORMS.map((n) => ((normsOf.get(p.user_id) || []).includes(n) ? 0.5 : 0)),
  ])
  const k = Math.max(2, Math.min(8, Math.round(Math.sqrt(prefs.length / 2))))
  let best = null
  for (let restart = 0; restart < 8; restart++) {
    const run = kmeans(vectors, k)
    if (!best || run.inertia < best.inertia) best = run
  }
  const groups = []
  for (let j = 0; j < k; j++) {
    const members = prefs.filter((_, i) => best.assign[i] === j)
    if (members.length < MIN_GROUP) continue
    const share = (fn) => members.filter(fn).length / members.length
    const likes = QUALITIES.filter((q) => share((m) => (m.likes || []).includes(q)) >= 0.5).slice(0, 4)
    const avoids = QUALITIES.filter((q) => share((m) => (m.avoids || []).includes(q)) >= 0.5).slice(0, 3)
    const norm = NORMS.find((n) => share((m) => (normsOf.get(m.user_id) || []).includes(n)) >= 0.5)
    const label = [likes.length ? `Likes ${likes.map((q) => LABEL[q]).join(', ')}` : 'Mixed likes', avoids.length ? `avoids ${avoids.map((q) => LABEL[q]).join(', ')}` : ''].filter(Boolean).join('; ') + (norm ? ` (many share ${norm})` : '')
    groups.push({ j, members, likes, avoids, label })
  }
  console.log(`k = ${k}; ${groups.length} groups of ${MIN_GROUP} or more:`)
  for (const g of groups) console.log(`  ${g.members.length} people: ${g.label}`)
  if (!APPLY) {
    console.log('\nCheck only; run with --apply to save.')
    return
  }
  const last = await get('taste_profile_groups?select=id&order=id.desc&limit=1')
  const run = Math.floor((last[0]?.id || 0) / 100) + 1
  const rows = groups.map((g, n) => ({ id: run * 100 + n + 1, label: g.label.slice(0, 200), top_likes: g.likes, top_avoids: g.avoids, size: g.members.length }))
  const save = async (table, body, onConflict) => {
    const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`)
  }
  await save('taste_profile_groups', rows, 'id')
  const assignments = groups.flatMap((g, n) => g.members.map((m) => ({ user_id: m.user_id, group_id: run * 100 + n + 1, computed_at: new Date().toISOString() })))
  for (let i = 0; i < assignments.length; i += 500) await save('taste_profiles', assignments.slice(i, i + 500), 'user_id')
  console.log(`\nSaved run ${run}: ${rows.length} groups, ${assignments.length} people placed.`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
