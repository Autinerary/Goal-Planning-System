import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/me/pause { paused: boolean }
 *
 * Pause your account (Riipen Labs, Group 34, slide 21): a break with nothing
 * lost. While paused, Autinerary sends no reminders, check-ins, weekly picks
 * or notifications (lib/pause.ts; each sender checks), and nobody can find
 * you in search. Resuming turns search back to what it was.
 *
 * Kept in preferences.paused as { since, wasDiscoverable }; null when not
 * paused, so a device that saw the pause clears it too.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body?.paused !== 'boolean') return NextResponse.json({ error: 'Say paused: true or false' }, { status: 400 })

  const { data: row, error: readError } = await supabase.from('profiles').select('preferences, discoverable').eq('id', user.id).maybeSingle()
  if (readError || !row) return NextResponse.json({ error: 'Your account could not be found. Please try again.' }, { status: 500 })

  const prefs = (row.preferences as Record<string, any>) || {}
  const current = prefs.paused && typeof prefs.paused === 'object' ? prefs.paused : null

  let paused: { since: string; wasDiscoverable: boolean } | null
  let discoverable: boolean
  if (body.paused) {
    // Pausing twice keeps the first date and the first answer.
    paused = current || { since: new Date().toISOString(), wasDiscoverable: Boolean(row.discoverable) }
    discoverable = false
  } else {
    paused = null
    discoverable = current ? Boolean(current.wasDiscoverable) : Boolean(row.discoverable)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: { ...prefs, paused }, discoverable })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: 'That could not be saved. Please try again.' }, { status: 500 })
  return NextResponse.json({ paused, discoverable })
}
