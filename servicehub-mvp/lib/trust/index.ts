/**
 * Rater trust & norm verification (Odosa).
 *
 * We deliberately do NOT collect diagnosis documents — see
 * scripts/2026_rater_trust.sql for the reasoning. Norms are self-identified by
 * default and labelled as such; credibility is earned from real behaviour.
 */

export type VerificationMethod = 'self' | 'peer' | 'professional'
export type TrustTier = 'new' | 'contributing' | 'trusted' | 'established'

export interface RaterTrust {
  ratingsCount: number
  helpfulTotal: number
  karma: number
  tier: TrustTier
}

export const TRUST_META: Record<
  TrustTier,
  { label: string; description: string; className: string }
> = {
  new: {
    label: 'New rater',
    description: 'Just getting started — no ratings yet.',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  contributing: {
    label: 'Contributing rater',
    description: 'Has started rating resources.',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  trusted: {
    label: 'Trusted rater',
    description: 'Several ratings that others found helpful.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  established: {
    label: 'Established rater',
    description: 'A long track record of ratings others rely on.',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
}

/** How a norm was verified. 'self' is the honest default, not a failure state. */
export const VERIFICATION_META: Record<
  VerificationMethod,
  { label: string; description: string; className: string }
> = {
  self: {
    label: 'Self-identified',
    description:
      'This person identifies with this norm. Many people are undiagnosed or self-diagnosed because assessment is expensive or inaccessible — self-identification is valid here.',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  peer: {
    label: 'Peer-vouched',
    description: 'Other members who share this norm have vouched for this person.',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  professional: {
    label: 'Professionally verified',
    description:
      'A clinician or support worker confirmed this. We store only that it happened — never the document or any diagnosis details.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
}

/** Tiers considered credible enough to highlight in aggregate breakdowns. */
export function isTrusted(tier: TrustTier): boolean {
  return tier === 'trusted' || tier === 'established'
}
