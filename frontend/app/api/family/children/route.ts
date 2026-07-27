import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET  /api/family/children — list the children the signed-in adult supervises.
 * POST /api/family/children — create a supervised child account.
 *
 * Only an authenticated (adult) user can be a guardian. Child accounts are
 * created with the service-role admin client and linked via `guardianships`.
 */

async function requireUser() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET(_req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const { data: links, error } = await admin
    .from('guardianships')
    .select('child_id, relationship, created_at')
    .eq('guardian_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich each child with name/email/onboarding status + whether a path exists.
  const children = await Promise.all(
    (links || []).map(async (l: any) => {
      const { data: childRes } = await admin.auth.admin.getUserById(l.child_id)
      const cu = childRes?.user
      const { count } = await admin
        .from('user_paths')
        .select('path_id', { count: 'exact', head: true })
        .eq('user_id', l.child_id)
      return {
        id: l.child_id,
        relationship: l.relationship,
        name: (cu?.user_metadata?.name as string) || (cu?.user_metadata?.full_name as string) || cu?.email || 'Child',
        email: cu?.email || null,
        dateOfBirth: (cu?.user_metadata?.date_of_birth as string) || null,
        hasCompletedOnboarding: cu?.user_metadata?.has_completed_onboarding === true,
        hasPath: (count || 0) > 0,
        createdAt: l.created_at,
      }
    })
  )

  return NextResponse.json({ children })
}

export async function POST(req: NextRequest) {
  const guardian = await requireUser()
  if (!guardian) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const dateOfBirth = typeof body?.dateOfBirth === 'string' ? body.dateOfBirth : ''
  const relationship = typeof body?.relationship === 'string' && body.relationship ? body.relationship : 'parent'

  if (!name || !email || !password || !dateOfBirth) {
    return NextResponse.json({ error: 'Name, email, password and date of birth are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create the child auth user (email pre-confirmed; the guardian manages it).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      full_name: name,
      date_of_birth: dateOfBirth,
      managed_by_guardian: true,
      guardian_id: guardian.id,
    },
  })

  if (createErr) {
    if (createErr.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: createErr.message }, { status: 400 })
  }

  const childId = created.user.id

  // Link + profile + flip the guardian to the family plan (billing stub).
  const { error: linkErr } = await admin
    .from('guardianships')
    .insert({ guardian_id: guardian.id, child_id: childId, relationship })
  if (linkErr) {
    // Roll back the orphaned auth user so a retry can reuse the email.
    await admin.auth.admin.deleteUser(childId).catch(() => {})
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }

  await admin
    .from('profiles')
    .upsert({ id: childId, email, date_of_birth: dateOfBirth, managed_by_guardian: true }, { onConflict: 'id' })
    .then(() => {}, () => {})
  await admin
    .from('profiles')
    .upsert({ id: guardian.id, email: guardian.email, plan: 'family' }, { onConflict: 'id' })
    .then(() => {}, () => {})

  return NextResponse.json({ child: { id: childId, name, email } })
}
