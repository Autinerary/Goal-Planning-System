import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge, MIN_SIGNUP_AGE } from '@/lib/age'
import { TERMS_VERSION } from '@/lib/legal'
import { TEEN_REQUESTS_ON } from '@/lib/trustedAdult'
import { emailEnabled, sendEmail, trustedAdultRequestEmail } from '@/lib/email'

/**
 * Someone under 18 asks a trusted adult (STEP 84): the account is made
 * locked, and the adult, who must already have an adult account, is emailed
 * to review it. Nothing more is kept until they approve. Only when the team
 * has turned it on (NEXT_PUBLIC_TEEN_REQUESTS).
 */
async function teenRequest(input: { email: string; password: string; name: string; dateOfBirth: string; adultEmail: string }, origin: string) {
  const admin = createAdminClient()
  // The adult: an account with this email, 18 or older, not itself a child's account.
  const { data: adultProfile } = await admin.from('profiles').select('id, date_of_birth, managed_by_guardian').eq('email', input.adultEmail).maybeSingle()
  const adultAge = computeAge(adultProfile?.date_of_birth || null)
  const sent = NextResponse.json({
    requested: true,
    message: 'Thank you. If that email belongs to an adult with an Autinerary account, we have asked them to approve you. You can sign in once they do. If they don’t have an account yet, ask them to make one, then try again.',
  })
  if (!adultProfile || adultAge === null || adultAge < MIN_SIGNUP_AGE || adultProfile.managed_by_guardian) return sent

  const { data: created, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    ban_duration: '876000h',
    app_metadata: {
      managed_by_guardian: true,
      guardian_id: adultProfile.id,
      date_of_birth: input.dateOfBirth,
      guardian_approval: { state: 'pending', requested_by: 'child', attestation_version: '2026-10-19' },
    },
    user_metadata: { name: input.name || null, full_name: input.name || null, date_of_birth: input.dateOfBirth, managed_by_guardian: true, guardian_id: adultProfile.id },
  })
  if (error) {
    if (error.message?.includes('already been registered')) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    return NextResponse.json({ error: 'That didn’t work. Please try again.' }, { status: 400 })
  }
  const { error: requestError } = await admin.from('guardian_requests').insert({ child_id: created.user.id, adult_id: adultProfile.id })
  if (requestError) return NextResponse.json({ error: 'Your account was made but the request could not be sent. Please contact us.' }, { status: 503 })
  await admin.from('profiles').upsert({ id: created.user.id, email: input.email, date_of_birth: input.dateOfBirth, managed_by_guardian: true }, { onConflict: 'id' }).then(() => {}, () => {})
  if (emailEnabled()) {
    const { data: adult } = await admin.auth.admin.getUserById(adultProfile.id)
    if (adult?.user?.email) {
      const { subject, html, text } = trustedAdultRequestEmail(input.name, `${origin}/family`)
      await sendEmail({ to: adult.user.email, subject, html, text, idempotencyKey: `guardian-request-${created.user.id}` }).catch(() => null)
    }
  }
  return sent
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, dateOfBirth, trustedAdultEmail } = await req.json()
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
    if (age < MIN_SIGNUP_AGE && TEEN_REQUESTS_ON && typeof trustedAdultEmail === 'string' && trustedAdultEmail.trim()) {
      const adultEmail = trustedAdultEmail.trim().toLowerCase()
      if (adultEmail === normalizedEmail) return NextResponse.json({ error: 'Your trusted adult needs their own email address.' }, { status: 400 })
      const origin = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
      return teenRequest({ email: normalizedEmail, password, name: typeof name === 'string' ? name.trim().slice(0, 100) : '', dateOfBirth, adultEmail }, origin)
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
