/**
 * /api/community/admin/flagged — what the automatic moderation asked a
 * moderator to look at (STEP 83's auto_flag on posts and answers).
 *   GET                          — the flagged posts and answers
 *   POST { kind, id, action }    — 'clear' (it's fine) or 'remove' (soft-delete)
 * Admins only (public.admin_users, checked as the caller); the change is
 * then saved by the server, since people can't write posts or answers
 * straight into the tables.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCommunityServiceClient, isCommunityAdmin } from '@/lib/community/client'
import { markdownExcerpt } from '@/lib/community/markdown'
import { step83Missing } from '@/lib/community/tidbits'

export const dynamic = 'force-dynamic'

async function admin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) }
  if (!(await isCommunityAdmin(supabase))) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }
  const client = getCommunityServiceClient()
  if (!client) return { error: NextResponse.json({ error: 'Community is not configured' }, { status: 503 }) }
  return { user, client }
}

export async function GET() {
  const a = await admin()
  if ('error' in a) return a.error
  const [posts, answers] = await Promise.all([
    a.client.from('community_posts').select('id, title, body_markdown, auto_flag_reason, created_at, kind').eq('auto_flag', 'review').eq('is_deleted', false).order('created_at', { ascending: false }).limit(50),
    a.client.from('community_answers').select('id, post_id, body_markdown, auto_flag_reason, created_at').eq('auto_flag', 'review').eq('is_deleted', false).order('created_at', { ascending: false }).limit(50),
  ])
  if (posts.error && step83Missing(posts.error)) return NextResponse.json({ items: [], open: false })
  return NextResponse.json({
    open: true,
    items: [
      ...((posts.data as any[]) ?? []).map((p) => ({ kind: 'post', id: p.id, post_id: p.id, title: p.title, excerpt: markdownExcerpt(p.body_markdown, 200), reason: p.auto_flag_reason, created_at: p.created_at })),
      ...((answers.data as any[]) ?? []).map((x) => ({ kind: 'answer', id: x.id, post_id: x.post_id, title: null, excerpt: markdownExcerpt(x.body_markdown, 200), reason: x.auto_flag_reason, created_at: x.created_at })),
    ].sort((x, y) => (x.created_at < y.created_at ? 1 : -1)),
  })
}

export async function POST(request: NextRequest) {
  const a = await admin()
  if ('error' in a) return a.error
  const body = await request.json().catch(() => ({}))
  const table = body?.kind === 'answer' ? 'community_answers' : body?.kind === 'post' ? 'community_posts' : null
  if (!table || typeof body?.id !== 'string') return NextResponse.json({ error: 'Which item?' }, { status: 400 })
  const update =
    body.action === 'remove'
      ? { auto_flag: null, auto_flag_reason: null, is_deleted: true, deleted_by: a.user.id, deleted_at: new Date().toISOString() }
      : { auto_flag: null, auto_flag_reason: null }
  const { error } = await a.client.from(table).update(update).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Could not do that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
