import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge, MIN_SIGNUP_AGE } from '@/lib/age'
import { clientIp, rateLimited, TOO_MANY_MESSAGE } from '@/lib/rateLimit'

// Accounts made from one address: a basic limit so a script can't make
// accounts in bulk or test which emails already have one (bug audit,
// 17 November 2026). Per server instance (lib/rateLimit.ts).
const PER_10_MINUTES = 5
const PER_DAY = 20

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, dateOfBirth } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // 18+ gate — same rule as Goal Planning. A minor cannot create their own
    // account; a parent/guardian adds them from their account instead.
    const age = computeAge(dateOfBirth)
    if (age === null) {
      return NextResponse.json({ error: 'Please enter your date of birth.' }, { status: 400 })
    }
    if (age < MIN_SIGNUP_AGE) {
      return NextResponse.json(
        {
          error:
            'You must be 18 or older to create your own account. Ask a parent or guardian to add you from their account.',
        },
        { status: 403 }
      )
    }

    // Counted only for tries that would make an account, so a mistyped date
    // of birth doesn't use one up.
    const ip = clientIp(req.headers)
    if (rateLimited('signup-10m', ip, PER_10_MINUTES, 10 * 60_000) || rateLimited('signup-day', ip, PER_DAY, 24 * 60 * 60_000)) {
      return NextResponse.json({ error: TOO_MANY_MESSAGE }, { status: 429 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || null, date_of_birth: dateOfBirth },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } })
  } catch (err: any) {
    console.error('Signup API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
