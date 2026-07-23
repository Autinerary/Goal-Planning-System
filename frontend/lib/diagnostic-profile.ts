export type DiagnosticStatus =
  | 'diagnosed'
  | 'self_identified'
  | 'exploring'
  | 'prefer_not_to_say'

export interface ConditionResponse {
  conditionId: string
  conditionLabel: string
  status: DiagnosticStatus
  subtypeIds: string[]
  notes: string
}

export interface SupportContext {
  therapyHours: string
  therapyTypes: string
  medicationHistory: '' | 'yes' | 'no' | 'prefer_not_to_say'
  sensoryNeeds: string
  strategiesWorked: string
  strategiesNotWorked: string
  schoolAccommodations: string
  workplaceAccommodations: string
  biggestChallenge: string
  biggestChallengeResponse: string
  recentChallenge: string
  recentChallengeResponse: string
}

export interface DiagnosticProfile {
  version: 1
  consentToStore: boolean
  conditions: ConditionResponse[]
  supportContext: SupportContext
}

/**
 * Functional context that may be sent to recommendation/path agents after
 * explicit consent. Clinical status, subtypes, and medication history are
 * deliberately excluded: agents need to know what support helps, not assess
 * or infer a diagnosis.
 */
export interface RecommendationSupportContext {
  conditionSupportNotes: string[]
  therapyTypes: string
  sensoryNeeds: string
  strategiesWorked: string
  strategiesNotWorked: string
  schoolAccommodations: string
  workplaceAccommodations: string
  biggestChallenge: string
  biggestChallengeResponse: string
  recentChallenge: string
  recentChallengeResponse: string
}

export interface ConditionOption {
  id: string
  label: string
  subtypes?: Array<{ id: string; label: string; description?: string }>
  notesPrompt?: string
}

export interface ConditionGroup {
  id: string
  label: string
  conditions: ConditionOption[]
}

export const EMPTY_SUPPORT_CONTEXT: SupportContext = {
  therapyHours: '',
  therapyTypes: '',
  medicationHistory: '',
  sensoryNeeds: '',
  strategiesWorked: '',
  strategiesNotWorked: '',
  schoolAccommodations: '',
  workplaceAccommodations: '',
  biggestChallenge: '',
  biggestChallengeResponse: '',
  recentChallenge: '',
  recentChallengeResponse: '',
}

export const EMPTY_DIAGNOSTIC_PROFILE: DiagnosticProfile = {
  version: 1,
  consentToStore: false,
  conditions: [],
  supportContext: { ...EMPTY_SUPPORT_CONTEXT },
}

/** Build the bounded, non-clinical context used to personalize AI output. */
export function toRecommendationSupportContext(
  profile: DiagnosticProfile
): RecommendationSupportContext | undefined {
  if (!profile.consentToStore) return undefined

  const support = profile.supportContext
  const context: RecommendationSupportContext = {
    conditionSupportNotes: profile.conditions
      .map((condition) => condition.notes.trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, 20),
    therapyTypes: support.therapyTypes.trim().slice(0, 1000),
    sensoryNeeds: support.sensoryNeeds.trim().slice(0, 1000),
    strategiesWorked: support.strategiesWorked.trim().slice(0, 1000),
    strategiesNotWorked: support.strategiesNotWorked.trim().slice(0, 1000),
    schoolAccommodations: support.schoolAccommodations.trim().slice(0, 1000),
    workplaceAccommodations: support.workplaceAccommodations.trim().slice(0, 1000),
    biggestChallenge: support.biggestChallenge.trim().slice(0, 1000),
    biggestChallengeResponse: support.biggestChallengeResponse.trim().slice(0, 1000),
    recentChallenge: support.recentChallenge.trim().slice(0, 1000),
    recentChallengeResponse: support.recentChallengeResponse.trim().slice(0, 1000),
  }

  return context.conditionSupportNotes.length > 0 ||
    Object.entries(context).some(([key, value]) => key !== 'conditionSupportNotes' && Boolean(value))
    ? context
    : undefined
}

const preferNotToSpecify = { id: 'prefer_not_to_specify', label: 'Prefer not to specify' }

export const CONDITION_GROUPS: ConditionGroup[] = [
  {
    id: 'neurodevelopmental',
    label: 'Neurodevelopmental conditions',
    conditions: [
      {
        id: 'autism',
        label: 'Autism spectrum disorder',
        subtypes: [
          { id: 'level_1', label: 'Level 1', description: 'Needs support with social communication, flexibility, or organization.' },
          { id: 'level_2', label: 'Level 2', description: 'Needs substantial support with communication and adapting to change.' },
          { id: 'level_3', label: 'Level 3', description: 'Needs very substantial support with communication and daily living.' },
          preferNotToSpecify,
        ],
        notesPrompt: 'Optional: communication preferences, stims, focused interests, or support needs',
      },
      {
        id: 'adhd',
        label: 'ADHD',
        subtypes: [
          { id: 'inattentive', label: 'Predominantly inattentive' },
          { id: 'hyperactive_impulsive', label: 'Predominantly hyperactive-impulsive' },
          { id: 'combined', label: 'Combined presentation' },
          preferNotToSpecify,
        ],
        notesPrompt: 'Optional: hyperfixations, helpful strategies, or support needs',
      },
      { id: 'intellectual_disability', label: 'Intellectual disability' },
      { id: 'developmental_coordination_disorder', label: 'Developmental coordination disorder' },
      { id: 'tic_disorders', label: 'Tic disorders' },
      { id: 'tourette_syndrome', label: 'Tourette syndrome' },
      { id: 'communication_disorders', label: 'Communication disorders' },
    ],
  },
  {
    id: 'learning_differences',
    label: 'Specific learning differences',
    conditions: [
      { id: 'dyslexia', label: 'Dyslexia' },
      { id: 'dyscalculia', label: 'Dyscalculia' },
      { id: 'dysgraphia', label: 'Dysgraphia' },
      { id: 'nonverbal_learning_disorder', label: 'Nonverbal learning disorder' },
      { id: 'written_expression_disorder', label: 'Written expression disorder' },
      { id: 'reading_disorder', label: 'Reading disorder' },
      { id: 'mathematics_disorder', label: 'Mathematics disorder' },
    ],
  },
  {
    id: 'sensory_differences',
    label: 'Sensory differences',
    conditions: [
      { id: 'synesthesia', label: 'Synesthesia', subtypes: [{ id: 'multiple', label: 'Multiple types' }, preferNotToSpecify] },
      { id: 'sensory_processing_differences', label: 'Sensory processing differences' },
      { id: 'misophonia', label: 'Misophonia' },
      { id: 'hyperacusis', label: 'Hyperacusis' },
      { id: 'auditory_processing_disorder', label: 'Auditory processing disorder' },
    ],
  },
  {
    id: 'psychiatric',
    label: 'Psychiatric conditions',
    conditions: [
      { id: 'anxiety_disorders', label: 'Anxiety disorders', subtypes: [
        { id: 'generalized_anxiety', label: 'Generalized anxiety' },
        { id: 'social_anxiety', label: 'Social anxiety' },
        { id: 'panic_disorder', label: 'Panic disorder' },
        { id: 'phobias', label: 'Phobias' },
        preferNotToSpecify,
      ] },
      { id: 'mood_disorders', label: 'Mood disorders', subtypes: [
        { id: 'major_depressive_disorder', label: 'Major depressive disorder' },
        { id: 'persistent_depressive_disorder', label: 'Persistent depressive disorder' },
        { id: 'cyclothymia', label: 'Cyclothymia' },
        preferNotToSpecify,
      ] },
      { id: 'ocd_related', label: 'Obsessive-compulsive and related conditions', subtypes: [
        { id: 'ocd', label: 'OCD' },
        { id: 'primarily_obsessional', label: 'Primarily obsessional OCD' },
        { id: 'contamination', label: 'Contamination-related OCD' },
        { id: 'relationship', label: 'Relationship OCD' },
        { id: 'body_dysmorphic_disorder', label: 'Body dysmorphic disorder' },
        { id: 'hoarding_disorder', label: 'Hoarding disorder' },
        preferNotToSpecify,
      ], notesPrompt: 'Optional: themes, triggers, or supports that help' },
      { id: 'trauma_related', label: 'Trauma-related conditions', subtypes: [
        { id: 'ptsd', label: 'PTSD' },
        { id: 'complex_ptsd', label: 'Complex PTSD' },
        preferNotToSpecify,
      ] },
      { id: 'psychotic_disorders', label: 'Psychotic disorders', subtypes: [
        { id: 'schizophrenia', label: 'Schizophrenia' },
        { id: 'schizoaffective_disorder', label: 'Schizoaffective disorder' },
        { id: 'delusional_disorder', label: 'Delusional disorder' },
        preferNotToSpecify,
      ] },
    ],
  },
  {
    id: 'personality_disorders',
    label: 'Personality disorders',
    conditions: [
      { id: 'cluster_a', label: 'Cluster A', subtypes: [
        { id: 'paranoid', label: 'Paranoid personality disorder' },
        { id: 'schizoid', label: 'Schizoid personality disorder' },
        { id: 'schizotypal', label: 'Schizotypal personality disorder' },
        preferNotToSpecify,
      ] },
      { id: 'cluster_b', label: 'Cluster B', subtypes: [
        { id: 'borderline', label: 'Borderline personality disorder' },
        { id: 'narcissistic', label: 'Narcissistic personality disorder' },
        { id: 'histrionic', label: 'Histrionic personality disorder' },
        { id: 'antisocial', label: 'Antisocial personality disorder' },
        preferNotToSpecify,
      ] },
      { id: 'cluster_c', label: 'Cluster C', subtypes: [
        { id: 'avoidant', label: 'Avoidant personality disorder' },
        { id: 'dependent', label: 'Dependent personality disorder' },
        { id: 'obsessive_compulsive_personality', label: 'Obsessive-compulsive personality disorder' },
        preferNotToSpecify,
      ] },
    ],
  },
  {
    id: 'sensory_disabilities',
    label: 'Sensory disabilities',
    conditions: [
      { id: 'vision_disability', label: 'Vision disability', subtypes: [{ id: 'blind', label: 'Blind' }, { id: 'low_vision', label: 'Low vision' }, preferNotToSpecify] },
      { id: 'hearing_disability', label: 'Hearing disability', subtypes: [{ id: 'deaf', label: 'Deaf' }, { id: 'hard_of_hearing', label: 'Hard of hearing' }, preferNotToSpecify] },
      { id: 'speech_disability', label: 'Speech disability' },
    ],
  },
  {
    id: 'communication_differences',
    label: 'Communication differences',
    conditions: [
      { id: 'aac_user', label: 'AAC user' },
      { id: 'nonspeaking', label: 'Nonspeaking' },
      { id: 'selectively_speaking', label: 'Selectively speaking' },
      { id: 'stutter', label: 'Stutter' },
      { id: 'other_communication_difference', label: 'Other communication difference' },
    ],
  },
  {
    id: 'chronic_and_mobility',
    label: 'Chronic illness, pain, and mobility',
    conditions: [
      { id: 'ehlers_danlos_syndrome', label: 'Ehlers-Danlos syndrome' },
      { id: 'fibromyalgia', label: 'Fibromyalgia' },
      { id: 'me_cfs', label: 'ME/CFS' },
      { id: 'arthritis', label: 'Arthritis' },
      { id: 'other_chronic_pain', label: 'Other chronic pain condition' },
      { id: 'wheelchair_user', label: 'Wheelchair user' },
      { id: 'limb_difference', label: 'Limb difference' },
      { id: 'cerebral_palsy', label: 'Cerebral palsy' },
      { id: 'muscular_dystrophy', label: 'Muscular dystrophy' },
    ],
  },
  {
    id: 'genetic_and_rare',
    label: 'Genetic and rare conditions',
    conditions: [
      { id: 'down_syndrome', label: 'Down syndrome' },
      { id: 'fragile_x_syndrome', label: 'Fragile X syndrome' },
      { id: 'williams_syndrome', label: 'Williams syndrome' },
      { id: 'turner_syndrome', label: 'Turner syndrome' },
      { id: 'klinefelter_syndrome', label: 'Klinefelter syndrome' },
      { id: '22q11_deletion_syndrome', label: '22q11.2 deletion syndrome' },
      { id: 'other_rare_or_genetic', label: 'Other rare or genetic condition' },
    ],
  },
  {
    id: 'other_disabilities',
    label: 'Other disabilities and health conditions',
    conditions: [
      { id: 'acquired_brain_injury', label: 'Acquired brain injury' },
      { id: 'epilepsy', label: 'Epilepsy' },
      { id: 'autoimmune_condition', label: 'Autoimmune condition' },
      { id: 'language_disorder', label: 'Language disorder' },
      { id: 'sleep_disorder', label: 'Sleep disorder' },
      { id: 'cognitive_disability', label: 'Cognitive disability' },
      { id: 'other_condition', label: 'Another condition or disability' },
    ],
  },
]

export const CONDITION_BY_LABEL = new Map(
  CONDITION_GROUPS.flatMap((group) => group.conditions).map((condition) => [condition.label.toLowerCase(), condition])
)

export const STATUS_OPTIONS: Array<{ id: DiagnosticStatus; label: string }> = [
  { id: 'diagnosed', label: 'Professionally diagnosed' },
  { id: 'self_identified', label: 'Self-identified' },
  { id: 'exploring', label: 'Exploring / unsure' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
]
