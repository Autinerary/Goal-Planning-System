#!/usr/bin/env node
/**
 * Shop item makers' published emails into products.contact_email (STEP 86),
 * for the team's contact list (the team's notes, October 2026: "For any
 * service or product added, add their email to a list so that we can
 * contact them"; ResourceHub's /admin/contacts).
 *
 * Reads scripts/data/products/contacts.json: one checked address per maker
 * website (host), each read on the page it cites. A product gets its maker's
 * address by its maker_url's host, except where one host sells several
 * makers' things and the address covers only one (below). An address already
 * set is never replaced.
 *
 *   node scripts/set-product-contacts.mjs            # check
 *   node scripts/set-product-contacts.mjs --apply    # after STEP 86
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const APPLY = process.argv.includes('--apply')
// One host, several makers: the address only fits these products.
const ONLY = {
  'amazon.ca': (p) => /boogie/i.test(`${p.brand} ${p.name}`), // Buffalo Games' address, for Boogie Board
  'penguinrandomhouse.com': (p) => /unmasking autism/i.test(p.name), // Crown's publicity, for Harmony's Unmasking Autism
}

function loadEnv() {
  for (const f of ['servicehub-mvp/.env.local', 'frontend/.env.local']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

loadEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const { contacts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/products/contacts.json'), 'utf8'))
const byHost = new Map(contacts.map((c) => [c.host, c]))
const ready = (await fetch(`${url}/rest/v1/products?select=contact_email&limit=1`, { headers: H })).ok
const products = await (await fetch(`${url}/rest/v1/products?select=id,name,brand,maker_url${ready ? ',contact_email' : ''}&status=eq.active&limit=1000`, { headers: H })).json()
const plan = []
for (const p of products) {
  const c = byHost.get(hostOf(p.maker_url))
  if (!c) continue
  if (ONLY[c.host] && !ONLY[c.host](p)) continue
  if (p.contact_email) continue
  plan.push({ id: p.id, name: p.name, email: c.email })
}
console.log(`${plan.length} of ${products.length} shop items get their maker's address (${contacts.length} makers' addresses).`)
if (!APPLY) {
  console.log(ready ? 'Check only: add --apply to save them.' : 'STEP 86 adds products.contact_email: paste it first, then run with --apply.')
  process.exit(0)
}
if (!ready) throw new Error('products.contact_email is missing: apply STEP 86 first')
let saved = 0
for (const x of plan) {
  const r = await fetch(`${url}/rest/v1/products?id=eq.${x.id}&contact_email=is.null`, { method: 'PATCH', headers: H, body: JSON.stringify({ contact_email: x.email }) })
  if (r.ok) saved++
  else console.log(`  not saved: ${x.name}: ${r.status} ${await r.text()}`)
}
console.log(`Saved ${saved}.`)
