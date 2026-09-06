import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** GET /api/role-models?category=Black — approved role models, optionally filtered. */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const category = new URL(req.url).searchParams.get('category')

  let query = supabase
    .from('role_models')
    .select('id, name, bio, photo_url, categories, source_url, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (category) query = query.contains('categories', [category])

  const { data, error } = await query
  if (error) {
    console.error('[role-models GET]', error.message)
    return NextResponse.json({ roleModels: [] })
  }
  return NextResponse.json({ roleModels: data || [] })
}

/** POST — submit a role model for review. Never goes live unmoderated. */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = String(body?.name || '').trim().slice(0, 120)
  const bio = String(body?.bio || '').trim().slice(0, 2000)
  const categories = Array.isArray(body?.categories)
    ? body.categories.filter((c: unknown) => typeof c === 'string').slice(0, 8)
    : []
  const sourceUrl = typeof body?.sourceUrl === 'string' ? body.sourceUrl.trim().slice(0, 500) : null

  if (!name || bio.length < 20) {
    return NextResponse.json({ error: 'A name and at least a short bio are required.' }, { status: 400 })
  }

  const { error } = await supabase.from('role_models').insert({
    name, bio, categories, source_url: sourceUrl || null,
    submitted_by: user.id, status: 'pending',
  })
  if (error) {
    console.error('[role-models POST]', error.message)
    return NextResponse.json({ error: 'Could not submit that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status: 'pending' })
}
