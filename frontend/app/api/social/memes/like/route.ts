import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE, socialError, socialReady } from '@/lib/social'

export const dynamic = 'force-dynamic'

/** POST /api/social/memes/like { id, like }: like or unlike a meme you can see. */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a meme.' }, { status: 400 })
  if (!(await socialReady(supabase))) return NextResponse.json({ error: 'This isn’t switched on yet.' }, { status: 503 })
  const { error } = body?.like === false
    ? await supabase.from('meme_likes').delete().eq('meme_id', id).eq('user_id', user.id)
    : await supabase.from('meme_likes').upsert({ meme_id: id, user_id: user.id }, { onConflict: 'meme_id,user_id', ignoreDuplicates: true })
  if (error) {
    const e = socialError(error, 'That could not be saved.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  const { data } = await supabase.from('memes').select('likes').eq('id', id).maybeSingle()
  return NextResponse.json({ id, liked: body?.like !== false, likes: (data as { likes?: number } | null)?.likes ?? 0 })
}
