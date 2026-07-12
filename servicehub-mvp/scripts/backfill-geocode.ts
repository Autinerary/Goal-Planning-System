/**
 * Backfill geocoding for existing profiles.
 *
 * Profiles created before onboarding geocoding shipped have a location with
 * lat/lng of 0,0 (or missing), so the ResourceHub "nearest to you" distance
 * features don't work for them. This one-shot script geocodes each such
 * profile's city/province/country to real coordinates and writes them back.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/backfill-geocode.ts
 *
 *   Add `--dry` to preview without writing.
 *
 * Nominatim policy: max 1 req/sec — this script sleeps 1.1s between lookups.
 */

import { createClient } from '@supabase/supabase-js'
import { geocodeLocation } from '../lib/geocode'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
}

const DRY_RUN = process.argv.includes('--dry')

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function needsCoords(loc: any): boolean {
  if (!loc || typeof loc !== 'object') return false
  const hasText = Boolean((loc.city || '').trim() || (loc.province || '').trim() || (loc.country || '').trim())
  const hasCoords = Number(loc.lat) !== 0 && Number(loc.lng) !== 0 && loc.lat != null && loc.lng != null
  return hasText && !hasCoords
}

async function main() {
  console.log(`\nBackfill geocoding${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, location')

  if (error) {
    console.error('Failed to load profiles:', error.message)
    process.exit(1)
  }

  const targets = (profiles || []).filter((p) => needsCoords(p.location))
  console.log(`${profiles?.length ?? 0} profiles total, ${targets.length} need geocoding.\n`)

  let updated = 0
  let skipped = 0

  for (const p of targets) {
    const loc: any = p.location
    const label = [loc.city, loc.province, loc.country].filter(Boolean).join(', ')
    const coords = await geocodeLocation({ city: loc.city, province: loc.province, country: loc.country })

    if (!coords) {
      console.log(`  ✗ ${label} — no result, skipped`)
      skipped++
      await sleep(1100)
      continue
    }

    console.log(`  ✓ ${label} -> ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`)

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ location: { ...loc, lat: coords.lat, lng: coords.lng } })
        .eq('id', p.id)
      if (upErr) {
        console.log(`     ! write failed: ${upErr.message}`)
        skipped++
      } else {
        updated++
      }
    } else {
      updated++
    }

    // Respect Nominatim's 1 req/sec limit.
    await sleep(1100)
  }

  console.log(`\nDone. ${updated} ${DRY_RUN ? 'would be updated' : 'updated'}, ${skipped} skipped.\n`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
