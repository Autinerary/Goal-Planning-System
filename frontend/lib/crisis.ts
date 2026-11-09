/**
 * Who to call when things are really hard right now: one list, used by the
 * glossary's "Talk to someone now", Start here's and setup's "Help right now",
 * and the starter kits. The goal helper's lines are the same
 * (backend/core/goal_helper.py, CRISIS).
 *
 * Riipen Labs, Group 24 (September 2026): "Immediate Need: Diagnosis
 * Navigator vs. School IEP vs. Crisis Support". Kids Help Phone was added for
 * parents whose child needs to talk to someone. Plain data, no imports.
 */

export interface CrisisLine {
  name: string
  /** What to do, in words, with the number. */
  how: string
  /** The number to dial, for a tel: link. */
  tel?: string
  /** The number to text, for an sms: link, and the word to send. Text comes first: many autistic people find a
   *  phone call the hardest way to reach out (9 November 2026). */
  sms?: string
  smsBody?: string
  /** Shown only where the person may be outside Canada. */
  outsideCanada?: boolean
}

export const CRISIS_LINES: CrisisLine[] = [
  { name: 'Emergency services', how: 'call 911 if you or someone else is in danger now.', tel: '911' },
  { name: '9-8-8 Suicide Crisis Helpline (Canada)', how: 'text or call 9-8-8, any time.', tel: '988', sms: '988' },
  // good2talk.ca/ontario, checked 9 November 2026.
  { name: 'Good2Talk, for college and university students in Ontario', how: 'text GOOD2TALKON to 686868, or call 1-866-925-5454, any time.', tel: '18669255454', sms: '686868', smsBody: 'GOOD2TALKON' },
  { name: 'Kids Help Phone, for children and young people', how: 'text CONNECT to 686868, or call 1-800-668-6868, any time.', tel: '18006686868', sms: '686868', smsBody: 'CONNECT' },
  { name: '988 Suicide & Crisis Lifeline (US)', how: 'text or call 988, any time.', tel: '988', sms: '988', outsideCanada: true },
]

/** An sms: link that opens the phone's messages with the number, and the word to send, filled in. "?&body=" is the
 *  form both iPhones and Android phones read. */
export function smsHref(to: string, body?: string): string {
  return `sms:${to}${body ? `?&body=${encodeURIComponent(body)}` : ''}`
}

/** "Message someone you trust": words to start with, sent by the person from their own phone or email, to whoever
 *  they choose. Writing the first words is often the hardest part. Autinerary doesn't send or keep it. */
export const REACH_OUT_MESSAGE = 'I’m having a really hard time right now. Could you call or text me when you can?'
export const reachOutSmsHref = (message: string): string => `sms:?&body=${encodeURIComponent(message)}`
export const reachOutMailHref = (message: string): string =>
  `mailto:?subject=${encodeURIComponent('Can we talk?')}&body=${encodeURIComponent(message)}`

/** For Ontario families in the Ontario Autism Program (ontario.ca/page/ontario-autism-program). */
export const OAP_URGENT = {
  name: 'Urgent response services (Ontario Autism Program)',
  how: 'for a child or teen in the program with an immediate need. Ask AccessOAP: 1-833-425-2445.',
  tel: '18334252445',
}

export const NOT_A_CRISIS_SERVICE = 'Autinerary isn’t a crisis service, and nothing in it is medical advice.'
