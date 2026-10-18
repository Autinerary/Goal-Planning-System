import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { torontoMonth } from '@/lib/communityChoice'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || /choice_/.test(e.message || ''))

/**
 * Community's Choice nominations (lib/communityChoice.ts; STEP 79).
 *
 * GET  /api/community-choice?item=<id>   whether the person nominated it this
 *      month, and the months it won
 * POST /api/community-choice { itemId, on }   nominate it, or take that back
 */
export async function GET(request: NextRequest) {
  const item = request.nextUrl.searchParams.get('item') || ''
  if (!UUID.test(item)) return NextResponse.json({ open: false })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const month = torontoMonth()
  const won = await supabase.from('choice_winners').select('month').eq('item_id', item).order('month', { ascending: false })
  if (missing(won.error)) return NextResponse.json({ open: false })
  let nominated = false
  if (user) {
    const { data } = await supabase.from('choice_nominations').select('item_id').eq('month', month).eq('item_id', item).eq('user_id', user.id).limit(1)
    nominated = (data || []).length > 0
  }
  return NextResponse.json({ open: true, month, nominated, won: (won.data || []).map((w) => w.month) })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to nominate.' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const itemId = String(body?.itemId || '')
  if (!UUID.test(itemId)) return NextResponse.json({ error: 'Which one?' }, { status: 400 })
  const { data, error } = await supabase.rpc('choice_nominate', { p_item: itemId, p_on: body?.on !== false })
  if (error) {
    if (missing(error)) return NextResponse.json({ error: "Community's Choice opens soon." }, { status: 503 })
    console.error('nominate failed:', error.message)
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 })
  }
  const out = data as { nominated?: boolean; month?: string; kind?: string; error?: string }
  if (out?.error === 'too_many') return NextResponse.json({ error: 'You have nominated ten of these this month, the most there can be.' }, { status: 409 })
  if (out?.error) return NextResponse.json({ error: 'That cannot be nominated.' }, { status: 404 })
  return NextResponse.json(out)
}
