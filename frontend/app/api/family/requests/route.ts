import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeAge } from '@/lib/age'

export const dynamic = 'force-dynamic'

/**
 * GET /api/family/requests: the teens who asked the signed-in adult to
 * approve their account (STEP 84), with what the adult needs to review:
 * their name, email and age. Only the adult they asked sees them.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.from('guardian_requests').select('id, child_id, status, created_at').eq('adult_id', user.id).eq('status', 'pending').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ requests: [], open: false })
  const admin = createAdminClient()
  const requests = await Promise.all(
    (data || []).map(async (r) => {
      const { data: child } = await admin.auth.admin.getUserById(r.child_id)
      const dob = child?.user?.app_metadata?.date_of_birth || child?.user?.user_metadata?.date_of_birth || null
      return {
        id: r.id,
        name: child?.user?.user_metadata?.name || child?.user?.user_metadata?.full_name || '',
        email: child?.user?.email || '',
        age: computeAge(dob),
        asked: r.created_at,
      }
    })
  )
  return NextResponse.json({ requests, open: true }, { headers: { 'Cache-Control': 'no-store' } })
}
