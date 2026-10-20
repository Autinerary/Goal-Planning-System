import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * POST   /api/moments/[id]/cheer  cheer a moment you can see (not your own)
 * DELETE /api/moments/[id]/cheer  take it back
 * The database counts them (STEP 87); cheers decide what trends.
 */
async function act(req: NextRequest, id: string, on: boolean) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Choose a moment.' }, { status: 400 })
  const { error } = on
    ? await supabase.from('moment_cheers').upsert({ moment_id: id, user_id: user.id }, { onConflict: 'moment_id,user_id', ignoreDuplicates: true })
    : await supabase.from('moment_cheers').delete().eq('moment_id', id).eq('user_id', user.id)
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'Hare World Social opens soon.' }, { status: 503 })
    return NextResponse.json({ error: on ? 'You can cheer moments you can see, but not your own.' : 'That didn’t work.' }, { status: error.code === '42501' ? 403 : 500 })
  }
  const { data } = await supabase.from('moments').select('cheer_count').eq('id', id).maybeSingle()
  return NextResponse.json({ cheered: on, cheers: data?.cheer_count ?? null })
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  return act(req, ctx.params.id, true)
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  return act(req, ctx.params.id, false)
}
