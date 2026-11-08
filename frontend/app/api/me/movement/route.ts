import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * Helper to get user from Authorization header OR cookie session.
 */
async function getAuthenticatedUser(req: NextRequest) {
  const supabase = createServerSupabase()
  
  // 1. Try reading standard cookie session first
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  if (cookieUser) return { user: cookieUser, supabase }

  // 2. Fall back to Authorization: Bearer <token> header from fetchWithAuth
  const authHeader = req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token)
    if (!error && tokenUser) {
      return { user: tokenUser, supabase }
    }
  }

  return { user: null, supabase }
}

/**
 * GET /api/me/movement
 */
export async function GET(req: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user) {
    return NextResponse.json({ movement: null }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('movement')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ movement: null })
  }

  return NextResponse.json({ movement: data?.movement ?? null })
}

/**
 * POST /api/me/movement
 *
 * Saves the order of pages opened, by address only: what follows a "?" or "#" (a search, a link's code) is never
 * kept, whatever the browser sends, and each visit keeps only its address, label and time (the compliance checklist,
 * November 2026: "No unnecessary data"). The browser sends it only once counting is allowed (lib/consent.ts).
 */
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthenticatedUser(req)

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const visits = Array.isArray(body?.visits) ? body.visits : null
  if (!visits) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Keep payload bounded to protect row size
  const trimmed = visits
    .slice(-500)
    .filter((v: any) => v && typeof v.path === 'string')
    .map((v: any) => ({
      path: v.path.split(/[?#]/)[0].slice(0, 200),
      label: typeof v.label === 'string' ? v.label.slice(0, 60) : '',
      at: typeof v.at === 'string' ? v.at.slice(0, 40) : '',
    }))
  const summary = trimmed.map((v: { label: string }) => v.label).filter(Boolean).join(' → ').slice(0, 20000)

  const movement = {
    visits: trimmed,
    summary,
    updatedAt: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, movement }, { onConflict: 'id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ movement })
}