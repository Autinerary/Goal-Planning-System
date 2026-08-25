import { NextRequest, NextResponse } from 'next/server'

// Server-side proxy — must run per-request, never prerendered.
export const dynamic = 'force-dynamic'

/**
 * POST /api/recommendations
 *
 * Same-origin proxy to ServiceHub's /api/onboarding/complete.
 *
 * The onboarding page used to POST to ServiceHub directly from the browser.
 * That is a cross-origin request with Content-Type: application/json, so the
 * browser sends a CORS preflight — and ServiceHub's route has no CORS headers
 * and no OPTIONS handler, so the request was always blocked. Result: the
 * AI-recommendations step "straight up didn't work" (Odosa).
 *
 * Server-to-server calls aren't subject to CORS, so proxying here fixes it.
 * ServiceHub's endpoint intentionally accepts unauthenticated calls for this
 * Goal-Planning integration, so no credentials are required.
 */
const SERVICE_HUB_URL = (
  process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'
).replace(/\/$/, '')

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const res = await fetch(`${SERVICE_HUB_URL}/api/onboarding/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // ServiceHub may be cold-starting; don't hang onboarding forever.
      signal: AbortSignal.timeout(45000),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok || !data) {
      console.error('[recommendations] ServiceHub returned', res.status)
      return NextResponse.json(
        {
          recommendations: [],
          recommendationExplanation:
            "We couldn't load recommendations just now. You can continue — they'll be waiting in ResourceHub.",
        },
        { status: 200 }
      )
    }

    // Cheapest first (free before paid), then by match score. Chi asked to see
    // free / lower-cost options rather than only paid ones. Unknown price sorts
    // after known-free but before expensive, so nothing is hidden.
    const recs = Array.isArray(data.recommendations) ? [...data.recommendations] : []
    recs.sort((a: any, b: any) => {
      const pa = typeof a?.price === 'number' ? a.price : Number.POSITIVE_INFINITY
      const pb = typeof b?.price === 'number' ? b.price : Number.POSITIVE_INFINITY
      const freeA = pa === 0 ? 0 : 1
      const freeB = pb === 0 ? 0 : 1
      if (freeA !== freeB) return freeA - freeB
      if (pa !== pb) return pa - pb
      return (b?.score || 0) - (a?.score || 0)
    })

    return NextResponse.json({ ...data, recommendations: recs })
  } catch (err) {
    console.error('[recommendations] proxy failed:', err)
    return NextResponse.json(
      {
        recommendations: [],
        recommendationExplanation:
          "We couldn't reach the recommendations service. You can continue — they'll be waiting in ResourceHub.",
      },
      { status: 200 }
    )
  }
}
