import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activePathRow, planMilestones, planTools } from '@/lib/activePath'
import { cleanEdits, resourceIdOf, visibleTools } from '@/lib/milestoneTools'
import { localServices, studies, type PersonPlace } from '@/lib/moreTools'
import { hubPool } from '@/lib/hubPool'
import { howToRequest, isPlace } from '@/lib/requests'
import { SIGNUP_ON } from '@/lib/signups'
import { userFrom } from '@/lib/signupServer'

export const dynamic = 'force-dynamic'

/**
 * Services near the person for one step of their plan (lib/moreTools.ts
 * localServices; the account holder's choice, 26 October 2026), shown under
 * the step's own tools in the task view with Send my request:
 *   GET ?milestone=<id>  ->  { services: [{ id, name, category, city, province }], place }
 * Their province (from their profile) or national ones; never a student-only
 * service unless their plan says they study; for themselves, never one only
 * for children or teens (for their child, never one only for adults); only
 * ones a request can reach; never one already among the step's tools. Off
 * unless one-click sign-up is on.
 */
export async function GET(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ services: [] }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const milestoneId = String(req.nextUrl.searchParams.get('milestone') || '').slice(0, 200)

  const admin = createAdminClient()
  const row = await activePathRow(admin, user.id)
  if (!row) return NextResponse.json({ error: 'No plan yet.', services: [] }, { status: 404 })
  const milestone = planMilestones(row.payload).find((m) => m.id === milestoneId)
  if (!milestone) return NextResponse.json({ error: 'That step isn’t in your plan.', services: [] }, { status: 404 })

  const shown = visibleTools(planTools(row.payload, milestoneId), cleanEdits(row.payload.toolEdits?.[milestoneId]))
  const exclude = new Set(shown.map(resourceIdOf).filter((x): x is string => !!x))
  const { data: profile } = await admin.from('profiles').select('location, preferences').eq('id', user.id).maybeSingle()
  const place = profile?.location && typeof profile.location === 'object' ? (profile.location as PersonPlace) : null
  // For whom ("Who are you here for?", lib/audiences.ts): themselves (an adult: Sign me up is 18+), or their child.
  const audience = (profile?.preferences as Record<string, unknown> | null)?.audience
  const forWhom = audience === 'child' ? 'child' : audience === 'self' || !audience ? 'adult' : null
  const up = (row.payload.userProfile || {}) as Record<string, unknown>
  const student = studies(JSON.stringify([up.goals, up.dreams, up.demographics, up.currentChallenges, up.supportContext]))
  const norms = Array.isArray(up.barrierTypes) ? (up.barrierTypes as string[]) : []

  const { pool, ratings } = await hubPool(admin)
  const rows = localServices(pool, milestone, {
    place, student, forWhom, exclude, norms, ratings, limit: 3,
    reachable: (r) => !isPlace(r.category) && howToRequest(r) !== 'none',
  })
  return NextResponse.json({
    services: rows.map((r) => ({ id: r.id, name: r.name, category: r.category, city: r.location?.city || null, province: r.location?.province || null })),
    place: place ? { city: place.city || null, province: place.province || null } : null,
  })
}
