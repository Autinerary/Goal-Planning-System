import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getReviewerProfiles } from '@/lib/supabase/queries'
import { containsProfanity, detectSpam } from '@/lib/agents/validation-agent/spam-detector'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX = 1000

// Before STEP 79 there is no comments table.
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /resource_comments/.test(e.message || ''))

/**
 * Comments on a service, which anyone signed in may leave at any time (the
 * team's planning note, October 2026, Goal 5: "Comment on a Service
 * (anytime)"); a rating needs experience (lib/ratings/access.ts).
 *
 * GET    /api/resources/<id>/comments          the newest 50
 * POST   /api/resources/<id>/comments { body }
 * DELETE /api/resources/<id>/comments?comment=<id>   one's own
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ comments: [] })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('resource_comments')
    .select('id, user_id, body, status, created_at')
    .eq('resource_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ comments: [], open: !missing(error) })
  const visible = (data || []).filter((c) => c.status === 'visible')
  const people = await getReviewerProfiles(visible.map((c) => c.user_id))
  return NextResponse.json({
    open: true,
    comments: visible.map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author: people.get(c.user_id)?.full_name || 'A member',
      role: people.get(c.user_id)?.role || null,
      mine: !!user && c.user_id === user.id,
    })),
  })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to comment.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  if (!text) return NextResponse.json({ error: 'Write a comment first.' }, { status: 400 })
  if (text.length > MAX) return NextResponse.json({ error: `A comment can be up to ${MAX} characters.` }, { status: 400 })
  // The checks ratings' comments get (lib/agents/validation-agent).
  if (containsProfanity(text) || detectSpam(text).isSpam) {
    return NextResponse.json({ error: 'That comment looks like spam or uses words we do not allow. Please change it.' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('resource_comments')
    .insert({ resource_id: params.id, user_id: user.id, body: text })
    .select('id, body, created_at')
    .single()
  if (error) {
    if (missing(error)) return NextResponse.json({ error: 'Comments open soon.' }, { status: 503 })
    console.error('comment failed:', error.message)
    return NextResponse.json({ error: 'Could not post that. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ comment: { ...data, mine: true } })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const id = request.nextUrl.searchParams.get('comment') || ''
  if (!UUID.test(params.id) || !UUID.test(id)) return NextResponse.json({ error: 'Which comment?' }, { status: 400 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { error } = await supabase.from('resource_comments').delete().eq('id', id).eq('user_id', user.id).eq('resource_id', params.id)
  if (error) return NextResponse.json({ error: 'Could not remove it.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
