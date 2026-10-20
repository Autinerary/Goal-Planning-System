import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { peopleByIds } from '@/lib/social'
import { alike, goalsOf } from '@/lib/sameGoals'

export const dynamic = 'force-dynamic'

/**
 * GET /api/social/same-goals
 *
 * "Person's Icon @ Goal: see who's going for the same goals" (Hare World):
 * for each of your goals, your people working on one like it. Read with your
 * own session, so only people who share their path with you count (STEP 87:
 * journey_visible). Goals are alike when they share at least half their words
 * (ignoring small ones), or one contains the other.
 */

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: conns } = await supabase
    .from('social_connections')
    .select('owner_id, target_user_id')
    .in('status', ['connected', 'matched'])
    .or(`owner_id.eq.${user.id},target_user_id.eq.${user.id}`)
  const ids = Array.from(new Set((conns || []).map((c: any) => (c.owner_id === user.id ? c.target_user_id : c.owner_id)).filter(Boolean))) as string[]

  const { data: paths } = await supabase
    .from('user_paths')
    .select('user_id, payload, is_active, updated_at')
    .in('user_id', [user.id, ...ids])
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
  // Each person's active (or newest) plan.
  const plan = new Map<string, any>()
  for (const p of (paths || []) as any[]) if (!plan.has(p.user_id)) plan.set(p.user_id, p.payload)
  const mine = goalsOf(plan.get(user.id))
  if (!mine.length || !ids.length) return NextResponse.json({ goals: mine.map((g) => ({ goal: g, people: [] })) })

  const people = await peopleByIds(supabase, ids.filter((id) => plan.has(id)))
  const goals = mine.map((goal) => ({
    goal,
    people: ids
      .filter((id) => plan.has(id))
      .map((id) => {
        const theirs = goalsOf(plan.get(id)).find((g) => alike(goal, g))
        return theirs ? { id, name: people[id]?.name || 'Someone', icon: people[id]?.icon || '🙂', avatar_url: people[id]?.avatar_url || null, their_goal: theirs } : null
      })
      .filter(Boolean),
  }))
  return NextResponse.json({ goals })
}
