/**
 * PATCH /api/visuals/[id] { status: 'approved' | 'rejected' } — the team's
 * decision on a shared artwork. Only an admin can make it: the visuals
 * policy checks is_admin(), and only status and reviewed_at can change
 * (STEP 86).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdminUser(supabase))) return NextResponse.json({ error: 'For the team' }, { status: 403 })
  let b: any
  try {
    b = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (b?.status !== 'approved' && b?.status !== 'rejected') return NextResponse.json({ error: 'approved or rejected' }, { status: 400 })
  const { data, error } = await supabase
    .from('visuals')
    .update({ status: b.status, reviewed_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, status')
  if (error) return NextResponse.json({ error: 'That didn’t save' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, status: data[0].status })
}
