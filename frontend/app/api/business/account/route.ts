import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { step81Missing, usableEmail } from '@/lib/listings'

export const dynamic = 'force-dynamic'

/**
 * GET  /api/business/account  the signed-in person's Resource Account
 * POST /api/business/account { kind, organization, role_title, website, contact_email, phone }
 * (the planning note's Goal 11: a Service Provider or Product Vendor; STEP 81).
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data, error } = await supabase.from('resource_accounts').select('kind, organization, role_title, website, contact_email, phone').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ account: null, open: !step81Missing(error) })
  return NextResponse.json({ account: data, open: true, email: user.email })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const kind = b?.kind === 'product_vendor' ? 'product_vendor' : b?.kind === 'service_provider' ? 'service_provider' : null
  const organization = typeof b?.organization === 'string' ? b.organization.trim().slice(0, 200) : ''
  if (!kind || !organization) return NextResponse.json({ error: 'Choose what you are, and give your organization’s name.' }, { status: 400 })
  const contact = b?.contact_email ? usableEmail(b.contact_email) : null
  if (b?.contact_email && !contact) return NextResponse.json({ error: 'That email doesn’t look right.' }, { status: 400 })
  const row = {
    user_id: user.id,
    kind,
    organization,
    role_title: typeof b?.role_title === 'string' ? b.role_title.trim().slice(0, 120) || null : null,
    website: typeof b?.website === 'string' ? b.website.trim().slice(0, 300) || null : null,
    contact_email: contact,
    phone: typeof b?.phone === 'string' ? b.phone.trim().slice(0, 40) || null : null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('resource_accounts').upsert(row, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: step81Missing(error) ? 'Resource Accounts open soon.' : 'Could not save that.' }, { status: step81Missing(error) ? 503 : 500 })
  return NextResponse.json({ ok: true })
}
