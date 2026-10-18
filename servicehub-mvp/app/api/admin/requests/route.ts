import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function admin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (await isAdminUser(supabase, profile?.role)) ? user : null
}

type Db = ReturnType<typeof createAdminClient>

async function emails(db: Db, ids: string[]) {
  const out = new Map<string, string>()
  for (const id of Array.from(new Set(ids.filter(Boolean)))) {
    const { data } = await db.auth.admin.getUserById(id)
    if (data?.user?.email) out.set(id, data.user.email)
  }
  return out
}

async function listingNames(db: Db, rows: { item_kind: string; item_id: string }[]) {
  const ids = (k: string) => Array.from(new Set(rows.filter((r) => r.item_kind === k).map((r) => r.item_id)))
  const [{ data: rs }, { data: ps }] = await Promise.all([
    ids('resource').length ? db.from('resources').select('id, name').in('id', ids('resource')) : Promise.resolve({ data: [] as any[] }),
    ids('product').length ? db.from('products').select('id, name').in('id', ids('product')) : Promise.resolve({ data: [] as any[] }),
  ])
  return new Map([...(rs || []), ...(ps || [])].map((r: any) => [r.id, r.name as string]))
}

/**
 * The team's queue for STEP 81 (the planning note, October 2026, Goals 9 and
 * 11): listing claims to check, listing changes that wait for the team (a
 * name, a picture, an address), promotions sent for approval, people asking
 * to be Spot Guides, and free-access requests (students and "explain your
 * case"); and what services answered in the V1.5 survey. The caller is
 * checked with their own session; changes are made with the server key.
 *
 * GET  /api/admin/requests
 * POST /api/admin/requests { section, id, action: 'approve' | 'reject' }
 */
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = createAdminClient()
  const [claims, edits, promos, guides, grants, survey] = await Promise.all([
    db.from('listing_claims').select('id, user_id, item_kind, item_id, method, evidence, created_at').eq('status', 'pending').eq('method', 'review').order('created_at').limit(100),
    db.from('listing_edits').select('id, user_id, item_kind, item_id, changes, before, created_at').eq('status', 'pending').order('created_at').limit(100),
    db.from('promotions').select('id, user_id, item_kind, item_id, headline, body, image_url, keywords, provinces, starts_on, ends_on, created_at').eq('status', 'submitted').order('created_at').limit(100),
    db.from('spot_guide_applications').select('user_id, area, why, created_at').eq('status', 'pending').order('created_at').limit(100),
    db.from('access_grants').select('id, user_id, kind, source, case_text, created_at').eq('status', 'pending').order('created_at').limit(200),
    db.from('provider_survey_responses').select('wants, other, image_same, created_at').order('created_at', { ascending: false }).limit(1000),
  ])
  if (claims.error && /does not exist|schema cache/i.test(claims.error.message)) return NextResponse.json({ ready: false, note: 'Apply STEP 81 to see requests.' })
  const listingRows = [...(claims.data || []), ...(edits.data || []), ...(promos.data || [])] as { item_kind: string; item_id: string }[]
  const [names, mail] = await Promise.all([
    listingNames(db, listingRows),
    emails(db, [...(claims.data || []), ...(edits.data || []), ...(promos.data || []), ...(guides.data || []), ...(grants.data || [])].map((r: any) => r.user_id)),
  ])
  const { data: accounts } = await db.from('resource_accounts').select('user_id, organization, kind, role_title').in('user_id', Array.from(new Set((claims.data || []).map((c) => c.user_id))))
  const org = new Map((accounts || []).map((a) => [a.user_id, a]))
  const wants: Record<string, number> = {}
  for (const r of survey.data || []) for (const w of r.wants || []) wants[w] = (wants[w] || 0) + 1
  const withName = (r: any) => ({ ...r, listing: names.get(r.item_id) || 'A listing', email: mail.get(r.user_id) || '' })
  return NextResponse.json({
    ready: true,
    claims: (claims.data || []).map((c) => ({ ...withName(c), account: org.get(c.user_id) || null })),
    edits: (edits.data || []).map(withName),
    promotions: (promos.data || []).map(withName),
    guides: (guides.data || []).map((g) => ({ ...g, id: g.user_id, email: mail.get(g.user_id) || '' })),
    access: (grants.data || []).map((g) => ({ ...g, email: mail.get(g.user_id) || '' })),
    survey: {
      answers: (survey.data || []).length,
      wants: Object.entries(wants).sort((a, b) => b[1] - a[1]),
      imageWrong: (survey.data || []).filter((r) => r.image_same === false).length,
      other: (survey.data || []).map((r) => r.other).filter(Boolean).slice(0, 50),
    },
  })
}

export async function POST(request: NextRequest) {
  const me = await admin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await request.json().catch(() => ({}))
  const id = String(b?.id || '')
  const approve = b?.action === 'approve'
  if (!UUID.test(id) || (b?.action !== 'approve' && b?.action !== 'reject')) return NextResponse.json({ error: 'Approve or reject which request?' }, { status: 400 })
  const db = createAdminClient()
  const now = new Date().toISOString()
  let error: { message: string; code?: string } | null = null

  switch (b?.section) {
    case 'claims': {
      ;({ error } = await db.from('listing_claims').update({ status: approve ? 'verified' : 'rejected', verified_at: approve ? now : null, reviewed_by: me.id }).eq('id', id).eq('status', 'pending'))
      if (error?.code === '23505') return NextResponse.json({ error: 'Someone else already manages this listing.' }, { status: 409 })
      break
    }
    case 'edits': {
      const { data: edit } = await db.from('listing_edits').select('item_kind, item_id, changes').eq('id', id).eq('status', 'pending').maybeSingle()
      if (!edit) return NextResponse.json({ error: 'That change was already handled.' }, { status: 404 })
      if (approve) {
        const table = edit.item_kind === 'product' ? 'products' : 'resources'
        const { data: row } = await db.from(table).select('location').eq('id', edit.item_id).maybeSingle()
        const c = edit.changes as Record<string, unknown>
        const update: Record<string, unknown> = { updated_at: now }
        if (typeof c.name === 'string' && c.name) update.name = c.name
        if (typeof c.image_url === 'string') {
          update.image_url = c.image_url || null
          if (table === 'resources') update.image_is_generic = false
        }
        if (typeof c.address === 'string' && table === 'resources') update.location = { ...((row as any)?.location || {}), address: c.address }
        ;({ error } = await db.from(table).update(update).eq('id', edit.item_id))
        if (error) break
      }
      ;({ error } = await db.from('listing_edits').update({ status: approve ? 'applied' : 'rejected', reviewed_by: me.id, reviewed_at: now }).eq('id', id))
      break
    }
    case 'promotions': {
      ;({ error } = await db.from('promotions').update({ status: approve ? 'active' : 'rejected', reviewed_by: me.id, reviewed_at: now, updated_at: now }).eq('id', id).eq('status', 'submitted'))
      break
    }
    case 'guides': {
      if (approve) {
        ;({ error } = await db.from('spot_guides').upsert({ user_id: id, granted_by: me.email || me.id, note: 'Approved from an application' }, { onConflict: 'user_id', ignoreDuplicates: true }))
        if (error) break
      }
      ;({ error } = await db.from('spot_guide_applications').update({ status: approve ? 'approved' : 'declined', reviewed_at: now }).eq('user_id', id))
      break
    }
    case 'access': {
      const ends = new Date()
      ends.setFullYear(ends.getFullYear() + 1)
      ;({ error } = await db
        .from('access_grants')
        .update(approve ? { status: 'active', starts_at: now, ends_at: ends.toISOString(), reviewed_at: now, reviewed_by: me.id } : { status: 'rejected', reviewed_at: now, reviewed_by: me.id })
        .eq('id', id)
        .eq('status', 'pending'))
      break
    }
    default:
      return NextResponse.json({ error: 'Which kind of request?' }, { status: 400 })
  }
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  console.log(`[requests] ${me.id} ${b.action} ${b.section} ${id}`)
  return NextResponse.json({ ok: true })
}
