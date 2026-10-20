import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE, peopleByIds } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'
import { trendingScore, type Moment, type MomentVisibility } from '@/lib/moments'
import { emailEnabled, momentReviewEmail, sendEmail } from '@/lib/email'
import { CONTACT_EMAIL } from '@/lib/contact'

export const dynamic = 'force-dynamic'

/**
 * Hare World Social (STEP 87): moments, a photo or video and a caption at the
 * end of a task or milestone.
 *
 * GET ?scope=mine        your Memories, newest first
 * GET ?scope=trending    the Reels feed: what you can see from others, most cheered lately first
 * GET ?scope=people      what your people shared, newest first
 * POST { kind, ref?, title, caption?, media_path?, media_type?, visibility? }
 * PATCH { id, caption?, visibility? }
 * DELETE { id }          the moment and its photo or video
 *
 * Who sees what is the database's (STEP 87): your people see what you share
 * with them unless you share nothing with them; everyone sees what you share
 * with everyone once the team has looked; Family accounts keep theirs private.
 * Photos and videos are in a private bucket and reach people as links that
 * last an hour, made with their own session, so they get only what they may see.
 */

const COLS = 'id, user_id, kind, ref, title, caption, media_path, media_type, visibility, review_status, cheer_count, hidden, created_at'
const VISIBILITIES: MomentVisibility[] = ['private', 'friends', 'everyone']

const HINTS: Record<string, string> = {
  private_only: 'Moments from a Family account stay private.',
}

function failure(error: { code?: string; hint?: string | null; message?: string } | null, fallback: string) {
  if (step64Missing(error)) return { status: 503, error: 'Hare World Social opens soon.' }
  if (error?.hint && HINTS[error.hint]) return { status: 400, error: HINTS[error.hint] }
  if (error?.code === '23514') return { status: 400, error: 'A moment needs a photo, a video or a few words, and a caption of at most 1000 characters.' }
  if (error?.code === '42501') return { status: 403, error: 'That isn’t yours to change.' }
  return { status: 500, error: fallback }
}

async function shape(supabase: SupabaseClient, me: string, rows: any[]): Promise<Moment[]> {
  if (!rows.length) return []
  const paths = rows.map((r) => r.media_path).filter(Boolean) as string[]
  const [signed, cheers, people] = await Promise.all([
    paths.length ? supabase.storage.from('moments').createSignedUrls(paths, 3600) : Promise.resolve({ data: [] as any[] }),
    supabase.from('moment_cheers').select('moment_id').eq('user_id', me).in('moment_id', rows.map((r) => r.id)),
    peopleByIds(supabase, rows.filter((r) => r.user_id !== me).map((r) => r.user_id)),
  ])
  const urls = new Map<string, string>()
  for (const s of ((signed as any).data || []) as { path: string | null; signedUrl: string | null }[]) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  const cheered = new Set(((cheers as any).data || []).map((c: { moment_id: string }) => c.moment_id))
  return rows.map((r) => {
    const person = r.user_id === me ? null : people[r.user_id]
    return {
      id: r.id,
      kind: r.kind,
      ref: r.ref,
      title: r.title,
      caption: r.caption,
      media_url: r.media_path ? urls.get(r.media_path) || null : null,
      media_type: r.media_type,
      visibility: r.visibility,
      review_status: r.review_status,
      hidden: r.hidden,
      cheers: r.cheer_count || 0,
      cheered: cheered.has(r.id),
      mine: r.user_id === me,
      by: person ? { id: person.id, name: person.name, icon: person.icon, avatar_url: person.avatar_url } : null,
      created_at: r.created_at,
    }
  })
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const scope = req.nextUrl.searchParams.get('scope') || 'mine'

  // Whether Hare World Social is in the database yet (STEP 87), before
  // offering "Capture this moment" or a note to future you.
  if (scope === 'check') {
    const { error } = await supabase.from('moments').select('id').eq('user_id', user.id).limit(1)
    return NextResponse.json({ available: !error || !step64Missing(error) })
  }

  if (scope === 'mine') {
    const { data, error } = await supabase.from('moments').select(COLS).eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
    if (error) {
      if (step64Missing(error)) return NextResponse.json({ available: false, moments: [] })
      return NextResponse.json({ error: 'Your memories could not be loaded.' }, { status: 500 })
    }
    return NextResponse.json({ available: true, moments: await shape(supabase, user.id, data || []) })
  }

  if (scope === 'people') {
    const { data: conns } = await supabase
      .from('social_connections')
      .select('owner_id, target_user_id')
      .in('status', ['connected', 'matched'])
      .or(`owner_id.eq.${user.id},target_user_id.eq.${user.id}`)
    const ids = Array.from(new Set((conns || []).map((c: any) => (c.owner_id === user.id ? c.target_user_id : c.owner_id)).filter(Boolean)))
    if (!ids.length) return NextResponse.json({ available: true, moments: [] })
    const { data, error } = await supabase.from('moments').select(COLS).in('user_id', ids).in('visibility', ['friends', 'everyone']).eq('hidden', false).order('created_at', { ascending: false }).limit(60)
    if (error) {
      if (step64Missing(error)) return NextResponse.json({ available: false, moments: [] })
      return NextResponse.json({ error: 'The moments could not be loaded.' }, { status: 500 })
    }
    return NextResponse.json({ available: true, moments: await shape(supabase, user.id, data || []) })
  }

  // Trending: everything you may see from others in the last 60 days, the
  // most cheered for their age first.
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('moments')
    .select(COLS)
    .neq('user_id', user.id)
    .in('visibility', ['friends', 'everyone'])
    .eq('hidden', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ available: false, moments: [] })
    return NextResponse.json({ error: 'The moments could not be loaded.' }, { status: 500 })
  }
  const now = Date.now()
  const top = (data || [])
    .map((r: any) => ({ r, score: trendingScore(r.cheer_count || 0, r.created_at, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
    .map((x) => x.r)
  return NextResponse.json({ available: true, moments: await shape(supabase, user.id, top) })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const kind = body?.kind === 'milestone' ? 'milestone' : 'task'
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const caption = typeof body?.caption === 'string' && body.caption.trim() ? body.caption.trim().slice(0, 1000) : null
  const mediaPath = typeof body?.media_path === 'string' && body.media_path.startsWith(`${user.id}/`) && body.media_path.length <= 300 ? body.media_path : null
  const mediaType = mediaPath ? (body?.media_type === 'video' ? 'video' : 'image') : null
  const visibility: MomentVisibility = VISIBILITIES.includes(body?.visibility) ? body.visibility : 'private'
  if (!title) return NextResponse.json({ error: 'Which task or milestone is it for?' }, { status: 400 })
  if (!mediaPath && !caption) return NextResponse.json({ error: 'Add a photo, a video or a few words.' }, { status: 400 })
  const { data, error } = await supabase
    .from('moments')
    .insert({
      user_id: user.id,
      kind,
      ref: typeof body?.ref === 'string' ? body.ref.slice(0, 200) : null,
      title,
      caption,
      media_path: mediaPath,
      media_type: mediaType,
      visibility,
    })
    .select('id, review_status')
    .single()
  if (error) {
    const e = failure(error, 'Your moment could not be saved. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  // Shared with everyone: tell the team it's waiting.
  if (data.review_status === 'pending' && emailEnabled()) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.autinerary.ca').replace(/\/$/, '')
    const { subject, html, text } = momentReviewEmail(`${site}/admin/moments`, 'shared')
    await sendEmail({ to: CONTACT_EMAIL, subject, html, text, idempotencyKey: `moment-shared-${data.id}` }).catch(() => null)
  }
  return NextResponse.json({ id: data.id, review_status: data.review_status }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a moment.' }, { status: 400 })
  const update: Record<string, unknown> = {}
  if (typeof body?.caption === 'string') update.caption = body.caption.trim().slice(0, 1000) || null
  if (VISIBILITIES.includes(body?.visibility)) update.visibility = body.visibility
  if (!Object.keys(update).length) return NextResponse.json({ ok: true })
  const { data, error } = await supabase.from('moments').update(update).eq('id', id).eq('user_id', user.id).select('id, visibility, review_status')
  if (error) {
    const e = failure(error, 'That change could not be saved.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  if (!data?.length) return NextResponse.json({ error: 'That moment couldn’t be found.' }, { status: 404 })
  return NextResponse.json(data[0])
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a moment.' }, { status: 400 })
  // Your own moment only; its photo or video goes with it.
  const { data, error } = await supabase.from('moments').delete().eq('id', id).eq('user_id', user.id).select('media_path')
  if (error) {
    const e = failure(error, 'That moment could not be deleted.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  if (!data?.length) return NextResponse.json({ error: 'That moment couldn’t be found.' }, { status: 404 })
  const path = data[0].media_path
  if (path) await supabase.storage.from('moments').remove([path]).catch(() => null)
  return NextResponse.json({ deleted: id })
}
