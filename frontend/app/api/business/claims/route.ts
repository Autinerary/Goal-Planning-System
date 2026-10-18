import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, listingClaimCodeEmail, sendEmail } from '@/lib/email'
import { claimCodeHash, CODE_MINUTES, isItemKind, maskEmail, newClaimCode, step81Missing, usableEmail } from '@/lib/listings'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MINUTE = 60_000
const DAY = 86_400_000

/**
 * GET  /api/business/claims  the person's claims, with each listing's name
 * POST /api/business/claims { kind, id, method: 'email_code' | 'review', evidence }
 *
 * A claim is checked by a six-digit code sent to the email the listing
 * publishes (only its hash is kept), or by the team (ResourceHub's admin
 * Requests) from what the person writes. Sign-up doesn't confirm email
 * addresses, so an account's own email proves nothing. Limits: a code every
 * 10 minutes, three a day per person and listing, and three people a day
 * per listing, so nobody can flood a service's inbox.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data, error } = await supabase
    .from('listing_claims')
    .select('id, item_kind, item_id, method, code_sent_to, code_expires_at, status, created_at, verified_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ claims: [], open: !step81Missing(error) })
  const admin = createAdminClient()
  const ids = (k: string) => (data || []).filter((c) => c.item_kind === k).map((c) => c.item_id)
  const [{ data: rs }, { data: ps }] = await Promise.all([
    ids('resource').length ? admin.from('resources').select('id, name').in('id', ids('resource')) : Promise.resolve({ data: [] as any[] }),
    ids('product').length ? admin.from('products').select('id, name').in('id', ids('product')) : Promise.resolve({ data: [] as any[] }),
  ])
  const names = new Map([...(rs || []), ...(ps || [])].map((r: any) => [r.id, r.name]))
  return NextResponse.json({
    open: true,
    claims: (data || []).map((c) => ({ ...c, code_sent_to: c.code_sent_to ? maskEmail(c.code_sent_to) : null, name: names.get(c.item_id) || 'A listing' })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const kind = b?.kind
  const id = String(b?.id || '')
  const method = b?.method === 'review' ? 'review' : 'email_code'
  if (!isItemKind(kind) || !UUID.test(id)) return NextResponse.json({ error: 'Which listing?' }, { status: 400 })

  const { data: account, error: accountError } = await supabase.from('resource_accounts').select('organization').eq('user_id', user.id).maybeSingle()
  if (accountError) return NextResponse.json({ error: step81Missing(accountError) ? 'Resource Accounts open soon.' : 'Could not check your account.' }, { status: step81Missing(accountError) ? 503 : 500 })
  if (!account) return NextResponse.json({ error: 'Make your Resource Account first.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: item } =
    kind === 'resource'
      ? await admin.from('resources').select('id, name, contact_info, status').eq('id', id).maybeSingle()
      : await admin.from('products').select('id, name, status').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'That listing wasn’t found.' }, { status: 404 })

  const { data: owner } = await admin.from('listing_claims').select('user_id').eq('item_kind', kind).eq('item_id', id).eq('status', 'verified').maybeSingle()
  if (owner) {
    return NextResponse.json({ error: owner.user_id === user.id ? 'You already manage this listing.' : 'Someone already manages this listing. If that’s wrong, email heydevs@autinerary.ca.' }, { status: 409 })
  }

  const { data: existing } = await admin.from('listing_claims').select('id, code_sent_at, codes_sent, status').eq('item_kind', kind).eq('item_id', id).eq('user_id', user.id).maybeSingle()

  if (method === 'review') {
    const evidence = typeof b?.evidence === 'string' ? b.evidence.trim().slice(0, 1000) : ''
    if (evidence.length < 10) return NextResponse.json({ error: 'Tell the team how they can check you run it (your role, and a phone number or web page that shows it).' }, { status: 400 })
    const { error } = await admin
      .from('listing_claims')
      .upsert({ ...(existing ? { id: existing.id } : {}), user_id: user.id, item_kind: kind, item_id: id, method: 'review', evidence, status: 'pending' }, { onConflict: 'item_kind,item_id,user_id' })
    if (error) return NextResponse.json({ error: 'Could not send that.' }, { status: 500 })
    return NextResponse.json({ ok: true, method: 'review' })
  }

  const to = kind === 'resource' ? usableEmail((item as any).contact_info?.email) : null
  if (!to) return NextResponse.json({ error: 'This listing has no email to send a code to. Ask the team to check instead.', review: true }, { status: 400 })
  if (!emailEnabled()) return NextResponse.json({ error: 'Codes can’t be sent just now. Ask the team to check instead.', review: true }, { status: 503 })

  const now = Date.now()
  const sentAt = existing?.code_sent_at ? Date.parse(existing.code_sent_at) : 0
  if (sentAt > now - 10 * MINUTE) return NextResponse.json({ error: 'A code was sent a few minutes ago. Check the listing’s inbox, or try again in 10 minutes.' }, { status: 429 })
  const sentToday = sentAt > now - DAY ? existing?.codes_sent || 0 : 0
  if (sentToday >= 3) return NextResponse.json({ error: 'Three codes have been sent today. Try again tomorrow, or ask the team to check instead.', review: true }, { status: 429 })
  const { count } = await admin
    .from('listing_claims')
    .select('id', { count: 'exact', head: true })
    .eq('item_kind', kind)
    .eq('item_id', id)
    .neq('user_id', user.id)
    .gt('code_sent_at', new Date(now - DAY).toISOString())
  if ((count || 0) >= 3) return NextResponse.json({ error: 'This listing has had several requests today. Try tomorrow, or ask the team to check instead.', review: true }, { status: 429 })

  const { data: claim, error } = await admin
    .from('listing_claims')
    .upsert({ ...(existing ? { id: existing.id } : {}), user_id: user.id, item_kind: kind, item_id: id, method: 'email_code', status: 'pending' }, { onConflict: 'item_kind,item_id,user_id' })
    .select('id')
    .single()
  if (error || !claim) return NextResponse.json({ error: 'Could not start that.' }, { status: 500 })
  const code = newClaimCode()
  await admin
    .from('listing_claims')
    .update({
      code_hash: claimCodeHash(claim.id, code),
      code_sent_to: to,
      code_expires_at: new Date(now + CODE_MINUTES * MINUTE).toISOString(),
      code_sent_at: new Date(now).toISOString(),
      codes_sent: sentToday + 1,
      attempts: 0,
    })
    .eq('id', claim.id)
  const sent = await sendEmail({
    to,
    ...listingClaimCodeEmail({ listing: (item as any).name, code, askedBy: user.email ? maskEmail(user.email) : 'an Autinerary account', minutes: CODE_MINUTES }),
    idempotencyKey: `claim-${claim.id}-${now}`,
  })
  if (!sent.ok) return NextResponse.json({ error: 'The code couldn’t be sent. Ask the team to check instead.', review: true }, { status: 502 })
  return NextResponse.json({ ok: true, id: claim.id, method: 'email_code', sentTo: maskEmail(to), minutes: CODE_MINUTES })
}
