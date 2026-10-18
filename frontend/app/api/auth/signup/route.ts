import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge, MIN_SIGNUP_AGE } from '@/lib/age'
import { TERMS_VERSION } from '@/lib/legal'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, dateOfBirth } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // 18+ gate. A minor cannot create their OWN account — a parent/guardian
    // adds them from an adult account (see /api/family/children). Enforced
    // server-side so it can't be bypassed by editing the client.
    const age = computeAge(typeof dateOfBirth === 'string' ? dateOfBirth : null)
    if (age === null) {
      return NextResponse.json({ error: 'Please enter your date of birth.' }, { status: 400 })
    }
    if (age < MIN_SIGNUP_AGE) {
      return NextResponse.json(
        {
          error: 'under_age',
          message:
            'Sorry, Autinerary is only for people 18 or older right now. A parent or legal guardian can add you from their own account, on their Family page.',
        },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      app_metadata: { date_of_birth: dateOfBirth },
      user_metadata: {
        full_name: name || null,
        name: name || null,
        date_of_birth: dateOfBirth,
      },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Mirror DOB onto the profiles row (best-effort; the row may only be created
    // later during onboarding, so upsert).
    try {
      await admin
        .from('profiles')
        .upsert({ id: data.user.id, email: normalizedEmail, date_of_birth: dateOfBirth }, { onConflict: 'id' })
    } catch {
      /* non-fatal */
    }

    // The terms they agreed to by creating the account (STEP 79). Before the
    // table exists this does nothing.
    const accepted = await admin.from('terms_acceptances').insert({ user_id: data.user.id, version: TERMS_VERSION, via: 'signup' })
    if (accepted.error && !/terms_acceptances/.test(accepted.error.message || '')) console.error('terms acceptance not recorded:', accepted.error.message)

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } })
  } catch (err: any) {
    console.error('Signup API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
