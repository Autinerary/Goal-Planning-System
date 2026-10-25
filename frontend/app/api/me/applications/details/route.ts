import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { APPLY_ON, cleanDetails, detailsFromRow, detailsToRow } from '@/lib/applications'
import { missingTable } from '@/lib/applicationSend'

export const dynamic = 'force-dynamic'

/**
 * What one-click Apply sends (lib/applications.ts, STEP 89), checked once
 * by the person (the "Check once, then one click" choice, October 2026).
 *   PUT    { details }   save them; saving is the yes to sending them with Apply
 *   DELETE               forget them; Apply asks again next time
 * Their own row only (application_details' RLS), with their own session.
 */

export async function PUT(req: NextRequest) {
  if (!APPLY_ON) return NextResponse.json({ error: 'Apply isn’t switched on.' }, { status: 404 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const checked = cleanDetails(body?.details)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('application_details')
    .upsert({ ...detailsToRow(user.id, checked.details), consented_at: now, updated_at: now }, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle()
  if (missingTable(error)) return NextResponse.json({ error: 'Apply isn’t ready yet.' }, { status: 503 })
  if (error) {
    console.error('apply details: could not save:', error.message)
    return NextResponse.json({ error: 'That didn’t save. Try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, details: detailsFromRow(data) })
}

export async function DELETE() {
  if (!APPLY_ON) return NextResponse.json({ error: 'Apply isn’t switched on.' }, { status: 404 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { error } = await supabase.from('application_details').delete().eq('user_id', user.id)
  if (missingTable(error)) return NextResponse.json({ error: 'Apply isn’t ready yet.' }, { status: 503 })
  if (error) return NextResponse.json({ error: 'That didn’t work. Try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
