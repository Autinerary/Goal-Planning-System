import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ratingAccess } from '@/lib/ratings/access'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/resources/<id>/rating-access: whether the person may rate this, and each way they could (lib/ratings/access.ts). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ access: { signed_in: false, can_rate: false } })
  try {
    return NextResponse.json({ access: await ratingAccess(supabase, params.id) })
  } catch (error: any) {
    console.error('rating-access failed:', error?.message || error)
    return NextResponse.json({ error: 'Could not check that.' }, { status: 500 })
  }
}
