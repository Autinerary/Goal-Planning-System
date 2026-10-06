import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanStory, publicStory } from '@/lib/stories'

export const dynamic = 'force-dynamic'

const OPEN_LIMIT = 3

/**
 * GET /api/stories: up to three published stories for the home page, with
 * only what each teller agreed to show. Empty until a story is published
 * (public.stories, STEP 52), and empty, not an error, before STEP 52.
 *
 * POST /api/stories: share a story (signed in, 18+). It goes to the team;
 * nothing is shown until its teller approves the final version
 * (/share-your-story). At most three waiting at once per person.
 */
export async function GET() {
  try {
    const { data, error } = await createAdminClient()
      .from('stories')
      .select('id, story, final_text, role, show_role, province, show_province, display_name, name_display')
      .eq('status', 'published')
      .eq('share_site', true)
      .order('published_at', { ascending: false })
      .limit(3)
    if (error) throw error
    return NextResponse.json({ stories: (data || []).map(publicStory) }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
  } catch {
    return NextResponse.json({ stories: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(req: NextRequest) {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to share your story.' }, { status: 401 })
  const { row, error } = cleanStory(await req.json().catch(() => null))
  if (!row) return NextResponse.json({ error }, { status: 400 })
  const admin = createAdminClient()
  const { count } = await admin.from('stories').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).in('status', ['submitted', 'awaiting_approval'])
  if ((count || 0) >= OPEN_LIMIT) {
    return NextResponse.json({ error: 'You have three stories with the team already. Please wait until they have been looked at.' }, { status: 429 })
  }
  const { data, error: insertError } = await admin.from('stories').insert({ ...row, user_id: user.id }).select('id').single()
  if (insertError) return NextResponse.json({ error: 'Your story could not be saved just now. Please try again later.' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
