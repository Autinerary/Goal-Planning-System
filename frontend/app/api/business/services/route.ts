import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_CATEGORIES } from '@/lib/shop/taxonomy'
import { step81Missing, usableEmail } from '@/lib/listings'

export const dynamic = 'force-dynamic'

/**
 * POST /api/business/services { name, category, description, address, city, province, phone, email, website, cost, delivery }
 *
 * The products round's planning note, Goal 10: "Do the same for service
 * providers & their services offered". A provider adds a service they offer;
 * it waits for the team (ResourceHub's admin Requests, "Services providers
 * added"), and once approved it is in ResourceHub and theirs to manage.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: account, error: accountError } = await supabase.from('resource_accounts').select('kind, organization').eq('user_id', user.id).maybeSingle()
  if (accountError) return NextResponse.json({ error: step81Missing(accountError) ? 'Resource Accounts open soon.' : 'Could not check your account.' }, { status: 503 })
  if (!account || account.kind !== 'service_provider') return NextResponse.json({ error: 'Make a Resource Account as a service provider first.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const name = String(b?.name || '').trim().slice(0, 200)
  const category = SERVICE_CATEGORIES.includes(b?.category) ? b.category : null
  const description = String(b?.description || '').trim().slice(0, 900)
  if (name.length < 2 || !category || description.length < 20) return NextResponse.json({ error: 'Give its name, its kind, and a sentence or two about it.' }, { status: 400 })
  let website: string | null = null
  if (b?.website) {
    try {
      const u = new URL(String(b.website).trim())
      website = /^https?:$/.test(u.protocol) ? u.toString().slice(0, 300) : null
    } catch {}
    if (!website) return NextResponse.json({ error: 'The website doesn’t look right.' }, { status: 400 })
  }
  const province = /^[A-Z]{2}$/.test(String(b?.province || '')) ? b.province : null
  const admin = createAdminClient()
  const { data: resource, error } = await admin
    .from('resources')
    .insert({
      name,
      category,
      description,
      location: { address: String(b?.address || '').trim().slice(0, 300) || null, city: String(b?.city || '').trim().slice(0, 100) || null, province, country: 'Canada', lat: null, lng: null },
      contact_info: { phone: String(b?.phone || '').trim().slice(0, 40) || null, email: usableEmail(b?.email), website },
      cost_type: b?.cost === 'free' || b?.cost === 'paid' ? b.cost : null,
      cost_source: b?.cost === 'free' || b?.cost === 'paid' ? 'listed' : null,
      delivery: ['in_person', 'online', 'both'].includes(b?.delivery) ? b.delivery : null,
      status: 'pending',
      submitted_by: user.id,
      source_type: 'operator',
      source_attribution: `From ${account.organization}`,
    })
    .select('id')
    .single()
  if (error || !resource) return NextResponse.json({ error: 'Could not add that.' }, { status: 500 })
  await admin.from('listing_claims').insert({ user_id: user.id, item_kind: 'resource', item_id: resource.id, method: 'review', evidence: `Added from their Resource Account (${account.organization})`, status: 'pending' })
  return NextResponse.json({ id: resource.id, status: 'pending' }, { status: 201 })
}
