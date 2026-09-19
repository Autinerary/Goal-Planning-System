/**
 * Filter vocabularies for ResourceHub (Odosa's expanded sidebar).
 *
 * Single-sourced here because the sidebar, the search API and the submission
 * form all need the same values. When these live in three places they drift,
 * and a filter whose value the API does not recognise silently returns
 * everything — which reads as "the filter is broken".
 */

/** Connection Type to Norm — Odosa's 12 granular types.
 *
 *  `tier` is the existing 4-level relationship weight each maps onto, so the
 *  weighting system is refined rather than forked. Both "undiagnosed" options
 *  weigh as `lived`: assessment is expensive and often inaccessible, so
 *  self-identification is never weighted below a diagnosis here. */
export const CONNECTION_TYPES = [
  { id: 'diagnosed',               label: 'Diagnosed',                           tier: 'lived' },
  { id: 'undiagnosed_identifying', label: 'Undiagnosed & identifying with norm', tier: 'lived' },
  { id: 'undiagnosed_unsure',      label: 'Undiagnosed & unsure',                tier: 'lived' },
  { id: 'parent_guardian',         label: 'Parent / guardian',                   tier: 'direct_support' },
  { id: 'sibling',                 label: 'Sibling',                             tier: 'direct_support' },
  { id: 'caretaker',               label: 'Caretaker',                           tier: 'direct_support' },
  { id: 'educator',                label: 'Educator',                            tier: 'indirect_support' },
  { id: 'employer',                label: 'Employer',                            tier: 'indirect_support' },
  { id: 'coworker',                label: 'Coworker',                            tier: 'indirect_support' },
  { id: 'therapist',               label: 'Therapist',                           tier: 'indirect_support' },
  { id: 'researcher',              label: 'Researcher',                          tier: 'indirect_support' },
  { id: 'ally',                    label: 'Ally',                                tier: 'ally' },
] as const

export type ConnectionTypeId = (typeof CONNECTION_TYPES)[number]['id']

/** Age bands a resource serves. */
export const AGE_RANGES = [
  { id: 'babies_0_4',         label: 'Babies (0-4)' },
  { id: 'children_5_8',       label: 'Children (5-8)' },
  { id: 'preteens_9_12',      label: 'Pre-teens (9-12)' },
  { id: 'teens_13_17',        label: 'Teens under 18 (13-17)' },
  { id: 'young_adults_18_30', label: 'Young adults (18-30)' },
  { id: 'adults_30_45',       label: 'Adults (30-45)' },
  { id: 'adults_45_65',       label: 'Adults (45-65)' },
  { id: 'seniors_65_plus',    label: 'Seniors (65+)' },
] as const

export type AgeRangeId = (typeof AGE_RANGES)[number]['id']

/** Trending tiers. Sustained interest is the rarer achievement, so the
 *  year-long tier is platinum rather than the daily one. */
export const TRENDING_TIERS = [
  { id: 'bronze',   label: 'Trending today',      className: 'bg-gradient-to-r from-amber-700 via-orange-400 to-amber-700 text-white' },
  { id: 'silver',   label: 'Trending this week',  className: 'bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 text-slate-900' },
  { id: 'gold',     label: 'Trending this month', className: 'bg-gradient-to-r from-yellow-600 via-yellow-200 to-yellow-600 text-yellow-950' },
  { id: 'platinum', label: 'Trending this year',  className: 'bg-gradient-to-r from-cyan-200 via-white to-cyan-200 text-slate-900' },
] as const

export type TrendingTierId = (typeof TRENDING_TIERS)[number]['id']

/** Special Tags. `first_party` is the gradient "Autinerary's Own" badge and is
 *  admin-set only — a self-applied official badge is worth nothing. */
export const SPECIAL_TAGS = [
  {
    id: 'first_party',
    label: "Autinerary's Own",
    className: 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold',
  },
  { id: 'rare',             label: 'Rare',             className: 'bg-indigo-100 text-indigo-800' },
  { id: 'highly_requested', label: 'Highly requested', className: 'bg-rose-100 text-rose-800' },
] as const

export type SpecialTagId = (typeof SPECIAL_TAGS)[number]['id']

/** Commentary provenance, grouped the way Odosa listed them. */
export const SOURCE_TYPE_GROUPS = [
  { label: 'News', options: [{ id: 'news', label: 'News' }] },
  {
    label: 'Social media',
    options: [
      { id: 'reddit',   label: 'Reddit' },
      { id: 'twitter',  label: 'Twitter / X' },
      { id: 'facebook', label: 'Facebook' },
    ],
  },
  {
    label: 'Videos',
    options: [
      { id: 'youtube',   label: 'YouTube' },
      { id: 'tiktok',    label: 'TikTok' },
      { id: 'instagram', label: 'Instagram' },
    ],
  },
  { label: 'Autinerary', options: [{ id: 'tidbits', label: 'Tidbits' }] },
] as const

export const SOURCE_TYPES = SOURCE_TYPE_GROUPS.flatMap((g) => g.options as readonly { id: string; label: string }[])
export type SourceTypeId = string

/** Validate an incoming filter value against its vocabulary. The API uses
 *  these so a crafted request cannot smuggle an arbitrary string into a query. */
export const isConnectionType = (v: string) => CONNECTION_TYPES.some((c) => c.id === v)
export const isAgeRange = (v: string) => AGE_RANGES.some((a) => a.id === v)
export const isSpecialTag = (v: string) => SPECIAL_TAGS.some((t) => t.id === v)
export const isSourceType = (v: string) => SOURCE_TYPES.some((s) => s.id === v)


/** Therapy sub-types (Odosa: "change Therapist to Therapy, and add dropdowns
 *  for types of Therapy ... take from the Autism Services dropdowns on our
 *  site").
 *
 *  These eight are the categories actually published on
 *  autinerary.ca/learning/general-service-info. Odosa also asked for the
 *  bolded items *under* each one as a third layer — those are rendered
 *  client-side on that page and were not retrievable, so they are
 *  deliberately absent rather than invented. Adding a made-up list of
 *  specific therapies under "Behavioural" would be exactly the kind of
 *  confident-looking clinical misinformation we agreed not to ship. */
export const THERAPY_TYPES = [
  { id: 'behavioural',      label: 'Behavioural' },
  { id: 'developmental',    label: 'Developmental' },
  { id: 'educational',      label: 'Educational' },
  { id: 'nutritional',      label: 'Nutritional' },
  { id: 'pharmacological',  label: 'Pharmacological' },
  { id: 'psychological',    label: 'Psychological' },
  { id: 'social_relational',label: 'Social-Relational' },
  { id: 'therapy_other',    label: 'Other' },
] as const

/** Provider types, also from the Learning page. Distinct from therapy TYPE:
 *  "who delivers it" is a different question from "what kind it is". */
export const THERAPY_PROVIDERS = [
  { id: 'bcba',              label: 'BCBA (Board Certified Behaviour Analyst)' },
  { id: 'ot',                label: 'OT (Occupational Therapist)' },
  { id: 'slp',               label: 'SLP (Speech Language Pathologist)' },
  { id: 'early_intervention',label: 'Early Interventionist' },
  { id: 'educational_therapist', label: 'Educational Therapist' },
  { id: 'pediatrician',      label: 'Pediatrician' },
  { id: 'non_autism_specific', label: 'Non autism-specific professional' },
] as const

export const isTherapyType = (v: string) => THERAPY_TYPES.some((t) => t.id === v)
