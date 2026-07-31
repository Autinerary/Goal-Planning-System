import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Community Path Market models (Layer 3).
 *
 * GET  — approved models for everyone, plus the caller's own submissions (any
 *        status) so they see their pending ones. Grouped by category_key.
 * POST — submit a model as the signed-in user (stored 'pending').
 *
 * RLS on public.path_models enforces the read/insert rules; we just shape data.
 */

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // RLS returns approved rows to everyone and the caller's own rows when signed
  // in — one query covers both.
  const { data, error } = await supabase
    .from('path_models')
    .select('id, category_key, name, contributor, contributor_id, description, seed_goals, status, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    // Table not migrated yet, etc. — degrade to empty so Path Market still works.
    return NextResponse.json({ byCategory: {} })
  }

  const byCategory: Record<string, any[]> = {}
  for (const row of data || []) {
    const model = {
      id: row.id,
      key: `community-${row.id}`,
      name: row.name,
      contributor: row.contributor || null,
      description: row.description,
      seedGoals: Array.isArray(row.seed_goals) ? row.seed_goals : [],
      status: row.status === 'approved' ? 'live' : 'pending',
      isOwn: !!user && row.contributor_id === user.id,
      community: true,
    }
    ;(byCategory[row.category_key] ||= []).push(model)
  }

  return NextResponse.json({ byCategory })
}

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

  const categoryKey = String(body?.categoryKey || '').trim()
  const name = String(body?.name || '').trim()
  const description = String(body?.description || '').trim()
  const contributor = String(body?.contributor || '').trim() || null
  const seedGoals = Array.isArray(body?.seedGoals)
    ? body.seedGoals.map((g: any) => String(g).trim()).filter(Boolean).slice(0, 6)
    : []

  // Validate against the DB-backed categories (not a hardcoded set) so this
  // stays correct as categories are added/edited in path_categories.
  const { data: cat } = await supabase
    .from('path_categories')
    .select('key')
    .eq('key', categoryKey)
    .maybeSingle()
  if (!cat) {
    return NextResponse.json({ error: 'Pick a valid life category.' }, { status: 400 })
  }
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: 'Give the model a name (2–60 characters).' }, { status: 400 })
  }
  if (description.length < 10 || description.length > 280) {
    return NextResponse.json({ error: 'Add a short description (10–280 characters).' }, { status: 400 })
  }
  if (seedGoals.length === 0) {
    return NextResponse.json({ error: 'Add at least one starting goal.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('path_models')
    .insert({
      category_key: categoryKey,
      name,
      contributor,
      contributor_id: user.id,
      description,
      seed_goals: seedGoals,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
