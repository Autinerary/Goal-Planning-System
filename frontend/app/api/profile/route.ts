import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

// The caller's own row. Username, pronouns, bio and photo arrived with
// STEP 64 (Riipen Labs, Group 34's profile page); before it, the older fields.
const FIELDS = 'id, display_name, email, avatar_emoji, dream, discoverable, created_at, updated_at, username, pronouns, bio, avatar_url'
const BEFORE_STEP_64 = 'id, display_name, email, avatar_emoji, dream, discoverable, created_at, updated_at'

const USERNAME_RULE = /^[a-z0-9_.]{3,20}$/

/**
 * GET /api/profile
 * Returns the current user's profile row from public.profiles, and whether
 * the STEP 64 fields exist (`extended`).
 * If no row exists yet (e.g. user was created before the trigger), upserts one
 * from auth.users metadata so the rest of the social flow has a target.
 * The row's copy of the email address follows the account's, which can now
 * be changed from Your profile.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let extended = true
  let { data, error }: { data: any; error: any } = await supabase.from('profiles').select(FIELDS).eq('id', user.id).maybeSingle()
  if (error && step64Missing(error)) {
    extended = false
    ;({ data, error } = await supabase.from('profiles').select(BEFORE_STEP_64).eq('id', user.id).maybeSingle())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) {
    // Self-heal: create a row from auth metadata
    const fallbackName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      (user.email ? user.email.split('@')[0] : null)
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: user.id, display_name: fallbackName, email: user.email })
      .select(extended ? FIELDS : BEFORE_STEP_64)
      .single()
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    return NextResponse.json({ profile: created, extended })
  }

  if (user.email && data.email !== user.email) {
    await supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
    data.email = user.email
  }

  return NextResponse.json({ profile: data, extended })
}

/**
 * PATCH /api/profile
 * Body: { display_name?, dream?, avatar_emoji?, discoverable?, username?,
 * pronouns?, bio?, avatar_url? }. Strings are trimmed and clamped; an empty
 * string clears an optional field. A photo must be in this person's own
 * folder of the avatars bucket, so the page can't be pointed at any address.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, any> = {}
  if (typeof body.display_name === 'string') patch.display_name = body.display_name.trim().slice(0, 80) || null
  if (typeof body.dream === 'string') patch.dream = body.dream.trim().slice(0, 280) || null
  if (typeof body.avatar_emoji === 'string') patch.avatar_emoji = body.avatar_emoji.trim().slice(0, 8) || '👤'
  if (typeof body.discoverable === 'boolean') patch.discoverable = body.discoverable

  let extended = false
  if (typeof body.username === 'string') {
    const username = body.username.trim().replace(/^@/, '').toLowerCase()
    if (username && !USERNAME_RULE.test(username)) {
      return NextResponse.json({ error: 'A username is 3 to 20 letters, numbers, dots or underscores.' }, { status: 400 })
    }
    patch.username = username || null
    extended = true
  }
  if (typeof body.pronouns === 'string') { patch.pronouns = body.pronouns.trim().slice(0, 60) || null; extended = true }
  if (typeof body.bio === 'string') { patch.bio = body.bio.trim().slice(0, 500) || null; extended = true }
  if (body.avatar_url === null || typeof body.avatar_url === 'string') {
    const url = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : ''
    const ownFolder = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')}/storage/v1/object/public/avatars/${user.id}/`
    // One file straight inside the folder: no "..", no other folder.
    if (url && !(url.startsWith(ownFolder) && /^[A-Za-z0-9-]{1,64}\.(jpg|jpeg|png|webp)$/.test(url.slice(ownFolder.length)))) {
      return NextResponse.json({ error: 'That photo is not one you uploaded.' }, { status: 400 })
    }
    patch.avatar_url = url || null
    extended = true
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 })
  }

  // RLS guarantees we can only update our own row, but pass eq(id) defensively
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select(extended ? FIELDS : BEFORE_STEP_64)
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That username is taken. Please choose another.' }, { status: 409 })
    if (error.code === '23514') return NextResponse.json({ error: 'A username is 3 to 20 letters, numbers, dots or underscores.' }, { status: 400 })
    if (step64Missing(error)) return NextResponse.json({ error: 'Usernames, pronouns, bios and photos aren’t switched on yet.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ profile: data })
}
