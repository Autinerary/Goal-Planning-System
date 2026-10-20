import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tagLabel } from '@/lib/filters/tags'
import { labelsFor, type ResourceLabels } from '@/lib/resourceLabels'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/resources/labels?ids=<uuid>,<uuid>
 *
 * ResourceHub's labels for up to 20 listings, for the tools on a milestone
 * (lib/resourceLabels.ts): the kind and type of listing, its tags, free or
 * paid, ages, and the norms people rated it for. Only what ResourceHub shows
 * anyone: approved listings, and from ratings only how often each norm was
 * scored, never who rated.
 */
export async function GET(req: NextRequest) {
  const ids = Array.from(new Set((req.nextUrl.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s)))).slice(0, 20)
  if (!ids.length) return NextResponse.json({ labels: {} })
  const admin = createAdminClient()
  const [{ data: rows }, { data: ratings }] = await Promise.all([
    admin.from('resources').select('id, category, tags, cost_type, price, age_ranges').eq('status', 'approved').in('id', ids),
    admin.from('ratings').select('resource_id, barrier_scores').in('resource_id', ids).limit(2000),
  ])
  const norms = new Map<string, Record<string, number>>()
  for (const r of ratings || []) {
    const counts = norms.get(r.resource_id) || {}
    for (const key of Object.keys((r.barrier_scores as Record<string, unknown>) || {})) counts[key] = (counts[key] || 0) + 1
    norms.set(r.resource_id, counts)
  }
  const labels: Record<string, ResourceLabels> = {}
  for (const row of rows || []) labels[row.id] = labelsFor(row, norms.get(row.id), tagLabel)
  return NextResponse.json({ labels }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
