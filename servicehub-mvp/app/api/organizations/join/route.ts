import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** POST /api/organizations/join — join an organisation with its code. */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const code = String(body?.joinCode || '').trim()
  if (!code) return NextResponse.json({ error: 'Enter a join code.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('join_code', code)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'That code is not valid.' }, { status: 404 })

  // Joining never grants leader — leaders are appointed, not self-selected.
  const { error } = await admin
    .from('organization_members')
    .upsert({ org_id: org.id, user_id: user.id, role: 'member' }, { onConflict: 'org_id,user_id' })
  if (error) {
    console.error('[org] join failed:', error.message)
    return NextResponse.json({ error: 'Could not join.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, org: { name: org.name, slug: org.slug } })
}
