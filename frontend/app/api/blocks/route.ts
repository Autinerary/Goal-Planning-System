import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * Blocking people (Riipen Labs, Group 34, slide 20; STEP 65).
 *
 * GET: the people you blocked, with names, and whether blocking is switched
 * on yet. POST { target }: block someone, which removes every connection
 * and request between you and hides you from each other. DELETE { target }:
 * unblock. The person blocked is never told.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function signedIn() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function target(req: NextRequest): Promise<string | null> {
  try {
    const body = await req.json()
    return typeof body?.target === 'string' && UUID.test(body.target) ? body.target : null
  } catch {
    return null
  }
}

export async function GET() {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.rpc('my_blocked_people')
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ available: false, people: [] })
    return NextResponse.json({ error: 'Your blocked people could not be loaded.' }, { status: 500 })
  }
  return NextResponse.json({ available: true, people: data || [] })
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = await target(req)
  if (!id || id === user.id) return NextResponse.json({ error: 'Choose someone to block.' }, { status: 400 })
  const { error } = await supabase.rpc('block_user', { target: id })
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'Blocking isn’t switched on yet.' }, { status: 503 })
    if (error.code === '23503') return NextResponse.json({ error: 'That account no longer exists.' }, { status: 404 })
    return NextResponse.json({ error: 'That person could not be blocked. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ blocked: id })
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = await target(req)
  if (!id) return NextResponse.json({ error: 'Choose someone to unblock.' }, { status: 400 })
  const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id)
  if (error) return NextResponse.json({ error: 'That person could not be unblocked. Please try again.' }, { status: 500 })
  return NextResponse.json({ unblocked: id })
}
