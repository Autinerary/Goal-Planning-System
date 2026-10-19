#!/usr/bin/env node
/**
 * Products for ResourceHub's shop (the products round's planning note,
 * October 2026, Goal 1: "Find & add the products + add to 'Quality List'"),
 * found where neurodivergent people and families recommend them and checked
 * on each maker's or seller's own pages (.qa-local/products/BRIEF.md: every
 * quality has a quote from those pages, kept here as quality_evidence).
 *
 * Reads scripts/data/products/<topic>.json:
 *   {"topic", "checked", "entries": [{slug, name, brand, category, description,
 *    qualities, quality_evidence, values, price, currency, price_note,
 *    maker_url, buy_links, community, evidence, notes}]}
 *
 * Each maker page and buy link is fetched again before saving; a product
 * whose maker page doesn't load is left out, and a buy link that doesn't load
 * is dropped. Categories and qualities outside lib/shop/taxonomy.json are
 * refused. Rows are live (status active), source_type 'operator', one batch
 * per topic (import_batch products-<topic>-2026-10), matched on source_ref,
 * so it is safe to re-run.
 *
 *   node scripts/import-products.mjs [topic ...]                    # check only
 *   node scripts/import-products.mjs --apply [topic ...]
 *   node scripts/import-products.mjs --apply --archive-demo         # also archives the "Demo Seller" placeholders
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const DIR = path.join(ROOT, 'scripts/data/products')
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const ARCHIVE_DEMO = args.includes('--archive-demo')
const ONLY = args.filter((a) => !a.startsWith('--'))
const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'servicehub-mvp/lib/shop/taxonomy.json'), 'utf8'))
const GROUP = Object.fromEntries(taxonomy.categories.map((c) => [c.id, c.group]))
const QUAL = Object.fromEntries(taxonomy.qualities.map((q) => [q.id, q]))
const VALUES = new Set(taxonomy.values.map((v) => v.id))

function loadEnv() {
  for (const f of ['servicehub-mvp/.env.local', 'frontend/.env.local', 'backend/.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

// 'yes', 'refuses robots' (it loads for people), or null when it is gone.
async function loads(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) })
      if (res.status < 400) return 'yes'
      if ([401, 403, 429, 503].includes(res.status) || res.headers.get('cf-mitigated') === 'challenge') return 'refuses robots'
      if (method === 'GET') return null
    } catch {
      if (method === 'GET') return null
    }
  }
  return null
}

async function main() {
  loadEnv()
  if (!fs.existsSync(DIR)) {
    console.log('No scripts/data/products yet.')
    return
  }
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && (!ONLY.length || ONLY.includes(f.replace(/\.json$/, ''))))
  const rows = []
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
    const topic = data.topic || file.replace(/\.json$/, '')
    let kept = 0
    for (const e of data.entries || []) {
      const group = GROUP[e.category]
      const bad = !e.slug || !e.name || !group ? 'no slug, name or known category' : (e.qualities || []).find((q) => !QUAL[q] || !(QUAL[q].groups.includes('*') || QUAL[q].groups.includes(group)))
      if (bad) {
        console.log(`  ${topic}: left out ${e.name || e.slug}: ${typeof bad === 'string' && bad.includes(' ') ? bad : `quality ${bad} doesn't fit`}`)
        continue
      }
      const maker = await loads(e.maker_url)
      if (!maker) {
        console.log(`  ${topic}: left out, its page didn't load: ${e.name} (${e.maker_url})`)
        continue
      }
      const links = []
      for (const l of e.buy_links || []) {
        const ok = await loads(l.url)
        if (ok) links.push({ label: String(l.label).slice(0, 80), url: l.url })
        else console.log(`  ${topic}: ${e.name}: dropped a link that didn't load (${l.url})`)
      }
      rows.push({
        name: String(e.name).slice(0, 200),
        brand: e.brand ? String(e.brand).slice(0, 120) : null,
        seller: e.brand ? String(e.brand).slice(0, 120) : null,
        category: e.category,
        description: String(e.description || '').slice(0, 1500),
        qualities: [...new Set(e.qualities || [])],
        quality_values: Object.fromEntries(Object.entries(e.values || {}).filter(([k, v]) => VALUES.has(k) && String(v).trim()).map(([k, v]) => [k, String(v).slice(0, 80)])),
        price: typeof e.price === 'number' ? e.price : null,
        currency: e.currency || 'CAD',
        price_note: e.price_note ? String(e.price_note).slice(0, 200) : null,
        maker_url: e.maker_url,
        buy_links: links,
        community_links: (e.community || []).filter((c) => c?.url).map((c) => ({ label: String(c.label).slice(0, 120), url: c.url })),
        image_urls: [],
        variations: [],
        sensory_details: {},
        status: 'active',
        source_type: 'operator',
        source_ref: `operator:products-${e.slug}`.slice(0, 200),
        last_verified_at: new Date(data.checked || Date.now()).toISOString(),
        import_batch: `products-${topic.replace(/^products_/, '').replace(/_/g, '-')}-2026-10`,
      })
      kept++
    }
    console.log(`${topic}: ${kept} ready`)
  }
  if (!APPLY) {
    console.log(`\n${rows.length} ready. Check only; run with --apply to save.`)
    return
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  let saved = 0
  for (let i = 0; i < rows.length; i += 100) {
    const r = await fetch(`${url}/rest/v1/products?on_conflict=source_ref`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows.slice(i, i + 100)) })
    if (!r.ok) {
      console.error('  failed:', r.status, (await r.text()).slice(0, 300))
      continue
    }
    saved += (await r.json()).length
  }
  console.log(`\nSaved ${saved} products.`)
  if (ARCHIVE_DEMO && (saved !== rows.length || saved === 0)) console.log(`Not archiving the "Demo Seller" placeholders: ${saved} of ${rows.length} saved.`)
  else if (ARCHIVE_DEMO) {
    // The placeholders from before real products (seller "Demo Seller"): archived, not deleted.
    const r = await fetch(`${url}/rest/v1/products?seller=eq.Demo%20Seller&status=eq.active`, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ status: 'archived' }) })
    console.log(r.ok ? `Archived ${(await r.json()).length} "Demo Seller" placeholders.` : `Archiving failed: ${r.status}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
