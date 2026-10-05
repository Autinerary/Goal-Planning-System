import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readMyProfile } from '@/lib/onboarding/profile'
import { cleanNeeds, findRole } from '@/lib/onboarding/setup'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/profile
 *
 * The signed-in person's ResourceHub profile (lib/onboarding/profile.ts),
 * plus how many places they have saved, by category: the profile page and
 * the prompts that ask for more later read it (Riipen Labs, Group 8).
 * Signed out: { signedIn: false }.
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ signedIn: false })

  const [profile, { data: saved }] = await Promise.all([
    readMyProfile(supabase, user),
    supabase.from('saved_resources').select('resource:resources(category)').eq('user_id', user.id).eq('status', 'wishlist'),
  ])
  const savedByCategory: Record<string, number> = {}
  for (const row of (saved || []) as any[]) {
    const category = row?.resource?.category
    if (typeof category === 'string' && category) savedByCategory[category] = (savedByCategory[category] || 0) + 1
  }

  return NextResponse.json({
    signedIn: true,
    ...profile,
    saved: { total: (saved || []).length, byCategory: savedByCategory },
  })
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * PATCH /api/me/profile — { role?, needs?, sharpen? }
 *
 * sharpen: 'no' never asks "sharpen your matches?" again; 'later' asks again
 * in a week. Needs and that answer are kept in the account's metadata.
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body?.role !== undefined) {
    const role = findRole(body.role)
    if (!role) return NextResponse.json({ error: 'Choose who you are here as.' }, { status: 400 })
    const { error } = await supabase
      .from('profiles')
      .update({ role: role.id, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }

  const meta: Record<string, unknown> = {}
  if (body?.needs !== undefined) meta.resourcehub_needs = cleanNeeds(body.needs)
  if (body?.sharpen === 'no') meta.resourcehub_sharpen = 'no'
  if (body?.sharpen === 'later') meta.resourcehub_sharpen = new Date(Date.now() + WEEK_MS).toISOString().slice(0, 10)
  if (Object.keys(meta).length > 0) {
    const { error } = await supabase.auth.updateUser({ data: meta })
    if (error) return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }

  const {
    data: { user: fresh },
  } = await supabase.auth.getUser()
  return NextResponse.json({ signedIn: true, ...(await readMyProfile(supabase, fresh || user)) })
}
