import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** GET /api/stories/mine: the signed-in person's own stories and where each is. */
export async function GET() {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!user) return NextResponse.json({ stories: [] }, { status: 401 })
  const { data, error } = await createAdminClient()
    .from('stories')
    .select('id, story, final_text, status, created_at, share_site, share_social, name_display, display_name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ stories: [], unavailable: true })
  return NextResponse.json({ stories: data || [] })
}
