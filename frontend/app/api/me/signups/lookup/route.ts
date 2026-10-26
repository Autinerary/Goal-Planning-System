import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lookUpContact } from '@/lib/contactLookup'
import { SIGNUP_ON } from '@/lib/signups'
import { howToRequest, isPlace, lookedUpAt } from '@/lib/requests'
import { accountFor, userFrom } from '@/lib/signupServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * Find a way to reach a listing that has none (lib/contactLookup.ts; the
 * account holder's choice, 26 October 2026), so Send my request can go:
 *   POST { resourceId }  ->  { how, found: { website, email } }
 * Its website and email are looked for on the web (OpenAI's web search, with
 * the listing's name and place only) and kept only if they check out against
 * the site itself. What's found is kept beside the listing's own details
 * (contact_info.found_website / found_email / found_at), never over them, so
 * the next person needn't look; nothing found is kept too, for 30 days. Ten a
 * person a day.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AGAIN_AFTER_DAYS = 30
const DAILY = 10

export async function POST(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ error: 'Sign me up isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const resourceId = String(body?.resourceId || '')
  if (!UUID.test(resourceId)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })

  const admin = createAdminClient()
  const account = await accountFor(admin, user)
  if (account.refusal) return NextResponse.json({ error: account.refusal }, { status: 403 })
  const { data: r } = await admin.from('resources').select('id, name, category, status, contact_info, source_url, source_type, location, geo_lat, geo_lng').eq('id', resourceId).maybeSingle()
  if (!r || r.status !== 'approved' || isPlace(r.category)) return NextResponse.json({ error: 'No such service.' }, { status: 404 })
  // Already reachable, or looked for lately: nothing to do.
  if (howToRequest(r) !== 'none') return NextResponse.json({ how: howToRequest(r), found: null })
  const at = lookedUpAt(r)
  if (at && Date.now() - new Date(at).getTime() < AGAIN_AFTER_DAYS * 24 * 3600 * 1000) return NextResponse.json({ how: 'none', found: null, lookedUp: at })

  // Ten a person a day (each costs a little).
  const { data: prof } = await admin.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
  const prefs = (prof?.preferences as Record<string, any>) || {}
  const today = new Date().toISOString().slice(0, 10)
  const used = prefs.lookups?.day === today ? Number(prefs.lookups.count) || 0 : 0
  if (used >= DAILY) return NextResponse.json({ error: 'That’s the most look-ups for one day. Try again tomorrow.' }, { status: 429 })
  await admin.from('profiles').update({ preferences: { ...prefs, lookups: { day: today, count: used + 1 } } }).eq('id', user.id)

  const found = await lookUpContact(r)
  if (!found.asked) return NextResponse.json({ error: 'Looking for contact details isn’t set up yet.' }, { status: 503 })
  const contact = (r.contact_info && typeof r.contact_info === 'object' ? r.contact_info : {}) as Record<string, unknown>
  const next = { ...contact, found_website: found.website, found_email: found.email, found_at: new Date().toISOString(), found_by: 'web search' }
  const { error } = await admin.from('resources').update({ contact_info: next }).eq('id', resourceId)
  if (error) console.error('lookup: could not save:', error.message)
  const how = howToRequest({ ...r, contact_info: next })
  return NextResponse.json({ how, found: { website: found.website, email: found.email } })
}
