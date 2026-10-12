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
  tel: string
  /** Shown only where the person may be outside Canada. */
  outsideCanada?: boolean
}

export const CRISIS_LINES: CrisisLine[] = [
  { name: 'Emergency services', how: 'call 911 if you or someone else is in danger now.', tel: '911' },
  { name: '9-8-8 Suicide Crisis Helpline (Canada)', how: 'call or text 9-8-8, any time.', tel: '988' },
  { name: 'Kids Help Phone, for children and young people', how: 'call 1-800-668-6868 or text CONNECT to 686868, any time.', tel: '18006686868' },
  { name: '988 Suicide & Crisis Lifeline (US)', how: 'call or text 988, any time.', tel: '988', outsideCanada: true },
]

/** For Ontario families in the Ontario Autism Program (ontario.ca/page/ontario-autism-program). */
export const OAP_URGENT = {
  name: 'Urgent response services (Ontario Autism Program)',
  how: 'for a child or teen in the program with an immediate need. Ask AccessOAP: 1-833-425-2445.',
  tel: '18334252445',
}

export const NOT_A_CRISIS_SERVICE = 'Autinerary isn’t a crisis service, and nothing in it is medical advice.'
