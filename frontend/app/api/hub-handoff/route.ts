import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * POST /api/hub-handoff: a one-time code that signs the signed-in person in
 * to ResourceHub (servicehub-mvp/app/auth/handoff), so they are never asked
 * to sign in a second time (Riipen Labs, Group 22: "a second sign in at
 * Resource Hub before anything can be saved"; Group 24: "Synchronize session
 * state between Autinerary and ResourceHub to eliminate secondary login").
 *
 * The two apps share one Supabase project but not cookies (different
 * domains). The hand-off used to put the person's access and refresh tokens
 * in the link itself, where browser history and request logs keep them, and a
 * refresh token works until it is rotated. Now the server asks Supabase for a
 * one-time sign-in code (admin generateLink, which sends no email): it works
 * once, expires (the project's email OTP expiry), and ResourceHub's server
 * exchanges it for its own session straight away. Only for the signed-in
 * person's own account; nothing is logged.
 */
export async function POST(req: NextRequest) {
  // Same-origin only (the /go/servicehub page).
  const origin = req.headers.get('origin')
  if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: 'Not allowed' }, { status: 403, headers: NO_STORE })

  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ tokenHash: null }, { headers: NO_STORE })
  try {
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: user.email })
    const tokenHash = data?.properties?.hashed_token
    if (error || !tokenHash) return NextResponse.json({ tokenHash: null }, { headers: NO_STORE })
    return NextResponse.json({ tokenHash }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ tokenHash: null }, { headers: NO_STORE })
  }
}
