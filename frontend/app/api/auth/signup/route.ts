import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge, MIN_SIGNUP_AGE } from '@/lib/age'

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
            'You must be 18 or older to create your own account. Ask a parent or guardian to add you from their account.',
        },
        { status: 403 }
      )
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
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

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } })
  } catch (err: any) {
    console.error('Signup API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
