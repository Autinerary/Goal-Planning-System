/**
 * Mass-generate synthetic user profiles for starter insights.
 *
 * These are NOT real users — they let us explore intersecting profiles
 * (e.g. "autistic parents", "young adults with OCD", "seniors with ADHD")
 * before we have enough real data, so we can form early assumptions and later
 * verify them against real usage. Each synthetic profile writes:
 *   - an auth.users row (required — profiles.id is a FK to auth.users)
 *   - profiles row (flagged is_synthetic + preferences JSON)
 *   - user_barriers rows
 *
 * Because it uses the Supabase Admin API to create auth users, it MUST run with
 * the service-role key (never the anon key).
 *
 * Usage:
 *   npx tsx scripts/generate-synthetic-profiles.ts            # default 100
 *   npx tsx scripts/generate-synthetic-profiles.ts --count 250
 *   npx tsx scripts/generate-synthetic-profiles.ts --dry      # preview only
 *   npx tsx scripts/generate-synthetic-profiles.ts --purge    # delete synthetic rows
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (auto-loaded
 * from .env.local / .env, same as the other scripts).
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── env loading (zero-dependency, matches backfill-geocode.ts) ──
function loadEnvFile(file: string) {
  try {
    const text = readFileSync(join(process.cwd(), file), 'utf8')
    for (const raw of text.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    /* missing file is fine */
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── args ──
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const PURGE = args.includes('--purge')
const countIdx = args.indexOf('--count')
const COUNT = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) || 100 : 100

// ── option pools (kept in sync with the app's onboarding + preferences) ──
const AGE_RANGES = ['18-40', '40-65', '65+'] as const
const TECH_SAVVY = ['not_at_all', 'somewhat', 'always'] as const
const VIEW_PREFS = ['plain', 'pretty', 'exciting', 'fun'] as const
const PINWHEEL_SIDES = ['left', 'right'] as const
const CONNECTIONS = ['self', 'parent', 'sibling', 'educator', 'employer', 'ally'] as const

const BARRIERS: { category: string; type: string }[] = [
  { category: 'neurodivergence', type: 'autism' },
  { category: 'neurodivergence', type: 'ADHD' },
  { category: 'neurodivergence', type: 'OCD' },
  { category: 'neurodivergence', type: 'dyslexia' },
  { category: 'mental_health', type: 'anxiety' },
  { category: 'mental_health', type: 'depression' },
  { category: 'disability', type: 'chronic_illness' },
  { category: 'socioeconomic', type: 'low_income' },
  { category: 'language', type: 'esl' },
]

const CITIES = [
  { city: 'Toronto', province: 'ON', country: 'Canada' },
  { city: 'Vancouver', province: 'BC', country: 'Canada' },
  { city: 'Calgary', province: 'AB', country: 'Canada' },
  { city: 'Montreal', province: 'QC', country: 'Canada' },
  { city: 'Ottawa', province: 'ON', country: 'Canada' },
]

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const pickN = <T,>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0])
  }
  return out
}

// Bias so tech savvy trends down with age — makes intersecting insights realistic.
function techForAge(age: string): (typeof TECH_SAVVY)[number] {
  if (age === '65+') return pick(['not_at_all', 'not_at_all', 'somewhat'] as const)
  if (age === '40-65') return pick(['somewhat', 'somewhat', 'always'] as const)
  return pick(['always', 'always', 'somewhat'] as const)
}

interface Synthetic {
  id: string
  email: string
  age: string
  barriers: { category: string; type: string }[]
  preferences: Record<string, unknown>
}

function buildProfile(i: number): Synthetic {
  const age = pick(AGE_RANGES)
  const barriers = pickN(BARRIERS, 1 + Math.floor(Math.random() * 2))
  const view = pick(VIEW_PREFS)
  return {
    id: randomUUID(),
    email: `synthetic+${Date.now()}_${i}@autinerary.dev`,
    age,
    barriers,
    preferences: {
      ageRange: age,
      techSavvy: techForAge(age),
      viewPreference: view,
      connection: pick(CONNECTIONS),
      layout: { pinwheelSide: pick(PINWHEEL_SIDES), widgetSize: 'medium', accent: 'cyan' },
      synthetic: true,
    },
  }
}

async function purge() {
  console.log('\nPurging synthetic profiles…')
  // Find synthetic profiles first so we can also remove their auth users.
  const { data: rows, error: selErr } = await supabase
    .from('profiles')
    .select('id')
    .like('email', 'synthetic+%@autinerary.dev')
  if (selErr) {
    console.error('Purge lookup failed:', selErr.message)
    return
  }
  const ids = (rows || []).map((r) => r.id)
  // Delete profile rows (barriers cascade via FK).
  if (ids.length) {
    await supabase.from('profiles').delete().in('id', ids)
    // Delete the backing auth users too.
    for (const id of ids) {
      await supabase.auth.admin.deleteUser(id).catch(() => {})
    }
  }
  console.log(`Deleted ${ids.length} synthetic profiles (and auth users).\n`)
}

/**
 * Create a real auth user for a synthetic profile so the profiles FK to
 * auth.users is satisfied. Returns the auth user id, or null on failure.
 */
async function createAuthUser(email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomUUID(), // random, unused — these accounts aren't logged into
    user_metadata: { synthetic: true },
  })
  if (error || !data?.user) {
    console.error(`auth user create failed for ${email}:`, error?.message)
    return null
  }
  return data.user.id
}

async function main() {
  if (PURGE) {
    await purge()
    return
  }

  console.log(`\nGenerating ${COUNT} synthetic profiles${DRY ? ' (DRY RUN)' : ''}…\n`)
  const profiles = Array.from({ length: COUNT }, (_, i) => buildProfile(i))

  // Quick distribution preview for sanity + starter insight.
  const byAge: Record<string, number> = {}
  const byBarrier: Record<string, number> = {}
  for (const p of profiles) {
    byAge[p.age] = (byAge[p.age] || 0) + 1
    for (const b of p.barriers) byBarrier[b.type] = (byBarrier[b.type] || 0) + 1
  }
  console.log('Age distribution:', byAge)
  console.log('Barrier distribution:', byBarrier, '\n')

  if (DRY) {
    console.log('Dry run — nothing written. Sample profile:')
    console.log(JSON.stringify(profiles[0], null, 2))
    return
  }

  let ok = 0
  for (const p of profiles) {
    // profiles.id has a FK to auth.users — create the auth user first and use
    // its id so the insert satisfies the constraint.
    const authId = await createAuthUser(p.email)
    if (!authId) continue
    p.id = authId

    const { error: pErr } = await supabase.from('profiles').upsert(
      {
        id: p.id,
        email: p.email,
        is_synthetic: true,
        preferences: p.preferences,
        location: pick(CITIES),
      },
      { onConflict: 'id' }
    )
    if (pErr) {
      // is_synthetic column may not exist yet — retry without it.
      const { error: retryErr } = await supabase.from('profiles').upsert(
        { id: p.id, email: p.email, preferences: p.preferences, location: pick(CITIES) },
        { onConflict: 'id' }
      )
      if (retryErr) {
        console.error(`profile ${p.id} failed:`, retryErr.message)
        // Roll back the orphaned auth user so reruns stay clean.
        await supabase.auth.admin.deleteUser(p.id).catch(() => {})
        continue
      }
    }
    const rows = p.barriers.map((b) => ({
      user_id: p.id,
      barrier_category: b.category,
      barrier_type: b.type,
      severity: 1 + Math.floor(Math.random() * 5),
    }))
    await supabase.from('user_barriers').insert(rows)
    ok++
    if (ok % 25 === 0) console.log(`  …${ok}/${COUNT}`)
  }
  console.log(`\nDone. Created ${ok} synthetic profiles. Purge later with --purge.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
