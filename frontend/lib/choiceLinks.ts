import { createHmac, timingSafeEqual } from 'crypto'

/**
 * The vote links in the newsletter's last edition of a month (Community's
 * Choice, Goal 5). Server-only. Each carries who votes (u:<account> or
 * s:<newsletter subscriber>), the month, and a signature made with a
 * server-only secret, so a link cannot be made for someone else. A link only
 * opens the vote; voting is a button on the page (a mail app opening the
 * link does nothing).
 */

const VOTER = /^(u|s):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

function key(): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', 'autinerary-choice-vote-v1').update(secret).digest()
}

export function voteSignature(voter: string, month: string): string {
  return createHmac('sha256', key()).update(`${voter}|${month}`).digest('base64url')
}

export function voteSignatureMatches(voter: unknown, month: unknown, signature: unknown): boolean {
  try {
    if (!VOTER.test(String(voter || '')) || !MONTH.test(String(month || ''))) return false
    const expected = Buffer.from(voteSignature(String(voter).toLowerCase(), String(month)))
    const given = Buffer.from(String(signature || ''))
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}

export function voteLink(appUrl: string, voter: string, month: string): string {
  const v = voter.toLowerCase()
  return `${appUrl.replace(/\/$/, '')}/community-choice?v=${encodeURIComponent(v)}&m=${month}&t=${encodeURIComponent(voteSignature(v, month))}`
}
