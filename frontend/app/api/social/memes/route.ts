import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE, peopleByIds, socialError, socialMissing, socialReady } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * Memes for your connections (Riipen Labs, Group 34; STEP 66): an emoji or a
 * few words, with a caption. The feed is yours and your connections' (the
 * ones a meme was shared with); the database decides.
 *
 * GET                    the feed, newest first
 * POST { content, content_type: 'emoji' | 'text', caption?, shared_with? }
 * DELETE { id }          delete one of yours
 */

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await socialReady(supabase))) return NextResponse.json({ available: false, memes: [] })
  const { data, error } = await supabase.from('memes').select('id, user_id, content_type, content, caption, likes, created_at').order('created_at', { ascending: false }).limit(50)
  if (error) {
    if (socialMissing(error)) return NextResponse.json({ available: false, memes: [] })
    return NextResponse.json({ error: 'The memes could not be loaded.' }, { status: 500 })
  }
  const rows = (data || []) as { id: string; user_id: string; content_type: string; content: string; caption: string | null; likes: number; created_at: string }[]
  const [people, liked] = await Promise.all([
    peopleByIds(supabase, rows.map((r) => r.user_id)),
    rows.length
      ? supabase.from('meme_likes').select('meme_id').eq('user_id', user.id).in('meme_id', rows.map((r) => r.id))
      : Promise.resolve({ data: [] as { meme_id: string }[] }),
  ])
  const likedIds = new Set(((liked as any).data || []).map((l: { meme_id: string }) => l.meme_id))
  return NextResponse.json({
    available: true,
    memes: rows.map((r) => ({
      id: r.id,
      by: people[r.user_id],
      mine: r.user_id === user.id,
      content_type: r.content_type,
      content: r.content,
      caption: r.caption,
      likes: r.likes || 0,
      liked: likedIds.has(r.id),
      created_at: r.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!(await socialReady(supabase))) return NextResponse.json({ error: 'This isn’t switched on yet.' }, { status: 503 })
  const shared = Array.isArray(body?.shared_with) ? body.shared_with.filter((id: unknown) => typeof id === 'string' && UUID_RE.test(id)).slice(0, 50) : []
  const { data, error } = await supabase
    .from('memes')
    .insert({
      user_id: user.id,
      content_type: body?.content_type === 'emoji' ? 'emoji' : 'text',
      content: typeof body?.content === 'string' ? body.content : '',
      caption: typeof body?.caption === 'string' ? body.caption : null,
      shared_with: shared,
    })
    .select('id')
    .single()
  if (error) {
    const e = socialError(error, 'Your meme could not be shared. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a meme.' }, { status: 400 })
  const { data, error } = await supabase.from('memes').delete().eq('id', id).eq('user_id', user.id).select('id')
  if (error) {
    const e = socialError(error, 'That meme could not be deleted.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  if (!data?.length) return NextResponse.json({ error: 'That meme couldn’t be found.' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
