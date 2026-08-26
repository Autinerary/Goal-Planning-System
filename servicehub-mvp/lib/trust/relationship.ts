/**
 * Relationship weighting — "whose experience is this?" (Odosa).
 *
 * We don't try to PROVE identity. Documents are forgeable (AI image editing
 * made that trivial), facial recognition is defeatable and inappropriate for
 * these categories, and demanding proof would exclude the undiagnosed and
 * self-diagnosed — the people this product exists for.
 *
 * Instead, relationship is declared and weighted openly. Everyone can
 * contribute; lived experience simply carries the most weight, and the mix is
 * always shown so readers can judge for themselves.
 */

export type Relationship = 'lived' | 'direct_support' | 'indirect_support' | 'ally'

export const RELATIONSHIP_WEIGHT: Record<Relationship, number> = {
  lived: 1.0,
  direct_support: 0.6,
  indirect_support: 0.35,
  ally: 0.15,
}

export const RELATIONSHIP_META: Record<
  Relationship,
  { label: string; short: string; description: string; className: string }
> = {
  lived: {
    label: 'Lived experience',
    short: 'Lived',
    description: 'This person has this norm themselves.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  direct_support: {
    label: 'Direct support',
    short: 'Family',
    description: 'A parent, sibling, or partner who shares daily life with someone who has this norm.',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  indirect_support: {
    label: 'Professional support',
    short: 'Professional',
    description: 'An educator, therapist, employer, or researcher who works with people who have this norm.',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ally: {
    label: 'Ally',
    short: 'Ally',
    description: 'A supporter without a direct connection to this norm.',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

/**
 * Goal Planning onboarding already asks this via `connectionTypes`. Map those
 * answers onto the four proximity tiers so both apps agree.
 */
const CONNECTION_TO_RELATIONSHIP: Record<string, Relationship> = {
  self: 'lived',
  parent: 'direct_support',
  sibling: 'direct_support',
  partner: 'direct_support',
  educator: 'indirect_support',
  employer: 'indirect_support',
  therapist: 'indirect_support',
  researcher: 'indirect_support',
  medical: 'indirect_support',
  ally: 'ally',
}

export function relationshipFromConnection(connectionType: string | null | undefined): Relationship {
  if (!connectionType) return 'lived'
  return CONNECTION_TO_RELATIONSHIP[connectionType.trim().toLowerCase()] || 'ally'
}

export function weightFor(relationship: string | null | undefined): number {
  if (!relationship) return RELATIONSHIP_WEIGHT.lived
  const r = relationship as Relationship
  return RELATIONSHIP_WEIGHT[r] ?? RELATIONSHIP_WEIGHT.lived
}

/** Order used when displaying a mix of relationships. */
export const RELATIONSHIP_ORDER: Relationship[] = [
  'lived',
  'direct_support',
  'indirect_support',
  'ally',
]
