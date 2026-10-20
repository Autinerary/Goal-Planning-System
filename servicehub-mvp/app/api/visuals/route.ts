/**
 * /api/visuals — Visuals: real art by the people who made it (the team's
 * notes, October 2026: "Add new category beside services, shop & tidbits:
 * Visuals. People can add their real art here. No to AI-generated art or
 * visuals"; STEP 86).
 *
 *   GET                 the approved artworks, newest first (?norm= narrows)
 *   GET ?mine=1         the signed-in artist's own, with where each stands
 *   GET ?review=1       everything waiting, for the team (admins only)
 *   POST                share one: waits for the team's review
 *
 * Before STEP 86 there is no table, and the page says Visuals opens soon.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/admin'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, title, description, alt_text, image_url, medium, credit, norms, status, created_at, reviewed_at'
const NORM_IDS = new Set(NORM_GROUPS.flatMap((g) => g.norms.map((n) => n.id)))
const missingTable = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /visuals/.test(e.message || '')))
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const p = request.nextUrl.searchParams
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase.from('visuals').select(COLUMNS).order('created_at', { ascending: false }).limit(120)
  if (p.get('mine') === '1') {
    if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
    query = query.eq('artist_id', user.id)
  } else if (p.get('review') === '1') {
    if (!user || !(await isAdminUser(supabase))) return NextResponse.json({ error: 'For the team' }, { status: 403 })
    query = query.eq('status', 'pending').order('created_at', { ascending: true })
  } else {
    query = query.eq('status', 'approved')
    const norm = p.get('norm')
    if (norm && NORM_IDS.has(norm)) query = query.contains('norms', [norm])
  }
  const { data, error } = await query
  if (missingTable(error)) return NextResponse.json({ ready: false, visuals: [] })
  if (error) return NextResponse.json({ error: 'Couldn’t load Visuals' }, { status: 500 })
  return NextResponse.json({ ready: true, visuals: data || [] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to share your art' }, { status: 401 })
  let b: any
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const title = clean(b?.title, 120)
  const alt = clean(b?.alt_text, 400)
  const description = typeof b?.description === 'string' ? b.description.trim().slice(0, 1000) : ''
  const medium = clean(b?.medium, 80)
  const credit = clean(b?.credit, 80)
  const norms = Array.isArray(b?.norms) ? Array.from(new Set(b.norms.filter((n: unknown) => typeof n === 'string' && NORM_IDS.has(n)))).slice(0, 12) : []
  const imageUrl = typeof b?.image_url === 'string' ? b.image_url : ''
  // Only an image this person uploaded through /api/visuals/upload.
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/resource-images/visuals/${user.id}/`
  if (!imageUrl.startsWith(base) || /[?#]/.test(imageUrl)) return NextResponse.json({ error: 'Upload your image first' }, { status: 400 })
  if (title.length < 2) return NextResponse.json({ error: 'Give it a title' }, { status: 400 })
  if (alt.length < 5) return NextResponse.json({ error: 'Describe what it shows, for people who can’t see it (at least a few words)' }, { status: 400 })
  if (b?.made_by_me !== true || b?.not_ai !== true) {
    return NextResponse.json({ error: 'Visuals is for art you made yourself, without AI. Tick both to share it.' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('visuals')
    .insert({
      artist_id: user.id,
      title,
      description: description || null,
      alt_text: alt,
      image_url: imageUrl,
      medium: medium || null,
      credit: credit || null,
      norms,
      made_by_me: true,
      not_ai: true,
      status: 'pending',
    })
    .select('id')
    .single()
  if (missingTable(error)) return NextResponse.json({ error: 'Visuals opens soon' }, { status: 503 })
  if (error) {
    console.error('[visuals] save failed:', error.message)
    return NextResponse.json({ error: 'That didn’t save. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
