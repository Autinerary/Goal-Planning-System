import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdult } from '@/lib/age'

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ approved: false }, { status: 401 })
  const admin = createAdminClient()
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(user.id)
  if (accountError || !account.user) return NextResponse.json({ approved: false }, { status: 503 })
  const metadata = account.user.app_metadata
  const guardianId = metadata?.guardian_id
  if (!metadata?.managed_by_guardian || metadata.guardian_approval?.state !== 'approved' || metadata.guardian_approval?.approved_by !== guardianId || typeof guardianId !== 'string') {
    return NextResponse.json({ approved: false })
  }
  const [{ data: link, error: linkError }, { data: guardian, error: guardianError }] = await Promise.all([
    admin.from('guardianships').select('child_id').eq('guardian_id', guardianId).eq('child_id', user.id).maybeSingle(),
    admin.auth.admin.getUserById(guardianId),
  ])
  if (linkError || guardianError) return NextResponse.json({ approved: false }, { status: 503 })
  const adult = guardian.user
  const approved = !!link && !!adult && !adult.app_metadata?.managed_by_guardian && !adult.user_metadata?.managed_by_guardian && isAdult(adult.app_metadata?.date_of_birth || adult.user_metadata?.date_of_birth)
  return NextResponse.json({ approved }, { headers: { 'Cache-Control': 'no-store' } })
}