import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET   /api/business/notifications  a Resource Account's notices (coming discount events, orders, reviews)
 * PATCH /api/business/notifications { id }  marks one read
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [] })
  const { data, error } = await supabase.from('vendor_notifications').select('id, kind, title, body, link, read_at, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ notifications: error ? [] : data || [] })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const { error } = await supabase.from('vendor_notifications').update({ read_at: new Date().toISOString() }).eq('id', String(b?.id || '')).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
