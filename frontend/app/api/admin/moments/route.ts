import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE, peopleByIds } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * The team's review of Hare World Social (STEP 87; admins only, is_admin):
 * moments shared with everyone, waiting to be shown, and moments hidden by
 * reports.
 *
 * GET                              both lists, with their photos and videos
 * PATCH { id, action: 'approve' | 'reject' | 'unhide' | 'hide' }
 */
async function team() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { supabase, error: NextResponse.json({ error: 'Team only.' }, { status: 403 }) }
  return { supabase, error: null }
}

export async function GET() {
  const { supabase, error: denied } = await team()
  if (denied) return denied
  const cols = 'id, user_id, kind, title, caption, media_path, media_type, visibility, review_status, report_count, hidden, created_at'
  const [waiting, reported] = await Promise.all([
    supabase.from('moments').select(cols).eq('visibility', 'everyone').eq('review_status', 'pending').eq('hidden', false).order('created_at', { ascending: true }).limit(100),
    supabase.from('moments').select(cols).or('hidden.eq.true,report_count.gt.0').order('created_at', { ascending: false }).limit(100),
  ])
  if (waiting.error) {
    if (step64Missing(waiting.error)) return NextResponse.json({ available: false, waiting: [], reported: [] })
    return NextResponse.json({ error: 'Could not load.' }, { status: 500 })
  }
  const rows = [...(waiting.data || []), ...(reported.data || [])]
  const paths = rows.map((r: any) => r.media_path).filter(Boolean)
  const [signed, people, reasons] = await Promise.all([
    paths.length ? supabase.storage.from('moments').createSignedUrls(paths, 3600) : Promise.resolve({ data: [] as any[] }),
    peopleByIds(supabase, rows.map((r: any) => r.user_id)),
    rows.length ? supabase.from('moment_reports').select('moment_id, reason, created_at, resolved_at').in('moment_id', rows.map((r: any) => r.id)) : Promise.resolve({ data: [] as any[] }),
  ])
  const urls = new Map(((signed as any).data || []).map((s: any) => [s.path, s.signedUrl]))
  const why = new Map<string, string[]>()
  for (const r of ((reasons as any).data || []) as any[]) if (!r.resolved_at) why.set(r.moment_id, [...(why.get(r.moment_id) || []), r.reason || '(no reason given)'])
  const shape = (r: any) => ({ ...r, media_url: r.media_path ? urls.get(r.media_path) || null : null, by: people[r.user_id] || null, reasons: why.get(r.id) || [] })
  return NextResponse.json({ available: true, waiting: (waiting.data || []).map(shape), reported: (reported.data || []).map(shape) })
}

export async function PATCH(req: NextRequest) {
  const { supabase, error: denied } = await team()
  if (denied) return denied
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  const action = body?.action
  if (!id || !['approve', 'reject', 'unhide', 'hide'].includes(action)) return NextResponse.json({ error: 'Choose a moment and what to do.' }, { status: 400 })
  const update =
    action === 'approve' ? { review_status: 'approved' } :
    action === 'reject' ? { review_status: 'rejected' } :
    action === 'unhide' ? { hidden: false } : { hidden: true }
  const { data, error } = await supabase.from('moments').update(update).eq('id', id).select('id, review_status, hidden')
  if (error || !data?.length) return NextResponse.json({ error: 'That didn’t save.' }, { status: 500 })
  // Unhiding settles its reports.
  if (action === 'unhide') await supabase.from('moment_reports').update({ resolved_at: new Date().toISOString() }).eq('moment_id', id).is('resolved_at', null)
  return NextResponse.json(data[0])
}
