import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const VALID_CATEGORIES = ['friends', 'mentors', 'rolemodels'] as const
type Category = (typeof VALID_CATEGORIES)[number]

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (VALID_CATEGORIES as readonly string[]).includes(value)
}

/**
 * GET /api/connections
 * Returns the signed-in user's social connections grouped by category.
 */
export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('social_connections')
    .select('id, category, name, role, status, icon, target_user_id, match_dream, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('GET /api/connections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const grouped: Record<Category, any[]> = { friends: [], mentors: [], rolemodels: [] }
  for (const row of data || []) {
    if (isCategory(row.category)) grouped[row.category].push(row)
  }

  return NextResponse.json({ connections: grouped })
}

/**
 * POST /api/connections
 * Body: { category, name, role?, status?, icon?, target_user_id?, match_dream? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { category, name, role, status, icon, target_user_id, match_dream } = body || {}

  if (!isCategory(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const insertRow = {
    owner_id: user.id,
    category,
    name: name.trim().slice(0, 200),
    role: typeof role === 'string' ? role.trim().slice(0, 200) : '',
    status: status === 'connected' || status === 'matched' ? status : 'pending',
    icon: typeof icon === 'string' && icon.length > 0 ? icon.slice(0, 8) : '👤',
    target_user_id: typeof target_user_id === 'string' ? target_user_id : null,
    match_dream: typeof match_dream === 'string' ? match_dream.slice(0, 500) : null,
  }

  const { data, error } = await supabase
    .from('social_connections')
    .insert(insertRow)
    .select('id, category, name, role, status, icon, target_user_id, match_dream, created_at')
    .single()

  if (error) {
    console.error('POST /api/connections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ connection: data }, { status: 201 })
}
