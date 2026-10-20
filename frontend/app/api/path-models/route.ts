import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { isLifeArea } from '@/lib/pathMarket'

/**
 * Community Path Market models.
 *
 * GET  — approved models for everyone, plus the caller's own submissions (any
 *        status) so they see their pending ones: `models`, and the same
 *        grouped by their first category (`byCategory`).
 * POST — submit a model as the signed-in user (stored 'pending').
 *
 * Since STEP 85 a model carries its categories, norms, connection type to
 * norm, races (each with its milestones), people (roles) and contributors
 * (the team's notes, October 2026). Before STEP 85 is in the database both
 * fall back to the columns it had.
 *
 * RLS on public.path_models enforces the read/insert rules; we just shape data.
 */

const BASE = 'id, category_key, name, contributor, contributor_id, description, seed_goals, status, created_at'
const LABELS = 'category_keys, norms, connection_types, races, people, contributors'

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // RLS returns approved rows to everyone and the caller's own rows when signed
  // in — one query covers both.
  let { data, error }: { data: any[] | null; error: any } = await supabase
    .from('path_models')
    .select(`${BASE}, ${LABELS}`)
    .order('created_at', { ascending: true })
  if (error) {
    ;({ data, error } = await supabase.from('path_models').select(BASE).order('created_at', { ascending: true }))
  }
  if (error) {
    // Table not migrated yet, etc. — degrade to empty so Path Market still works.
    return NextResponse.json({ models: [], byCategory: {} })
  }

  const models = (data || [])
    .filter((row: any) => row.status !== 'rejected')
    .map((row: any) => ({
      id: row.id,
      key: `community-${row.id}`,
      name: row.name,
      contributor: row.contributor || null,
      contributors: Array.isArray(row.contributors) ? row.contributors : [],
      description: row.description,
      seedGoals: Array.isArray(row.seed_goals) ? row.seed_goals : [],
      status: row.status === 'approved' ? 'live' : 'pending',
      categoryKey: row.category_key,
      categoryKeys: Array.isArray(row.category_keys) && row.category_keys.length ? row.category_keys : [row.category_key],
      norms: Array.isArray(row.norms) ? row.norms : [],
      connectionTypes: Array.isArray(row.connection_types) ? row.connection_types : [],
      races: Array.isArray(row.races) ? row.races : [],
      people: Array.isArray(row.people) ? row.people : [],
      isOwn: !!user && row.contributor_id === user.id,
      community: true,
    }))
  const byCategory: Record<string, any[]> = {}
  for (const m of models) (byCategory[m.categoryKey] ||= []).push(m)
  return NextResponse.json({ models, byCategory })
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const list = (v: unknown, maxItems: number, maxChars: number) =>
  Array.isArray(v) ? Array.from(new Set(v.map((x) => text(x, maxChars)).filter(Boolean))).slice(0, maxItems) : []

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Sign in to share a path model.' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = text(body?.name, 80)
  const description = text(body?.description, 400)
  const contributors = list(body?.contributors, 6, 80)
  const contributor = contributors[0] || text(body?.contributor, 80) || null
  const requestedKeys = list(body?.categoryKeys?.length ? body.categoryKeys : [body?.categoryKey], 6, 40)
  const norms = list(body?.norms, 12, 40)
  const connectionTypes = list(body?.connectionTypes, 6, 40)
  // Races: a name, the life category it's about, and its milestones.
  const races = (Array.isArray(body?.races) ? body.races : [])
    .map((r: any) => ({ name: text(r?.name, 120), area: isLifeArea(r?.area) ? r.area : 'other', milestones: list(r?.milestones, 12, 120) }))
    .filter((r: any) => r.name)
    .slice(0, 8)
  // People on the path, by role (never names).
  const people = (Array.isArray(body?.people) ? body.people : [])
    .map((p: any) => ({ role: text(p?.role, 60), ...(text(p?.note, 160) ? { note: text(p?.note, 160) } : {}) }))
    .filter((p: any) => p.role)
    .slice(0, 10)
  const seedGoals = races.length
    ? races.map((r: any) => r.name)
    : list(body?.seedGoals, 6, 120)

  // Validate against the DB-backed categories (not a hardcoded set) so this
  // stays correct as categories are added/edited in path_categories.
  const { data: cats } = await supabase.from('path_categories').select('key').in('key', requestedKeys.length ? requestedKeys : ['-'])
  const categoryKeys = requestedKeys.filter((k) => (cats || []).some((c: any) => c.key === k))
  if (!categoryKeys.length) {
    return NextResponse.json({ error: 'Pick at least one category.' }, { status: 400 })
  }
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: 'Give the model a name (2–60 characters).' }, { status: 400 })
  }
  if (description.length < 10 || description.length > 280) {
    return NextResponse.json({ error: 'Add a short description (10–280 characters).' }, { status: 400 })
  }
  if (seedGoals.length === 0) {
    return NextResponse.json({ error: 'Add at least one race (a goal).' }, { status: 400 })
  }

  const row = {
    category_key: categoryKeys[0],
    name,
    contributor,
    contributor_id: user.id,
    description,
    seed_goals: seedGoals,
    status: 'pending',
  }
  let { data, error } = await supabase
    .from('path_models')
    .insert({ ...row, category_keys: categoryKeys, norms, connection_types: connectionTypes, races, people, contributors: contributors.length ? contributors : contributor ? [contributor] : [] })
    .select('id')
    .single()
  if (error && /column|schema cache/i.test(error.message || '')) {
    // Before STEP 85: the model without its new labels.
    ;({ data, error } = await supabase.from('path_models').insert(row).select('id').single())
  }

  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not submit.' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
