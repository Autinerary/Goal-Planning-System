import { NextResponse } from 'next/server'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'

/**
 * The norms search can filter by, grouped, for filter options:
 * [{ category, label, barriers: [{ id, label }] }].
 *
 * From the shared taxonomy (lib/norms/taxonomy.ts), the same list onboarding
 * offers. It used to list every distinct value in user_barriers, read with the
 * service role, so anything anyone had typed as a norm (free text included)
 * was public to anyone who asked (bug audit, 17 November 2026, item 16).
 * "Other (specify)" isn't something to filter by, so it isn't listed.
 */
export async function GET() {
  const formattedCategories = NORM_GROUPS.map((group) => ({
    category: group.key,
    label: group.label,
    barriers: group.norms.filter((n) => !n.id.endsWith('_other')).map((n) => ({ id: n.id, label: n.label })),
  })).filter((group) => group.barriers.length > 0)

  return NextResponse.json(formattedCategories, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  })
}
