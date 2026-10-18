import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { cleanEmail, ipHash } from '@/lib/newsletter'
import { PETITION_ASKS, PROVINCES } from '@/lib/petition'

export const dynamic = 'force-dynamic'

const PER_HOUR = 10
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /petition/.test(e.message || ''))

/**
 * GET  /api/petition   the counts (STEP 81's petition_counts())
 * POST /api/petition { name, email, province, ask, institution, comment, showName, contactOk, website }
 *   sign #FundAutinerary: one signature per email address, and a limit on
 *   floods from one place. Written by the server (the table takes no direct
 *   writes).
 */
export async function GET() {
  const { data, error } = await createServerSupabase().rpc('petition_counts')
  if (error) return NextResponse.json({ open: !missing(error), total: 0, by_ask: {}, top: [], recent: [] })
  return NextResponse.json({ open: true, ...(data as object) })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (body?.website) return NextResponse.json({ ok: true })
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 100) : ''
  const email = cleanEmail(body?.email)
  const ask = PETITION_ASKS.some((a) => a.id === body?.ask) ? body.ask : null
  const province = PROVINCES.includes(body?.province) ? body.province : null
  const institution = typeof body?.institution === 'string' ? body.institution.trim().slice(0, 200) || null : null
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) || null : null
  if (!name) return NextResponse.json({ error: 'Add your name.' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Enter an email address, like you@example.com.' }, { status: 400 })
  if (!ask) return NextResponse.json({ error: 'Choose who you are asking.' }, { status: 400 })

  const admin = createAdminClient()
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  const where = ipHash(ip)
  if (where) {
    const since = new Date(Date.now() - 3600 * 1000).toISOString()
    const { count, error } = await admin.from('petition_signatures').select('id', { count: 'exact', head: true }).eq('ip_hash', where).gte('created_at', since)
    if (missing(error)) return NextResponse.json({ error: 'The petition opens soon.' }, { status: 503 })
    if ((count || 0) >= PER_HOUR) return NextResponse.json({ error: 'Too many signatures from here just now. Please try again later.' }, { status: 429 })
  }
  let userId: string | null = null
  try {
    const {
      data: { user },
    } = await createServerSupabase().auth.getUser()
    userId = user?.id || null
  } catch {}
  const { error } = await admin.from('petition_signatures').insert({
    name,
    email,
    email_key: email.toLowerCase(),
    province,
    ask,
    institution,
    comment,
    show_name: body?.showName === true,
    contact_ok: body?.contactOk === true,
    ip_hash: where,
    user_id: userId,
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, again: true })
    if (missing(error)) return NextResponse.json({ error: 'The petition opens soon.' }, { status: 503 })
    console.error('petition failed:', error.message)
    return NextResponse.json({ error: 'Could not sign just now. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
