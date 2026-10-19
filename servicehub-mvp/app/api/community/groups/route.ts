/**
 * /api/community/groups — Tidbits groups (STEP 83).
 *   GET              — every group, how many are in it, and whether you are
 *   POST { slug, join } — join (true) or leave (false) a group
 * Writing a Tidbit, even anonymously, needs a group (the Tidbits round's
 * planning note: "Must still be part of a Community Group to write an
 * article"). Who is in a group is private; only the count is shown.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCommunityServiceClient } from '@/lib/community/client'
import { step83Missing } from '@/lib/community/tidbits'

export const dynamic = 'force-dynamic'

export async function GET() {
  const client = getCommunityServiceClient()
  if (!client) return NextResponse.json({ groups: [] }, { status: 503 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: groups, error } = await client.from('community_groups').select('id, slug, name, description, member_count').order('sort_order')
  if (error) return NextResponse.json({ groups: [], open: !step83Missing(error) })
  // Your own memberships, read as you (RLS: only your own rows).
  const { data: mine } = user ? await supabase.from('community_group_members').select('group_id').eq('user_id', user.id) : { data: [] }
  const joined = new Set(((mine as any[]) ?? []).map((m) => m.group_id))
  return NextResponse.json({
    open: true,
    signedIn: !!user,
    groups: (groups ?? []).map((g) => ({ slug: g.slug, name: g.name, description: g.description, member_count: g.member_count, joined: joined.has(g.id) })),
  })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const client = getCommunityServiceClient()
  if (!client) return NextResponse.json({ error: 'Community is not configured' }, { status: 503 })
  const { data: group, error } = await client.from('community_groups').select('id, slug').eq('slug', String(body?.slug || '')).maybeSingle()
  if (error) return NextResponse.json({ error: step83Missing(error) ? 'Groups open soon.' : 'Could not do that.' }, { status: 503 })
  if (!group) return NextResponse.json({ error: 'No such group.' }, { status: 404 })
  // As the person (RLS: their own membership only).
  const { error: writeError } =
    body?.join === false
      ? await supabase.from('community_group_members').delete().eq('group_id', group.id).eq('user_id', user.id)
      : await supabase.from('community_group_members').upsert({ group_id: group.id, user_id: user.id }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
  if (writeError) {
    console.error('[community] group membership failed:', writeError.message)
    return NextResponse.json({ error: 'Could not do that.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, slug: group.slug, joined: body?.join !== false })
}
