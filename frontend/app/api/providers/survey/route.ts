import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { step81Missing, surveySignatureMatches, usableEmail } from '@/lib/listings'
import { isWant } from '@/lib/providerSurvey'

export const dynamic = 'force-dynamic'

/** POST /api/providers/survey { r, t, wants, other, image_same, contact_email }: a service's answer (V1.5; STEP 81). Three per listing at most. */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const r = String(b?.r || '').toLowerCase()
  if (!surveySignatureMatches(r, b?.t)) return NextResponse.json({ error: 'This link doesn’t work. Use the one in the email.' }, { status: 403 })
  const wants = (Array.isArray(b?.wants) ? b.wants : []).filter(isWant).slice(0, 20)
  const other = typeof b?.other === 'string' ? b.other.trim().slice(0, 2000) || null : null
  const image = typeof b?.image_same === 'boolean' ? b.image_same : null
  const contact = b?.contact_email ? usableEmail(b.contact_email) : null
  if (!wants.length && !other && image === null) return NextResponse.json({ error: 'Choose something, or write a line.' }, { status: 400 })
  const admin = createAdminClient()
  // A plain read, not a count: a count's empty reply can't say the table is missing (before STEP 81).
  const { data: before, error: countError } = await admin.from('provider_survey_responses').select('id').eq('resource_id', r).limit(3)
  if (countError) return NextResponse.json({ error: step81Missing(countError) ? 'The survey opens soon.' : 'Could not send that.' }, { status: step81Missing(countError) ? 503 : 500 })
  if ((before || []).length >= 3) return NextResponse.json({ error: 'We already have answers for this listing. Thank you!' }, { status: 409 })
  const { error } = await admin.from('provider_survey_responses').insert({ resource_id: r, wants, other, image_same: image, contact_email: contact })
  if (error) return NextResponse.json({ error: 'Could not send that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
