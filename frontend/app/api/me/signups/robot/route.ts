import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RECIPES } from '@/lib/signupKit'
import { SIGNUP_KIT_SOURCE } from '@/lib/signupKitSource'
import { robotSignup } from '@/lib/signupRobot'
import { ROBOT_DAILY_LIMIT, SIGNUP_ON } from '@/lib/signups'
import { accountFor, missingTable, recordSignup, userFrom } from '@/lib/signupServer'
import { randomInt } from 'crypto'
import { robotBrowser as browser } from '@/lib/signupBrowser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * One-click sign-up's server robot (lib/signupRobot.ts): for someone without
 * the Autinerary extension, a browser on the server fills in the service's
 * sign-up form for them. Only services marked `robot` (no robot check was met
 * on them); it never gets around a check. The new account's password is made
 * here, used once, and returned once in this answer for the person to save;
 * it is never stored or logged.
 *   POST { service, resourceId? }  ->  { status, detail?, password? }
 *   GET  ?check=1                  ->  { ok, version, ms }: the browser starts
 * Off unless NEXT_PUBLIC_ONE_CLICK_SIGNUP=on and SIGNUP_ROBOT=on.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 16 random characters (no look-alikes), then one of each kind services ask for.
function newPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const out = Array.from({ length: 16 }, () => chars[randomInt(chars.length)]).join('')
  return `${out.slice(0, 8)}-${out.slice(8)}!7aK`
}

/**
 * GET ?check=1: does the robot's browser start here? It loads a blank page
 * and says its version; no service, nobody's details. The first thing to open
 * after switching SIGNUP_ROBOT on (docs/one-click-signup-2026-10.md).
 */
export async function GET(req: NextRequest) {
  if (!SIGNUP_ON || process.env.SIGNUP_ROBOT !== 'on') return NextResponse.json({ error: 'The server robot isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (req.nextUrl.searchParams.get('check') !== '1') return NextResponse.json({ error: 'Add ?check=1.' }, { status: 400 })
  const t0 = Date.now()
  const b = await browser().catch((e) => {
    console.error('signup robot check: no browser:', e?.message)
    return null
  })
  if (!b) return NextResponse.json({ ok: false, error: 'The browser didn’t start.', ms: Date.now() - t0 }, { status: 500 })
  try {
    const page = await b.newPage()
    await page.setContent('<p>ok</p>')
    const said = await page.evaluate(() => document.body.innerText.trim())
    return NextResponse.json({ ok: said === 'ok', version: await b.version(), ms: Date.now() - t0 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message || e).slice(0, 200), ms: Date.now() - t0 }, { status: 500 })
  } finally {
    await b.close().catch(() => {})
  }
}

export async function POST(req: NextRequest) {
  if (!SIGNUP_ON || process.env.SIGNUP_ROBOT !== 'on') return NextResponse.json({ error: 'The server robot isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const recipe = RECIPES[String(body?.service || '')]
  if (!recipe) return NextResponse.json({ error: 'Unknown service.' }, { status: 400 })
  if (!recipe.robot) return NextResponse.json({ error: `${recipe.name} checks for robots, so it can’t be done from here: sign up on its own site${recipe.start ? ` (${recipe.start})` : ''}.`, needsExtension: true, start: recipe.start }, { status: 409 })

  const admin = createAdminClient()
  const account = await accountFor(admin, user)
  if (account.refusal) return NextResponse.json({ error: account.refusal }, { status: 403 })
  if (!account.details || !account.email) return NextResponse.json({ error: 'Check your details first.', needDetails: true }, { status: 409 })

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('service_signups')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('runner', 'server')
    .gte('updated_at', since)
  if (missingTable(countError)) return NextResponse.json({ error: 'Sign me up isn’t ready yet.' }, { status: 503 })
  if ((count || 0) >= ROBOT_DAILY_LIMIT) return NextResponse.json({ error: 'That’s the most for one day. Try again tomorrow.' }, { status: 429 })

  const { data: before } = await admin.from('service_signups').select('status').eq('user_id', user.id).eq('service', recipe.key).maybeSingle()
  if (before && ['signed_up', 'check_email', 'exists'].includes(before.status)) {
    return NextResponse.json({ status: before.status, detail: 'already' })
  }

  const resourceId = UUID.test(String(body?.resourceId || '')) ? String(body.resourceId) : null
  await recordSignup(admin, { userId: user.id, service: recipe.key, resourceId, runner: 'server', status: 'started' })
  const password = recipe.kind === 'account' ? newPassword() : undefined
  let status: string = 'failed'
  let detail: string | null = null
  const b = await browser().catch((e) => {
    console.error('signup robot: no browser:', e?.message)
    return null
  })
  if (!b) {
    detail = 'The robot couldn’t start.'
  } else {
    try {
      const r = await robotSignup(b, SIGNUP_KIT_SOURCE, recipe, { ...account.details, email: account.email, password }, { timeoutMs: 70000 })
      status = r.status === 'timeout' || r.status === 'dry_run' ? 'failed' : r.status
      detail = r.status === 'timeout' ? 'It took too long.' : r.detail || null
    } catch (e) {
      console.error('signup robot:', (e as Error)?.message)
      detail = 'Something went wrong in the robot.'
    } finally {
      await b.close().catch(() => {})
    }
  }
  await recordSignup(admin, { userId: user.id, service: recipe.key, resourceId, runner: 'server', status: status as 'failed', detail })
  // The password once, only for an account it made (or that is waiting on their email).
  return NextResponse.json({ status, detail, ...(password && (status === 'signed_up' || status === 'check_email') ? { password } : {}) })
}
