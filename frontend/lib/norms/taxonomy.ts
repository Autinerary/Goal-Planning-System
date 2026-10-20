/**
 * ResourceHub's norms (servicehub-mvp/lib/norms/taxonomy.ts), kept the same
 * here so the Path Market filters norms the way ResourceHub does. CI checks
 * the two copies match:  node scripts/qa/check-sponsored.mjs
 */

export interface NormOption {
  id: string
  label: string
}

export interface NormGroup {
  key: string
  label: string
  norms: NormOption[]
}

export const NORM_GROUPS: NormGroup[] = [
  {
    key: 'neurodivergence',
    label: 'Neurodivergence',
    norms: [
      { id: 'autism', label: 'Autism Spectrum' },
      { id: 'adhd', label: 'ADHD' },
      { id: 'ocd', label: 'OCD' },
      { id: 'bipolar', label: 'Bipolar Disorder' },
      { id: 'neurodivergence_other', label: 'Other (specify)' },
    ],
  },
  {
    key: 'disability',
    label: 'Non-Neurodivergent Disabilities',
    norms: [
      { id: 'sensory_deaf', label: 'Deaf or Hard of Hearing' },
      { id: 'sensory_blind', label: 'Blind or Low Vision' },
      { id: 'physical_wheelchair', label: 'Wheelchair User' },
      { id: 'physical_mobility', label: 'Mobility Challenges' },
      { id: 'intellectual', label: 'Intellectual Disabilities' },
      { id: 'disability_other', label: 'Other (specify)' },
    ],
  },
  {
    key: 'identity',
    label: 'Identity & Background',
    norms: [
      { id: 'race_visible_minority', label: 'Race/Visible Minority' },
      { id: 'ethnicity', label: 'Ethnicity' },
      { id: 'language', label: 'Primary Language' },
      { id: 'gender', label: 'Gender Identity' },
      { id: 'lgbtq', label: 'LGBTQ+' },
      { id: 'socioeconomic', label: 'Socioeconomic Considerations' },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    norms: [
      { id: 'chronic_health', label: 'Chronic Health Conditions' },
      { id: 'mental_health', label: 'Mental Health Considerations' },
      // Named explicitly rather than folded into 'mental_health' generally —
      // Odosa asked for both by name, matching how 'bipolar' already gets
      // its own entry instead of hiding under a broader label.
      { id: 'depression', label: 'Depression' },
      { id: 'substance_use', label: 'Substance Use / Recovery' },
      { id: 'healthy_eating', label: 'Healthy Options / Eating Healthy' },
      { id: 'veganism', label: 'Veganism' },
    ],
  },
]

/** Groups shown in the search filter. Neurodivergence is excluded there — the
 *  Neurodevelopmental Conditions taxonomy replaces it (Odosa). "Other (specify)"
 *  options are onboarding-only; they aren't useful as filters. */
export const FILTER_NORM_GROUPS: NormGroup[] = NORM_GROUPS.filter(
  (g) => g.key !== 'neurodivergence'
).map((g) => ({ ...g, norms: g.norms.filter((n) => !n.id.endsWith('_other')) }))
