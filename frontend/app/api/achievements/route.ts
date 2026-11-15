import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { evaluateFriendAchievements, listAchievementUnlocks } from '@/lib/server/achievements'

async function getAuthenticatedSupabase(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { supabase, user }

  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token)
    if (!error && tokenUser) return { supabase: createServerSupabase(token), user: tokenUser }
  }
  return { supabase, user: null }
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await getAuthenticatedSupabase(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const friendCount = await evaluateFriendAchievements(user.id)
    const unlocks = await listAchievementUnlocks(user.id)
    return NextResponse.json({ friendCount, unlocks })
  } catch (error) {
    console.error('GET /api/achievements error:', error)
    return NextResponse.json({ error: 'Could not load achievements' }, { status: 500 })
  }
}
