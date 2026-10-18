import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge, MIN_SIGNUP_AGE } from '@/lib/age'
import { TERMS_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/complete-profile  { dateOfBirth: 'YYYY-MM-DD' }
 *
 * Adds a date of birth to a signed-in account that has none: new Google
 * accounts (Google does not share it) and accounts made before the 18+ rule.
 * Stored where /api/auth/signup puts it (app_metadata, which only the server
 * can write and the backend checks, plus user_metadata and profiles).
 * Under 18: nothing is stored, and the answer is the same as at sign-up.
 * A date of birth that is already set cannot be changed here.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const dateOfBirth = typeof body?.dateOfBirth === 'string' ? body.dateOfBirth : ''

  if (user.app_metadata?.date_of_birth) {
    return NextResponse.json({ error: 'Your date of birth is already saved.' }, { status: 409 })
  }
  const age = computeAge(dateOfBirth)
  if (age === null) return NextResponse.json({ error: 'Please enter your date of birth.' }, { status: 400 })
  if (age < MIN_SIGNUP_AGE) {
    return NextResponse.json(
      {
        error: 'under_age',
        message: 'Sorry, Autinerary is only for people 18 or older right now. A parent or legal guardian can add you from their own account, on their Family page.',
      },
      { status: 403 }
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { date_of_birth: dateOfBirth },
    user_metadata: { date_of_birth: dateOfBirth },
  })
  if (error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })

  try {
    await admin.from('profiles').upsert({ id: user.id, email: user.email, date_of_birth: dateOfBirth }, { onConflict: 'id' })
  } catch {
    /* non-fatal, as at sign-up */
  }
  // The terms, agreed to by continuing (STEP 79; nothing before the table exists).
  await admin.from('terms_acceptances').upsert({ user_id: user.id, version: TERMS_VERSION, via: 'signup' }, { onConflict: 'user_id,version', ignoreDuplicates: true })
  return NextResponse.json({ ok: true })
}
