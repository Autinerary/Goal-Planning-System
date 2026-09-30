import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'

    // Try FastAPI backend login first
    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
      }
    } catch {
      /* Fall through to Supabase admin client if backend route is unavailable */
    }

    // Supabase admin fallback
    const admin = createAdminClient()
    const { data, error } = await admin.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        hasCompletedOnboarding: data.user.user_metadata?.has_completed_onboarding === true,
      },
      session: data.session,
    })
  } catch (err: any) {
    console.error('Login API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}