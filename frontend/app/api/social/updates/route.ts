import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { connectedPeople } from '@/lib/social'
import { milestoneNames } from '@/lib/pathMilestones'

export const dynamic = 'force-dynamic'

/**
 * GET /api/social/updates: steps your people finished in the last 30 days,
 * newest first (Riipen Labs, Group 34: rival notifications were always empty;
 * these are updates, not a contest). Connected people could always read each
 * other's progress and path; this only gathers it. Needs no migration.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const people = await connectedPeople(supabase, user.id)
  if (!people.length) return NextResponse.json({ updates: [], people: 0 })
  const byId = new Map(people.map((p) => [p.id, p]))
  const since = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: progress, error } = await supabase
    .from('race_progress')
    .select('user_id, milestone_id, completed_at')
    .in('user_id', people.map((p) => p.id))
    .eq('kind', 'completed')
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: 'Updates could not be loaded.' }, { status: 500 })
  const rows = (progress || []) as { user_id: string; milestone_id: string; completed_at: string }[]

  // Each person's active path, for the names of the steps.
  const ids = Array.from(new Set(rows.map((r) => r.user_id)))
  const names = new Map<string, Map<string, string>>()
  await Promise.all(ids.map(async (id) => {
    const { data } = await supabase
      .from('user_paths')
      .select('payload')
      .eq('user_id', id)
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    names.set(id, milestoneNames((data as { payload?: unknown } | null)?.payload))
  }))

  return NextResponse.json({
    people: people.length,
    updates: rows.map((r) => ({
      person: byId.get(r.user_id),
      step: names.get(r.user_id)?.get(r.milestone_id) || null,
      completed_at: r.completed_at,
    })),
  })
}
