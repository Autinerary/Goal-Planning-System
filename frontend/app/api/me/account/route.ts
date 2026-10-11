import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * Deleting your own account (Riipen Labs, Group 34, slide 21; STEP 65).
 *
 * GET: whether this account can be deleted here. delete_my_account()
 * deletes nothing unless it is passed 'DELETE', so asking it with anything
 * else tells whether it exists (STEP 65 applied) and whether this is a team
 * account, which can't be deleted this way.
 *
 * DELETE { confirm: 'DELETE' }: removes the person's photos (storage can
 * only be emptied through its API), their newsletter sign-up, then
 * everything in the database, then the sign-in itself; and signs out.
 */

type Status = { deletable: true } | { deletable: false; reason: 'not_ready' | 'staff' | 'error' }

async function status(supabase: ReturnType<typeof createServerSupabase>): Promise<Status> {
  const { data, error } = await supabase.rpc('delete_my_account', { confirm: '' })
  if (error) return { deletable: false, reason: step64Missing(error) ? 'not_ready' : 'error' }
  if (data === 'staff') return { deletable: false, reason: 'staff' }
  return { deletable: true }
}

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  return NextResponse.json(await status(supabase))
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { body = null }
  if (body?.confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })

  const check = await status(supabase)
  if (!check.deletable) {
    const error = check.reason === 'staff'
      ? 'Team accounts can’t be deleted here. Please email us.'
      : check.reason === 'not_ready'
        ? 'Deleting your account here isn’t switched on yet. Please email us.'
        : 'Your account could not be deleted. Please try again, or email us.'
    return NextResponse.json({ error }, { status: check.reason === 'staff' ? 403 : 503 })
  }

  // Photos first: once the account is gone, nobody may remove them.
  const storage = supabase.storage.from('avatars')
  const { data: photos } = await storage.list(user.id, { limit: 100 })
  if (photos?.length) await storage.remove(photos.map((f) => `${user.id}/${f.name}`))

  // A newsletter sign-up with the same address is the same person.
  const admin = createAdminClient()
  if (user.email) await admin.from('newsletter_subscribers').delete().ilike('email', user.email.replace(/[\\%_]/g, (c) => `\\${c}`))

  const { data: outcome, error } = await supabase.rpc('delete_my_account', { confirm: 'DELETE' })
  if (error || (outcome !== 'deleted' && outcome !== 'profile_deleted')) {
    console.error('[account] delete failed:', error?.code, error?.message, outcome)
    return NextResponse.json({ error: 'Your account could not be deleted. Please try again, or email us.' }, { status: 500 })
  }
  if (outcome === 'profile_deleted') {
    // The database may not remove sign-ins on Supabase; the admin API can.
    const { error: authError } = await admin.auth.admin.deleteUser(user.id)
    if (authError) {
      console.error('[account] sign-in not removed:', user.id, authError.message)
      return NextResponse.json({ error: 'Your information was deleted, but your sign-in could not be removed. Please email us and we will finish it.' }, { status: 500 })
    }
  }

  await supabase.auth.signOut().catch(() => {})
  return NextResponse.json({ deleted: true })
}
