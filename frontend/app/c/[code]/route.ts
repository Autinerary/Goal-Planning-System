import { NextRequest, NextResponse } from 'next/server'
import { campaignTarget } from '@/lib/campaign'

/**
 * GET /c/<code>: a campaign short link (lib/campaign.ts), e.g. /c/comic.
 * Redirects to Start here with the campaign's tracking. An unknown code still
 * lands on Start here, so a mistyped link is never a dead end.
 */
export function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = String(params.code || '').toLowerCase()
  return NextResponse.redirect(new URL(campaignTarget(code), req.nextUrl.origin), 307)
}
