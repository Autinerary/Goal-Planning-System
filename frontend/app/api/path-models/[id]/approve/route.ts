import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/path-models/[id]/approve  → { action: 'approve' | 'reject' }
 *
 * Moderates a community-submitted model. Gated to admins: the caller's email
 * must be in ADMIN_EMAILS (comma-separated). Writes with the service-role client
 * (bypasses RLS). Without ADMIN_EMAILS set, no one can approve via the API and
 * moderation is DB-only.
 */
function isAdmin(email: string | undefined | null): boolean {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return !!email && list.includes(email.toLowerCase())
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (ctx.params?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let action = 'approve'
  try {
    const body = await req.json()
    if (body?.action === 'reject') action = 'reject'
  } catch {
    /* default approve */
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('path_models')
    .update({ status: action === 'reject' ? 'rejected' : 'approved' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: action === 'reject' ? 'rejected' : 'approved' })
}
